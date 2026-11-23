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
- Estado: pendiente
- Agente: backend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-01.01
- Paralelizable con: T-01.04, T-01.05
- Cubre: CA-01.2, CA-01.4, CA-01.6, CA-01.7, CA-01.9, CA-01.11, CA-01.12 (lógica y BD; las respuestas HTTP son de T-01.03)
- Archivos: apps/api/src/domain/auth/{session.ts,user.ts (+ tests)}, apps/api/src/application/ports/{user-repository.ts,session-repository.ts,audit-log-writer.ts,password-hasher.ts,session-tokens.ts,clock.ts}, apps/api/src/application/auth/{login.ts,logout.ts,resolve-session.ts (+ tests)}, apps/api/src/infrastructure/auth/{argon2-password-hasher.ts,session-tokens.ts (+ tests)}, apps/api/src/infrastructure/clock/system-clock.ts, apps/api/src/infrastructure/db/{schema.ts,seed.ts,seed.test.ts}, apps/api/src/infrastructure/db/repositories/{user-repository.ts,session-repository.ts,audit-log-writer.ts (+ tests)}, apps/api/drizzle/ (generada), apps/api/tsup.config.ts, docs/adr/003-sesion-en-bd.md (nota)
- Verificación: npm test -w @incidapp/api && npm run db:migrate && npm run db:seed && npm run db:seed && npm run typecheck && npm run lint
- Notas: skill `caso-de-uso` (sin la parte HTTP, que es de T-01.03). Tablas `users`, `user_departments`, `sessions` y `audit_log` y `pgEnum` `role` según `plan.md`, con la migración **generada**. `sessions.id` = SHA-256 del *token*. `login` con verificación ficticia si el email no existe, mensaje único "Email o contraseña incorrectos.", rotación de la sesión anterior, borrado de las caducadas y auditoría (`LOGIN_FAILED` con `after: { email, reason }`, nunca la contraseña). `resolveSession` borra la sesión caducada y todas las de un usuario inactivo. `AuditLogWriter` solo con `record`. `@node-rs/argon2` (argon2id, 19 MiB, t=2, p=1), externa en tsup. *Seed* con `DEMO_USERS` de `shared`, idempotente y sin cambiar contraseñas. Tests de aplicación con *fakes*; de infraestructura con `createTestDatabase()`. Añadir a ADR-003 la nota de que se guarda el *hash* del *token*.

### T-01.03 · Exponer los endpoints de autenticación con cookie, anti-CSRF y límite de intentos
- Estado: pendiente
- Agente: backend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-01.02
- Paralelizable con: T-01.04, T-01.05
- Cubre: CA-01.1, CA-01.2, CA-01.3, CA-01.4, CA-01.5, CA-01.6, CA-01.7, CA-01.8, CA-01.9, CA-01.10, CA-01.11
- Archivos: apps/api/src/http/routes/{auth.ts,auth.test.ts}, apps/api/src/http/auth/{session-cookie.ts,require-session.ts (+ tests)}, apps/api/src/http/{csrf.ts,csrf.test.ts,app.ts,error-handler.ts}, apps/api/src/composition/{config.ts,config.test.ts,container.ts}, .env.example
- Verificación: npm test -w @incidapp/api && npm run typecheck && npm run lint && npm run build
- Notas: `POST /api/auth/login`, `POST /api/auth/logout` y `GET /api/auth/me` según `plan.md`. `@fastify/cookie` (`incidapp_session`, `httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure: config.enforceHttps`, 7 días) y `@fastify/rate-limit` (`global: false`, solo en login, `max`/`timeWindow` de `config`, `ErrorResponse` `TOO_MANY_REQUESTS` y `Retry-After`). *Hook* global `onRequest` que exige `X-Requested-With` en `/api` para métodos que no son GET/HEAD/OPTIONS (403), registrado antes que las rutas: corre antes que el límite y que la validación. `trustProxy` con `config.trustProxyHops` (nunca `true`). `requireSession` reutilizable con `request.currentUser`. `redact` de `password` en el logger. Variables `TRUST_PROXY_HOPS`, `LOGIN_RATE_LIMIT_MAX` y `LOGIN_RATE_LIMIT_WINDOW_MS` validadas en `config` y documentadas en `.env.example`. Resuelve los pendientes de security-reviewer de T-00.03 (cabecera anti-CSRF y `trustProxy`). Tests con `fastify.inject` de todos los criterios, incluido el log capturado sin la contraseña.

### T-01.04 · Crear el átomo `Link` y las moléculas `FormField` y `Alert`
- Estado: pendiente
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-01.01, T-00.07
- Paralelizable con: T-01.02, T-01.03
- Cubre: CA-01.13 (campos con error accesible y región de alerta), CA-01.17 (enlace)
- Archivos: apps/web/src/components/atoms/Link/…, apps/web/src/components/molecules/{FormField,Alert}/…, índices de nivel
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build-storybook
- Notas: skill `componente`, en un worktree de `.worktrees/`. `Link` polimórfico con `as` (sin importar React Router). `FormField` genera los ids y pasa `aria-describedby` y `aria-invalid` al campo hijo. `Alert` con `tone` (info, success, warning, danger) y `role` según el tono. Cada uno con story (estados normal, error, tonos) y test. Sin textos de negocio fijos.

### T-01.05 · Crear los organismos `LoginForm`, `DemoAccountsPanel` y `AppHeader`
- Estado: pendiente
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-01.04
- Paralelizable con: T-01.02, T-01.03
- Cubre: CA-01.13 (formulario), CA-01.15 (cabecera)
- Archivos: apps/web/src/components/organisms/{LoginForm,DemoAccountsPanel,AppHeader}/…, apps/web/src/components/organisms/index.ts, apps/web/src/lib/labels.ts (+ test)
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build-storybook
- Notas: skill `componente`, en el mismo worktree que T-01.04. Props según `plan.md`; presentacionales (sin queries, router ni sesión). `LoginForm` valida con `LoginInput` de `shared`, muestra los errores por campo y el `errorMessage` en un `Alert` danger, y no reenvía mientras `isSubmitting`. `DemoAccountsPanel` recibe las cuentas por props y llama a `onSelect(email)`. `AppHeader` muestra nombre, rol en español (`ROLE_LABELS` de `lib/labels.ts`) y "Cerrar sesión". Stories con los estados (vacío, con errores, enviando, error de la API) y tests de interacción.

### T-01.06 · Montar la página de login, las rutas protegidas, el cierre de sesión y la página 404
- Estado: pendiente
- Agente: frontend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-01.03, T-01.05
- Paralelizable con: —
- Cubre: CA-01.13, CA-01.14, CA-01.15, CA-01.16, CA-01.17
- Archivos: apps/web/src/queries/{auth.ts,auth.test.ts}, apps/web/src/app/{router.tsx,providers.tsx,providers.test.tsx,guards.tsx,ProtectedLayout.tsx,safe-next-path.ts (+ tests)}, apps/web/src/pages/{LoginPage,NotFoundPage}/…, apps/web/src/pages/HomePage/…
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build && prueba manual con `npm run dev` (login con los 4 usuarios demo, recarga, logout y ruta inexistente)
- Notas: skill `componente` para las páginas. `useCurrentUser` (401 → `null`), `useLogin` y `useLogout` (vacía la caché). `RequireSession` (indicador de carga mientras se resuelve `me`; sin sesión → `/login?next=`) y `RedirectIfAuthenticated`. `ProtectedLayout` = `AppLayout` + `AppHeader` + `<Outlet />`. `LoginPage` con `AuthLayout`, `LoginForm` y `DemoAccountsPanel` (con `DEMO_USERS` y `DEMO_PASSWORD` de `shared`), y el aviso de sesión caducada con `expired=1`. 401 durante el uso (fuera de `me` y `login`) → vaciar la caché y `router.navigate('/login?next=…&expired=1')`. `safeNextPath` impide el *open redirect*. `NotFoundPage` con el átomo `Link` y el `Link` de React Router (resuelve el pendiente de T-00.04). Tests con `fetch` simulado.

### T-01.07 · Desplegar F01 en Render y comprobar el login con los usuarios demo
- Estado: pendiente
- Agente: principal · Revisores: code-reviewer
- Depende de: T-01.06
- Paralelizable con: —
- Cubre: CA-01.12 (en producción), CA-01.8 (IP real detrás del *proxy*)
- Archivos: render.yaml, README.md (usuarios demo y contraseña)
- Verificación: CI en verde en el PR (`gh pr checks`) · tras el despliegue, login en https://incidapp.onrender.com con los 4 usuarios demo, recarga con la sesión mantenida y logout · `curl` a `POST /api/auth/login` sin `X-Requested-With` → 403 · la fila `LOGIN_SUCCEEDED` de `audit_log` en Neon tiene la IP pública real del cliente
- Notas: `startCommand: npm run db:migrate && npm run db:seed && npm start`. Si la IP de la auditoría es la del *proxy* de Render, ajustar `TRUST_PROXY_HOPS` en el panel de Render (sin cambiar código) y anotarlo aquí. README: tabla de usuarios demo con su rol y la contraseña `Demo2026!`. Abrir el PR `feat/F01-autenticacion` → `main` y hacer *squash merge* (ambos piden confirmación). Revisión de la UI en el navegador con el usuario antes del merge.

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
