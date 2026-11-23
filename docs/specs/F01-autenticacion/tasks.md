# F01 · Autenticación — Tareas

> Fuente de verdad del avance. El hook de inicio de sesión lee este archivo: respeta el formato (`### T-…` y las líneas `- Estado:` y `- Agente:`).
> Estados: `pendiente` · `en curso` · `hecha` · `bloqueada`
>
> Rama `feat/F01-autenticacion`, desde `main`. Las tareas de componentes (T-01.04 y T-01.05) necesitan el bloque B de F00 (T-00.06 y T-00.07) en `main` y van en un worktree de `.worktrees/` en paralelo con la API.
> La instalación de dependencias pide confirmación al usuario; cada tarea justifica en su resumen las dependencias que añade.

### T-01.01 · Definir el contrato de autenticación en `shared`
- Estado: hecha
- Agente: backend-dev · Revisores: code-reviewer
- Depende de: —
- Paralelizable con: —
- Cubre: CA-01.1, CA-01.3, CA-01.8, CA-01.12 (parte de contrato)
- Archivos: packages/shared/src/{auth.ts,auth.test.ts,demo-users.ts,audit.ts,errors.ts,index.ts}, apps/web/src/lib/api/client.ts (429 → `TOO_MANY_REQUESTS` en `codeFromStatus`)
- Verificación: npm test -w @incidapp/shared && npm run typecheck
- Notas: `Role`, `DepartmentSummary`, `CurrentUser`, `LoginInput` (email con trim + minúsculas + formato; contraseña 1–200; campos extra descartados), `AuditAction` (`LOGIN_SUCCEEDED`, `LOGIN_FAILED`), `TOO_MANY_REQUESTS` en `ErrorCode`, `DEMO_USERS` y `DEMO_PASSWORD` (`Demo2026!`) con los nombres, emails, roles y departamentos de `plan.md`. Tests de `LoginInput` (normalización, límites, mensajes en español) y de que `DEMO_USERS` tiene uno por rol. El commit incluye también `spec.md`, `plan.md` y `tasks.md` de F01. Hecha: `Role`, `DepartmentSummary`, `CurrentUser`, `LoginInput` y `PASSWORD_MAX_LENGTH` en `auth.ts`; `AuditAction` en `audit.ts`; `DEMO_USERS` (con `departmentCodes`) y `DEMO_PASSWORD` en `demo-users.ts`. El formato del email se valida sobre el valor ya normalizado; la contraseña no se recorta. Revisión: 3 hallazgos bajos (`.max(254)` en el email, test de email inválido en `CurrentUser`), sin cambios.

### T-01.02 · Implementar el dominio, los casos de uso y la persistencia de la autenticación
- Estado: hecha
- Agente: backend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-01.01
- Paralelizable con: T-01.04, T-01.05
- Cubre: CA-01.2, CA-01.4, CA-01.6, CA-01.7, CA-01.9, CA-01.11, CA-01.12 (lógica y BD; las respuestas HTTP son de T-01.03)
- Archivos: apps/api/src/domain/auth/{session.ts,user.ts (+ tests)}, apps/api/src/application/ports/{user-repository.ts,session-repository.ts,audit-log-writer.ts,password-hasher.ts,session-tokens.ts,clock.ts}, apps/api/src/application/auth/{login.ts,logout.ts,resolve-session.ts (+ tests)}, apps/api/src/infrastructure/auth/{argon2-password-hasher.ts,session-tokens.ts (+ tests)}, apps/api/src/infrastructure/clock/system-clock.ts, apps/api/src/infrastructure/db/{schema.ts,seed.ts,seed.test.ts}, apps/api/src/infrastructure/db/repositories/{user-repository.ts,session-repository.ts,audit-log-writer.ts (+ tests)}, apps/api/drizzle/ (generada), apps/api/tsup.config.ts, docs/adr/003-sesion-en-bd.md (nota)
- Verificación: npm test -w @incidapp/api && npm run db:migrate && npm run db:seed && npm run db:seed && npm run typecheck && npm run lint
- Notas: skill `caso-de-uso` (sin la parte HTTP, que es de T-01.03). Tablas `users`, `user_departments`, `sessions` y `audit_log` y `pgEnum` `role` según `plan.md`, con la migración **generada**. `sessions.id` = SHA-256 del *token*. `login` con verificación ficticia si el email no existe, mensaje único "Email o contraseña incorrectos.", rotación de la sesión anterior, borrado de las caducadas y auditoría (`LOGIN_FAILED` con `after: { email, reason }`, nunca la contraseña). `resolveSession` borra la sesión caducada y todas las de un usuario inactivo. `AuditLogWriter` solo con `record`. `@node-rs/argon2` (argon2id, 19 MiB, t=2, p=1), externa en tsup. *Seed* con `DEMO_USERS` de `shared`, idempotente y sin cambiar contraseñas. Tests de aplicación con *fakes*; de infraestructura con `createTestDatabase()`. Añadir a ADR-003 la nota de que se guarda el *hash* del *token*. Hecha: el dominio define `UserRole` sin importar `shared` (un test de tipos comprueba que coincide con `Role`); `findCurrentUser` devuelve `{ user, active }`; la contraseña se verifica antes de mirar `active` (mismo coste); la sesión caduca en `expiresAt` incluido; `seedDatabase(db, { passwordHasher })` solo calcula el *hash* de los usuarios que faltan. Fuera de la lista: `composition/db-command.ts` (pasa el *hasher* al *seed*) y `migrate.test.ts` (lista de tablas). Dependencia: `@node-rs/argon2` (MIT, binarios precompilados). Revisión: security-reviewer, 1 hallazgo medio corregido (email sin longitud máxima → `EMAIL_MAX_LENGTH = 254` en `LoginInput` y recorte antes de auditar; ver `docs/proceso-ia/hallazgos-revisores.md`); el *hash* ficticio se precalcula al construir `makeLogin` (bajo, de ambos revisores). Otros bajos sin cambios: el login no es transaccional (si falla entre borrar la sesión anterior y crear la nueva, el usuario vuelve a entrar). **Para T-01.03:** validar con `LoginInput` antes de llamar a `login` y comprobar que `@node-rs/argon2` carga desde `dist/`.

### T-01.03 · Exponer los endpoints de autenticación con cookie, anti-CSRF y límite de intentos
- Estado: hecha
- Agente: backend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-01.02
- Paralelizable con: T-01.04, T-01.05
- Cubre: CA-01.1, CA-01.2, CA-01.3, CA-01.4, CA-01.5, CA-01.6, CA-01.7, CA-01.8, CA-01.9, CA-01.10, CA-01.11
- Archivos: apps/api/src/http/routes/{auth.ts,auth.test.ts}, apps/api/src/http/auth/{session-cookie.ts,require-session.ts (+ tests)}, apps/api/src/http/{csrf.ts,csrf.test.ts,app.ts,error-handler.ts}, apps/api/src/composition/{config.ts,config.test.ts,container.ts}, .env.example
- Verificación: npm test -w @incidapp/api && npm run typecheck && npm run lint && npm run build
- Notas: `POST /api/auth/login`, `POST /api/auth/logout` y `GET /api/auth/me` según `plan.md`. `@fastify/cookie` (`incidapp_session`, `httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure: config.enforceHttps`, 7 días) y `@fastify/rate-limit` (`global: false`, solo en login, `max`/`timeWindow` de `config`, `ErrorResponse` `TOO_MANY_REQUESTS` y `Retry-After`). *Hook* global `onRequest` que exige `X-Requested-With` en `/api` para métodos que no son GET/HEAD/OPTIONS (403), registrado antes que las rutas: corre antes que el límite y que la validación. `trustProxy` con `config.trustProxyHops` (nunca `true`). `requireSession` reutilizable con `request.currentUser`. `redact` de `password` en el logger. Variables `TRUST_PROXY_HOPS`, `LOGIN_RATE_LIMIT_MAX` y `LOGIN_RATE_LIMIT_WINDOW_MS` validadas en `config` y documentadas en `.env.example`. Resuelve los pendientes de security-reviewer de T-00.03 (cabecera anti-CSRF y `trustProxy`). Tests con `fastify.inject` de todos los criterios, incluido el log capturado sin la contraseña. Hecha: en Fastify 5.12 un número en `trustProxy` no confía en N saltos (no confía en nada), así que se pasa la función `(addr, hop) => hop < hops`, nunca `true`; supone que la API solo es accesible a través del *proxy* (como en Render), y hay tests con 0, 1 y 2 saltos. El anti-CSRF decide por la ruta encontrada (`routeOptions.url`), porque el router decodifica la URL y `POST /%61pi/…` llegaba a `/api/…`. `TooManyRequestsError` vive en `http/`. `AppDeps.auth` es obligatorio (`http/test-support.ts` para los tests que no lo usan). Clave del límite explícita con `rateLimitKey` (IPv6 → prefijo /64, IPv4 mapeada → IPv4); `@fastify/rate-limit` ya lo hacía por defecto, pero no se depende de ello. Respuestas de `/auth/*` con `cache-control: no-store`. Fuera de la lista: `http/api-path.ts`, `http/rate-limit-key.ts`, `composition/main.ts` y ajustes en tests existentes (`X-Requested-With`). Dependencias: `@fastify/cookie` y `@fastify/rate-limit` (MIT); externas en el build y cargan desde `dist/` (`@node-rs/argon2` también). Revisión: sin hallazgos altos ni medios; aplicados 2 bajos (clave por /64 en IPv6 y test de 2 saltos); sin cambios: el límite cuenta también los intentos con cuerpo inválido (el 403 anti-CSRF sí va antes). **Para T-01.06:** el logout no debe enviar `Content-Type: application/json` sin cuerpo (Fastify responde 400). **Para T-01.07:** comprobar la IP real en `audit_log` y ajustar `TRUST_PROXY_HOPS` si sale la del *proxy*.

### T-01.04 · Crear el átomo `Link` y las moléculas `FormField` y `Alert`
- Estado: hecha
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-01.01, T-00.07
- Paralelizable con: T-01.02, T-01.03
- Cubre: CA-01.13 (campos con error accesible y región de alerta), CA-01.17 (enlace)
- Archivos: apps/web/src/components/atoms/Link/…, apps/web/src/components/molecules/{FormField,Alert}/…, índices de nivel
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build-storybook
- Notas: skill `componente`, en un worktree de `.worktrees/`. `Link` polimórfico con `as` (sin importar React Router). `FormField` genera los ids y pasa `aria-describedby` y `aria-invalid` al campo hijo. `Alert` con `tone` (info, success, warning, danger) y `role` según el tono. Cada uno con story (estados normal, error, tonos) y test. Sin textos de negocio fijos. Hecha: `Link` genérico (`LinkProps<E>`, el tipo de `to` sale del componente de `as`) con variantes `default` y `subtle`, y `rel="noopener noreferrer"` con `target="_blank"`. `FormField` usa `cloneElement` sobre un único hijo: le pone `id = htmlFor`, `aria-describedby` (error, ayuda y lo que ya trajera), `aria-invalid` y `aria-required` (no el `required` nativo), y `invalid` solo si el hijo es un componente. `Alert` con el título en `<p>` (no rompe la jerarquía de encabezados) y sin botón de cerrar. Sin dependencias nuevas. Hecha en paralelo con T-01.03, en el worktree `.worktrees/T-01.04`. Revisión: aprobada, 2 hallazgos bajos sin cambios (un hijo de `FormField` que no reenvíe las props pierde la asociación; `ref` con `as` depende del componente). **Para T-01.05:** `LoginForm` pinta el `Alert` danger solo cuando hay `errorMessage` y lleva `noValidate`.

### T-01.05 · Crear los organismos `LoginForm`, `DemoAccountsPanel` y `AppHeader`
- Estado: hecha
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-01.04
- Paralelizable con: T-01.02, T-01.03
- Cubre: CA-01.13 (formulario), CA-01.15 (cabecera)
- Archivos: apps/web/src/components/organisms/{LoginForm,DemoAccountsPanel,AppHeader}/…, apps/web/src/components/organisms/index.ts, apps/web/src/lib/labels.ts (+ test)
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build-storybook
- Notas: skill `componente`, en el mismo worktree que T-01.04. Props según `plan.md`; presentacionales (sin queries, router ni sesión). `LoginForm` valida con `LoginInput` de `shared`, muestra los errores por campo y el `errorMessage` en un `Alert` danger, y no reenvía mientras `isSubmitting`. `DemoAccountsPanel` recibe las cuentas por props y llama a `onSelect(email)`. `AppHeader` muestra nombre, rol en español (`ROLE_LABELS` de `lib/labels.ts`) y "Cerrar sesión". Stories con los estados (vacío, con errores, enviando, error de la API) y tests de interacción. Hecha: `LoginForm` valida con `LoginInput.safeParse` al enviar (`noValidate`), lleva el foco al primer campo con error, usa `useId()` para los ids y `autoComplete="username"`; un error de campo se muestra mientras el campo conserva el valor con el que se validó (así el recuadro demo lo limpia sin `useEffect`). `DemoAccountsPanel` con `aria-label` "Usar la cuenta de <nombre> (<rol>)" y título `h2`. `AppHeader` sin `<header>` propio (lo pone `AppLayout`) y con texto para lectores de pantalla; el `Badge` del rol no se recorta en móvil. axe-core sobre las 16 stories: 0 violaciones. Sin dependencias nuevas. Revisión: aprobada, 1 hallazgo bajo sin cambios (el error reaparece si el campo vuelve al valor validado). **Para T-01.06:** el aviso de sesión caducada lo pinta la página con un `Alert` warning encima de `LoginForm` dentro de `AuthLayout`.

### T-01.06 · Montar la página de login, las rutas protegidas, el cierre de sesión y la página 404
- Estado: hecha
- Agente: frontend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-01.03, T-01.05
- Paralelizable con: —
- Cubre: CA-01.13, CA-01.14, CA-01.15, CA-01.16, CA-01.17
- Archivos: apps/web/src/queries/{auth.ts,auth.test.ts}, apps/web/src/app/{router.tsx,providers.tsx,providers.test.tsx,guards.tsx,ProtectedLayout.tsx,safe-next-path.ts (+ tests)}, apps/web/src/pages/{LoginPage,NotFoundPage}/…, apps/web/src/pages/HomePage/…
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build && prueba manual con `npm run dev` (login con los 4 usuarios demo, recarga, logout y ruta inexistente)
- Notas: skill `componente` para las páginas. `useCurrentUser` (401 → `null`), `useLogin` y `useLogout` (vacía la caché). `RequireSession` (indicador de carga mientras se resuelve `me`; sin sesión → `/login?next=`) y `RedirectIfAuthenticated`. `ProtectedLayout` = `AppLayout` + `AppHeader` + `<Outlet />`. `LoginPage` con `AuthLayout`, `LoginForm` y `DemoAccountsPanel` (con `DEMO_USERS` y `DEMO_PASSWORD` de `shared`), y el aviso de sesión caducada con `expired=1`. 401 durante el uso (fuera de `me` y `login`) → vaciar la caché y `router.navigate('/login?next=…&expired=1')`. `safeNextPath` impide el *open redirect*. `NotFoundPage` con el átomo `Link` y el `Link` de React Router (resuelve el pendiente de T-00.04). Tests con `fetch` simulado. Hecha: la vuelta a la ruta pedida la hace `RedirectIfAuthenticated` con `safeNextPath(next)` (la página no navega por su cuenta); `safeNextPath` rechaza también los caracteres de control, otro origen y `/login`. `useCurrentUser` con `staleTime: Infinity` y `useLogin` con `gcTime: 0` (la contraseña no queda en la caché). Al caducar o cerrar la sesión se vacía la caché, `me` pasa a `null` y se navega en el mismo *tick*. `RequireSession` muestra un aviso con "Reintentar" si `me` falla por 5xx o red. La 404 usa `AuthLayout` y se muestra a todos, con o sin sesión (no revela nada). `HomePage` ya no pone su propio `<main>`. Fuera de la lista: `main.tsx` y las ayudas `test/api-mock.ts` y `test/render-app.tsx`. Sin dependencias nuevas. Prueba de humo con `npm run dev` (a través del proxy de Vite): login de los 4 usuarios demo con su rol y departamento, `me` 200, logout 204 y la cookie anterior da 401; cookie `HttpOnly; SameSite=Lax; Max-Age=604800`; 403 sin `X-Requested-With`; 401 con el mensaje único; `/login`, `/` y `/no-existe` sirven la SPA. La revisión visual en el navegador queda para T-01.07. Revisión: security-reviewer sin hallazgos; code-reviewer, 2 bajos sin cambios (404 sin sesión, decidido arriba; un 401 en el logout muestra el aviso de sesión caducada, que es seguro). **Límite conocido:** con `staleTime: Infinity`, una sesión revocada solo se detecta cuando otra petición protegida responde 401; en F01 la página de inicio solo llama a `/api/health` (pública), así que el aviso de caducada aparecerá a partir de F02/F03.

### T-01.07 · Desplegar F01 en Render y comprobar el login con los usuarios demo
- Estado: en curso
- Agente: principal · Revisores: code-reviewer
- Depende de: T-01.06
- Paralelizable con: —
- Cubre: CA-01.12 (en producción), CA-01.8 (IP real detrás del *proxy*)
- Archivos: render.yaml, README.md (usuarios demo y contraseña)
- Verificación: CI en verde en el PR (`gh pr checks`) · tras el despliegue, login en https://incidapp.onrender.com con los 4 usuarios demo, recarga con la sesión mantenida y logout · `curl` a `POST /api/auth/login` sin `X-Requested-With` → 403 · la fila `LOGIN_SUCCEEDED` de `audit_log` en Neon tiene la IP pública real del cliente
- Notas: `startCommand: npm run db:migrate && npm run db:seed && npm start`. Si la IP de la auditoría es la del *proxy* de Render, ajustar `TRUST_PROXY_HOPS` en el panel de Render (sin cambiar código) y anotarlo aquí. README: tabla de usuarios demo con su rol y la contraseña `Demo2026!`. Abrir el PR `feat/F01-autenticacion` → `main` y hacer *squash merge* (ambos piden confirmación). Revisión de la UI en el navegador con el usuario antes del merge. Avance (23/11): `startCommand` con `db:seed` y tabla de usuarios demo en el README (con el aviso de que la contraseña es pública a propósito y el límite de intentos por defecto). Revisión: 2 hallazgos bajos; aplicado "por defecto" en el README; `TRUST_PROXY_HOPS` no se declara en `render.yaml` (vale 1 en producción) y se ajusta en el panel si hace falta. UI revisada por el usuario con `npm run dev`: visto bueno. `npm test` completo en verde (50 + 273 + 308).

---

## Cobertura

| Criterio | Tareas |
|---|---|
| CA-01.1 | T-01.01 (esquema), T-01.03 |
| CA-01.2 | T-01.02, T-01.03 |
| CA-01.3 | T-01.01 (esquema), T-01.03 |
| CA-01.4 | T-01.02, T-01.03 |
| CA-01.5 | T-01.03 |
| CA-01.6 | T-01.02, T-01.03 |
| CA-01.7 | T-01.02, T-01.03 |
| CA-01.8 | T-01.01 (código de error), T-01.03, T-01.07 (IP real) |
| CA-01.9 | T-01.02, T-01.03 |
| CA-01.10 | T-01.03 |
| CA-01.11 | T-01.02, T-01.03 |
| CA-01.12 | T-01.01 (datos), T-01.02, T-01.07 |
| CA-01.13 | T-01.04, T-01.05, T-01.06 |
| CA-01.14 | T-01.06 |
| CA-01.15 | T-01.05, T-01.06 |
| CA-01.16 | T-01.06 |
| CA-01.17 | T-01.04, T-01.06 |
