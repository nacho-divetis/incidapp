# F03 · Incidencias — Spec

- **Estado:** aprobada (25/11/2026, por el usuario)
- **Depende de:** F02 (`AuthorizationPolicy`, `canOnIncident`, `incidentActionsFor`, `authorize`, `GlobalAction.createIncident`, catálogo de departamentos, `UnitOfWork`)
- **Requisitos que cubre:** RF-06 (catálogo de tipos), RF-07 (alta), RF-08 (código `INC-AAAA-NNNN`), RF-09 (edición), RF-10 (asignación), RF-11 (listado con filtros, **reducido**: ver "Fuera de alcance"), RF-12 (detalle con acciones permitidas), RNF-08 (404/403), RNF-14 (fechas `dd/mm/aaaa`, `Europe/Madrid`)

## Objetivo
Que un usuario registre una incidencia indicando su tipo, que llegue al departamento que la debe resolver con un código legible, y que cada rol la vea, la edite y la asigne solo según `permisos.md`. Es el MVP sobre el que F04 añade los estados y el historial. Alcance recortado para implementarse en ~1 día (congelación: viernes 27/11/2026 a las 20:00).

## Historias de usuario
- **HU-01** (de `requisitos.md`): Como **usuario**, quiero registrar una incidencia indicando su tipo para que llegue al departamento que debe resolverla, y seguir viéndola aunque sea de otro departamento.
- **HU-03** (de `requisitos.md`): Como **responsable**, quiero ver las incidencias de mis departamentos, filtrarlas y asignarlas a mi equipo para repartir el trabajo.
- **HU-03.1:** Como **usuario de cualquier rol**, quiero abrir el detalle de una incidencia y ver solo los botones de lo que puedo hacer, para no intentar acciones que me van a rechazar.

## Criterios de aceptación

### API

#### CA-03.1 · Catálogo de tipos de incidencia
- **Dado** una base de datos migrada
- **Cuando** se ejecuta `npm run db:seed` dos veces
- **Entonces** existen exactamente los 7 tipos de `requisitos.md` (Transporte → LOG, Proveedor → COMP, Cliente / Reclamación → ATC, Calidad → CAL, Técnica / Instalación → TEC, Administrativa → ADM, Interna / Operativa → PROD), sin duplicados
- **Y** `GET /api/incident-types` con sesión de cualquier rol responde 200 con `id`, `code`, `name` y su departamento por defecto (`id`, `code`, `name`), ordenados por nombre; sin sesión, 401

#### CA-03.2 · Alta de una incidencia
- **Dado** un Admin, Responsable o Usuario con sesión
- **Cuando** hace `POST /api/incidents` con `{ title, description, typeId, priority, dueDate? }`
- **Entonces** responde 201 con la incidencia creada: `code` nuevo, `status: "OPEN"`, departamento propietario = departamento por defecto del tipo, `createdBy` = el actor, sin asignado, y sus `allowedActions`
- **Y** se inserta en `incident_events` un evento `CREATED` con el actor, en la misma transacción que el alta
- **Y** los campos que decide el servidor (`code`, `status`, `departmentId`, `createdBy`, `assignedTo`, fechas de creación, resolución y cierre) se ignoran (`permisos.md`, **Lo que nunca decide el cliente**)

#### CA-03.3 · Validación del alta
- **Dado** un cuerpo con el título vacío o de más de 150 caracteres, la descripción vacía o de más de 5000, una prioridad que no es de `Priority`, un `dueDate` que no es una fecha `AAAA-MM-DD` o un `typeId` que no existe
- **Cuando** hace `POST /api/incidents`
- **Entonces** responde 400 (`VALIDATION`) con `details` en español y no crea nada (ni incidencia, ni código consumido, ni evento)

#### CA-03.4 · Código correlativo por año
- **Dado** que en el año en curso (zona `Europe/Madrid`, reloj inyectado) ya existen *n* incidencias
- **Cuando** se crea otra
- **Entonces** su código es `INC-AAAA-NNNN` con *n* + 1 rellenado con ceros a 4 cifras (`INC-2026-0001`, `INC-2026-0002`…)
- **Y** varias altas simultáneas obtienen códigos distintos y sin huecos (contador en `code_counters` incrementado en la misma transacción)
- **Y** la primera incidencia de un año nuevo vuelve a `0001`

#### CA-03.5 · Quién puede crear
- **Dado** un usuario de Dirección con sesión
- **Cuando** hace `POST /api/incidents`
- **Entonces** responde 403 (`FORBIDDEN`) y no crea nada; sin sesión, 401

#### CA-03.6 · Detalle con acciones permitidas
- **Dado** una incidencia visible para el actor
- **Cuando** hace `GET /api/incidents/:id`
- **Entonces** responde 200 con `id`, `code`, `title`, `description`, tipo, departamento propietario, `priority`, `status`, creador y asignado (`id`, `name`), `dueDate`, `createdAt`, `updatedAt` y `allowedActions` calculadas por `incidentActionsFor` (solo `update` y `assign`; las transiciones de estado van aparte, en `allowedTransitions`, que calcula F04)
- **Y** si la incidencia no existe, no es visible para el actor o el id no es un UUID válido, responde 404 con el mismo cuerpo en los tres casos

#### CA-03.7 · Listado de las incidencias visibles
- **Dado** incidencias de varios departamentos, creadas por y asignadas a distintos usuarios
- **Cuando** un usuario hace `GET /api/incidents`
- **Entonces** responde 200 con `{ items, total, page, pageSize }`: solo las incidencias **visibles** para él (Admin y Dirección, todas), ordenadas de la más reciente a la más antigua, 20 por página (`?page=`, desde 1)
- **Y** cada elemento trae `id`, `code`, `title`, tipo, departamento, `priority`, `status`, asignado (`id`, `name` o `null`), `dueDate` y `createdAt`
- **Y** `total` cuenta solo las visibles

#### CA-03.8 · Filtros del listado
- **Dado** el listado de CA-03.7
- **Cuando** se añaden uno o varios de `status`, `priority`, `departmentId`, `assignedToMe=true` y `q` (texto)
- **Entonces** se combinan con Y; `q` busca, sin distinguir mayúsculas, en el código y el título
- **Y** los filtros nunca amplían lo visible: filtrar por un departamento ajeno devuelve solo lo que el actor ya veía de él
- **Y** un valor de filtro no válido (estado o prioridad inexistente, `page` < 1) responde 400

#### CA-03.9 · Edición de una incidencia
- **Dado** una incidencia visible
- **Cuando** el actor hace `PATCH /api/incidents/:id` con uno o varios de `title`, `description`, `priority` y `dueDate` (`null` para quitarla), con las validaciones de CA-03.3
- **Entonces** si `permisos.md` le permite **editar campos**, responde 200 con la incidencia actualizada y se inserta un evento `UPDATED` con los campos que han cambiado (antes y después); si no cambia nada, 200 sin evento
- **Y** si no se lo permite (Dirección; Usuario sobre una incidencia que no ha creado o que no está ABIERTA; Responsable sobre una de otro dpto. que no ha creado), responde 403; si no es visible, 404
- **Y** `typeId`, `status`, `assignedTo` y los demás campos del servidor se ignoran

#### CA-03.10 · Asignación
- **Dado** una incidencia visible y un actor con permiso de **asignar** (`permisos.md`)
- **Cuando** consulta `GET /api/incidents/:id/assignees`
- **Entonces** recibe los usuarios **activos** del departamento propietario (`id`, `name`), ordenados por nombre
- **Y cuando** hace `POST /api/incidents/:id/assign` con `{ assigneeId }` de uno de ellos, responde 200 con la incidencia actualizada y se inserta un evento `ASSIGNED` (asignado anterior y nuevo)
- **Y** si `assigneeId` no es un usuario activo del departamento propietario, responde 400 con un mensaje en español; reasignar al mismo usuario responde 200 sin evento
- **Y** sin permiso de asignar, ambos endpoints responden 403 (404 si no es visible)

#### CA-03.11 · Matriz de autorización de los endpoints de incidencias
- **Dado** un usuario de cada rol (y una petición sin sesión) y una incidencia de cada relación (de sus dptos. · creada por él · asignada a él · ninguna)
- **Cuando** llama a cada endpoint de F03
- **Entonces** el código coincide con `permisos.md` (200/201, 401, 403 o 404), en filas añadidas a la tabla `it.each` de CA-02.15

### Web

#### CA-03.12 · Listado de incidencias
- **Dado** un usuario con sesión
- **Cuando** abre `/incidencias` (enlace "Incidencias" en la navegación de `AppLayout`, para todos los roles)
- **Entonces** ve una tabla accesible con código (enlace al detalle), título, tipo, departamento, prioridad y estado (con `PriorityBadge` y `StatusBadge`, textos en español), asignado y fecha objetivo en `dd/mm/aaaa`
- **Y** encima, filtros de estado, prioridad, departamento, "Asignadas a mí" y un buscador; cambiar un filtro vuelve a la página 1
- **Y** paginación con "Anterior" / "Siguiente" y el total; un estado vacío ("No hay incidencias que coincidan con los filtros.") si no hay resultados; indicador mientras carga y `Alert` si la API falla

#### CA-03.13 · Alta desde la web
- **Dado** un usuario cuyas `allowedActions` globales incluyen `createIncident`
- **Cuando** pulsa "Nueva incidencia" en el listado (botón que **no** aparece en caso contrario) y envía el formulario de `/incidencias/nueva` (título, descripción, tipo, prioridad y fecha objetivo opcional)
- **Entonces** se valida en el cliente con el esquema de `shared`, con los errores junto a cada campo (`aria-invalid` + `aria-describedby`), y al guardar navega al detalle de la incidencia creada
- **Y** al elegir el tipo se muestra el departamento que la recibirá

#### CA-03.14 · Detalle de una incidencia
- **Dado** un usuario en `/incidencias/:id`
- **Cuando** se carga la página
- **Entonces** muestra código, título, estado, prioridad, tipo, departamento, creador, asignado, fechas (`dd/mm/aaaa`, `Europe/Madrid`) y descripción
- **Y** muestra "Editar" solo si `allowedActions` incluye `update`, y el control de asignación solo si incluye `assign`; la web no comprueba el rol
- **Y** si la API responde 404, muestra "Incidencia no encontrada." con un enlace al listado

#### CA-03.15 · Edición y asignación desde la web
- **Dado** un usuario en el detalle con las acciones correspondientes
- **Cuando** pulsa "Editar" (formulario precargado en `/incidencias/:id/editar`, reutilizando el de alta, sin el campo de tipo) o elige un usuario en el selector de asignación y pulsa "Asignar"
- **Entonces** se llama a la API y, al terminar, el detalle muestra los datos nuevos y un aviso de éxito; si la API responde con error, se muestra en español sin perder lo escrito

## Permisos
- `docs/permisos.md` → **Definiciones**: incidencia visible, departamento propietario (lo fija el tipo).
- `docs/permisos.md` → **Incidencias**: filas "Ver", "Crear", "Editar campos" y "Asignar" (con la aclaración ¹, solo usuarios activos del dpto. propietario, y la ²). Las aplica la `AuthorizationPolicy` de F02; F03 no añade reglas.
- `docs/permisos.md` → **Respuestas de la API** (404 si no es visible, 403 si la acción no está permitida) y **Lo que nunca decide el cliente**.

## Fuera de alcance
- **Estados, transiciones (con su comentario) e historial visible:** F04. Sin comentarios sueltos (trabajo futuro). F03 solo crea `incident_events` e inserta `CREATED`, `UPDATED` y `ASSIGNED`.
- **Adjuntos (F05) y auditoría / cuadro de mando (F06): fuera del TFM** por la fecha de congelación. Las incidencias no se registran en `audit_log` (la trazabilidad es su historial).
- Filtros por tipo y por un asignado cualquiera (solo "Asignadas a mí"), ordenación por columnas, tamaño de página configurable y filtros guardados en la URL.
- Cambiar el tipo (y con él el departamento) de una incidencia ya creada.
- Asignar en el alta y quitar la asignación (solo se asigna o reasigna desde el detalle).
- Borrar incidencias, operaciones en bloque, exportar a CSV (RF-23) y notificaciones (RF-22).
- Búsqueda en la descripción o de texto completo (`q` solo busca en código y título).
- Datos demo de incidencias (F07) y E2E con Playwright (F07).

## Decisiones (aprobadas el 25/11/2026)
1. **Filtros reducidos:** estado, prioridad, departamento, "Asignadas a mí" y texto (código y título). RF-11 citaba también tipo y asignado: se recortan.
2. **Tipo no editable:** cambiarlo movería la incidencia de departamento y dejaría al asignado fuera; se recorta.
3. **Sin restricción por estado** para editar y asignar más allá de la de `permisos.md` (el Usuario solo edita en ABIERTA). Un Admin o Responsable puede editar o reasignar una incidencia CERRADA o RECHAZADA.
4. **Asignado inválido → 400** (`VALIDATION`), no 409: es un dato de entrada que no cumple la regla ¹.
5. **El año del código** se toma de la fecha de alta en `Europe/Madrid` (no UTC).
6. **`incident_events` nace en F03** (tabla, puerto solo de inserción y eventos `CREATED`/`UPDATED`/`ASSIGNED`) para que el historial de F04 esté completo desde la primera incidencia.
7. **El listado no trae `allowedActions`** por elemento (solo el detalle y las respuestas de las mutaciones); el botón "Nueva incidencia" usa la acción global `createIncident`.
8. **`requisitos.md` se ajusta** al recorte del TFM (RF-16, RF-17, RF-19 y RF-20 pasan a W; RF-18 se queda en lo que registran F01 y F02; RF-14 queda en el comentario de un cambio de estado, sin comentarios sueltos) dentro de la tarea del contrato de F03 (T-03.01).
