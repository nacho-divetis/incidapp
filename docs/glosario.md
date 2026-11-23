# Glosario

El código usa identificadores en inglés; la interfaz y la documentación, en español. Esta tabla fija la equivalencia para que todos (personas y agentes) usen los mismos nombres.

## Entidades

| Español | Código | Notas |
|---|---|---|
| Incidencia | `Incident` | Tabla `incidents` |
| Código de incidencia | `code` | `INC-AAAA-NNNN`, correlativo por año (`code_counters`) |
| Tipo de incidencia | `IncidentType` | Tabla `incident_types`; tiene un departamento por defecto |
| Departamento | `Department` | Tabla `departments`; `code` (DIR, ADM…) y `name` |
| Departamento propietario | `departmentId` | El de la incidencia |
| Usuario | `User` | Tabla `users` |
| Pertenencia a departamento | `UserDepartment` | Tabla `user_departments` |
| Sesión | `Session` | Tabla `sessions`; identificador aleatorio de 256 bits |
| Evento del historial | `IncidentEvent` | Tabla `incident_events`; solo inserción |
| Comentario | `Comment` | Evento de tipo `COMMENTED` |
| Adjunto | `Attachment` | Tabla `attachments`; contenido en `bytea` |
| Registro de auditoría | `AuditLog` | Tabla `audit_log`; solo inserción |
| Cuadro de mando | `Dashboard` | |
| Acciones permitidas | `allowedActions` | Calculadas por la `AuthorizationPolicy` para el usuario actual |
| Política de autorización | `AuthorizationPolicy` | Única fuente de decisión de permisos |
| Actor | `actor` | Usuario que ejecuta una acción |
| Creador | `createdBy` | |
| Asignado | `assignedTo` | |
| Fecha objetivo | `dueDate` | |

## Roles (`Role`)

| Español | Código |
|---|---|
| Admin | `ADMIN` |
| Dirección | `DIRECTOR` |
| Responsable | `MANAGER` |
| Usuario | `USER` |

## Estados (`Status`)

| Español | Código |
|---|---|
| Abierta | `OPEN` |
| En curso | `IN_PROGRESS` |
| Pendiente de tercero | `PENDING_THIRD_PARTY` |
| Resuelta | `RESOLVED` |
| Cerrada | `CLOSED` |
| Rechazada | `REJECTED` |
| Reabierta | `REOPENED` |

## Prioridades (`Priority`)

| Español | Código |
|---|---|
| Baja | `LOW` |
| Media | `MEDIUM` |
| Alta | `HIGH` |
| Urgente | `URGENT` |

## Tipos de evento del historial (`IncidentEventType`)

| Español | Código |
|---|---|
| Alta | `CREATED` |
| Cambio de estado | `STATUS_CHANGED` |
| Comentario | `COMMENTED` |
| Asignación | `ASSIGNED` |
| Edición | `UPDATED` |
| Adjunto añadido | `ATTACHMENT_ADDED` |

## Errores de aplicación

| Español | Código | HTTP |
|---|---|---|
| Datos no válidos | `ValidationError` | 400 |
| Sin sesión | `UnauthorizedError` | 401 |
| Acción no permitida | `ForbiddenError` | 403 |
| No encontrado (o no visible) | `NotFoundError` | 404 |
| Conflicto con el estado actual | `ConflictError` | 409 |

## Términos técnicos

| Término | Significado en este proyecto |
|---|---|
| Caso de uso | Operación de `application/` que recibe sus dependencias (puertos) por parámetro |
| Puerto | Interfaz que define `application/` y que implementa `infrastructure/` |
| Composition root | `composition/`: el único sitio donde se crean las implementaciones y se conectan |
| Contrato | Esquemas Zod de `packages/shared` que comparten la API y la web |
| Átomo · molécula · organismo · plantilla · página | Niveles de atomic design de la web (ver ADR-008) |
| Token de diseño | Variable de color, tipografía, espaciado, radio o sombra del tema |
| *Seed* | Carga de datos iniciales o de demostración (`npm run db:seed`) |
