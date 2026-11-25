# F04 · Estados e historial — Spec

- **Estado:** aprobada (25/11/2026, por el usuario)
- **Depende de:** F03 (incidencias, detalle con `allowedActions`, tabla `incident_events` y su puerto de inserción), F02 (`AuthorizationPolicy`: transiciones `operationalTransition` / `managementTransition`)
- **Requisitos que cubre:** RF-13 (cambiar el estado con comentario obligatorio donde se exige), RF-14 (comentar, **solo** con el comentario de un cambio de estado), RF-15 (línea de tiempo, **sin adjuntos**), RNF-09 (historial solo de inserción), RNF-14 (fechas en `Europe/Madrid`)

## Objetivo
Que cada incidencia avance por la máquina de estados de `permisos.md` solo con las transiciones que el actor puede hacer, que la API diga cuáles son (`allowedTransitions`) y que todo lo ocurrido quede en un historial inalterable que se ve como línea de tiempo en el detalle. Alcance recortado para implementarse en ~1 día (congelación: viernes 27/11/2026 a las 20:00).

## Historias de usuario
- **HU-02** (de `requisitos.md`, sin adjuntos ni comentarios sueltos): Como **usuario**, quiero ver las incidencias que tengo asignadas y cambiar su estado, con un comentario cuando haga falta, para informar del avance.
- **HU-04** (de `requisitos.md`): Como **responsable**, quiero rechazar, cerrar o reabrir incidencias con un comentario para controlar la calidad de la resolución.
- **HU-04.1:** Como **usuario de cualquier rol**, quiero ver en el detalle quién hizo qué y cuándo, para entender cómo ha llegado la incidencia a su estado actual.

## Criterios de aceptación

### Dominio y API

#### CA-04.1 · Máquina de estados
- **Dado** cada par (estado actual, estado destino) de los 7 × 7 posibles
- **Cuando** se consulta la máquina de estados (función pura de `domain/`, sin dependencias externas)
- **Entonces** las 9 transiciones de la tabla **Transiciones de estado** de `permisos.md` devuelven su tipo (operativa / gestión) y si exigen comentario, y cualquier otro par devuelve un error de dominio tipado
- **Y** en particular: no hay transición desde `REJECTED`, `REOPENED` solo se alcanza desde `CLOSED` y un estado no transita a sí mismo
- **Y** se comprueba con una tabla `it.each` que se lee fila a fila contra `permisos.md` (TDD)

#### CA-04.2 · Cambiar el estado
- **Dado** una incidencia visible y una transición que existe desde su estado actual y que el actor puede hacer
- **Cuando** hace `POST /api/incidents/:id/transitions` con `{ to, comment? }` (comentario obligatorio si la transición lo exige)
- **Entonces** responde 200 con la incidencia actualizada (`status` nuevo, `updatedAt`, `allowedActions` y `allowedTransitions` recalculadas)
- **Y** se inserta un evento `STATUS_CHANGED` con `{ from, to, comment }` en la misma transacción que el cambio: si falla uno, no queda ninguno
- **Y** al entrar en `RESOLVED` se guarda `resolvedAt` y al entrar en `CLOSED`, `closedAt` (la fecha de la última vez)

#### CA-04.3 · Errores del cambio de estado
- **Dado** una petición a `POST /api/incidents/:id/transitions`
- **Cuando** se evalúa, en este orden
- **Entonces** si la incidencia no es visible (o no existe), responde 404
- **Y** si la transición no existe desde el estado actual, 409 (`CONFLICT`) con un mensaje en español ("No se puede pasar de Rechazada a En curso.")
- **Y** si existe pero `permisos.md` no permite al actor su tipo (gestión para un Usuario, cualquiera para Dirección, Responsable sobre una de otro dpto. que no ha creado ni tiene asignada), 403
- **Y** si exige comentario y falta o solo tiene espacios, 400 (`VALIDATION`) "Esta transición requiere un comentario."; un comentario de más de 2000 caracteres o un `to` que no es de `Status`, 400
- **Y** `status` solo cambia por este endpoint (el `PATCH` de F03 lo ignora)

#### CA-04.4 · Transiciones permitidas en la respuesta
- **Dado** una incidencia y un actor de cada rol con cada relación (de sus dptos. · creada por él · asignada a él · ninguna)
- **Cuando** pide el detalle (`GET /api/incidents/:id`) o hace cualquier mutación de F03/F04
- **Entonces** la respuesta incluye `allowedTransitions: { to, requiresComment }[]`: las transiciones que existen desde el estado actual (CA-04.1) y que la política permite al actor por su tipo, y nada más
- **Y** Dirección y cualquier actor sobre una incidencia `REJECTED` reciben una lista vacía
- **Y** `allowedActions` no cambia respecto a F03 (`update` y `assign`): no hay acción `comment`

#### CA-04.5 · Historial solo de inserción
- **Dado** el puerto y el repositorio de `incident_events`
- **Cuando** se revisan sus operaciones
- **Entonces** solo ofrecen insertar y leer: no hay forma de actualizar ni borrar un evento (RNF-09)
- **Y** cada mutación de F03 y F04 (alta, edición con cambios, asignación y transición) inserta exactamente un evento con el actor y la fecha del servidor, en la misma transacción que el cambio

#### CA-04.6 · Leer el historial
- **Dado** una incidencia visible
- **Cuando** el actor hace `GET /api/incidents/:id/events`
- **Entonces** responde 200 con los eventos en orden cronológico (el más antiguo primero), cada uno con `id`, `type`, actor (`id`, `name`), `createdAt` y sus datos (`STATUS_CHANGED`: `from`, `to`, `comment`; `ASSIGNED`: asignado anterior y nuevo; `UPDATED`: campos cambiados)
- **Y** si la incidencia no es visible o no existe, 404; sin sesión, 401

#### CA-04.7 · Matriz de autorización de los endpoints de F04
- **Dado** un usuario de cada rol (y una petición sin sesión) y una incidencia de cada relación
- **Cuando** llama a `POST …/transitions` (una operativa y una de gestión) y `GET …/events`
- **Entonces** el código coincide con `permisos.md` (200, 401, 403 o 404), en filas añadidas a la tabla `it.each` de CA-02.15

### Web

#### CA-04.8 · Acciones de estado en el detalle
- **Dado** un usuario en `/incidencias/:id`
- **Cuando** `allowedTransitions` no está vacía
- **Entonces** ve un botón por transición con un texto en español ("Empezar", "Rechazar", "Marcar como resuelta", "Cerrar", "Reabrir", "Devolver a en curso"…); si está vacía, no ve ninguno
- **Y** al pulsar uno se abre un diálogo accesible (foco atrapado, `Escape` cierra) con un campo "Comentario", **obligatorio** si `requiresComment` (validado en el cliente) y opcional en caso contrario
- **Y** al confirmar se llama a la API; al terminar, el estado, los botones y la línea de tiempo se actualizan; si la API responde con error, se muestra en español dentro del diálogo sin perder el comentario

#### CA-04.9 · Línea de tiempo
- **Dado** un usuario en el detalle de una incidencia
- **Cuando** se carga el historial
- **Entonces** se muestra una lista ordenada (`<ol>`) con cada evento: autor, fecha y hora (`dd/mm/aaaa HH:mm`, `Europe/Madrid`) y una frase en español ("creó la incidencia", "cambió el estado de Abierta a En curso", "asignó a …", "editó: título, prioridad"), con el texto del comentario cuando el cambio de estado lo tiene
- **Y** mientras carga muestra un indicador, y si falla, un `Alert`

## Permisos
- `docs/permisos.md` → **Transiciones de estado**: las 9 transiciones, su tipo, quién y si exigen comentario (CA-04.1, CA-04.3, CA-04.4). La máquina decide qué transición existe; la política, si el actor puede hacer ese tipo (CA-02.2).
- `docs/permisos.md` → **Incidencias**: filas "Transiciones operativas" y "Rechazar · Cerrar · Reabrir · Devolver de RESUELTA a EN_CURSO", con la nota ². La fila "Comentar" no se usa en F04: quien puede hacer una transición puede acompañarla de un comentario.
- `docs/permisos.md` → **Respuestas de la API** (404 / 403 / 400-409 por regla de dominio) y **Lo que nunca decide el cliente** (`status` solo por transiciones; autor de los eventos).

## Fuera de alcance
- **Comentarios sueltos (trabajo futuro):** sin `POST /api/incidents/:id/comments`, sin evento `COMMENTED` y sin acción `comment` en `allowedActions`. RF-14 queda cubierto solo por el comentario de un cambio de estado.
- **Adjuntos (F05) y evento `ATTACHMENT_ADDED`; auditoría y cuadro de mando (F06): fuera del TFM.** `resolvedAt`/`closedAt` se guardan pero ningún informe los usa.
- Editar o borrar el comentario de una transición (el historial es inmutable), comentarios con formato (Markdown), menciones y respuestas en hilo.
- Filtrar o paginar la línea de tiempo (se carga entera; las incidencias de la demo tienen pocos eventos).
- Transiciones automáticas o por tiempo, SLA y avisos por fecha objetivo vencida.
- Notificaciones (RF-22) y actualización en tiempo real (otro usuario ve los cambios al recargar).
- Desasignar automáticamente al cerrar o rechazar.
- E2E con Playwright (F07).

## Decisiones (aprobadas el 25/11/2026)
1. **Comentarios:** solo el comentario de la transición (obligatorio u opcional según `permisos.md`). El comentario suelto (endpoint, evento `COMMENTED`, acción `comment` y formulario en la web) se deja como trabajo futuro.
2. **Orden de los errores** del cambio de estado: 404 → 409 (no existe la transición) → 403 (no puede hacer su tipo) → 400 (falta el comentario). Así la política solo se consulta para transiciones que existen.
3. **Forma del contrato:** `allowedActions` (acciones: `update`, `assign`) y `allowedTransitions` (`{ to, requiresComment }[]`) son dos campos distintos de la incidencia, en lugar de mezclar las transiciones en `allowedActions`.
4. **Historial en un endpoint propio** (`GET /api/incidents/:id/events`), no dentro del detalle: F03 y F04 no tocan la misma respuesta y la web solo invalida dos consultas.
5. **`resolvedAt`/`closedAt`** guardan la fecha de la **última** entrada en ese estado y no se borran al reabrir o devolver a EN CURSO.
6. **Inmutabilidad** garantizada por el puerto y el repositorio (sin `update`/`delete`) y un test, sin *trigger* en la BD.
7. **Textos de los botones** de transición: los de CA-04.8; ABIERTA → EN CURSO y REABIERTA → EN CURSO se llaman "Empezar"; PENDIENTE DE TERCERO → EN CURSO, "Reanudar"; EN CURSO → PENDIENTE DE TERCERO, "Pendiente de tercero".
