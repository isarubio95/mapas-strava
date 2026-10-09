# Trazo

Todas tus rutas de Strava dibujadas a la vez sobre un mapa, con filtros,
resumen, reproducción en el tiempo, mapa de calor y pósteres.

"Trazo" es un nombre de trabajo. Las guías de marca de Strava no permiten
llevar "Strava" en el nombre de la app.

## Requisitos

- Node.js 22.22 o posterior.
- Docker, para Supabase en local.

## Puesta en marcha en local

```bash
npm install
npm run db:start     # Supabase local en Docker: http://127.0.0.1:54321
npm run dev:local    # la app contra Supabase local: http://localhost:5173
```

`npm run dev` usa el proyecto remoto definido en `.env`. `npm run dev:local`
arranca en el modo `e2e` de Vite, que lee `.env.e2e` con las claves por
defecto de Supabase local (no son secretas).

Supabase Studio local queda en http://127.0.0.1:54323 y los correos de prueba
en http://127.0.0.1:54324.

## Variables de entorno

| Archivo     | Uso                                              |
| ----------- | ------------------------------------------------ |
| `.env`      | Proyecto remoto de Supabase (no se sube a git).  |
| `.env.e2e`  | Supabase local, para desarrollo y pruebas.       |

Las dos solo llevan `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, que
pueden llegar al navegador porque el acceso a los datos lo protege RLS. Los
secretos de Strava van como secretos de las Edge Functions, nunca aquí.

## Scripts

| Script               | Qué hace                                        |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Desarrollo contra el proyecto remoto.           |
| `npm run dev:local`  | Desarrollo contra Supabase local.               |
| `npm run typecheck`  | Tipos de rutas y comprobación de TypeScript.    |
| `npm test`           | Pruebas de lógica con Vitest.                   |
| `npm run test:e2e`   | Pruebas de extremo a extremo con Playwright.    |
| `npm run db:start`   | Arranca Supabase local.                         |
| `npm run db:reset`   | Recrea la base local y aplica las migraciones.  |
| `npm run db:types`   | Genera los tipos de la base de datos.           |
| `npm run mock:strava`| API de Strava simulada, con datos sintéticos.   |

## Mapa

`/prototipos` enseña las tres distribuciones (HUD, barra y dock) con 800
actividades sintéticas. La elección se guarda en este navegador. `/` y
`/poster` usan tus actividades reales; si tu cuenta aún no tiene Strava
conectado, te llevan a `/conectar`. El mapa abre en la zona donde empiezan
la mayoría de tus rutas.

Para conectar Strava de verdad hace falta una app en strava.com/settings/api,
sin "Strava" en el nombre y con dominio de retorno
`twpgxilnhxkqqmrvjyoy.supabase.co`. El Client ID y el Client Secret se guardan
como secretos de Supabase (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`), junto
con `CRON_SECRET` y `STRAVA_WEBHOOK_VERIFY_TOKEN`.
