# F04 · Estados e historial — Tareas

> Fuente de verdad del avance. El hook de inicio de sesión lee este archivo: respeta el formato (`### T-…` y las líneas `- Estado:` y `- Agente:`).
> Estados: `pendiente` · `en curso` · `hecha` · `bloqueada`
>
> **Plazo:** congelación el viernes 27/11/2026 a las 20:00. T-04.01 se hace justo después de T-03.01 (antes que T-03.02) para que los componentes de F04 empiecen pronto. **T-04.06 despliega F03 y F04 juntas.**

### T-04.01 · Ampliar el contrato con transiciones e historial e implementar la máquina de estados
- Estado: hecha
- Agente: backend-dev · Revisores: code-reviewer
- Depende de: T-03.01
- Paralelizable con: T-03.03
- Cubre: CA-04.1, CA-04.3 (esquema del cuerpo), CA-04.6 (forma de los eventos)
- Archivos: packages/shared/src/incidents.ts (+ test), apps/api/src/domain/incidents/{incident.ts,status-machine.ts} (+ tests), apps/api/src/domain/index.ts
- Verificación: npm test -w @incidapp/shared && npm test -w @incidapp/api -- status-machine && npm run typecheck && npm run lint
- Notas: según `plan.md`: `TransitionInput` (`to` de `Status`, `comment` con *trim* ≤ 2000, vacío → `undefined`), `IncidentEvent` (unión discriminada por `type` con los datos de `CREATED`, `UPDATED`, `ASSIGNED` y `STATUS_CHANGED`) e `IncidentEventList`. **No** cambia la forma de `Incident` (F03 ya trae `allowedTransitions`). Máquina de estados en TDD: tabla `it.each` de los 49 pares (estado actual × destino) en la que cada fila cita la de **Transiciones de estado** de `docs/permisos.md`; `findTransition` lanza `InvalidTransitionError` (error de dominio tipado) para cualquier par que no esté en la tabla; `transitionsFrom`. TypeScript puro: como se hace antes que T-03.02, crea `IncidentStatus` en `apps/api/src/domain/incidents/incident.ts` con su test de coincidencia con `Status` (T-03.02 añade ahí `IncidentPriority`). Sin comentarios sueltos: ni `CommentInput` ni `COMMENTED`.

### T-04.02 · Implementar el cambio de estado, las transiciones permitidas y el historial en la API
- Estado: hecha
- Agente: backend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-03.02, T-04.01
- Paralelizable con: T-03.04, T-04.03
- Cubre: CA-04.2, CA-04.3, CA-04.4, CA-04.5, CA-04.6
- Archivos: apps/api/src/application/incidents/{incident-presenter.ts,change-incident-status.ts,list-incident-events.ts,status-labels.ts} (+ tests), apps/api/src/application/ports/{incident-event-reader.ts,unit-of-work.ts}, apps/api/src/infrastructure/db/repositories/{incident-event-reader,incident-event-writer,incident-repository}.ts (+ tests), apps/api/src/http/routes/incidents.ts (+ test), apps/api/src/http/test-support.ts, apps/api/src/composition/container.ts
- Verificación: npm test -w @incidapp/api && npm run typecheck && npm run lint
- Notas: skill `caso-de-uso`. Sin migración (comprobar que `npm run db:generate` no genera nada). `allowedTransitions` en `presentIncident` (un solo sitio: así el detalle y todas las mutaciones de F03 y F04 la devuelven), filtrando `transitionsFrom(status)` con `canOnIncident(…, 'operationalTransition' | 'managementTransition')`; `allowedActions` sigue siendo `update`/`assign`. `changeIncidentStatus` con el orden 404 → 409 (`InvalidTransitionError` → `ConflictError` "No se puede pasar de Rechazada a En curso.") → 403 → 400 ("Esta transición requiere un comentario."); cambio + `resolvedAt`/`closedAt` (última fecha) + evento `STATUS_CHANGED` en la `UnitOfWork`, con test de reversión. Historial: `IncidentEventReader` con solo `listByIncident` (orden `created_at`, `id`); test de que ningún puerto ni adaptador del historial expone `update`/`delete`; test de API de que cada mutación de F03 y F04 deja exactamente un evento (o ninguno si no cambia nada). Alinea con `IncidentEvent` los datos que escribe F03 para `UPDATED`/`ASSIGNED` si difieren.

### T-04.03 · Crear los componentes de estado e historial: acciones de estado, diálogo de transición y línea de tiempo
- Estado: hecha
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-04.01, T-03.03
- Paralelizable con: T-03.02, T-03.04, T-04.02
- Cubre: CA-04.8 (botones y diálogo), CA-04.9 (línea de tiempo)
- Archivos: apps/web/src/components/molecules/ConfirmDialog/… (variante), apps/web/src/components/organisms/{IncidentStatusActions,StatusTransitionDialog,IncidentTimeline}/…, apps/web/src/components/organisms/index.ts, apps/web/src/lib/labels.ts (+ test)
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build-storybook
- Notas: skill `componente`, en el worktree de `.worktrees/` de T-03.03 (o uno nuevo desde la rama de la feature). Sin dependencias nuevas: `ConfirmDialog` gana `children?` y `confirmDisabled?`, y "Confirmar" no cierra el diálogo por sí solo (`open` controlado), sin romper sus usos de F02. Props según `plan.md`. `transitionLabel(from, to)` con los textos de la decisión 7 de la spec; `describeEvent` con las frases de CA-04.9 y `formatDateTime` de T-03.03. El comentario es obligatorio solo si `requiresComment`, con el error junto al campo; el error de la API se muestra dentro del diálogo sin perder el comentario. Stories: sin transiciones, cada estado de origen, diálogo con comentario obligatorio y opcional, enviando, error; línea de tiempo con los 4 tipos de evento. Tests de interacción y axe (foco atrapado, `Escape` cierra).

### T-04.04 · Integrar las acciones de estado y la línea de tiempo en el detalle
- Estado: hecha
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-04.02, T-04.03, T-03.04
- Paralelizable con: T-04.05
- Cubre: CA-04.8, CA-04.9
- Archivos: apps/web/src/queries/incidents.ts (+ test), apps/web/src/pages/IncidentDetailPage/…
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build && prueba manual con `npm run dev` (como Usuario: crear y "Empezar" su incidencia, "Marcar como resuelta" exige comentario; como Responsable del dpto.: "Cerrar" y "Reabrir" con comentario; como Dirección: sin botones; la línea de tiempo muestra cada paso)
- Notas: `useIncidentEvents(id)` y `useTransitionIncident(id)`; todas las mutaciones de incidencia invalidan `['incidents', id, 'events']`. Los botones salen solo de `allowedTransitions` (la web no mira el rol ni el estado). El diálogo se cierra solo si la API responde bien. Indicador de carga y `Alert` de error en la línea de tiempo. **Punto de control con el usuario:** revisión de la UI de F03 y F04 en el navegador antes de T-04.06.

### T-04.05 · Ampliar la matriz de autorización con las transiciones y el historial
- Estado: hecha
- Agente: qa-tester · Revisores: code-reviewer
- Depende de: T-04.02, T-03.05
- Paralelizable con: T-04.04
- Cubre: CA-04.7, CA-04.4 (`allowedTransitions` por rol y relación de punta a punta)
- Archivos: apps/api/src/http/authorization-matrix.test.ts, apps/api/src/http/test-support.ts
- Verificación: npm test -w @incidapp/api -- authorization-matrix && npm run lint
- Notas: reutiliza las incidencias por relación de T-03.05 y `createAuthzClient`. Filas para `POST …/transitions` (una operativa, `OPEN → IN_PROGRESS`, y una de gestión, `OPEN → REJECTED` con comentario; cada caso sobre una incidencia nueva en el estado de partida para no depender del orden) y `GET …/events`, con sin sesión y los 4 roles × relación; incluye la nota ² (Responsable fuera de sus dptos.: operativa sí, gestión 403). Comprueba además que `allowedTransitions` del detalle coincide con lo que la matriz permite. Revisa la tabla de la máquina de estados de T-04.01 contra `docs/permisos.md` y propone (no corrige) las diferencias. No toca código de producción. **Revisión de la máquina contra `permisos.md`:** sin diferencias (9 transiciones, tipo y comentario obligatorio).

### T-04.06 · Desplegar F03 y F04 en Render y comprobar incidencias, estados e historial
- Estado: pendiente
- Agente: principal · Revisores: code-reviewer
- Depende de: T-03.05, T-04.04, T-04.05
- Paralelizable con: —
- Cubre: CA-03.1 (en producción), CA-03.4 (en producción), CA-04.2 (en producción)
- Archivos: README.md (incidencias, estados y recorte de alcance: sin adjuntos, auditoría, cuadro de mando ni comentarios sueltos)
- Verificación: `npm test` completo · CI en verde en el PR (`gh pr checks`) · en https://incidapp.onrender.com: 7 tipos tras el arranque; como Usuario, crear una incidencia (`INC-2026-000n`), "Empezar" y "Marcar como resuelta" con comentario; como Responsable de su dpto., asignarla, cerrarla y reabrirla; como Dirección, verla sin acciones (y 403 en `POST …/transitions`); la línea de tiempo muestra todo en hora de Madrid · en Neon, `incident_events` con un evento por mutación
- Notas: abrir el PR → `main` y hacer *squash merge* (ambos piden confirmación). Según la decisión de rama de `F03-incidencias/plan.md`: un solo PR de F03 + F04, o los dos PR apilados fusionados seguidos. Antes del viernes 27/11 a las 20:00 (congelación).

---

## Cobertura

| Criterio | Tareas |
|---|---|
| CA-04.1 | T-04.01, T-04.05 (revisión contra `permisos.md`) |
| CA-04.2 | T-04.02, T-04.06 (en producción) |
| CA-04.3 | T-04.01 (esquema), T-04.02 |
| CA-04.4 | T-04.02, T-04.05 |
| CA-04.5 | T-04.02 |
| CA-04.6 | T-04.01 (forma), T-04.02 |
| CA-04.7 | T-04.05 |
| CA-04.8 | T-04.03, T-04.04 |
| CA-04.9 | T-04.03, T-04.04 |
