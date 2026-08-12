# Conectar Gmail — puesta a punto local

Lo que hace falta para que el paso 3 del onboarding funcione de punta a punta, y
las tres cosas que hacen perder una hora si no se saben.

---

## 1. El puerto del dev server no es libre

`redirect_uri` se arma del origen real (`window.location.origin + '/onboarding'`)
y Google exige que coincida **carácter por carácter** con un URI autorizado en la
consola. Hoy el autorizado es:

```
http://localhost:4292/onboarding
```

Así que el dev server va en ese puerto y no en otro:

```bash
ng serve --port 4292
```

Con cualquier otro puerto Google contesta `redirect_uri_mismatch` — y lo hace
**antes** de mostrar la pantalla de permiso, así que ni siquiera se llega a
probar el resto.

Para agregar más puertos: consola de Google → *APIs y servicios* → *Credenciales*
→ el OAuth 2.0 Client ID → *URI de redireccionamiento autorizados*.

---

## 2. Los secretos van en un archivo ignorado

```
supabase/.env.local        ← GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET
```

`supabase/.gitignore` lo ignora. `scripts/servir-funcion.sh` lo carga solo.

El **client ID no es un secreto**: viaja en la URL del consentimiento y Google lo
trata como público — por eso vive en `environment.ts`. El **client secret sí**, y
nunca sale del servidor: sólo lo ve la edge function.

En producción va con `supabase secrets set`, nunca en un archivo.

---

## 3. Servir la función

El edge runtime del CLI de Supabase no arranca en todos los entornos
(`error setting rlimit type 7`). Las functions son Deno estándar:

```bash
./scripts/servir-funcion.sh gmail-oauth     # queda en :8000
```

Lo que este atajo NO reproduce es el enrutado `/functions/v1/<nombre>` del
gateway. Con el edge runtime levantado no hace falta nada de esto.

---

## Estado de publicación: la trampa de los 7 días

`gmail.readonly` es un **scope restringido**. Mientras el proyecto esté en
*Testing* en la pantalla de consentimiento de Google:

- sólo pueden conectarse las cuentas listadas como usuarios de prueba, y
- **el refresh token caduca a los 7 días**.

Textual de Google:

> A Google Cloud Platform project with an OAuth consent screen configured for an
> external user type and a publishing status of "Testing" is issued a refresh
> token expiring in 7 days, unless the only OAuth scopes requested are a subset
> of name, email address, and user profile.
>
> — [developers.google.com/identity/protocols/oauth2](https://developers.google.com/identity/protocols/oauth2)

La excepción no aplica: `gmail.readonly` no está en ese subconjunto.

Lo segundo importa más de lo que parece: toda la spec 0004 se apoya en que
conectar el correo es *una vez y listo*. Con la app en Testing, el usuario tiene
que reconectar cada semana, y entremedio la captura se apaga en silencio.

Pasar a *In production* con un scope restringido exige la verificación de Google
(incluye evaluación de seguridad). **Hay que confirmar el estado actual del
proyecto en la consola antes de dar el hito por cerrado** — es una decisión de
producto, no un detalle de configuración.

---

## Comprobar sin completar el consentimiento

Si el URI está autorizado, Google devuelve su pantalla de login; si no, un error:

```bash
curl -s -L "https://accounts.google.com/o/oauth2/v2/auth\
?client_id=<CLIENT_ID>\
&redirect_uri=http%3A%2F%2Flocalhost%3A4292%2Fonboarding\
&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly\
&access_type=offline&prompt=consent&state=x" | grep -o "redirect_uri_mismatch\|<title>[^<]*</title>"
```

`<title>Sign in - Google Accounts</title>` = autorizado.

Y para saber si el par ID+secret es válido, sin consentimiento: canjear un código
falso. `invalid_client` significa credenciales malas; `invalid_grant` significa
que las credenciales están bien y lo único rechazado fue el código.
