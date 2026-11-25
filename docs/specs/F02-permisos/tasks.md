# F02 · Usuarios, departamentos y permisos — Tareas

> Fuente de verdad del avance. El hook de inicio de sesión lee este archivo: respeta el formato (`### T-…` y las líneas `- Estado:` y `- Agente:`).
> Estados: `pendiente` · `en curso` · `hecha` · `bloqueada`

### T-02.01 · Ampliar el contrato en `shared` con estados, acciones, usuarios y auditoría
- Estado: hecha
- Agente: backend-dev · Revisores: code-reviewer
- Depende de: —
- Paralelizable con: —
- Cubre: CA-02.7 (esquema del alta), CA-02.8 (esquema de la edición), CA-02.11 (`isDemoUserEmail`), CA-02.12 (esquema del restablecimiento), CA-02.13 (acciones de auditoría)
- Archivos: packages/shared/src/{status.ts,authorization.ts,users.ts,audit.ts,demo-users.ts,index.ts} (+ tests)
- Verificación: npm test -w @incidapp/shared && npm run typecheck && npm run lint
- Notas: según la tabla **Contrato** de `plan.md`: `Status`, `GlobalAction`, `UserAction`, `UserAdmin`, `UserName`, `NewPassword`, `CreateUserInput`, `UpdateUserInput` (al menos un campo), `ResetPasswordInput`, las 5 acciones nuevas de `AuditAction` e `isDemoUserEmail`. El email reutiliza el esquema de `LoginInput` (extraerlo a una constante compartida). Mensajes de validación en español; campos extra descartados. **No** se toca `CurrentUser` aquí (lo amplía T-02.02 junto con la API, para que el `typecheck` siga en verde). Tests de cada esquema: válidos, límites (nombre 100, contraseña 8 y 200), departamentos vacíos o repetidos, `UpdateUserInput` vacío, campos extra. Hecha: el email se extrae a la constante `Email` (en `auth.ts`), que reutilizan `LoginInput` y los esquemas de usuarios; se exportan `USER_NAME_MAX_LENGTH` (100) y `PASSWORD_MIN_LENGTH` (8). `isDemoUserEmail` normaliza antes de comparar (una variante en mayúsculas no esquiva la protección). `UpdateUserInput` vacío da el error en la raíz (`path` vacío). `UserAdmin.createdAt` con `z.iso.datetime()`. Sin máximo de departamentos; la existencia la comprueba la API. 115 tests en `shared`. Revisión: aprobada, sin hallazgos. **Para T-02.03:** `AuditData` aún no admite arrays de *strings*.

### T-02.02 · Implementar la `AuthorizationPolicy` y las acciones globales del usuario actual
- Estado: hecha
- Agente: backend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-02.01
- Paralelizable con: T-02.05, T-02.06
- Cubre: CA-02.1, CA-02.2, CA-02.3, CA-02.4
- Archivos: apps/api/src/application/authorization/{authorization-policy.ts,authorize.ts} (+ tests), apps/api/src/application/auth/{login.ts,resolve-session.ts} (+ tests), packages/shared/src/auth.ts (+ test), fixtures de `CurrentUser` en los tests de apps/api y apps/web
- Verificación: npm test -w @incidapp/api -- authorization && npm run typecheck && npm run lint && npm test
- Notas: TDD. Funciones puras según `plan.md` (`canOnIncident`, `incidentActionsFor`, `globalActionsFor`, `userActionsFor`, `authorize`), sin puertos ni E/S. La matriz de incidencias y de transiciones por tipo es una tabla `it.each` en la que cada fila cita la fila de `docs/permisos.md`; incluye la nota ² (Responsable fuera de sus dptos. = Usuario) y "el Usuario edita solo en `OPEN`" con cada estado. `CurrentUser` gana `allowedActions: GlobalAction[]`, que calculan `login` y `resolveSession`; se actualizan los *fixtures* de `CurrentUser` de los tests de la API y de la web (`apps/web/src/test/`) para que todo siga compilando. Test de API: el cambio de rol en la BD se ve en el siguiente `GET /api/auth/me`. Ningún `role ===` fuera de `application/authorization/`. Hecha: el puerto `UserRepository` devuelve `CurrentUserProfile` (sin `allowedActions`) y las añaden `login` y `resolveSession`; `globalActionsFor` solo necesita el rol. Matriz de 128 filas (8 acciones × 4 roles × 4 relaciones) + estados de "editar" + nota ². "ABIERTA" es solo `OPEN` (no `REOPENED`). `userActionsFor`: el Admin puede restablecer su propia contraseña; un usuario demo solo tiene `rename` (aunque estuviera desactivado). **Decisión del usuario (23/11):** el Responsable fuera de sus dptos. edita lo que ha creado mientras esté ABIERTA (como un Usuario); se corrige la aclaración 2 de `permisos.md`, que lo omitía. Revisión: code-reviewer aprobada (1 bajo sin cambios: demo desactivado sin `activate`, no alcanzable por CA-02.11); security-reviewer sin hallazgos. **Para T-02.03:** 403 por `manageUsers` antes que el 404; si falta una `UserAction`, 409 con el mensaje de la regla; comprobar "sin cambio" antes que `deactivate`/`activate`.

### T-02.03 · Implementar la gestión de usuarios y el catálogo de departamentos en la API
- Estado: hecha
- Agente: backend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-02.02
- Paralelizable con: T-02.05, T-02.06
- Cubre: CA-02.5, CA-02.6, CA-02.7, CA-02.8, CA-02.9, CA-02.10, CA-02.11, CA-02.12, CA-02.13, CA-02.14
- Archivos: apps/api/src/application/ports/{user-admin-repository.ts,department-repository.ts,unit-of-work.ts,audit-log-writer.ts}, apps/api/src/application/users/… (+ tests), apps/api/src/application/departments/… (+ tests), apps/api/src/infrastructure/db/{unit-of-work.ts,repositories/{user-admin-repository,department-repository}.ts} (+ tests), apps/api/src/http/routes/{users.ts,departments.ts} (+ tests), apps/api/src/http/app.ts, apps/api/src/composition/container.ts, docs/adr/002-clean-architecture.md (nota)
- Verificación: npm test -w @incidapp/api && npm run typecheck && npm run lint **Revisión:** hallazgo medio (lectura y diff fuera de la transacción en `update-user` y `set-user-active`) aceptado: con pocos Admin, una carrera solo duplicaría una fila de auditoría o daría un `before` desfasado, sin corromper datos.
- Notas: skill `caso-de-uso`. Endpoints, códigos y mensajes según `plan.md`: 403 por no ser Admin antes que el 404 y que la validación del cuerpo; `:id` no UUID → 404; 409 por regla de negocio (uno mismo, usuario demo, email repetido también de un inactivo); desactivar o activar sin cambio → 200 sin auditoría; *diff* en el `PATCH` (solo lo que cambia pide su `UserAction` y se audita). `UnitOfWork` con `db.transaction`: cambio + borrado de sesiones + auditoría juntos, con un test de reversión. Auditoría con `before`/`after` de los campos cambiados (departamentos por código), nunca contraseña ni *hash*. `cache-control: no-store` en `/api/users*`. Tests con `fastify.inject` de cada criterio, incluido que el usuario desactivado da 401 en su siguiente petición y que el reset cierra sus sesiones. Sin migración nueva. Nota en ADR-002 sobre la `UnitOfWork`.

### T-02.04 · Escribir la matriz de autorización de la API
- Estado: hecha
- Agente: qa-tester · Revisores: code-reviewer
- Depende de: T-02.03
- Paralelizable con: T-02.07
- Cubre: CA-02.15
- Archivos: apps/api/src/http/authorization-matrix.test.ts, apps/api/src/http/test-support.ts (ayudas para crear un usuario con sesión de cada rol)
- Verificación: npm test -w @incidapp/api -- authorization-matrix && npm run lint **Revisión de la política contra `permisos.md`:** sin diferencias. Observaciones para documentar: el Admin puede restablecer su propia contraseña; la protección de los usuarios demo viene de CA-02.11; la regla "el asignado es un usuario activo del departamento propietario" corresponde al caso de uso de asignar (F03).
- Notas: tabla `it.each` `{ método, endpoint, sin sesión, ADMIN, DIRECTOR, MANAGER, USER }` con todos los endpoints de F02 (`/api/users…`, `/api/departments`), con `X-Requested-With` y cuerpos válidos para que el código dependa solo del permiso. Comprueba también que un no-Admin recibe 403 (no 404) con un id inexistente. Estructura pensada para que F03 y F04 añadan filas con incidencias visibles y no visibles. Revisa además la tabla de la política de T-02.02 contra `docs/permisos.md` y propone (no corrige) las diferencias que encuentre. No toca código de producción.

### T-02.05 · Instalar Radix y crear el átomo `Table` y las moléculas `CheckboxGroup`, `ConfirmDialog` y `PageHeader`
- Estado: hecha
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-02.01
- Paralelizable con: T-02.02, T-02.03
- Cubre: CA-02.18 (tabla accesible), CA-02.19 (departamentos como casillas), CA-02.20 (confirmación)
- Archivos: apps/web/package.json, package-lock.json, apps/web/src/components/atoms/Table/…, apps/web/src/components/molecules/{CheckboxGroup,ConfirmDialog,PageHeader}/…, índices de nivel
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build-storybook
- Notas: skill `componente`, en un worktree de `.worktrees/`. Dependencia `@radix-ui/react-alert-dialog` (MIT, aprobada por el usuario el 23/11; la instalación pide confirmación). Props según `plan.md`. `Table` con partes semánticas, `scope` en las cabeceras y desplazamiento horizontal propio en móvil. `CheckboxGroup` con `fieldset`/`legend` y el error asociado. `ConfirmDialog` con el foco inicial en "Cancelar" y `tone` danger. Sin textos de negocio fijos ni `@incidapp/shared` en el átomo. Cada uno con story y test; axe sin violaciones. Hecha: `@radix-ui/react-alert-dialog@^1.2.1` (MIT). `Table` añade `TableCaption`, `containerClassName` y `regionLabel` (región enfocable para tablas anchas sin elementos enfocables; `UserTable` no la necesita porque tiene enlaces). `CheckboxGroup` con `required`, `emptyMessage`, `columns` (1–2) y `ref` al `fieldset`. `ConfirmDialog` con `trigger` y `children` opcionales; **confirmar no cierra**: lo cierra quien lo usa con `open=false` al terminar; con `isConfirming` no se puede cerrar. axe sin violaciones en las 21 stories (jsdom) y en Chrome a 320 y 1024 px. 339 tests en web. Revisión: aprobada (1 bajo sin cambios: `Table` ancha sin `regionLabel` ni enfocables da aviso de axe; documentado en el JSDoc). **Para T-02.06:** tras desactivar, llevar el foco al aviso o al botón nuevo; el `Alert` de error dentro del diálogo se pasa desde el organismo (las moléculas no se importan entre sí). Aviso: `architecture.test.ts` puede superar los 5 s en frío.

### T-02.06 · Crear los organismos `MainNav`, `UserTable`, `UserForm` y `UserAccountActions`
- Estado: hecha
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-02.05
- Paralelizable con: T-02.02, T-02.03
- Cubre: CA-02.16 (navegación), CA-02.18 (tabla de usuarios), CA-02.19 (formulario), CA-02.20 (desactivar y reactivar), CA-02.21 (restablecer la contraseña)
- Archivos: apps/web/src/components/organisms/{MainNav,UserTable,UserForm,UserAccountActions}/…, apps/web/src/components/organisms/index.ts, apps/web/src/lib/labels.ts (si hacen falta textos nuevos)
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build-storybook
- Notas: skill `componente`, en el mismo worktree que T-02.05. Presentacionales (sin queries, router ni sesión); props según `plan.md`. `UserForm` valida con `CreateUserInput`/`UpdateUserInput` de `shared`, muestra `fieldErrors` del servidor (409 de email) y deshabilita, con una explicación, los campos que `allowedActions` no permite. `UserAccountActions` muestra cada acción solo si su `UserAction` está en `allowedActions`; desactivar pasa por `ConfirmDialog`; el restablecimiento pide la contraseña dos veces. Stories con los estados (vacío, errores, enviando, campos bloqueados, usuario demo, uno mismo, desactivado) y tests de interacción.

### T-02.07 · Montar las páginas de usuarios, la guarda por acción y la navegación
- Estado: hecha
- Agente: frontend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-02.03, T-02.06
- Paralelizable con: T-02.04
- Cubre: CA-02.16, CA-02.17, CA-02.18, CA-02.19, CA-02.20, CA-02.21
- Archivos: apps/web/src/queries/{users.ts,departments.ts} (+ tests), apps/web/src/app/{router.tsx,guards.tsx,ProtectedLayout.tsx,nav-items.ts} (+ tests), apps/web/src/pages/{UsersPage,UserCreatePage,UserEditPage,ForbiddenPage}/…
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build && prueba manual con `npm run dev` (como Admin: crear, editar, desactivar, reactivar y restablecer; como Usuario: no ve "Usuarios" y `/admin/usuarios` muestra "No tienes permiso") **Revisión:** hallazgo medio corregido (la `key` del formulario de edición incluye `dataUpdatedAt` para no quedarse con datos obsoletos). La prueba manual se hace en producción en T-02.08.
- Notas: skill `componente` para las páginas. `RequireAction({ action: 'manageUsers' })` pinta `ForbiddenPage` sin montar la página. `navItemsFor(allowedActions, pathname)` en `app/` (no mira el rol). Mutaciones que actualizan `['users', id]` e invalidan `['users']` (y `me` si el usuario editado es el actual). 409 de email → `fieldErrors.email`. Aviso de éxito por `location.state`. Tests de páginas con `fetch` simulado.

### T-02.08 · Desplegar F02 en Render y comprobar la gestión de usuarios
- Estado: pendiente
- Agente: principal · Revisores: code-reviewer
- Depende de: T-02.04, T-02.07
- Paralelizable con: —
- Cubre: CA-02.11 (en producción), CA-02.9 (en producción)
- Archivos: README.md (gestión de usuarios y usuarios demo protegidos)
- Verificación: CI en verde en el PR (`gh pr checks`) · en https://incidapp.onrender.com como Admin: crear un usuario, iniciar sesión con él, desactivarlo (su sesión da 401), reactivarlo y restablecer su contraseña; intentar desactivar un usuario demo → 409; como Usuario, sin "Usuarios" en la navegación y 403 en `GET /api/users` · filas `USER_*` en `audit_log` de Neon sin contraseñas
- Notas: abrir el PR `feat/F02-permisos` → `main` y hacer *squash merge* (ambos piden confirmación). README: nota de que los usuarios demo no se pueden modificar y de que para probar la gestión se crean usuarios nuevos.

---

## Cobertura

| Criterio | Tareas |
|---|---|
| CA-02.1 | T-02.02, T-02.04 (revisión contra `permisos.md`) |
| CA-02.2 | T-02.02 |
| CA-02.3 | T-02.02 |
| CA-02.4 | T-02.02 |
| CA-02.5 | T-02.03, T-02.04 |
| CA-02.6 | T-02.03 |
| CA-02.7 | T-02.01 (esquema), T-02.03 |
| CA-02.8 | T-02.01 (esquema), T-02.03 |
| CA-02.9 | T-02.03, T-02.08 |
| CA-02.10 | T-02.03 |
| CA-02.11 | T-02.01 (`isDemoUserEmail`), T-02.03, T-02.08 |
| CA-02.12 | T-02.01 (esquema), T-02.03 |
| CA-02.13 | T-02.01 (acciones), T-02.03 |
| CA-02.14 | T-02.03 |
| CA-02.15 | T-02.04 |
| CA-02.16 | T-02.06, T-02.07 |
| CA-02.17 | T-02.07 |
| CA-02.18 | T-02.05, T-02.06, T-02.07 |
| CA-02.19 | T-02.05, T-02.06, T-02.07 |
| CA-02.20 | T-02.05, T-02.06, T-02.07 |
| CA-02.21 | T-02.06, T-02.07 |
