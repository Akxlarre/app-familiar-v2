// La corrida de captura, en un solo lugar.
//
// La ejecutan DOS caminos con permisos distintos: `process-bank-emails`, que la
// dispara el cron con service role para todas las casillas, y `procesar-ahora`,
// que la dispara el usuario para la suya al terminar el onboarding (spec 0004,
// AC10). Tenerla dos veces sería tener dos versiones del pedazo más frágil del
// sistema, y el día que difieran nadie se entera: las dos "funcionan".
//
// Lo que cambia entre ambos caminos son tres cosas y son parámetros: a qué
// hogar mirar, cuántos correos y cuántos días hacia atrás.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CredencialesGoogle,
  ErrorDeGmail,
  correoDeLaCuenta,
  leerMensaje,
  listarMensajes,
  necesitaRefresco,
  refrescarToken,
} from './gmail.ts';
import { elegirParser, extraerDatos, fechaEnZona } from './parseo.ts';
import { motivoDeFaltante, motivoSeguro } from './capturas.ts';

/** Tope conservador: la función tiene límite de tiempo y Gmail cobra cuota. */
export const MAX_CORREOS_POR_CORRIDA = 10;

/** Lo que mira el cron. La primera corrida mira más hacia atrás (spec 0004). */
export const DIAS_ATRAS = 90;

/**
 * La primera corrida del onboarding busca 180 días.
 *
 * El paso 4 necesita algo que mostrar: con 90 días, quien conecta el correo en
 * enero después de las fiestas puede encontrarse con una pantalla vacía y creer
 * que la app no funciona.
 */
export const DIAS_ATRAS_PRIMERA = 180;

export interface OpcionesDeCorrida {
  /** Sólo este hogar. Sin esto, todas las integraciones activas (el cron). */
  householdId?: string;
  maximo?: number;
  diasAtras?: number;
}

export interface ResultadoDeCorrida {
  capturadas: number;
  movimientos: number;
  /** Por qué no se hizo nada, cuando no se hizo nada. */
  motivo: string | null;
}

interface Integracion {
  id: string;
  profile_id: string;
  household_id: string;
  email: string;
  carpeta: string;
  access_token: string | null;
  refresh_token: string | null;
  expira_en: string | null;
}

interface Parser {
  id: string;
  banco: string;
  tipo: string;
  remitente_patron: string;
  asunto_patron: string | null;
  regex_monto: string;
  regex_comercio: string | null;
  regex_fecha: string | null;
  regex_cuota: string | null;
  regex_tarjeta: string | null;
  cuenta_id: string | null;
}

async function marcarIntegracion(
  supabase: SupabaseClient,
  id: string,
  campos: Record<string, unknown>,
) {
  await supabase
    .from('integraciones_email')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id', id);
}

/**
 * Categoría aprendida para este comercio (REQ-013, RN-10).
 *
 * Delega en el RPC porque la normalización del patrón vive sólo en SQL: tenerla
 * también acá significaría que dos implementaciones tienen que coincidir para
 * siempre, y el día que difieran los alias dejan de aplicarse en silencio.
 */
async function categoriaAprendida(
  supabase: SupabaseClient,
  householdId: string,
  comercio: string | null,
): Promise<string | null> {
  if (!comercio) return null;
  const { data, error } = await supabase.rpc('categoria_para_comercio', {
    p_household_id: householdId,
    p_comercio: comercio,
  });
  if (error) return null;
  return (data as string | null) ?? null;
}

/** Agrupa las cuotas de una misma compra (REQ-031, RB-03). */
async function compraEnCuotas(
  supabase: SupabaseClient,
  householdId: string,
  cuentaId: string | null,
  comercio: string | null,
  montoCuota: number,
  cuotasTotal: number,
  fecha: string,
): Promise<string | null> {
  const descripcion = `${comercio ?? 'Compra'} · ${cuotasTotal} cuotas de ${montoCuota}`;

  const { data: existente } = await supabase
    .from('compras_en_cuotas')
    .select('id')
    .eq('household_id', householdId)
    .eq('descripcion', descripcion)
    .maybeSingle();

  if (existente) return (existente as { id: string }).id;

  const { data: creada } = await supabase
    .from('compras_en_cuotas')
    .insert({
      household_id: householdId,
      cuenta_id: cuentaId,
      descripcion,
      comercio,
      monto_cuota: montoCuota,
      cuotas_total: cuotasTotal,
      primera_fecha: fecha,
    })
    .select('id')
    .single();

  return (creada as { id: string } | null)?.id ?? null;
}

/**
 * Lee las casillas conectadas y convierte lo que encuentra en movimientos.
 *
 * Necesita un cliente con **service role**: escribe `integraciones_email`, que
 * ningún usuario puede tocar. Quien la llame en nombre de un usuario tiene que
 * haber validado su JWT y resuelto su hogar ANTES, y pasarlo en `householdId`.
 */
export async function correrCaptura(
  supabase: SupabaseClient,
  cred: CredencialesGoogle,
  opciones: OpcionesDeCorrida = {},
): Promise<ResultadoDeCorrida> {
  const maximo = opciones.maximo ?? MAX_CORREOS_POR_CORRIDA;
  const diasAtras = opciones.diasAtras ?? DIAS_ATRAS;

  let consulta = supabase
    .from('integraciones_email')
    .select('id, profile_id, household_id, email, carpeta, access_token, refresh_token, expira_en')
    .eq('proveedor', 'gmail')
    .eq('estado', 'activa');

  // El filtro por hogar es lo que hace que la corrida del usuario no toque las
  // casillas de nadie más. Va acá y no en quien llama: el cliente es de service
  // role y RLS no lo frena, así que si este `eq` falta, no falta nada más.
  if (opciones.householdId) consulta = consulta.eq('household_id', opciones.householdId);

  const { data: integraciones } = await consulta;

  const lista = (integraciones ?? []) as Integracion[];
  if (lista.length === 0) return { capturadas: 0, movimientos: 0, motivo: 'sin integraciones activas' };

  let capturadas = 0;
  let movimientos = 0;

  for (const integracion of lista) {
    if (capturadas >= maximo) break;

    // ── Token ──────────────────────────────────────────────────────────────
    let accessToken = integracion.access_token;
    if (necesitaRefresco(accessToken, integracion.expira_en)) {
      if (!integracion.refresh_token) {
        await marcarIntegracion(supabase, integracion.id, {
          estado: 'expirada',
          ultimo_error: 'Sin refresh token: hay que reconectar la cuenta',
        });
        continue;
      }
      try {
        const t = await refrescarToken(cred, integracion.refresh_token);
        accessToken = t.accessToken;
        await marcarIntegracion(supabase, integracion.id, {
          access_token: t.accessToken,
          expira_en: t.expiraEn,
          ultimo_error: null,
        });
      } catch (e) {
        // Google revoca el refresh token cuando el usuario quita el permiso.
        await marcarIntegracion(supabase, integracion.id, {
          estado: 'revocada',
          ultimo_error: String(e).slice(0, 300),
        });
        continue;
      }
    }
    if (!accessToken) continue;

    // Si el correo cambió (o nunca se guardó), se corrige.
    const correoReal = await correoDeLaCuenta(accessToken);
    if (correoReal && correoReal !== integracion.email) {
      await marcarIntegracion(supabase, integracion.id, { email: correoReal });
    }

    // ── Configuración del hogar ────────────────────────────────────────────
    const { data: parsersRaw } = await supabase
      .from('parsers_email')
      .select('id, banco, tipo, remitente_patron, asunto_patron, regex_monto, regex_comercio, regex_fecha, regex_cuota, regex_tarjeta, cuenta_id')
      .eq('household_id', integracion.household_id)
      .eq('activo', true);

    const parsers = (parsersRaw ?? []) as Parser[];
    if (parsers.length === 0) continue;

    const { data: hogar } = await supabase
      .from('households')
      .select('timezone')
      .eq('id', integracion.household_id)
      .maybeSingle();
    const zona = (hogar as { timezone?: string } | null)?.timezone?.trim() || 'America/Santiago';

    const { data: catOtros } = await supabase
      .from('categorias_gasto')
      .select('id')
      .is('household_id', null)
      .eq('nombre', 'Otros')
      .maybeSingle();
    const categoriaPorDefecto = (catOtros as { id: string } | null)?.id ?? null;

    // ── Correos ────────────────────────────────────────────────────────────
    let ids: string[];
    try {
      ids = await listarMensajes(accessToken, {
        maximo: maximo,
        diasAtras: diasAtras,
        carpeta: integracion.carpeta,
      });
    } catch (e) {
      // Un 401/403 de Gmail significa que el permiso murió: el usuario lo quitó
      // desde su cuenta de Google, o el refresh token caducó (pasa a los 7 días
      // con la app en "Testing"). Dejarla `activa` haría que el cron reintente
      // cada hora para siempre y que nadie se entere de que hay que reconectar.
      //
      // Cualquier otro fallo —Gmail caído, cuota agotada— sí se arregla solo:
      // se anota y se vuelve a intentar en la próxima corrida.
      const muerta = e instanceof ErrorDeGmail && e.esCredencialMuerta;
      await marcarIntegracion(supabase, integracion.id, {
        ...(muerta ? { estado: 'revocada' } : {}),
        ultimo_error: muerta
          ? 'Google dejó de aceptar el permiso: hay que volver a conectar el correo'
          : String(e).slice(0, 300),
      });
      continue;
    }

    for (const idMensaje of ids) {
      if (capturadas >= maximo) break;

      // Ya resuelto en una corrida anterior: no se vuelve a tocar.
      const { data: previa } = await supabase
        .from('capturas')
        .select('id, estado')
        .eq('household_id', integracion.household_id)
        .eq('origen', 'email')
        .eq('origen_ref', idMensaje)
        .maybeSingle();

      const estadoPrevio = (previa as { estado: string } | null)?.estado;
      if (estadoPrevio === 'procesada' || estadoPrevio === 'descartada') continue;

      const mensaje = await leerMensaje(accessToken, idMensaje);
      if (!mensaje) continue;

      const parser = elegirParser(parsers, mensaje.remitente, mensaje.asunto);

      // Correo que no corresponde a ningún parser: no es del banco, se ignora
      // sin dejar rastro. Registrarlo llenaría la bandeja de ruido.
      if (!parser) continue;

      const datos = extraerDatos(mensaje.cuerpo, parser);
      const fecha = fechaEnZona(mensaje.fechaInterna, zona);

      // RN-09: la captura se registra SIEMPRE, antes de decidir nada. Si el
      // proceso muere más abajo, el correo ya está guardado.
      const { data: capturaRaw, error: errCaptura } = await supabase
        .from('capturas')
        .upsert(
          {
            household_id: integracion.household_id,
            origen: 'email',
            origen_ref: idMensaje,
            parser_id: parser.id,
            payload: {
              remitente: mensaje.remitente,
              asunto: mensaje.asunto,
              extracto: mensaje.cuerpo.slice(0, 500),
            },
            interpretado: { ...datos, fecha, banco: parser.banco, tipo: parser.tipo },
            estado: 'pendiente',
            fecha_origen: mensaje.fechaInterna?.toISOString() ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'household_id,origen,origen_ref' },
        )
        .select('id, intentos')
        .single();

      if (errCaptura || !capturaRaw) continue;
      const captura = capturaRaw as { id: string; intentos: number };
      capturadas++;

      // ── ¿Alcanza para crear el movimiento solo? ─────────────────────────
      // La decisión vive en `_shared/capturas.ts` porque `reprocesar-capturas`
      // tiene que tomar exactamente la misma con el texto ya guardado.
      const cuentaId = parser.cuenta_id;
      const faltante = motivoDeFaltante(datos, cuentaId);

      if (faltante) {
        await supabase
          .from('capturas')
          .update({
            estado: 'requiere_revision',
            motivo: faltante,
            intentos: captura.intentos + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', captura.id);
        continue;
      }

      const esIngreso = parser.tipo === 'pago_recibido' || parser.tipo === 'abono';
      const categoriaId =
        (await categoriaAprendida(supabase, integracion.household_id, datos.comercio))
        ?? (esIngreso ? null : categoriaPorDefecto);

      let compraCuotasId: string | null = null;
      if (datos.cuotasTotal && datos.cuotasTotal > 1 && datos.monto) {
        compraCuotasId = await compraEnCuotas(
          supabase,
          integracion.household_id,
          cuentaId,
          datos.comercio,
          datos.monto,
          datos.cuotasTotal,
          fecha,
        );
      }

      const { error: errMovimiento } = await supabase.from('movimientos').insert({
        household_id: integracion.household_id,
        cuenta_id: cuentaId,
        profile_id: integracion.profile_id,
        categoria_id: categoriaId,
        monto: datos.monto,
        tipo: esIngreso ? 'ingreso' : 'gasto',
        fecha,
        comercio: datos.comercio,
        captura_id: captura.id,
        compra_cuotas_id: compraCuotasId,
        numero_cuota: datos.cuotaActual,
      });

      if (errMovimiento) {
        // El índice único sobre captura_id hace que un reproceso no duplique:
        // si ya existía el movimiento, la captura simplemente queda procesada.
        const duplicado = errMovimiento.code === '23505';
        if (!duplicado) console.error('[movimientos]', errMovimiento);
        await supabase
          .from('capturas')
          .update({
            estado: duplicado ? 'procesada' : 'requiere_revision',
            // `motivo` se muestra tal cual en la bandeja: un mensaje crudo de
            // Postgres le contaría el esquema al usuario. El error real va al
            // log de la función, que es donde sirve.
            motivo: duplicado ? null : motivoSeguro(errMovimiento.code),
            intentos: captura.intentos + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', captura.id);
        continue;
      }

      movimientos++;
      await supabase
        .from('capturas')
        .update({ estado: 'procesada', motivo: null, updated_at: new Date().toISOString() })
        .eq('id', captura.id);
    }

    await marcarIntegracion(supabase, integracion.id, {
      ultima_sync: new Date().toISOString(),
      ultimo_error: null,
    });
  }

  return { capturadas, movimientos, motivo: null };
}
