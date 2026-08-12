import type { FiltroMovimientos } from '@core/models/plata.model';
import { periodoDelMes } from '@core/models/plata.model';

/**
 * Traducción entre el filtro y los query params.
 *
 * Los filtros viven en la URL y no en memoria: recargar y perder el filtro es
 * de las cosas que hacen que una app se sienta un prototipo (AC14). Y de paso,
 * un filtro en la URL se puede compartir y volver atrás con el botón del
 * navegador.
 *
 * Funciones puras: sin `Router`, sin señales. Data in → data out.
 */

/** Sólo lo que difiere del estado por defecto. Una URL limpia se lee. */
export function aQueryParams(filtro: FiltroMovimientos): Record<string, string | null> {
  const actual = periodoDelMes();
  return {
    // El período sólo se escribe si NO es el mes en curso, que es el default.
    desde: filtro.desde === actual.desde ? null : filtro.desde,
    hasta: filtro.hasta === actual.hasta ? null : filtro.hasta,
    cuenta: filtro.cuentaId,
    categoria: filtro.categoriaId,
    tipo: filtro.tipo,
    // `null` y no `''`: Angular quita el parámetro en vez de dejar `?q=`.
    q: filtro.texto.trim() || null,
  };
}

/**
 * Reconstruye el filtro desde la URL.
 *
 * Todo lo que no se entienda se descarta en silencio y cae al default: una URL
 * escrita a mano o de una versión anterior tiene que dejar la pantalla usable,
 * no romperla.
 */
export function desdeQueryParams(params: Record<string, string | undefined>): FiltroMovimientos {
  const pordefecto = periodoDelMes();
  const fecha = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const tipo = params['tipo'];

  return {
    desde: fecha(params['desde']) ?? pordefecto.desde,
    hasta: fecha(params['hasta']) ?? pordefecto.hasta,
    cuentaId: params['cuenta'] || null,
    categoriaId: params['categoria'] || null,
    tipo: tipo === 'gasto' || tipo === 'ingreso' ? tipo : null,
    texto: params['q'] ?? '',
  };
}

/** Si dos filtros son el mismo, para no navegar de más. */
export function mismoFiltro(a: FiltroMovimientos, b: FiltroMovimientos): boolean {
  return (
    a.desde === b.desde &&
    a.hasta === b.hasta &&
    a.cuentaId === b.cuentaId &&
    a.categoriaId === b.categoriaId &&
    a.tipo === b.tipo &&
    a.texto.trim() === b.texto.trim()
  );
}
