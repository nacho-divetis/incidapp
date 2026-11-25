# F01 · Autenticación — Plan

> **Nota (25/11/2026):** `HomePage` (`/`), `queries/health.ts` y la entrada "Inicio" de la navegación se retiraron en T-07.10 (F07): `/` y el login llevan al listado de incidencias (CA-07.5). Este plan se conserva como se ejecutó.

- **Estado:** aprobado (23/11/2026; en F01 no requiere aprobación del usuario)
- **Spec:** `spec.md` (aprobada el 23/11)

## Contrato (`packages/shared`)

| Esquema / constante | Uso |
|---|---|
| `Role` | `z.enum(['ADMIN', 'DIRECTOR', 'MANAGER', 'USER'])` (`docs/glosario.md`) |
| `DepartmentSummary` | `{ id: uuid, code: string, name: string }` |
| `CurrentUser` | `{ id: uuid, email, name, role: Role, departments: DepartmentSummary[] }`. Respuesta de `POST /api/auth/login` y `GET /api/auth/me` |
| `LoginInput` | `{ email: string (trim + minúsculas + formato email), password: string (1–200) }`. Cuerpo de `POST /api/auth/login`. Objeto no estricto: los campos extra se descartan (CA-01.3) |
| `AuditAction` | `z.enum(['LOGIN_SUCCEEDED', 'LOGIN_FAILED'])`. F02 añade los cambios de usuarios |
| `ErrorCode` | se añade `TOO_MANY_REQUESTS` (429) |
| `DEMO_USERS` y `DEMO_PASSWORD` | Los 4 usuarios demo (`email`, `name`, `role`, códigos de departamento) y la contraseña `Demo2026!`. **Una sola fuente** para el *seed* de la API y el recuadro "Usuarios demo" de `/login`. Son públicos a propósito (datos ficticios) |

Usuarios demo (nombres ficticios): Elena Ruiz · `admin@incidapp.test` · `ADMIN` · ADM — Javier Ortega · `direccion@incidapp.test` · `DIRECTOR` · DIR — Carmen Vidal · `responsable@incidapp.test` · `MANAGER` · LOG — Pablo Moreno · `usuario@incidapp.test` · `USER` · LOG.

## API

| Método y ruta | Caso de uso | Permiso | Respuestas |
|---|---|---|---|
| `POST /api/auth/login` | `login` | público (con *rate limit*) | 200 `CurrentUser` + `Set-Cookie` · 400 · 401 · 403 (sin `X-Requested-With`) · 429 |
| `POST /api/auth/logout` | `logout` | público (idempotente) | 204 + cookie borrada · 403 |
| `GET /api/auth/me` | `resolveSession` | con sesión | 200 `CurrentUser` · 401 |

- **Cookie** (`@fastify/cookie`): nombre `incidapp_session`; valor = *token* aleatorio de 32 bytes en base64url; `httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure: config.enforceHttps`, `maxAge` = 7 días. El logout la borra con los mismos atributos.
- **`requireSession`** (`http/auth/require-session.ts`): *preHandler* reutilizable que lee la cookie, llama a `resolveSession` y deja el usuario en `request.currentUser` (tipado con `declare module 'fastify'`). Sin sesión válida → `UnauthorizedError` → 401. Lo usarán todas las rutas protegidas de F02 en adelante.
- **Anti-CSRF** (`http/csrf.ts`): *hook* global `onRequest` registrado antes que las rutas: en `/api`, cualquier método distinto de GET, HEAD u OPTIONS sin la cabecera `X-Requested-With` → 403 "Petición no permitida: falta la cabecera X-Requested-With." Al ser `onRequest` global, corre antes que el *rate limit* (que es de ruta) y que la validación del cuerpo (CA-01.10).
- **Rate limit** (`@fastify/rate-limit`, almacén en memoria —un solo proceso—): `global: false` y configuración solo en la ruta de login; `max` y `timeWindow` desde `config`; `errorResponseBuilder` → `ErrorResponse` `TOO_MANY_REQUESTS` "Demasiados intentos de inicio de sesión. Inténtalo de nuevo en unos minutos." El plugin añade `Retry-After`.
- **IP del cliente:** `trustProxy` de Fastify con el número de saltos de `config.trustProxyHops` (0 en local, 1 en producción por defecto). Nunca `true`: con `true` se tomaría la primera IP de `X-Forwarded-For`, que el cliente puede falsear para saltarse el límite. Se comprueba en el despliegue (T-01.07).
- **Logger:** se añade `req.body.password` (y `*.password`) a `redact`. El logger por defecto de Fastify no registra cuerpos, pero el `redact` cubre cualquier log futuro (CA-01.11).
- **Errores:** `error-handler.ts` traduce el error 429 del plugin (si llega como excepción) a `TOO_MANY_REQUESTS`. El cliente web (`codeFromStatus`) mapea 429 → `TOO_MANY_REQUESTS`.

## Dominio y aplicación

- `domain/auth/session.ts`: `SESSION_TTL_MS` (7 días), `sessionExpiresAt(now)` e `isSessionExpired(expiresAt, now)`. Funciones puras, sin dependencias.
- `domain/auth/user.ts`: tipo `UserAccount` (`id`, `email`, `name`, `role`, `active`, `passwordHash`) y `normalizeEmail` (trim + minúsculas).
- **Puertos** (`application/ports/`): `UserRepository` (`findAccountByEmail`, `findCurrentUser(id)` con departamentos), `SessionRepository` (`create`, `findById`, `delete`, `deleteAllForUser`, `deleteExpiredForUser(userId, now)`), `AuditLogWriter` (**solo** `record(entry)`; sin `update` ni `delete`), `PasswordHasher` (`hash`, `verify`), `SessionTokens` (`generate()` → *token* y `idFor(token)`), `Clock` (`now()`).
- **Casos de uso** (`application/auth/`), con sus dependencias por parámetro:
  - `login({ email, password, ip, currentToken? })` → `{ user: CurrentUser, token, expiresAt }`. Si el email no existe, verifica contra un *hash* ficticio para igualar el tiempo de respuesta. Contraseña incorrecta o usuario inactivo → `UnauthorizedError('Email o contraseña incorrectos.')` + auditoría `LOGIN_FAILED` (`actorId` si existe el usuario; `after: { email, reason }` con `reason` = `UNKNOWN_EMAIL` · `BAD_PASSWORD` · `INACTIVE`, que solo ve la auditoría). Correcto → borra la sesión de `currentToken` si la hay (rotación, CA-01.4) y las caducadas del usuario, crea la nueva y audita `LOGIN_SUCCEEDED`.
  - `logout({ token? })` → borra la sesión si existe. Nunca falla por no haber sesión.
  - `resolveSession({ token? })` → `CurrentUser`. Sin *token*, sesión inexistente → `UnauthorizedError`. Caducada → la borra y `UnauthorizedError`. Usuario inactivo → borra todas sus sesiones y `UnauthorizedError` (CA-01.6).
- **En la BD solo se guarda el *hash* del *token***: `sessions.id = SHA-256(token)` en hexadecimal. Si se filtrara la tabla, los identificadores no sirven como cookie. El *token* en claro solo viaja en la cookie.

## Base de datos

Migración generada con `npm run db:generate` a partir de `infrastructure/db/schema.ts`:

- `role` (`pgEnum`: `ADMIN`, `DIRECTOR`, `MANAGER`, `USER`).
- `users`: `id uuid` PK (`gen_random_uuid()`), `email text` único (se guarda normalizado), `name text`, `password_hash text`, `role role`, `active boolean` (`true` por defecto), `created_at timestamptz`.
- `user_departments`: `user_id` → `users` (`on delete cascade`), `department_id` → `departments`; PK compuesta.
- `sessions`: `id text` PK (SHA-256 del *token*), `user_id` → `users` (`on delete cascade`), `expires_at timestamptz`, `created_at timestamptz`; índice por `user_id`.
- `audit_log`: `id uuid` PK, `actor_id uuid` nulo → `users` (sin *cascade*: los usuarios se desactivan, no se borran), `action text`, `entity text`, `entity_id text` nulo, `before jsonb` nulo, `after jsonb` nulo, `ip text` nulo, `created_at timestamptz`; índice por `created_at`.
- **Adaptadores** (`infrastructure/`): `auth/argon2-password-hasher.ts` (`@node-rs/argon2`, argon2id con los parámetros mínimos de OWASP: 19 MiB, t=2, p=1), `auth/session-tokens.ts` (`node:crypto`), `clock/system-clock.ts`, `db/repositories/{user-repository,session-repository,audit-log-writer}.ts` (Drizzle).
- **Seed:** `seedDatabase` añade los `DEMO_USERS` de `shared` con `onConflictDoNothing` sobre `email` (no cambia la contraseña de un usuario que ya existe) y sus `user_departments` con `onConflictDoNothing`. Recibe el `PasswordHasher` por parámetro.

## Configuración

`composition/config.ts` añade, documentadas en `.env.example`:

| Variable | Por defecto | Uso |
|---|---|---|
| `TRUST_PROXY_HOPS` | `1` en producción, `0` en el resto | Saltos de *proxy* de confianza para la IP del cliente |
| `LOGIN_RATE_LIMIT_MAX` | `10` | Intentos de login por IP y ventana |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Ventana del límite |

`render.yaml`: `startCommand: npm run db:migrate && npm run db:seed && npm start`.

## Interfaz (atomic design)

Depende de F00 bloque B (T-00.06 y T-00.07): tokens, átomos, `AppLayout` y `AuthLayout`.

### Páginas y `app/`

| Página / pieza | Ruta | Plantilla | Roles | Queries / mutaciones |
|---|---|---|---|---|
| `LoginPage` | `/login` | `AuthLayout` | sin sesión (con sesión → `/`) | `useLogin()` |
| `HomePage` (existente) | `/` | `AppLayout` (vía `ProtectedLayout`) | con sesión | `useHealth()`; saluda al usuario con `useCurrentUser()` |
| `NotFoundPage` | `*` | ninguna | todos | — |
| `app/ProtectedLayout.tsx` | ruta de layout de las protegidas | `AppLayout` + `AppHeader` + `<Outlet />` | con sesión | `useCurrentUser()`, `useLogout()` |
| `app/guards.tsx` | — | — | — | `RequireSession` (carga → `Spinner`; sin sesión → `/login?next=<ruta>`) y `RedirectIfAuthenticated` |

- `queries/auth.ts`: `useCurrentUser()` (`GET /auth/me`; un 401 se devuelve como `null`, no como error; `staleTime` largo), `useLogin()` (al terminar, escribe el usuario en la caché de `me`) y `useLogout()` (al terminar, `queryClient.clear()`).
- **401 durante el uso (CA-01.16):** en `createQueryClient`, `QueryCache` y `MutationCache` con `onError`: si es un `ApiError` 401 y no viene de `me` ni de `login`, se vacía la caché y se navega a `/login?next=<ruta actual>&expired=1` (con `router.navigate`). `LoginPage` muestra el aviso con `expired=1`.
- **Sin *open redirect*:** `next` solo se acepta si es una ruta interna (empieza por `/` y no por `//` ni contiene `\`); si no, se usa `/`. Función pura `safeNextPath` en `app/` con su test.
- Textos de los roles en español: `lib/labels.ts` (`ROLE_LABELS: Record<Role, string>`), usable desde moléculas y organismos.

### Componentes

| Nivel | Componente | Nuevo / variante / reutilizado | Notas (props) |
|---|---|---|---|
| Átomo | `Button`, `Input`, `Label`, `Text`, `Heading`, `Spinner`, `Icon`, `Badge` | reutilizados | De T-00.07 |
| Átomo | `Link` | nuevo | Estilo de enlace con foco visible; polimórfico con `as` para que las páginas le pasen el `Link` de React Router sin que el átomo conozca el router |
| Molécula | `FormField` | nuevo | `label`, `htmlFor`, `error?`, `hint?`, `required?`, `children` (el campo). Genera los ids de error y ayuda y los pasa al campo (`aria-describedby`, `aria-invalid`) |
| Molécula | `Alert` | nuevo | `tone`: info · success · warning · danger; `title?`, `children`. `role="alert"` en danger y warning; `role="status"` en el resto |
| Organismo | `LoginForm` | nuevo | `onSubmit(values: LoginInput)`, `isSubmitting`, `errorMessage?`, `defaultEmail?`, `email`/`onEmailChange` opcionales (para rellenarlo desde el recuadro demo). Valida con `LoginInput` de `shared` y muestra los errores por campo |
| Organismo | `DemoAccountsPanel` | nuevo | `accounts: { email, name, role }[]`, `password`, `onSelect(email)`. Lista accesible de los usuarios demo con su rol en español; al elegir uno, rellena el email del formulario |
| Organismo | `AppHeader` | nuevo | `appName`, `user: { name, role }`, `onLogout`, `isLoggingOut`. Nombre, `Badge` con el rol en español y botón "Cerrar sesión" |
| Plantilla | `AuthLayout`, `AppLayout` | reutilizadas | De T-00.07. En F01, el hueco `nav` de `AppLayout` queda vacío (la navegación llega con F02/F03) |

## Tests

- **Dominio:** caducidad de la sesión y `normalizeEmail`.
- **Aplicación (con *fakes* de los puertos):** `login` (correcto; email inexistente con verificación ficticia; contraseña incorrecta; usuario inactivo; mismo mensaje en los tres; rotación; borrado de caducadas; auditoría de éxito y de fallo sin contraseña), `logout` (con y sin sesión) y `resolveSession` (válida, inexistente, caducada y borrada, usuario inactivo con sus sesiones borradas).
- **Infraestructura (PGlite en memoria):** repositorios, *hasher* (`$argon2id$`, verifica bien y mal), *tokens* (32 bytes, `idFor` determinista), *seed* idempotente con los 4 usuarios y sus departamentos, y migraciones repetibles.
- **API (`fastify.inject`):** CA-01.1 a CA-01.10 de punta a punta: atributos de la cookie (con y sin `enforceHttps`), 401 idéntico en los tres casos, 400 sin llegar al *hasher*, rotación, `me`, caducidad con reloj inyectado, logout idempotente, 429 con `Retry-After` (límite bajo en el test) que no afecta a `me` ni a `logout`, IP con `X-Forwarded-For` y `trustProxyHops`, 403 sin `X-Requested-With` antes del 400 y sin consumir intentos, y la contraseña ausente del log (*stream* capturado).
- **Web:** componentes con Testing Library (+ stories); `LoginPage`, guardas, `ProtectedLayout`, 401 durante el uso, `safeNextPath` y `NotFoundPage` con `fetch` simulado.
- **E2E:** ninguno en F01 (el flujo con login es de F07).

## Riesgos y decisiones

- **Dependencias nativas de argon2 en Windows y en Render** → `@node-rs/argon2` (binarios precompilados, sin `node-gyp`, MIT). Si fallara en Render, alternativa `argon2` (también precompilado). Se marca como externa en tsup.
- **Coste de argon2 en los tests** (PGlite ya es lento) → parámetros de OWASP sin rebajar en producción; en los tests de aplicación se usa un *fake* del *hasher*; solo los de infraestructura y API usan el real.
- **IP real detrás de Render** → `trustProxyHops` configurable y comprobación en el despliegue con un login y la fila de `audit_log`. Si Render añade más saltos, se ajusta la variable, sin cambiar código.
- ***Rate limit* en memoria** → válido con una sola instancia (plan gratuito); se reinicia si Render duerme el servicio, lo que es aceptable.
- **Enumeración de usuarios** → mismo mensaje y tiempo parecido (verificación ficticia) para email inexistente, contraseña incorrecta y usuario inactivo.
- **Contraseña demo pública** → intencionado (HU-08): datos ficticios y sin nada que proteger. Se documenta en el README y en `/login`.
- **`audit_log` de solo inserción** → garantizado por el puerto (`record` es la única operación). Un *trigger* en la BD exigiría una migración escrita a mano; se valora en F06.
- **Rama y paralelismo:** las tareas de API van en `feat/F01-autenticacion` (desde `main`). Las de componentes necesitan el bloque B de F00 en `main` y van en un worktree de `.worktrees/`.
- **ADR:** ninguno nuevo; aplica ADR-003 (sesión en BD). El detalle de guardar el SHA-256 del *token* se añade como nota a ADR-003 en T-01.02.
