# F04 · Estados e historial — Plan

- **Estado:** borrador · no requiere aprobación (solo F00 y F02 la exigen)
- **Spec:** `spec.md` (aprobada el 25/11, sin comentarios sueltos)

## Contrato (`packages/shared`)

Se amplía `packages/shared/src/incidents.ts` (F03 ya define `Status`, `IncidentEventType`, `AllowedTransition`, `UserSummary` e `Incident` con `allowedTransitions`, así que la forma de la incidencia **no cambia**).

| Esquema / constante | Uso |
|---|---|
| `TransitionInput` | `{ to: Status, comment?: string }`; `comment` con *trim*, ≤ 2000 (`TRANSITION_COMMENT_MAX_LENGTH`); vacío tras el *trim* → `undefined`. Cuerpo de `POST /api/incidents/:id/transitions`. Que la transición exija comentario lo decide el dominio, no el esquema |
| `IncidentEvent` | unión discriminada por `type`, con `{ id, actor: UserSummary, createdAt: ISO }` y `data`: `CREATED` → `{}`; `UPDATED` → `{ changes: { field: 'title' \| 'description' \| 'priority' \| 'dueDate', before, after }[] }`; `ASSIGNED` → `{ from: UserSummary \| null, to: UserSummary }`; `STATUS_CHANGED` → `{ from: Status, to: Status, comment: string \| null }` |
| `IncidentEventList` | `IncidentEvent[]`. Respuesta de `GET /api/incidents/:id/events` |

Los datos de `UPDATED` y `ASSIGNED` los escribe F03 en `incident_events.data`; T-04.01 fija su forma en el contrato y, si no coincide con lo que guarda F03, la tarea de API (T-04.02) ajusta el escritor (no hay datos en producción que migrar).

## API

| Método y ruta | Caso de uso | Permiso (`permisos.md`) | Respuestas |
|---|---|---|---|
| `POST /api/incidents/:id/transitions` | `changeIncidentStatus` | transición operativa o de gestión, según el tipo | 200 `Incident` · 400 · 401 · 403 · 404 · 409 |
| `GET /api/incidents/:id/events` | `listIncidentEvents` | ver | 200 `IncidentEvent[]` · 401 · 404 |
| `GET /api/incidents/:id` y mutaciones de F03 | (F03) | (F03) | `allowedTransitions` calculadas |

- **Orden en `transitions`:** sesión (401) → forma del cuerpo (`to` fuera de `Status`, comentario > 2000: 400) → no existe / no visible (404) → la transición no existe desde el estado actual (409 "No se puede pasar de Rechazada a En curso.") → el actor no puede hacer ese tipo (403) → falta el comentario obligatorio (400 "Esta transición requiere un comentario."). Los 400 de forma no dependen de la incidencia, así que no revelan nada; los tests del orden 404 → 409 → 403 → 400 usan cuerpos con forma válida.
- `status` solo cambia aquí: el `PATCH` de F03 ya lo descarta (esquema no estricto).
- `cache-control: no-store` y `X-Requested-With` como en F03.

## Dominio y aplicación

### Dominio (`apps/api/src/domain/incidents/status-machine.ts`)
- `STATUS_TRANSITIONS`: las 9 filas de `permisos.md` (`from`, `to`, `kind: 'operational' | 'management'`, `requiresComment`).
- `findTransition(from, to)` → la fila, o lanza `InvalidTransitionError` (error de dominio tipado con `from` y `to`).
- `transitionsFrom(from)` → filas que salen de un estado.
- TypeScript puro (usa `IncidentStatus` de F03). TDD con `it.each` de los 49 pares.

### Aplicación
- `incident-presenter.ts` (F03): `allowedTransitions = transitionsFrom(status)` filtradas por `canOnIncident(actor, facts, kind === 'operational' ? 'operationalTransition' : 'managementTransition')` → `{ to, requiresComment }`. Al estar en el presentador, el detalle y **todas** las mutaciones de F03 y F04 las devuelven sin tocar cada caso de uso (CA-04.4).
- `changeIncidentStatus(id, { to, comment })` → 404 → `findTransition` (`InvalidTransitionError` → `ConflictError` con los nombres en español de `STATUS_LABELS` de aplicación) → 403 por tipo → 400 si `requiresComment` y no hay comentario → en la `UnitOfWork`: `update(status, updatedAt, resolvedAt si entra en RESOLVED, closedAt si entra en CLOSED)` + `append(STATUS_CHANGED, { from, to, comment })`.
- `listIncidentEvents(id)` → 404 si no es visible; eventos en orden cronológico con el nombre del actor.
- Puertos: `IncidentEventWriter` (F03, solo `append`) y un `IncidentEventReader` nuevo con **solo** `listByIncident(incidentId)`. Ningún puerto ni adaptador ofrece `update` ni `delete` (CA-04.5); un test lo comprueba sobre las claves del adaptador.
- Las etiquetas en español de los estados para el mensaje del 409 van en `application/incidents/status-labels.ts` (la web tiene las suyas en `lib/labels.ts`; ambas siguen `docs/glosario.md`).

## Base de datos

- **Sin migración nueva:** F03 ya crea `incident_status` con los 7 estados, `incident_event_type` con `STATUS_CHANGED` y las columnas `resolved_at`/`closed_at`.
- Lectura del historial con el índice (`incident_id`, `created_at`) de F03; desempate por `id` para un orden estable.

## Interfaz (atomic design)

Inventario tras F03: además de lo de F02, moléculas `StatusBadge`, `PriorityBadge`, `Pagination`, `DetailList`; organismos `IncidentFilters`, `IncidentTable`, `IncidentForm`, `IncidentSummary`, `IncidentAssignForm`; `lib/dates.ts` con `formatDateTime`. **Sin dependencias nuevas:** el diálogo reutiliza `@radix-ui/react-alert-dialog` (F02) a través de `ConfirmDialog`.

### Páginas

| Página | Ruta | Plantilla | Roles | Queries / mutaciones |
|---|---|---|---|---|
| `IncidentDetailPage` (se amplía) | `/incidencias/:id` | `AppLayout` | todos (las acciones salen de `allowedTransitions`) | `useIncident(id)`, `useIncidentEvents(id)`, `useTransitionIncident(id)` |

- `queries/incidents.ts`: `useIncidentEvents(id)` (clave `['incidents', id, 'events']`) y `useTransitionIncident(id)`. Todas las mutaciones de incidencia (F03 y F04) invalidan también `['incidents', id, 'events']`.
- El diálogo se cierra solo si la API responde bien; con error, sigue abierto con el comentario y el mensaje.

### Componentes

| Nivel | Componente | Nuevo / variante / reutilizado | Notas (props, `allowedTransitions`) |
|---|---|---|---|
| Átomo | `Button`, `Textarea`, `Spinner`, `Text` | reutilizados | — |
| Molécula | `ConfirmDialog` | variante | se añade `children?` (contenido entre la descripción y los botones) y `confirmDisabled?`; "Confirmar" no cierra el diálogo por sí solo (lo controla `open`), para poder mostrar errores dentro |
| Molécula | `FormField`, `Alert`, `StatusBadge` | reutilizados | — |
| Organismo | `IncidentStatusActions` | nuevo | `status: Status`, `transitions: AllowedTransition[]`, `onSelect(transition)`. Un botón por transición con `transitionLabel(from, to)`; nada si la lista está vacía. Tono `danger` para "Rechazar" |
| Organismo | `StatusTransitionDialog` | nuevo | `transition: AllowedTransition \| null`, `from: Status`, `open`, `onOpenChange`, `onConfirm(comment?)`, `isSubmitting`, `errorMessage?`. Sobre `ConfirmDialog` con un `FormField` + `Textarea` "Comentario" (obligatorio si `requiresComment`, validado en el cliente con `TransitionInput` y la regla de obligatoriedad; `aria-invalid` + `aria-describedby`). Título "Cambiar el estado a <estado>" |
| Organismo | `IncidentTimeline` | nuevo | `events: IncidentEvent[]`. `<ol>` con autor, `formatDateTime` y la frase de `describeEvent`; el comentario de un `STATUS_CHANGED` en un bloque citado. Estado vacío no aplica (siempre hay `CREATED`) |
| Organismo | `IncidentSummary` | reutilizado | su hueco `actions` recibe `IncidentStatusActions` |

- `lib/labels.ts`: `transitionLabel(from, to)` (los textos de la decisión 7 de la spec), `EVENT_FIELD_LABELS` (título, descripción, prioridad, fecha objetivo) y `describeEvent(event)` → frase en español ("creó la incidencia", "cambió el estado de Abierta a En curso", "asignó a Ana Ruiz", "editó: título, prioridad"). Tests que cubren las 9 transiciones y los 4 tipos de evento.

## Tests

- **Dominio:** `it.each` de los 49 pares contra la tabla de `permisos.md` (CA-04.1).
- **Aplicación (con *fakes*):** orden 404 → 409 → 403 → 400; `resolvedAt`/`closedAt` (también tras reabrir y volver a cerrar: la última fecha); `allowedTransitions` por rol × relación × estado (incluidas Dirección y `REJECTED` vacías); la transacción revierte el cambio de estado si falla el evento.
- **Infraestructura (PGlite):** lectura en orden; el adaptador del historial no expone `update`/`delete`.
- **API (`fastify.inject`):** CA-04.2 a CA-04.6, incluido que cada mutación de F03 y F04 deja exactamente un evento (o ninguno si no cambia nada).
- **Matriz (CA-04.7, `qa-tester`):** filas de `transitions` (una operativa y una de gestión, desde el estado adecuado) y `events` por rol y relación.
- **Web:** stories y tests (axe) de los organismos nuevos y de la variante de `ConfirmDialog` (foco atrapado, `Escape`, comentario obligatorio); página de detalle con `fetch` simulado (botones según `allowedTransitions`, diálogo con error de la API que conserva el comentario, línea de tiempo con carga y error).
- **E2E:** ninguno (F07).

## Riesgos y decisiones

- **F04 depende del detalle de F03** → el contrato y la máquina de estados (T-04.01) solo dependen del contrato de F03 y se hacen antes que la API de F03; los componentes (T-04.03) van en paralelo con la API de F03. Solo la API (T-04.02) y la página (T-04.04) esperan a F03.
- **`AlertDialog` de Radix con un formulario** → se usa porque ya está instalado y cumple foco atrapado y `Escape`; hay que evitar que la acción "Confirmar" cierre el diálogo (`preventDefault` y `open` controlado). Si resultara inaccesible, se valoraría `@radix-ui/react-dialog` (gratuita), que pediría confirmación para instalarla.
- **Forma de los datos de `UPDATED`/`ASSIGNED`** fijada en F04 sobre lo que escribe F03 → T-04.01 la toma de `plan.md` de F03 y T-04.02 alinea el escritor si difiere.
- **Un solo despliegue para F03 y F04** (T-04.06): ahorra un ciclo de PR, CI y comprobación en Render. Los puntos de control de UI de F03 y F04 se juntan en uno (T-04.04).
- **ADR:** ninguno nuevo. Aplican ADR-002, ADR-007 y ADR-009.
