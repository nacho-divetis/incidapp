# F00 · Fundaciones — Plan

- **Estado:** aprobado (23/11/2026)
- **Spec:** `spec.md` (aprobada el 23/11)

## Decisiones técnicas de base

| Tema | Decisión | Motivo |
|---|---|---|
| Módulos | ESM en todo el monorepo (`"type": "module"`), TypeScript `strict` + `noUncheckedIndexedAccess`, `moduleResolution: "Bundler"`. `tsconfig.base.json` en la raíz y uno por workspace | Una sola configuración; el bundler resuelve |
| `packages/shared` | **Sin paso de build**: `exports` apunta a `src/index.ts`. Lo consumen Vite (web), Vitest y el bundle de la API | Sin `dist/` que sincronizar ni `tsc -b` en modo *watch* |
| Build de la API | **tsup** (esbuild) empaqueta `composition/main.ts` en `apps/api/dist/main.js`, incluido `@incidapp/shared` (`noExternal`). Las dependencias de npm (PGlite, pg, Fastify) quedan externas | Un único archivo ejecutable con `node`, sin problemas de resolución de ESM |
| Ejecución en desarrollo | `tsx watch` para la API; Vite para la web; `concurrently` para `npm run dev` | Recarga en caliente sin compilar |
| `db:migrate` y `db:seed` | Scripts TS ejecutados con `tsx` en todos los entornos. En Render, el build instala también las `devDependencies` (`npm ci --include=dev`) | Un solo comando con el mismo nombre en local y en producción, como pide `AGENTS.md` |
| Versiones | Última estable de cada paquete al instalar: Fastify 5, Zod 4 + `fastify-type-provider-zod`, Drizzle ORM + drizzle-kit, `@electric-sql/pglite`, `pg`, React 19, React Router 7 (modo librería), TanStack Query 5, Vite, Tailwind 4 (`@tailwindcss/vite`), Storybook (`@storybook/react-vite` + `addon-a11y`), Vitest, ESLint 9 (*flat config*) | Todas gratuitas y con licencia MIT o Apache |
| Reglas de arquitectura | `eslint-plugin-boundaries` (capas del backend y niveles atómicos) + `no-restricted-imports` (paquetes prohibidos por capa o nivel) en un único `eslint.config.js` en la raíz | Las dos reglas se prueban con la API de ESLint (`lintText`) sobre fragmentos de ejemplo |
| Configuración | `composition/config.ts` valida `process.env` con Zod: `NODE_ENV`, `PORT` (3000; Render pone el suyo), `HOST` (`0.0.0.0`), `DATABASE_URL` (opcional salvo en producción), `PGLITE_DATA_DIR` (`.data/pglite`), `WEB_DIST_DIR`. Documentadas en `.env.example` | CA-00.3; un error de configuración se detecta al arrancar, no en la primera petición |
| Versión en `/api/health` | `version` del `package.json` de la API + los 7 primeros caracteres de `RENDER_GIT_COMMIT` si existe | Permite comprobar qué commit está desplegado |

## Contrato (`packages/shared`)

| Esquema | Uso |
|---|---|
| `HealthResponse` | `{ status: 'ok' \| 'error', db: 'ok' \| 'error', version: string }`. Cuerpo de `GET /api/health` |
| `ErrorCode` | `'VALIDATION' \| 'UNAUTHORIZED' \| 'FORBIDDEN' \| 'NOT_FOUND' \| 'CONFLICT' \| 'INTERNAL'` |
| `ErrorResponse` | `{ error: { code: ErrorCode, message: string, details?: { path: string, message: string }[] } }`. Cuerpo de toda respuesta 4xx/5xx de `/api` |

`UNAUTHORIZED` (401) se incluye ya para que F01 no tenga que cambiar el contrato de errores.

## API

| Método y ruta | Caso de uso | Permiso | Respuestas |
|---|---|---|---|
| `GET /api/health` | `getHealth` | público | 200 · 503 |
| `GET /api/*` (no definida) | — | — | 404 `ErrorResponse` |
| `GET /*` (resto) | — | público | 200 `index.html` (archivos estáticos de `WEB_DIST_DIR` o *fallback* de la SPA) |

- `http/app.ts` exporta `buildApp(deps)`: registra `@fastify/helmet` (CSP por defecto de Helmet), el *type provider* de Zod, las rutas bajo el prefijo `/api`, `@fastify/static` y el *not found handler* (JSON para `/api/*`, `index.html` para el resto). Si no existe el build de la web (desarrollo), no se registra la parte estática.
- `http/error-handler.ts`: `ValidationError` y errores de validación de Fastify → 400 (con `details`), `UnauthorizedError` → 401, `ForbiddenError` → 403, `NotFoundError` → 404, `ConflictError` → 409; cualquier otro → 500 con "Se ha producido un error inesperado." y el detalle **solo en el log**.
- Logger de Fastify (pino) con `redact` de `authorization`, `cookie` y `set-cookie` desde el principio.

## Dominio y aplicación
- `application/errors.ts`: `AppError` (base) y `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError` y `ConflictError`, con mensaje en español.
- `application/ports/database-health.ts`: puerto `DatabaseHealth { ping(): Promise<void> }`.
- `application/health/get-health.ts`: caso de uso `getHealth({ databaseHealth, version })` → `HealthResponse`. Si `ping` falla o tarda más de 2 s, `db: 'error'`.
- `domain/`: vacío en F00 (solo un `index.ts` para que la regla de capas tenga algo que vigilar).
- `composition/container.ts`: crea la conexión según `config` (PGlite o node-postgres con SSL) y monta las dependencias. `composition/main.ts`: arranca el servidor y cierra la conexión con `SIGTERM`.

## Base de datos
- `infrastructure/db/schema.ts`: tabla `departments` (`id uuid` PK con `gen_random_uuid()`, `code text` único, `name text`, `created_at timestamptz` con `now()`).
- `infrastructure/db/client.ts`: `createDatabase(config)` → `{ db, close }`, con el mismo esquema Drizzle en los dos drivers.
- `infrastructure/db/migrate.ts`: aplica `apps/api/drizzle/` con el *migrator* del driver que toque. Las migraciones se generan con `npm run db:generate` y no se editan.
- `infrastructure/db/seed.ts`: inserta los 9 departamentos con `onConflictDoNothing` sobre `code` (idempotente).
- `infrastructure/db/database-health.ts`: adaptador de `DatabaseHealth` (`select 1`).
- Tests: PGlite **en memoria** + migraciones reales, con un *helper* `createTestDatabase()` que reutilizarán todas las features.

## Interfaz (atomic design)

### Páginas

| Página | Ruta | Plantilla | Roles | Queries / mutaciones |
|---|---|---|---|---|
| `HomePage` | `/` | ninguna en F00 (F01 le pone `AppLayout`) | público | `useHealth()` (`queries/health.ts`) |

- `lib/api/client.ts`: `apiGet(path, schema)` y la base para los métodos que escriben (`credentials: 'include'`; `X-Requested-With: fetch` en las peticiones que no son GET). Valida la respuesta con el esquema de `shared` y convierte un `ErrorResponse` en un `ApiError` con `status`, `code` y `message`.
- `app/`: `QueryClient`, `createBrowserRouter` y los *providers*. Proxy de Vite `/api` → `http://localhost:3000`.

### Componentes (bloque B)

| Nivel | Componente | Nuevo / variante / reutilizado | Notas (props) |
|---|---|---|---|
| Tokens | `styles/tokens.css` + `styles/index.css` | nuevo | Variables CSS en `@theme` de Tailwind 4: `primary`, `neutral`, `success`, `warning`, `danger` e `info` (cada uno con `-bg`, `-fg` y `-border`), superficie, texto, tipografía (Inter con *fallback* del sistema, sin cargar fuentes externas), escala de espaciado, radios, sombras y anillo de foco. Story `Tokens/Paleta` |
| Átomo | `Button` | nuevo | `variant`: primary · secondary · ghost · danger; `size`: sm · md; `loading`, `disabled`, `leftIcon` |
| Átomo | `Input`, `Textarea`, `Select` | nuevo | `invalid` → `aria-invalid`; reenvían `ref` y el resto de props nativas (`aria-describedby`…). `Select` nativo (`<select>`) |
| Átomo | `Checkbox` | nuevo | Nativo, con `label` opcional |
| Átomo | `Label` | nuevo | `htmlFor`, `required` (asterisco con texto accesible "obligatorio") |
| Átomo | `Badge` | nuevo | `tone`: neutral · info · success · warning · danger · primary. Lo usarán `StatusBadge` y `PriorityBadge` (F03) |
| Átomo | `Spinner` | nuevo | `size`; `role="status"` con texto accesible por props |
| Átomo | `Heading`, `Text` | nuevo | `Heading`: `level` 1–4 (y `as` para separar semántica y tamaño). `Text`: `variant` body · muted · small |
| Átomo | `Icon` | nuevo | Envuelve `lucide-react` (MIT): `name`, `size`, `aria-hidden` salvo que reciba `label` |
| Plantilla | `AppLayout` | nuevo | *Slots* `header`, `nav`, `children`; enlace "Saltar al contenido" (texto por prop con ese valor por defecto) |
| Plantilla | `AuthLayout` | nuevo | *Slots* `title`, `children`; panel centrado |

- `components/{atoms,molecules,organisms,templates}/index.ts` (los vacíos se crean ya) y alias `@/` → `src/`.
- Utilidad `lib/cn.ts` (`clsx` + `tailwind-merge`) para combinar clases. Está en `lib/` y la pueden usar todos los niveles.
- Storybook: `.storybook/` en `apps/web`, reutiliza la configuración de Vite (Tailwind incluido), addon a11y y `preview.ts` que carga `styles/index.css`. Solo en local; la publicación en Pages es de F07.

## Tests

- **Unitarios (API):** `getHealth` (ok, BD caída, *timeout*), selección de driver y validación de `config` (CA-00.3), `error-handler` (cada error tipado → su código y `ErrorResponse`; 500 sin *stack*), `seed` idempotente y `migrate` repetible sobre PGlite en memoria.
- **API (`fastify.inject`):** `/api/health` 200 y 503, `/api/no-existe` → 404 JSON, `/` y `/incidencias/123` → `index.html` (con un `WEB_DIST_DIR` de *fixture*), cabeceras de Helmet presentes.
- **Arquitectura:** `apps/api/src/architecture.test.ts` (capas, CA-00.13) y `apps/web/src/components/architecture.test.ts` (niveles CA-00.18, estructura CA-00.17, sin colores ni valores arbitrarios CA-00.15). Usan la API de ESLint y la lectura del sistema de archivos.
- **Web:** `HomePage` con `fetch` simulado (`vi.stubGlobal`): carga, "Conectada" y "Sin conexión" (CA-00.7); `apiGet` (respuesta válida, `ErrorResponse` → `ApiError`). Átomos con interacción (`Button`, campos, `Checkbox`) y plantillas (*landmarks*, enlace de salto) con Testing Library.
- **Manual:** despliegue (CA-00.10) y `commitlint` con un mensaje inválido (CA-00.12, comprobado también con `npx commitlint` en un test de la tarea).
- E2E: ninguno en F00.

## Calidad y entrega continua
- **Raíz:** `package.json` con `workspaces`, `engines.node >= 24` y los scripts de `AGENTS.md`; `eslint.config.js`; `.prettierrc.json`; `commitlint.config.js` (`@commitlint/config-conventional`); `.husky/pre-commit` (`lint-staged`) y `.husky/commit-msg`; `.lintstagedrc.json`; `.env.example`; `.nvmrc` (24).
- **CI** (`.github/workflows/ci.yml`): en `pull_request` y `push` a `main`; Node 24 con caché de npm; `npm ci` → `lint` → `typecheck` → `test` → `build`.
- **`render.yaml`:** servicio `web`, `runtime: node`, `plan: free`, `region: frankfurt`, `branch: main`, `buildCommand: npm ci --include=dev && npm run build`, `startCommand: npm run db:migrate && npm start`, `healthCheckPath: /api/health`, despliegue automático **solo si la CI pasa** (`autoDeployTrigger: checksPass`), `envVars`: `NODE_VERSION=24`, `NODE_ENV=production` y `DATABASE_URL` con `sync: false` (el valor se pega en Render, nunca en el repo).

## Riesgos y decisiones
- **PGlite y node-postgres divergen** (tipos o *migrator*) → el mismo esquema y la misma función de migración con los dos drivers. Los tests usan PGlite y el despliegue valida node-postgres contra Neon antes de F01.
- **Render gratuito**: memoria de build limitada (512 MB) y arranque en frío de alrededor de un minuto → build ligero (Vite + tsup) y `healthCheckPath`. Aviso en el README.
- **Neon y SSL**: la cadena de conexión lleva `sslmode=require` y el *pool* de node-postgres es pequeño (`max: 5`). Se usa la conexión **directa** (sin *pooler*), suficiente para un servicio y compatible con las migraciones.
- **Bloqueo de PGlite en local**: un directorio de datos solo admite un proceso → `npm run dev` ejecuta `db:migrate` y `db:seed` **antes** de arrancar la API, nunca a la vez.
- **Windows (local) frente a Linux (CI y Render)**: finales de línea LF por `.gitattributes`, rutas con `node:path` y nombres de archivo con las mayúsculas exactas (la CI los detecta).
- **Compatibilidad entre Zod 4 y el *type provider* de Fastify** → se fija la versión que lo soporte. Si da problemas, se valida con `schema.parse` en la ruta, sin cambiar el contrato.
- **Tailwind 4 en Storybook** → Storybook reutiliza `vite.config.ts`. Se comprueba con `build-storybook` en la propia tarea.
- **ADR nuevos** (los crea T-00.01 con la skill `adr`): 001 monolito modular · 002 Clean Architecture · 003 sesión en BD · 004 PGlite en local y Neon en producción · 005 adjuntos en `bytea` · 006 despliegue con coste cero · 007 contrato compartido con Zod · 008 atomic design + Storybook · 009 permisos en el servidor (`allowedActions`).

## Avance del desglose (para `tasks.md`)

| Tarea | Agente | Bloque | Cubre |
|---|---|---|---|
| T-00.01 Documentación de base y ADR | principal | A | CA-00.14 |
| T-00.02 Monorepo, contrato base, calidad y CI | backend-dev | A | CA-00.1, 00.11, 00.12, 00.13 |
| T-00.03 API: servidor, errores, BD, migraciones, *seed* y SPA | backend-dev | A | CA-00.2, 00.3, 00.4, 00.5, 00.6, 00.8, 00.9 |
| T-00.04 Web: cliente API, *providers* y página inicial | frontend-dev | A | CA-00.2, 00.7 |
| T-00.05 Despliegue en Render + Neon | principal (+ usuario) | A | CA-00.10 |
| T-00.06 Tokens, Storybook y reglas de UI | frontend-dev | B | CA-00.15, 00.16, 00.17, 00.18 |
| T-00.07 Átomos base y plantillas | frontend-dev | B | CA-00.19, 00.20 |

Camino crítico del bloque A: T-00.02 → (T-00.03 ∥ T-00.04) → T-00.05. T-00.01 va en paralelo con todo el bloque A.
