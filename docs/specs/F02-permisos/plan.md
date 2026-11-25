# F02 · Usuarios, departamentos y permisos — Plan

> **Nota (25/11/2026):** `HomePage` (`/`), `queries/health.ts` y la entrada "Inicio" de la navegación se retiraron en T-07.10 (F07): `/` y el login llevan al listado de incidencias (CA-07.5). Este plan se conserva como se ejecutó.

- **Estado:** aprobado (23/11/2026, por el usuario)
- **Spec:** `spec.md` (aprobada el 23/11)

## Contrato (`packages/shared`)

| Esquema / constante | Uso |
|---|---|
| `Status` | `z.enum(['OPEN', 'IN_PROGRESS', 'PENDING_THIRD_PARTY', 'RESOLVED', 'CLOSED', 'REJECTED', 'REOPENED'])` (`docs/glosario.md`). F02 lo necesita para la regla "el Usuario edita solo mientras esté ABIERTA"; F03 y F04 lo reutilizan |
| `GlobalAction` | `z.enum(['createIncident', 'manageUsers', 'viewAudit', 'viewDashboard'])`. Acciones que no dependen de un recurso |
| `CurrentUser` | se añade `allowedActions: GlobalAction[]` (CA-02.4). Lo devuelven `login` y `me` |
| `UserAction` | `z.enum(['rename', 'changeEmail', 'changeRole', 'changeDepartments', 'deactivate', 'activate', 'resetPassword'])`. Acciones del Admin sobre un usuario concreto |
| `UserAdmin` | `{ id, email, name, role, active, departments: DepartmentSummary[], createdAt: ISO string, allowedActions: UserAction[] }`. Respuesta de `GET /api/users`, `GET /api/users/:id` y de las mutaciones |
| `UserName` · `NewPassword` | nombre (trim, 1–100) y contraseña nueva (8–200, sin trim). Reutilizados por los esquemas de entrada |
| `CreateUserInput` | `{ email (mismo esquema que en `LoginInput`), name: UserName, role: Role, departmentIds: uuid[] (≥ 1, sin repetidos), password: NewPassword }`. Objeto no estricto: los campos extra se descartan (CA-02.7) |
| `UpdateUserInput` | `{ email?, name?, role?, departmentIds? }` con al menos un campo. Sin `password` ni `active` (CA-02.8) |
| `ResetPasswordInput` | `{ password: NewPassword }` |
| `AuditAction` | se añaden `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `USER_ACTIVATED` y `USER_PASSWORD_RESET` |
| `isDemoUserEmail(email)` | `true` si el email es de `DEMO_USERS`. Una sola fuente para la protección de los usuarios demo (CA-02.11) |

Los mensajes de validación, en español, como en `LoginInput`. Las acciones de incidencias (`IncidentAction`) **no** van a `shared` en F02: las expone F03 cuando las devuelva la API; en F02 son un tipo de `application/`.

## API

| Método y ruta | Caso de uso | Permiso | Respuestas |
|---|---|---|---|
| `GET /api/users` | `listUsers` | `manageUsers` | 200 `UserAdmin[]` · 401 · 403 |
| `GET /api/users/:id` | `getUser` | `manageUsers` | 200 `UserAdmin` · 401 · 403 · 404 |
| `POST /api/users` | `createUser` | `manageUsers` | 201 `UserAdmin` · 400 · 401 · 403 · 409 |
| `PATCH /api/users/:id` | `updateUser` | `manageUsers` + `UserAction` de cada campo que cambia | 200 `UserAdmin` · 400 · 401 · 403 · 404 · 409 |
| `POST /api/users/:id/deactivate` | `setUserActive(false)` | `manageUsers` + `deactivate` | 200 `UserAdmin` · 401 · 403 · 404 · 409 |
| `POST /api/users/:id/activate` | `setUserActive(true)` | `manageUsers` + `activate` | 200 `UserAdmin` · 401 · 403 · 404 · 409 |
| `POST /api/users/:id/password` | `resetUserPassword` | `manageUsers` + `resetPassword` | 204 · 400 · 401 · 403 · 404 · 409 |
| `GET /api/departments` | `listDepartments` | con sesión | 200 `DepartmentSummary[]` · 401 |

- Todas con `requireSession` (F01). El 403 por no ser Admin se comprueba **antes** que el 404 y que la validación del cuerpo: un no-Admin nunca sabe si un id existe (CA-02.5).
- `:id` que no es un UUID → 404 (no 400), igual que un id inexistente (CA-02.6).
- **409 frente a 403 en las acciones sobre un usuario:** si `allowedActions` del usuario objetivo no incluye la acción por una regla de negocio (ser uno mismo, ser usuario demo), la respuesta es **409** `CONFLICT` con el mensaje de la regla (CA-02.10, CA-02.11), como fija la aclaración ³ de `permisos.md`. Desactivar a un inactivo o activar a un activo es **200 sin cambios** (CA-02.9), no 409.
- **Solo cuenta lo que cambia:** un `PATCH` que envía el mismo rol o los mismos departamentos que ya tiene no pide `changeRole`/`changeDepartments` ni genera auditoría. Así el formulario puede enviar todos los campos.
- Respuestas de `/api/users*` con `cache-control: no-store`.
- `logger.redact` ya cubre `req.body.password` (F01).

## Dominio y aplicación

### `AuthorizationPolicy` (`application/authorization/`)
Funciones puras, sin puertos ni E/S; la única fuente de la autorización (ADR-009):

- `Actor = { id, role, departmentIds }` (se obtiene de `CurrentUser`).
- `IncidentAccessFacts = { ownerDepartmentId, createdById, assignedToId: string | null, status: Status }`. F03 construye estos hechos a partir de la incidencia.
- `IncidentAction = 'view' | 'update' | 'assign' | 'comment' | 'attach' | 'downloadAttachment' | 'operationalTransition' | 'managementTransition'`.
- `canOnIncident(actor, facts, action): boolean` — la tabla **Incidencias** y la columna "Quién" de **Transiciones** de `permisos.md`. Internamente calcula la relación del actor con la incidencia: `ADMIN` · `DIRECTOR` · `MANAGER` de sus dptos. · `USER`-equivalente (creador o asignado, incluido el Responsable fuera de sus dptos., nota ²) · ninguna (no visible).
- `incidentActionsFor(actor, facts): IncidentAction[]` — para las `allowedActions` de F03.
- `globalActionsFor(actor): GlobalAction[]` (CA-02.4).
- `userActionsFor(actor, target: { id, email, active }): UserAction[]` — vacío si el actor no es Admin; sin `deactivate` ni `changeRole` sobre sí mismo; solo `rename` sobre un usuario demo (`isDemoUserEmail`); `deactivate` si está activo y `activate` si no (CA-02.10, CA-02.11).
- `authorize({ visible, allowed })` — ayudante para los casos de uso: `!visible` → `NotFoundError`, `!allowed` → `ForbiddenError` (CA-02.3). `NotFoundError`, `ForbiddenError` y `ConflictError` ya existen en `application/errors.ts` y `http/error-handler.ts` ya los traduce a 404/403/409.

### Usuario actual
- `login` y `resolveSession` añaden `allowedActions: globalActionsFor(user)` al `CurrentUser`. Como `resolveSession` lee el usuario de la BD en cada petición, un cambio de rol se nota en la siguiente (CA-02.4).

### Puertos nuevos (`application/ports/`)
- `UserAdminRepository`: `list()`, `findById(id)`, `findByEmail(email)` (incluye inactivos), `create(data)`, `update(id, changes)` (incl. sustituir departamentos), `setActive(id, active)`, `setPasswordHash(id, hash)`. Devuelven el usuario con sus departamentos; nunca el *hash* hacia fuera del adaptador salvo en `UserAccount` (F01).
- `DepartmentRepository`: `list()` (ordenados por nombre) y `findByIds(ids)` (para validar que existen → 400 si falta alguno).
- `UnitOfWork`: `run(fn: (tx: { users: UserAdminRepository; sessions: SessionRepository; auditLog: AuditLogWriter }) => Promise<T>)`. El cambio, el borrado de sesiones y su fila de auditoría van en **una transacción** (CA-02.13).

### Casos de uso (`application/users/` y `application/departments/`)
Reciben el `actor` (`CurrentUser`), la IP y sus dependencias por parámetro. Todos empiezan con `authorize({ visible: true, allowed: globalActionsFor(actor).includes('manageUsers') })` → 403.

- `listUsers`, `getUser(id)` → `UserAdmin` con `allowedActions = userActionsFor(actor, user)`.
- `createUser(input)` → valida departamentos, 409 si el email existe (también inactivos), *hash* argon2id, inserta + `USER_CREATED` (`after` sin contraseña) en la transacción.
- `updateUser(id, input)` → calcula el *diff*; por cada campo que cambia exige su `UserAction` (409 con el mensaje de la regla si falta); valida departamentos y email único; actualiza + `USER_UPDATED` con `before`/`after` de los campos cambiados. Sin cambios → 200 sin auditoría.
- `setUserActive(id, active)` → sin cambio → 200; si no, exige `deactivate`/`activate`, actualiza, al desactivar borra **todas** sus sesiones, y audita `USER_DEACTIVATED`/`USER_ACTIVATED`.
- `resetUserPassword(id, password)` → exige `resetPassword`, *hash*, borra sus sesiones y audita `USER_PASSWORD_RESET` sin `before`/`after` de contraseña.
- `listDepartments` → con sesión.

`AuditData` admite arrays de *strings* para registrar los códigos de departamento antes y después.

## Base de datos

- **Sin cambios de esquema.** `users`, `user_departments`, `departments`, `sessions` y `audit_log` ya existen (F00/F01). No hay migración nueva.
- Adaptadores Drizzle nuevos: `db/repositories/{user-admin-repository,department-repository}.ts` y `db/unit-of-work.ts` (`db.transaction`, que funciona igual con PGlite y node-postgres). Los repositorios existentes aceptan el `tx` para reutilizarlos dentro de la transacción.
- Unicidad del email: la garantiza el índice único de `users.email`; el caso de uso comprueba antes para responder 409, y el adaptador traduce la violación de unicidad (carrera) a `ConflictError`.

## Interfaz (atomic design)

Inventario actual: átomos `Badge`, `Button`, `Checkbox`, `Heading`, `Icon`, `Input`, `Label`, `Link`, `Select`, `Spinner`, `Text`, `Textarea`; moléculas `Alert`, `FormField`; organismos `AppHeader`, `DemoAccountsPanel`, `LoginForm`; plantillas `AppLayout`, `AuthLayout`.

**Dependencia nueva (aprobada):** `@radix-ui/react-alert-dialog` (MIT, gratuita) para la confirmación de desactivar, accesible (foco atrapado, `Escape`, `aria-*`).

### Páginas y `app/`

| Página / pieza | Ruta | Plantilla | Acción requerida | Queries / mutaciones |
|---|---|---|---|---|
| `UsersPage` | `/admin/usuarios` | `AppLayout` (vía `ProtectedLayout`) | `manageUsers` | `useUsers()` |
| `UserCreatePage` | `/admin/usuarios/nuevo` | ídem | `manageUsers` | `useDepartments()`, `useCreateUser()` |
| `UserEditPage` | `/admin/usuarios/:id` | ídem | `manageUsers` | `useUser(id)`, `useDepartments()`, `useUpdateUser()`, `useSetUserActive()`, `useResetUserPassword()` |
| `ForbiddenPage` | (la pinta la guarda) | dentro de `AppLayout` | — | — |
| `app/guards.tsx` | — | — | — | `RequireAction({ action })`: si `CurrentUser.allowedActions` no la incluye, pinta `ForbiddenPage` sin montar la página (no llama a `/api/users`, CA-02.17) |
| `app/ProtectedLayout.tsx` | — | — | — | Pasa a `AppLayout.nav` el organismo `MainNav` con los enlaces de `app/nav-items.ts` |
| `app/nav-items.ts` | — | — | — | `navItemsFor(allowedActions, pathname)` (función pura + test): "Inicio" siempre; "Usuarios" con `manageUsers`. No mira el rol (CA-02.16) |

- `queries/users.ts`: `useUsers`, `useUser(id)`, `useCreateUser`, `useUpdateUser(id)`, `useSetUserActive(id)`, `useResetUserPassword(id)`. Las mutaciones actualizan la caché de `['users', id]` e invalidan `['users']`. Si la mutación afecta al propio usuario (rename o email), invalidan también `me`.
- `queries/departments.ts`: `useDepartments()` (`staleTime` largo: catálogo fijo).
- **Aviso de éxito al volver al listado:** por `location.state` (`{ notice: 'Usuario creado.' }`), que `UsersPage` muestra en un `Alert` success.
- **409 de email en el campo:** la página traduce `ApiError` 409 de `createUser`/`updateUser` a `fieldErrors.email`; cualquier otro error va al `Alert` del formulario.

### Componentes

| Nivel | Componente | Nuevo / variante / reutilizado | Notas (props, `allowedActions`) |
|---|---|---|---|
| Átomo | `Button`, `Input`, `Select`, `Checkbox`, `Label`, `Text`, `Heading`, `Badge`, `Spinner`, `Link` | reutilizados | — |
| Átomo | `Table` | nuevo | Partes semánticas (`Table`, `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell` con `scope`, `TableCell`) con los tokens; contenedor con desplazamiento horizontal propio en móvil (la página no se desborda). Lo reutiliza el listado de incidencias de F03 |
| Molécula | `FormField`, `Alert` | reutilizados | — |
| Molécula | `CheckboxGroup` | nuevo | `legend`, `options: { value, label, description? }[]`, `value: string[]`, `onChange`, `error?`, `disabled?`, `hint?`. `fieldset` + `legend`, error con `aria-describedby` en el `fieldset` |
| Molécula | `ConfirmDialog` | nuevo | Radix `AlertDialog`: `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `cancelLabel`, `tone` (`danger`/`default`), `onConfirm`, `isConfirming`. El foco inicial va a "Cancelar" |
| Molécula | `PageHeader` | nuevo | `title` (h1), `description?`, `actions?` (huecos). Lo reutilizan F03–F06 |
| Organismo | `MainNav` | nuevo | `items: { label, href, current }[]`, `linkAs?` (el `Link` de React Router lo pasa `app/`). Lista de enlaces sin `<nav>` propio (lo pone `AppLayout`), con `aria-current="page"` |
| Organismo | `UserTable` | nuevo | `users: UserAdmin[]`, `getEditHref(id)`, `linkAs?`. Columnas: nombre (enlace a editar), email, rol (`ROLE_LABELS`), departamentos (códigos con `title` del nombre), estado (`Badge` "Activo"/"Desactivado"). Estado vacío |
| Organismo | `UserForm` | nuevo | `mode: 'create' \| 'edit'`, `departments: DepartmentSummary[]`, `defaultValues?`, `allowedActions?: UserAction[]` (en edición, deshabilita con explicación los campos que no permite), `onSubmit(values)`, `isSubmitting`, `fieldErrors?`, `errorMessage?`, `cancelHref`, `linkAs?`. Valida con `CreateUserInput`/`UpdateUserInput`. Contraseña solo en `create` |
| Organismo | `UserAccountActions` | nuevo | `user: Pick<UserAdmin, 'name' \| 'active' \| 'allowedActions'>`, `onDeactivate`, `onActivate`, `onResetPassword(password)`, estados `isPending…` y `notice?`/`errorMessage?`. Botón "Desactivar usuario" con `ConfirmDialog` o "Reactivar usuario"; formulario "Restablecer contraseña" (contraseña + confirmación, valida con `ResetPasswordInput`). Cada parte solo aparece si su `UserAction` está en `allowedActions` (CA-02.20, CA-02.21) |
| Plantilla | `AppLayout` | reutilizada | Su hueco `nav` se llena por primera vez |

Los textos de negocio de los organismos ("Nuevo usuario", "Desactivar usuario"…) van en el organismo (en español, como en F01); los átomos y moléculas no tienen textos de negocio fijos.

## Tests

- **Política (aplicación, `it.each`):** la matriz completa de CA-02.1 y CA-02.2 — 4 roles × relación (sus dptos. · creada · asignada · ninguna, y Responsable fuera de sus dptos. con creada/asignada) × acción, más "Usuario edita solo en `OPEN`" con cada estado. Cada fila cita la fila de `permisos.md`. `globalActionsFor` por rol; `userActionsFor` (uno mismo, demo, activo/inactivo, no Admin); `authorize` → 404/403.
- **Casos de uso (con *fakes*):** alta, edición con *diff*, no-ops sin auditoría, 409 por email (también inactivo), 409 de uno mismo y de demo, desactivar borra sesiones, reset borra sesiones, auditoría sin contraseña ni *hash*, y la transacción revierte el cambio si falla la auditoría (*fake* que lanza).
- **Infraestructura (PGlite):** repositorios nuevos, `UnitOfWork` que revierte, sustitución de departamentos, carrera de email → `ConflictError`.
- **API (`fastify.inject`):** CA-02.4 a CA-02.14 de punta a punta, incluido "el usuario desactivado da 401 en su siguiente petición" y "el cambio de rol se ve en el siguiente `me`".
- **Matriz de autorización de la API (CA-02.15, `qa-tester`):** `apps/api/src/http/authorization-matrix.test.ts` con una tabla `{ endpoint, método, rol → estado esperado }` y ayudas para crear un usuario con sesión de cada rol (`http/test-support`). Pensada para que F03/F04 añadan filas.
- **Web:** stories + tests de los componentes nuevos (axe sin violaciones); `navItemsFor`; `RequireAction`; páginas con `fetch` simulado (listado, alta con 409 en el campo, edición con campos deshabilitados, desactivar con confirmación, reset).
- **E2E:** ninguno (F07).

## Riesgos y decisiones

- **La política se escribe antes que las incidencias** → se prueba sobre `IncidentAccessFacts` (hechos mínimos), no sobre la entidad de F03. Si F03 necesita otro hecho, se añade a la política y a su tabla, no en el caso de uso.
- **Dispersión de la autorización** → los casos de uso solo llaman a funciones de `authorization/`; ningún `role ===` fuera de ese módulo (se comprueba en la revisión con un `grep`; una regla de ESLint es desproporcionada).
- **Demo rota por un Admin anónimo** → usuarios demo protegidos por email (CA-02.11). Sigue siendo posible crear muchos usuarios; con datos moderados y Neon gratuito es aceptable (la limpieza de datos demo es de F07).
- **Transacciones con PGlite** → `db.transaction` de Drizzle está soportado; se prueba la reversión en infraestructura.
- **Cambiar el propio email del Admin** → permitido (no bloquea el acceso); `me` se invalida en la web.
- **Mensajes de 409** en español, definidos en los casos de uso: "Ya existe un usuario con ese email.", "No puedes desactivarte ni quitarte el rol de Admin a ti mismo.", "Los usuarios demo no se pueden modificar."
- **Rama y paralelismo:** `feat/F02-permisos` desde `main`. Tras el contrato (T-02.01), la API y los componentes van en paralelo; los componentes en un worktree de `.worktrees/`.
- **ADR:** ninguno nuevo. Aplican ADR-009 (permisos en el servidor) y ADR-002 (capas). La `UnitOfWork` se anota en ADR-002 como el patrón para cambios + auditoría.
