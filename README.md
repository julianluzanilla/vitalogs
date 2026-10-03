# VitaLogs

Registro personal de salud (dolor, mareo, pulso, presión arterial, medicamentos y baño) con reportes PDF/Excel para el médico.
PWA en español: se instala en iPhone como app (barra inferior, hojas deslizables) y funciona como webapp en PC/iPad (barra lateral, modales).

**Producción:** https://vitalogs.luzaron.uk · **Administración:** https://vitalogs.luzaron.uk/admin

## Arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + TypeScript, PWA (`vite-plugin-pwa`), IndexedDB (Dexie) |
| Backend | Cloudflare Pages Functions con Hono (`functions/api/[[route]].ts`) |
| Base de datos | Cloudflare D1 (`migrations/`) |
| Reportes | `jspdf` + `jspdf-autotable` (PDF), `exceljs` (Excel), generados en el dispositivo |

- **Offline-first:** todo se guarda primero en el dispositivo y se sincroniza con `/api/sync` (al guardar, al volver la conexión, al abrir la app y cada 60 s). Conflictos: gana la última edición.
- **Privacidad:** cada consulta de datos filtra por el usuario de la sesión. La cuenta de administrador es una identidad aparte (tabla `admins`, cookie propia limitada a `/api/admin`) y su API solo gestiona cuentas; no existe ningún endpoint de admin que lea registros.
- **Seguridad:** contraseñas con PBKDF2-SHA256 (100 000 iteraciones), sesiones con token aleatorio guardado como hash, cookies `HttpOnly; Secure; SameSite=Strict`, bloqueo tras 5 intentos fallidos, CSP estricta (`public/_headers`), sin servicios de terceros (la fuente va incluida).
- **Compartir:** en iPhone/iPad, “Compartir” abre la hoja nativa del sistema (WhatsApp, Telegram, Correo…). En PC se ofrece “Descargar”.

## Desarrollo local

```bash
npm install
npm run db:migrate:local                 # crea la base D1 local
node scripts/create-admin.mjs admin --local
npm run build
npx wrangler pages dev dist --port 8788  # app + API en http://localhost:8788
npm run dev                              # (opcional) Vite con recarga en caliente en :5173, usa la API de :8788
npm test                                 # pruebas unitarias
```

## Despliegue (primera vez)

1. **Iniciar sesión en Cloudflare:** `npx wrangler login`
2. **Crear la base de datos:** `npx wrangler d1 create vitalogs` y copiar el `database_id` que devuelve en `wrangler.toml`.
3. **Crear las tablas:** `npm run db:migrate:remote`
4. **Subir a GitHub:** hacer commit del `wrangler.toml` actualizado y `git push`.
5. **Cloudflare Pages:** Dashboard → Workers & Pages → Create → Pages → *Connect to Git* → elegir el repo.
   - Framework preset: *None* · Build command: `npm run build` · Build output: `dist`
   - Variables de entorno: `NODE_VERSION` = `22`
   - El binding D1 `DB` se toma de `wrangler.toml` (verifícalo en *Settings → Bindings*).
6. **Dominio:** en el proyecto de Pages → *Custom domains* → `vitalogs.luzaron.uk` (crea el CNAME en la zona automáticamente).
7. **Administrador:** `node scripts/create-admin.mjs <usuario>` (pide la contraseña sin mostrarla). Entra a `/admin` y crea tu usuario personal; la app pedirá cambiar la contraseña temporal al primer ingreso.

Cada `git push` a la rama principal publica una nueva versión; la app instalada se actualiza sola.
Si agregas migraciones nuevas, ejecuta `npm run db:migrate:remote` antes de publicar.

## Estructura

```
functions/api/[[route]].ts   API: auth, sync, admin
functions/lib/               crypto (PBKDF2), sesiones, lógica de sync
shared/model.ts              modelo de datos y validación (cliente y servidor)
src/data/                    IndexedDB, cola de sincronización, cliente API
src/lib/                     formato, formulario, reportes, exportación PDF/Excel/compartir
src/pages/, src/components/  pantallas y componentes
src/admin/                   consola de administración (paquete aparte)
design_handoff_vitalogs/     diseño original (Claude Design)
```
