# Una tarea de punta a punta: T-03.02

Cómo se construyó una tarea real, desde el criterio de aceptación hasta producción: **spec → plan → tarea → delegación → verificación → revisión con contexto limpio → corrección → commit → PR → despliegue**. Las piezas del *harness* que aparecen se describen en [harness.md](harness.md).

La tarea elegida es [T-03.02](../specs/F03-incidencias/tasks.md) (la API de incidencias) porque los dos revisores encontraron en ella, cada uno por su cuenta, un fallo que los más de mil tests no detectaban.

## 1 · Spec: el criterio de aceptación

La regla de negocio viene de la matriz de [permisos.md](../permisos.md): un Usuario puede **editar** las incidencias que ha creado *solo mientras estén ABIERTAS*. La spec de F03 la convierte en criterios comprobables ([spec.md](../specs/F03-incidencias/spec.md)):

> **CA-03.9 · Edición de una incidencia** — … si `permisos.md` le permite **editar campos**, responde 200 con la incidencia actualizada y se inserta un evento `UPDATED` con los campos que han cambiado (antes y después) … si no se lo permite (… Usuario sobre una incidencia que no ha creado o que **no está ABIERTA** …), responde 403; si no es visible, 404.

CA-03.10 hace lo mismo con la **asignación** (evento `ASSIGNED` con el asignado anterior y el nuevo). El usuario aprobó la spec antes de pasar al plan (punto de control).

## 2 · Plan y tarea

El [plan.md](../specs/F03-incidencias/plan.md) fija los puertos, los endpoints, el orden de las comprobaciones (400 → 404 → 403 → reglas) y la transacción del alta con el contador de códigos. La *skill* `sdd-feature` lo desglosa en tareas; la de T-03.02 dice quién la hace, quién la revisa y cómo se verifica:

```
### T-03.02 · Implementar las incidencias en la API: tipos, alta con código, listado, detalle, edición y asignación
- Agente: backend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-03.01
- Paralelizable con: T-03.03, T-04.03
- Cubre: CA-03.1 … CA-03.10
- Verificación: npm run db:generate (sin cambios pendientes tras generar) && npm test -w @incidapp/api && npm run typecheck && npm run lint
```

## 3 · Delegación en paralelo

Con el contrato ya en `packages/shared` (T-03.01, commit [`34a8f85`](https://github.com/nacho-divetis/incidapp/commit/34a8f85)), el agente principal trabajó en paralelo:

- `backend-dev` con T-03.02, en la rama de la feature;
- `frontend-dev` con T-03.03 y T-04.03 (componentes de incidencias y de estados), en un *worktree* de Git propio, porque `Paralelizable con` lo permitía y los componentes solo dependen del contrato.

El *prompt* de cada subagente es corto: el ID de la tarea, la ruta de `tasks.md` y "sigue tus instrucciones". La spec la lee el subagente; el principal no se la resume. El front terminó antes ([`4c32f13`](https://github.com/nacho-divetis/incidapp/commit/4c32f13) y [`4202bbb`](https://github.com/nacho-divetis/incidapp/commit/4202bbb)) y se integró en la rama de la feature.

## 4 · Implementación y verificación

`backend-dev` siguió la *skill* `caso-de-uso` con TDD: dominio (`incident-code.ts`, `incident-changes.ts`), casos de uso (`createIncident`, `updateIncident`, `assignIncident`…), puertos, repositorios Drizzle con su migración **generada**, rutas Fastify y tests de API. El agente principal **repitió la verificación** de la tarea (no se fía del resumen del subagente): `typecheck`, `lint` y los tests de la API, en verde.

## 5 · Revisión con contexto limpio

El principal lanzó `code-reviewer` y `security-reviewer` en paralelo, pasándoles **solo** "T-03.02" y el alcance del diff. Ninguno sabía qué había pensado el implementador. Los dos señalaron, con gravedad **media**, el mismo problema:

> La edición y la asignación leían la incidencia, la autorizaban y calculaban el *diff* **fuera** de la transacción, y el `UPDATE` iba sin bloqueo.

El escenario concreto (*TOCTOU*, *time of check to time of use*):

1. Un Usuario abre su incidencia ABIERTA y la edita (`PATCH`). La API la lee: está ABIERTA, así que puede editar.
2. Mientras tanto, otra petición la pasa a EN CURSO.
3. La edición del paso 1 se escribe igualmente: el Usuario ha editado una incidencia que **ya no estaba ABIERTA**, saltándose la regla de `permisos.md`.
4. Además, el `before` del evento `UPDATED` se calculó sobre la lectura antigua. El historial es **solo de inserción**: ese dato erróneo ya no se podría corregir.

Todos los tests pasaban (1009 en ese momento), porque ninguno lanzaba dos peticiones a la vez.

## 6 · Corrección

Gravedad media → se corrige (tabla de la *skill* `tarea`). El principal devolvió el hallazgo a `backend-dev`, que:

- añadió `findByIdForUpdate` al repositorio (`SELECT … FOR UPDATE`, que bloquea la fila hasta el fin de la transacción);
- creó `lockIncidentForAction(incidents, actor, id, action)` en `incident-support.ts`: lee **con bloqueo dentro de la `UnitOfWork`** y autoriza sobre esa misma lectura;
- hizo que `updateIncident` y `assignIncident` calculen el *diff* sobre la lectura bloqueada;
- añadió tests con *fakes* que cambian la incidencia justo antes del bloqueo:

```ts
it('CA-03.9: si otra petición cambia el estado antes del bloqueo, la regla "solo en ABIERTA" usa el estado nuevo (403)', …)
it('CA-03.9: el "antes" del evento UPDATED es el de la lectura bloqueada, no uno desfasado', …)
```

Después se repitió la verificación y el hallazgo se anotó en [hallazgos-revisores.md](hallazgos-revisores.md).

## 7 · Commit

Un solo commit con el código, los tests, la tarea marcada como hecha y el hallazgo registrado, con el ID de la tarea en el mensaje (Conventional Commits en español, comprobado por commitlint):

> [`30d8bc5`](https://github.com/nacho-divetis/incidapp/commit/30d8bc5) `feat(incidents): tipos, alta con código, listado, detalle, edición y asignación [T-03.02]` — 60 archivos, incluidos `docs/specs/F03-incidencias/tasks.md` y `docs/proceso-ia/hallazgos-revisores.md`.

La corrección tuvo un efecto más: la tarea siguiente, [T-04.02](../specs/F04-estados/tasks.md) (cambio de estado), reutilizó `lockIncidentForAction`, de modo que las **transiciones** también deciden sobre la incidencia bloqueada (commit [`50df90e`](https://github.com/nacho-divetis/incidapp/commit/50df90e), en [`change-incident-status.ts`](../../apps/api/src/application/incidents/change-incident-status.ts)).

## 8 · PR y despliegue

F03 y F04 se integraron en la rama `feat/F03-F04-incidencias-estados`. Al terminar sus tareas, el principal ejecutó `npm test` completo y, con la confirmación del usuario, abrió el PR y lo integró con *squash merge* cuando la CI estuvo en verde:

> PR [#6](https://github.com/nacho-divetis/incidapp/pull/6) → [`8949239`](https://github.com/nacho-divetis/incidapp/commit/8949239) `feat: F03 incidencias y F04 estados e historial [T-03.01..T-04.06] (#6)`

Render despliega `main` solo si la CI está en verde (`autoDeployTrigger: checksPass` en [render.yaml](../../render.yaml)). La última tarea de F04 comprobó el flujo en producción como Usuario, Responsable y Dirección ([`018c304`](https://github.com/nacho-divetis/incidapp/commit/018c304), T-04.06).

## Trazabilidad

| Paso | Dónde |
|---|---|
| Requisito | RF-09 y RF-10 en [requisitos.md](../requisitos.md) |
| Regla | "Editar campos" en [permisos.md](../permisos.md) |
| Criterio | CA-03.9 y CA-03.10 en [spec.md](../specs/F03-incidencias/spec.md) |
| Tarea | T-03.02 en [tasks.md](../specs/F03-incidencias/tasks.md) |
| Hallazgo | [hallazgos-revisores.md](hallazgos-revisores.md) |
| Commit | [`30d8bc5`](https://github.com/nacho-divetis/incidapp/commit/30d8bc5) |
| PR | [#6](https://github.com/nacho-divetis/incidapp/pull/6) |

## Otro hallazgo: un test intermitente

No todos los problemas los encuentra un revisor. Durante las páginas de incidencias (F03), un test de la web sobre la sesión caducada (CA-01.16) fallaba **solo a veces**. En lugar de reintentarlo hasta que pasara, se investigó la causa, y resultó ser un bug real de producción:

> Cada 401 vaciaba la caché; la página seguía montada durante la navegación a `/login`, recreaba sus *queries* y recibía otro 401, en bucle.

Con la sesión caducada, el navegador entraba en un **bucle de peticiones** contra la API. La corrección (5 líneas en `providers.tsx` y un test que lo reproduce) está en el commit [`738dab6`](https://github.com/nacho-divetis/incidapp/commit/738dab6) `fix(web): evitar el bucle de peticiones tras caducar la sesión`. La regla de los tests del *harness* ("un test que falla por un bug real no se salta ni se debilita") es lo que llevó a encontrarlo.
