/**
 * Desarrollo — apunta a la instancia LOCAL de Supabase (`npx supabase start`).
 *
 * La anon key de abajo no es un secreto: es la clave de demo que el CLI de
 * Supabase genera igual en todas las instalaciones locales, firmada con el
 * JWT secret de demo. La de producción se inyecta con `scripts/set-env.js`
 * sobre `environment.prod.ts`, que el build sustituye vía `fileReplacements`.
 */
export const environment = {
  production: false,
  supabase: {
    url: "http://127.0.0.1:54321",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  },
};
