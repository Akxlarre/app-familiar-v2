# Estado del proyecto — traspaso a desarrollo local

> Escrito el 2026-08-12 al cerrar la sesión remota. Todo lo de acá abajo está
> commiteado y pusheado a `main`.

---

## Lo primero que tenés que hacer

### 1. Poner las credenciales de Google

```bash
cp supabase/.env.local.example supabase/.env.local
# y completar los dos valores
```

`supabase/.env.local` está ignorado por git, así que **no viajó en el push**. Es a
propósito: el `client_secret` no puede vivir en el repositorio.

El **client ID** ya está en `src/environments/environment.ts` — no es un secreto,
viaja en la URL del consentimiento y Google lo trata como público.

> ⚠️ **Rotá el `client_secret` antes de producción.** El que usamos quedó expuesto
> en el chat de la sesión remota. Para desarrollo local sirve igual.
>
> ⚠️ Y borrá o restringí la API key `AIza…` que quedó expuesta también. No se
> guardó en ningún archivo, pero está en el historial de la conversación.

### 2. El puerto del dev server no es libre

```bash
ng serve --port 4292
```

El redirect URI autorizado en Google es `http://localhost:4292/onboarding`, exacto.
Con 4200 o cualquier otro, Google contesta `redirect_uri_mismatch` **antes** de
mostrar la pantalla de permiso, así que no se llega a probar nada. Para agregar
más puertos: consola de Google → Credenciales → el OAuth 2.0 Client ID.

Detalle completo en [`docs/CONECTAR-GMAIL.md`](docs/CONECTAR-GMAIL.md).

### 3. Levantar la base y una edge function

```bash
npx supabase start
./scripts/servir-funcion.sh gmail-oauth      # queda en :8000
```

Si el edge runtime del CLI arranca en tu máquina —acá no podía, pedía un rlimit
que el sandbox no daba— no hace falta `servir-funcion.sh`: usá
`supabase functions serve` y listo.

---

## La decisión que está pendiente y no es técnica

**Mirá el estado de publicación de la pantalla de consentimiento en Google.**

Si está en *Testing*, Google emite refresh tokens que **caducan a los 7 días** para
scopes restringidos como `gmail.readonly`. Textual de su documentación:

> A Google Cloud Platform project with an OAuth consent screen configured for an
> external user type and a publishing status of "Testing" is issued a refresh
> token expiring in 7 days, unless the only OAuth scopes requested are a subset
> of name, email address, and user profile.

`gmail.readonly` no está en ese subconjunto. O sea: **hay que reconectar el correo
todas las semanas**, y entremedio la captura se apaga sola.

Toda la spec 0004 se apoya en que conectar el correo es una vez y listo. Salir de
Testing con un scope restringido exige la verificación de Google, que incluye
evaluación de seguridad. Es una decisión de producto: o se pasa por eso, o la app
avisa de la reconexión semanal.

---

## Qué está construido y verificado

| Spec | Estado | Verificación |
|---|---|---|
| 0002 · Lenguaje de pantallas | ✅ done | 359 tests + 18 comprobaciones en navegador |
| 0003 · Navegación y secciones | ✅ done | 405 tests + QA. 11/15 AC |
| 0005 · La pantalla de la plata | ✅ done | 475 tests + QA con 5.032 movimientos reales. 17/19 AC |
| 0004 · Del registro al primer movimiento | ✅ done | 516 tests + 40 de edge functions + 12 de privilegios + QA. **18/18 AC** |
| 0006 · Cuentas y tarjetas | 🟡 fases 1-2 | Cuentas creables y vinculables a parsers |

**Lo único que no se pudo verificar en toda la 0004** es completar el
consentimiento de Google: exige entrar a una cuenta real. Sí se verificó que
Google acepta el par client_id + client_secret (pasa de `invalid_client` a
`invalid_grant`), que el redirect URI es el correcto, y que el `refresh_token` no
se puede leer (403) ni escribir (400) desde el cliente.

---

## Lo que sigue

**Spec 0025 — Deudas** es lo siguiente a construir, y va **antes que la 0007**
aunque tenga número más alto. Las seis decisiones de producto ya están cerradas en
[`specs/specs/0025-deudas/decisiones.md`](specs/specs/0025-deudas/decisiones.md),
así que se puede ir directo a `/spec-plan`.

Después: **0024 — Configuración del hogar**, que le da puerta de entrada a
desconectar el correo. Hoy eso sólo se puede hacer desde la consola de Google.

---

## Lo primero que vas a descubrir cuando conectes tu Gmail de verdad

**Los parsers de los bancos chilenos se escribieron sin un correo real delante.**
Están en la migración `20260812030000_captura_plantillas_parser.sql`, para 10
bancos, a partir de remitentes conocidos — pero nadie comparó un regex contra un
correo verdadero.

Esperá que varios no calcen. **Ese es el flujo previsto, no una falla:** la captura
que no se puede interpretar queda en la bandeja con su motivo, se corrige el patrón
en la tabla `plantillas_parser`, y `reprocesar-capturas` la vuelve a interpretar sin
perder nada (RN-09).

Si me pasás qué falló, se corrigen los patrones con datos reales — que es
exactamente lo que a esta cadena le falta.

---

## Comandos que importan

```bash
npm run typecheck        # tsconfig.app.json + tsconfig.spec.json
npm run test:ci          # 516 tests
npm run lint:arch        # linter arquitectónico (0 errores, 2 advertencias heredadas)
npm run test:functions   # 40 tests de las edge functions (Deno)
npm run check:functions  # tipos de las edge functions
node --test supabase/tests/grants.test.mjs   # 12 casos de privilegios
node qa/qa-guard.mjs     # QA en navegador — ver qa/README.md
```

> **No uses `npx tsc --noEmit -p tsconfig.json`.** El tsconfig raíz es
> *solution-style*: compila cero archivos y sale con código 0. Da verde sin haber
> mirado nada. Usá `npm run typecheck`.

---

## Deuda técnica conocida

- **ARCH-09** (2 advertencias): `section-hero.component.ts` tiene 1170 líneas y
  `tabs.component.ts` 298. Heredadas del boilerplate.
- **`necesitaRefresco(token, null)` devuelve `false`.** Una integración sin
  `expira_en` nunca refresca. En la práctica siempre se escribe, pero el valor por
  defecto para "no sé cuándo vence" debería ser refrescar, no confiar.
- **AC-E3 de la spec 0005** (cuota "3 de 12" enlazando a la compra) sigue diferido
  a la 0007.
