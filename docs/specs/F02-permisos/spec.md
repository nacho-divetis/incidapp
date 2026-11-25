# F02 · Usuarios, departamentos y permisos — Spec

- **Estado:** aprobada (23/11/2026)
- **Depende de:** F01 (sesión, `CurrentUser`, `requireSession`, `audit_log`, usuarios demo)
- **Requisitos que cubre:** RF-04 (restringir por rol y departamentos), RF-05 (gestionar usuarios), RF-18 (en parte: cambios de usuarios), RNF-08 (autorización solo en el servidor, 404/403), RNF-12 (en parte: matriz de autorización)

## Objetivo
Que la autorización de IncidApp se decida en un único sitio, la `AuthorizationPolicy` (ADR-009), que aplica la matriz de [`permisos.md`](../../permisos.md) y calcula las `allowedActions` que la API devuelve. Encima de ella, el Admin gestiona los usuarios (alta, edición, rol, departamentos, desactivación) desde la web, y cada cambio queda auditado. F03 y F04 reutilizan la política sin reescribir reglas.

## Historias de usuario
- **HU-06** (de `requisitos.md`): Como **admin**, quiero dar de alta y de baja a usuarios y cambiar su rol y sus departamentos para controlar quién accede a qué.
- **HU-02.1:** Como **usuario de cualquier rol**, quiero ver en la navegación solo las secciones a las que tengo acceso, para no toparme con pantallas que no puedo usar.
- **HU-02.2:** Como **admin**, quiero que cada cambio de usuarios quede registrado (quién, qué, cuándo y desde dónde) para poder revisarlo en la auditoría (F06).
- **HU-02.3:** Como **responsable del proyecto**, quiero que los permisos estén en una sola política probada con una tabla de tests, para que ninguna feature posterior los rompa sin que falle un test.

## Criterios de aceptación

### Política de autorización (aplicación)

#### CA-02.1 · Matriz de incidencias en la política
- **Dado** un actor de cada rol y una incidencia descrita por su departamento propietario, su creador, su asignado y su estado
- **Cuando** se consulta la `AuthorizationPolicy` para cada acción de la tabla **Incidencias** de `permisos.md` (ver, editar, asignar, comentar, adjuntar, descargar un adjunto)
- **Entonces** la respuesta coincide con la matriz para cada combinación de rol × relación con la incidencia (de sus departamentos · creada por él · asignada a él · ninguna)
- **Y** se cumplen las dos reglas finas: un Usuario solo edita lo que ha creado **mientras esté ABIERTA**, y un Responsable fuera de sus departamentos tiene sobre lo que ha creado o tiene asignado los permisos de Usuario (nota ² de `permisos.md`)
- **Y** la comprobación es una tabla `it.each` que se lee fila a fila contra `permisos.md`

#### CA-02.2 · Transiciones por tipo y creación
- **Dado** un actor de cada rol y una incidencia con las relaciones de CA-02.1
- **Cuando** se consulta la política para una transición **operativa** o de **gestión** (tabla **Transiciones de estado** de `permisos.md`) y para **crear** una incidencia
- **Entonces** permite las operativas a Admin, Responsable (de sus dptos.) y Usuario (creador o asignado); las de gestión solo a Admin y Responsable (de sus dptos.); y crear a todos salvo Dirección
- **Y** la política no decide qué transiciones existen ni si piden comentario: eso es la máquina de estados de F04, que solo le pregunta por el tipo

#### CA-02.3 · De la política al error HTTP
- **Dado** un caso de uso que actúa sobre un recurso
- **Cuando** comprueba el permiso con el ayudante de la política
- **Entonces** si el recurso no es visible para el actor lanza `NotFoundError` (404), y si es visible pero la acción no está permitida lanza `ForbiddenError` (403), con mensajes en español (`permisos.md`, **Respuestas de la API**)

#### CA-02.4 · Acciones globales del usuario actual
- **Dado** un usuario con sesión de cada rol
- **Cuando** hace `POST /api/auth/login` o `GET /api/auth/me`
- **Entonces** `CurrentUser` incluye `allowedActions` globales calculadas por la política: crear incidencias (todos salvo Dirección), gestionar usuarios (solo Admin), consultar la auditoría (solo Admin) y ver el cuadro de mando (Admin y Dirección)
- **Y** si el Admin cambia el rol de un usuario, su siguiente `GET /api/auth/me` ya devuelve el rol y las acciones nuevas, sin cerrar su sesión

### Gestión de usuarios (API)

#### CA-02.5 · Solo el Admin gestiona usuarios
- **Dado** cualquier endpoint de `/api/users`
- **Cuando** lo llama un usuario con sesión de rol Dirección, Responsable o Usuario
- **Entonces** responde 403 con `ErrorResponse` (`code: "FORBIDDEN"`) y no modifica nada
- **Y** sin sesión responde 401

#### CA-02.6 · Listado y detalle de usuarios
- **Dado** un Admin con sesión
- **Cuando** hace `GET /api/users`
- **Entonces** responde 200 con todos los usuarios (activos y desactivados) ordenados por nombre, cada uno con `id`, `email`, `name`, `role`, `active`, `departments`, `createdAt` y sus `allowedActions`, y **nunca** `passwordHash`
- **Y** `GET /api/users/:id` devuelve un usuario con el mismo formato; si no existe o el id no es un UUID válido, responde 404

#### CA-02.7 · Alta de un usuario
- **Dado** un Admin con sesión
- **Cuando** hace `POST /api/users` con `{ email, name, role, departmentIds, password }`
- **Entonces** responde 201 con el usuario creado, activo, con el email normalizado (sin espacios y en minúsculas) y la contraseña guardada como hash argon2id
- **Y** responde 400 (`VALIDATION`, `details` en español) si falta un campo, el email no es válido, el nombre está vacío o pasa de 100 caracteres, la contraseña tiene menos de 8 o más de 200 caracteres, no hay ningún departamento o alguno no existe
- **Y** responde 409 (`CONFLICT`) "Ya existe un usuario con ese email." si el email ya está registrado, aunque sea de un usuario desactivado
- **Y** los campos que decide el servidor (`id`, `active`, `createdAt`, `passwordHash`) se ignoran

#### CA-02.8 · Edición de un usuario
- **Dado** un Admin con sesión y un usuario existente
- **Cuando** hace `PATCH /api/users/:id` con uno o varios de `name`, `email`, `role` y `departmentIds`
- **Entonces** responde 200 con el usuario actualizado, con las mismas validaciones y el mismo 409 por email repetido que en el alta
- **Y** los departamentos enviados sustituyen a los anteriores (al menos uno)
- **Y** la contraseña y el estado activo no se cambian por esta vía

#### CA-02.9 · Desactivar y reactivar
- **Dado** un Admin con sesión y otro usuario activo
- **Cuando** hace `POST /api/users/:id/deactivate`
- **Entonces** responde 200 con `active: false`, se borran todas las sesiones de ese usuario (su siguiente petición responde 401) y su login responde 401 con el mismo mensaje que unas credenciales incorrectas (CA-01.2)
- **Y** `POST /api/users/:id/activate` lo vuelve a activar y puede iniciar sesión de nuevo con su contraseña
- **Y** desactivar a un usuario ya desactivado (o activar a uno activo) responde 200 sin cambios y sin nueva fila de auditoría
- **Y** los usuarios nunca se borran: no existe `DELETE /api/users/:id`

#### CA-02.10 · El Admin no se bloquea a sí mismo
- **Dado** un Admin con sesión
- **Cuando** intenta desactivarse o quitarse el rol `ADMIN` a sí mismo
- **Entonces** responde 409 (`CONFLICT`) con un mensaje en español ("No puedes desactivarte ni quitarte el rol de Admin a ti mismo.") y no cambia nada (aclaración ³ de `permisos.md`)
- **Y** las `allowedActions` de su propio usuario no incluyen desactivar ni cambiar el rol

#### CA-02.11 · Usuarios demo protegidos
- **Dado** uno de los cuatro usuarios demo (`DEMO_USERS` de `shared`)
- **Cuando** un Admin intenta desactivarlo, cambiar su email, su rol o sus departamentos, o restablecer su contraseña
- **Entonces** responde 409 con un mensaje en español ("Los usuarios demo no se pueden modificar.") y no cambia nada; sí se puede cambiar su nombre
- **Y** sus `allowedActions` reflejan esas restricciones

#### CA-02.12 · Restablecer la contraseña
- **Dado** un Admin con sesión y otro usuario
- **Cuando** hace `POST /api/users/:id/password` con `{ password }` (8–200 caracteres)
- **Entonces** responde 204, la nueva contraseña se guarda como hash argon2id y se borran todas las sesiones de ese usuario
- **Y** la contraseña no aparece en la respuesta, en los logs ni en la auditoría

#### CA-02.13 · Auditoría de los cambios de usuarios
- **Dado** un alta, una edición, una desactivación, una reactivación o un restablecimiento de contraseña que **cambia algo**
- **Cuando** termina
- **Entonces** se inserta en `audit_log` una fila (`USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `USER_ACTIVATED` o `USER_PASSWORD_RESET`) con el Admin como actor, la entidad `user`, el id del usuario afectado, la IP y, en `before`/`after`, solo los campos que han cambiado
- **Y** nunca la contraseña ni su hash
- **Y** el cambio y su fila de auditoría se guardan juntos: si falla uno, no queda ninguno

#### CA-02.14 · Catálogo de departamentos
- **Dado** un usuario con sesión de cualquier rol
- **Cuando** hace `GET /api/departments`
- **Entonces** responde 200 con los nueve departamentos (`id`, `code`, `name`) ordenados por nombre
- **Y** sin sesión responde 401

#### CA-02.15 · Matriz de autorización de la API
- **Dado** un usuario de cada rol (y una petición sin sesión)
- **Cuando** llama a cada endpoint de F02 (`/api/users…` y `/api/departments`)
- **Entonces** el código de respuesta coincide con `permisos.md` (200/201/204, 401, 403 o 404), comprobado con una tabla `it.each` rol × endpoint
- **Y** la tabla está preparada para que F03 y F04 añadan filas para los endpoints de incidencias

### Web

#### CA-02.16 · Navegación según las acciones permitidas
- **Dado** un usuario con sesión
- **Cuando** se muestra cualquier página protegida
- **Entonces** la navegación de `AppLayout` muestra "Inicio" y, solo si `allowedActions` incluye gestionar usuarios, "Usuarios"
- **Y** el enlace de la página actual lleva `aria-current="page"`
- **Y** la web no comprueba el rol: decide solo con `allowedActions`
- **Actualizado el 25/11/2026 (T-07.10):** la primera entrada de la navegación es ahora "Incidencias" (F03), y "Inicio" se retiró con la página inicial.

#### CA-02.17 · Página sin permiso
- **Dado** un usuario sin la acción de gestionar usuarios
- **Cuando** abre a mano `/admin/usuarios` (o cualquiera de sus subrutas)
- **Entonces** ve una página "No tienes permiso para ver esta página." con un enlace a la página de inicio, sin pedir datos a `/api/users`

#### CA-02.18 · Listado de usuarios
- **Dado** un Admin en `/admin/usuarios`
- **Cuando** se carga la página
- **Entonces** muestra una tabla accesible (con cabeceras) con nombre, email, rol en español, departamentos y estado ("Activo" / "Desactivado"), un botón "Nuevo usuario" y, por fila, acceso a editar
- **Y** mientras carga muestra un indicador, y si la API falla, un `Alert` con el mensaje en español

#### CA-02.19 · Alta y edición desde la web
- **Dado** un Admin en `/admin/usuarios/nuevo` o en `/admin/usuarios/:id`
- **Cuando** rellena el formulario (nombre, email, rol, departamentos como casillas y, solo en el alta, contraseña) y lo envía
- **Entonces** se valida en el cliente con los esquemas de `shared`, con los errores junto a cada campo (`aria-invalid` + `aria-describedby`)
- **Y** un 409 por email repetido se muestra junto al campo "Email"
- **Y** al guardar vuelve al listado, que muestra los datos nuevos y un aviso de éxito
- **Y** en la edición, los campos que las `allowedActions` no permiten cambiar (rol del propio Admin; los protegidos de los usuarios demo, CA-02.11) aparecen deshabilitados con una explicación

#### CA-02.20 · Desactivar y reactivar desde la web
- **Dado** un Admin en la edición de un usuario
- **Cuando** las `allowedActions` lo permiten
- **Entonces** ve el botón "Desactivar usuario" (o "Reactivar usuario" si está desactivado); desactivar pide una confirmación explícita antes de llamar a la API
- **Y** tras la acción, el estado se actualiza en la página y en el listado
- **Y** si las `allowedActions` no lo permiten, el botón no aparece

#### CA-02.21 · Restablecer la contraseña desde la web
- **Dado** un Admin en la edición de un usuario cuyas `allowedActions` lo permiten
- **Cuando** escribe una contraseña nueva y la confirma
- **Entonces** se llama a `POST /api/users/:id/password`, se vacía el campo y se muestra "Contraseña restablecida. El usuario deberá iniciar sesión de nuevo."

## Permisos
- `docs/permisos.md` → **Definiciones** (rol, sus departamentos, departamento propietario, incidencia visible, usuario desactivado).
- `docs/permisos.md` → **Incidencias** completa, nota ² incluida: la implementa la política (CA-02.1). Los endpoints de incidencias llegan en F03/F04.
- `docs/permisos.md` → **Transiciones de estado**: columna "Quién" por tipo (operativa / gestión) (CA-02.2).
- `docs/permisos.md` → **Administración y consulta**: "Gestionar usuarios" y aclaración ³ (CA-02.5 a CA-02.13); "Cuadro de mando" y "Consultar la auditoría" solo como `allowedActions` globales (CA-02.4).
- `docs/permisos.md` → **Respuestas de la API** (CA-02.3, CA-02.15) y **Lo que nunca decide el cliente** (`role` solo lo fija el Admin en la gestión de usuarios; CA-02.7).

## Fuera de alcance
- Endpoints, pantallas y datos de incidencias (F03), máquina de estados y comentarios (F04), adjuntos (F05). En F02 la política de incidencias se prueba solo a nivel de aplicación.
- Panel de auditoría (F06): en F02 solo se registra. Cuadro de mando (F06).
- Borrado de usuarios (solo se desactivan). Alta o baja de departamentos (catálogo fijo del *seed*, RF-06).
- Filtros, búsqueda y paginación del listado de usuarios (la demo tiene pocos usuarios).
- Que un usuario cambie su propia contraseña o su perfil, recuperación de contraseña por email y políticas de complejidad más allá de la longitud.
- Permisos configurables o roles por departamento (rol global, ADR-009).
- E2E con Playwright (F07).

## Dudas resueltas (23/11/2026)
1. **Usuarios demo en la demo pública:** se protegen (CA-02.11). La API responde 409 si se intenta desactivarlos, cambiar su email, su rol, sus departamentos o su contraseña; el nombre sí se puede cambiar. Para probar la gestión, el Admin crea usuarios nuevos.
2. **Restablecer la contraseña por el Admin:** se incluye (CA-02.12 y CA-02.21).
3. **Transiciones:** la política responde por tipo de transición (operativa / gestión). F04 la combina con la máquina de estados para calcular las transiciones posibles.
