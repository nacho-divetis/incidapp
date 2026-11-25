# Diagramas (UML)

Diagramas en [Mermaid](https://mermaid.js.org/), que GitHub dibuja directamente al abrir este archivo. Las reglas de negocio de las que salen están en [`permisos.md`](permisos.md) y las decisiones de arquitectura, en los [ADR](adr/README.md).

## 1 · Máquina de estados de una incidencia (diagrama de estados)

Transiciones de [`permisos.md`](permisos.md#transiciones-de-estado), implementadas en [`status-machine.ts`](../apps/api/src/domain/incidents/status-machine.ts). Las etiquetas son los botones de la web; las marcadas con `*` exigen comentario; las de **gestión** solo las hacen Admin y Responsable (de sus departamentos); las **operativas**, también el Usuario que creó la incidencia o la tiene asignada.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> OPEN: alta
    OPEN --> IN_PROGRESS: Empezar (operativa)
    OPEN --> REJECTED: Rechazar * (gestión)
    IN_PROGRESS --> PENDING_THIRD_PARTY: Pendiente de tercero (operativa)
    PENDING_THIRD_PARTY --> IN_PROGRESS: Reanudar (operativa)
    IN_PROGRESS --> RESOLVED: Marcar como resuelta * (operativa)
    RESOLVED --> IN_PROGRESS: Devolver a en curso * (gestión)
    RESOLVED --> CLOSED: Cerrar (gestión)
    CLOSED --> REOPENED: Reabrir * (gestión)
    REOPENED --> IN_PROGRESS: Empezar (operativa)
    REJECTED --> [*]

    OPEN: Abierta
    IN_PROGRESS: En curso
    PENDING_THIRD_PARTY: Pendiente de tercero
    RESOLVED: Resuelta
    CLOSED: Cerrada
    REJECTED: Rechazada
    REOPENED: Reabierta
```

Cada cambio de estado inserta un evento `STATUS_CHANGED` en `incident_events`, que es **solo de inserción**: la línea de tiempo nunca se reescribe.

## 2 · Capas de la API (diagrama de componentes)

Clean Architecture ([ADR-002](adr/002-clean-architecture.md)). Las flechas son dependencias de código: una capa solo importa de las que tiene debajo. La regla la comprueba ESLint (`eslint-plugin-boundaries`, en [`eslint.config.js`](../eslint.config.js)).

```mermaid
flowchart TB
    subgraph composition["composition · composition root"]
        C["config · container · main · db-command"]
    end
    subgraph http["http · Fastify"]
        H["rutas · validación con Zod · anti-CSRF · errores → HTTP"]
    end
    subgraph infrastructure["infrastructure · adaptadores"]
        I["Drizzle (PGlite / Neon) · repositorios · UnitOfWork · argon2id · reloj"]
    end
    subgraph application["application · casos de uso"]
        A["casos de uso · puertos (interfaces) · AuthorizationPolicy"]
    end
    subgraph domain["domain · sin dependencias externas"]
        D["Incident · máquina de estados · código INC-AAAA-NNNN"]
    end
    shared[["packages/shared · contrato Zod (front y back)"]]

    composition --> http
    composition --> infrastructure
    http --> application
    infrastructure -. implementa los puertos .-> application
    application --> domain
    http --> shared
    application --> shared
```

- `domain` no importa Fastify, Drizzle, Zod ni `node:*`.
- `http` e `infrastructure` no se importan entre sí: solo el *composition root* las conecta.
- La autorización se decide solo en [`authorization-policy.ts`](../apps/api/src/application/authorization/authorization-policy.ts) ([ADR-009](adr/009-permisos-en-servidor.md)).

## 3 · Niveles de la web (atomic design)

[ADR-008](adr/008-atomic-design-storybook.md). Un nivel solo importa de niveles inferiores; en el mismo nivel, solo los organismos usan otros organismos. Solo las páginas usan datos (TanStack Query), el router y la sesión.

```mermaid
flowchart LR
    T[tokens] --> At[átomos] --> M[moléculas] --> O[organismos] --> Tp[plantillas] --> P[páginas]
    O --> O
    Q[(queries · TanStack Query)] --> P
    API[[lib/api · cliente HTTP]] --> Q
```

## 4 · Una petición de cambio de estado (diagrama de secuencia)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant W as Web (página de detalle)
    participant R as http · ruta Fastify
    participant CU as changeIncidentStatus
    participant P as AuthorizationPolicy
    participant DB as UnitOfWork (PostgreSQL)

    U->>W: Pulsa "Marcar como resuelta" y escribe el comentario
    W->>R: POST /api/incidents/:id/transitions
    R->>R: Sesión, X-Requested-With y validación Zod
    R->>CU: actor, id, { to, comment }
    CU->>DB: SELECT … FOR UPDATE (dentro de la transacción)
    CU->>P: ¿visible? ¿transición permitida a este actor?
    alt no visible
        CU-->>R: NotFoundError → 404
    else no permitida
        CU-->>R: ForbiddenError → 403
    else permitida
        CU->>DB: UPDATE incidents + INSERT incident_events (STATUS_CHANGED)
        CU-->>R: incidencia con allowedActions y allowedTransitions
        R-->>W: 200
        W->>U: Nuevo estado y línea de tiempo actualizada
    end
```
