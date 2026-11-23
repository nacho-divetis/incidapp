# Matriz de permisos

**Fuente de verdad de la autorización.** La implementa una única `AuthorizationPolicy` en `apps/api/src/application/`, que usan todos los casos de uso y que calcula también las `allowedActions` que la API devuelve en cada recurso. El front solo muestra u oculta acciones a partir de esas `allowedActions`; no recalcula permisos.

## Definiciones

- **Rol:** cada usuario tiene uno, global: `ADMIN` (Admin), `DIRECTOR` (Dirección), `MANAGER` (Responsable) o `USER` (Usuario).
- **Sus departamentos:** los departamentos a los que pertenece el usuario (uno o varios).
- **Departamento propietario:** el de la incidencia. Al crearla se toma del tipo.
- **Incidencia visible** para un Responsable o un Usuario: la de cualquiera de **sus departamentos**, la que **ha creado** o la que **tiene asignada**. Admin y Dirección ven todas.
- **Usuario desactivado:** no puede iniciar sesión y sus sesiones abiertas dejan de valer.

## Incidencias

| Acción | Admin | Dirección | Responsable | Usuario |
|---|---|---|---|---|
| Ver (listado y detalle) | Todas | Todas | Visibles | Visibles |
| Crear | ✅ | ❌ | ✅ | ✅ |
| Editar campos | ✅ | ❌ | Las de sus dptos. | Las que ha creado, **solo** mientras estén ABIERTAS |
| Asignar (solo a usuarios activos del dpto. propietario) ¹ | ✅ | ❌ | Las de sus dptos. | ❌ |
| Transiciones operativas (ver la tabla de estados) | ✅ | ❌ | Las de sus dptos. | Las que ha creado o tiene asignadas |
| Rechazar · Cerrar · Reabrir · Devolver de RESUELTA a EN_CURSO | ✅ | ❌ | Las de sus dptos. | ❌ |
| Comentar | ✅ | ❌ | Visibles | Visibles |
| Adjuntar | ✅ | ❌ | Visibles | Visibles |
| Descargar un adjunto | Si puede ver la incidencia | Si puede ver la incidencia | Si puede ver la incidencia | Si puede ver la incidencia |

**Responsable fuera de sus departamentos** ²**:** sobre una incidencia que ha creado o tiene asignada en otro departamento, un Responsable tiene los mismos permisos que un Usuario (no los de Responsable).

## Transiciones de estado

Estados: `OPEN` (ABIERTA), `IN_PROGRESS` (EN CURSO), `PENDING_THIRD_PARTY` (PENDIENTE DE TERCERO), `RESOLVED` (RESUELTA), `CLOSED` (CERRADA), `REJECTED` (RECHAZADA, final) y `REOPENED` (REABIERTA).

| Transición | Tipo | Quién | Comentario obligatorio |
|---|---|---|---|
| ABIERTA → EN CURSO | operativa | Admin · Responsable · Usuario (creador o asignado) | No |
| ABIERTA → RECHAZADA | gestión | Admin · Responsable | **Sí** |
| EN CURSO → PENDIENTE DE TERCERO | operativa | Admin · Responsable · Usuario (creador o asignado) | No |
| PENDIENTE DE TERCERO → EN CURSO | operativa | Admin · Responsable · Usuario (creador o asignado) | No |
| EN CURSO → RESUELTA | operativa | Admin · Responsable · Usuario (creador o asignado) | **Sí** |
| RESUELTA → EN CURSO (solución no válida) | gestión | Admin · Responsable | **Sí** |
| RESUELTA → CERRADA | gestión | Admin · Responsable | No |
| CERRADA → REABIERTA | gestión | Admin · Responsable | **Sí** |
| REABIERTA → EN CURSO | operativa | Admin · Responsable · Usuario (creador o asignado) | No |

"Responsable" significa siempre **de las de sus departamentos**. Cualquier otra transición (incluida cualquiera desde RECHAZADA o hacia REABIERTA desde un estado distinto de CERRADA) se rechaza con un error de dominio. En el cuadro de mando, el tiempo de resolución se mide hasta la **última** resolución.

## Administración y consulta

| Acción | Admin | Dirección | Responsable | Usuario |
|---|---|---|---|---|
| Cuadro de mando (global) | ✅ | ✅ | ❌ | ❌ |
| Gestionar usuarios (alta, edición, desactivación, rol y departamentos) | ✅ | ❌ | ❌ | ❌ |
| Consultar la auditoría | ✅ | ❌ | ❌ | ❌ |
| Ver y cerrar su propia sesión | ✅ | ✅ | ✅ | ✅ |

Un Admin no puede desactivarse a sí mismo ni quitarse el rol de Admin, para que no se pierda el acceso de administración ³.

## Respuestas de la API

| Situación | Respuesta |
|---|---|
| Sin sesión válida en un endpoint protegido | **401** |
| El recurso no existe **o no es visible** para el actor | **404** (no se revela que existe) |
| El recurso es visible pero la acción no está permitida | **403** |
| La acción está permitida pero viola una regla de dominio (transición inválida, falta el comentario obligatorio) | **400** o **409**, según el caso |

## Lo que nunca decide el cliente

El servidor ignora o rechaza en las peticiones los campos que decide él: `role` (salvo en la gestión de usuarios por un Admin), `createdBy`, `code`, `status` (solo cambia a través de las transiciones), `departmentId` (lo fija el tipo), fechas de creación, resolución y cierre, y el autor de eventos y comentarios.

## Aclaraciones confirmadas (23/11/2026)

Precisiones a la matriz de la definición del proyecto, confirmadas por el usuario:

1. Solo se puede asignar a usuarios **activos** del departamento propietario.
2. Un Responsable, fuera de sus departamentos, tiene los permisos de Usuario sobre lo que ha creado o tiene asignado (ver, comentar, adjuntar y transiciones operativas); no puede rechazar, cerrar, reabrir ni asignar.
3. Un Admin no puede desactivarse ni quitarse el rol de Admin a sí mismo: la API responde **409** con un mensaje en español.

## Cómo se prueba

La matriz se convierte en una tabla de tests de autorización en la API (`it.each`): rol × acción × incidencia visible o no visible, esperando 200/201, 403 o 404. Ver `docs/specs/F02-permisos/`.
