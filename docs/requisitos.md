# Requisitos

IncidApp es una aplicación web para registrar y hacer seguimiento de las incidencias de una **empresa ficticia** (transporte, proveedores, clientes, calidad…), con acceso por roles y departamentos, estados con historial y auditoría de la gestión de usuarios (los adjuntos y el cuadro de mando quedan fuera del TFM).

- Prioridad **MoSCoW**: **M** (*must*, imprescindible) · **S** (*should*, importante) · **C** (*could*, si sobra tiempo) · **W** (*won't*, fuera de esta versión).
- Cada requisito indica la feature que lo implementa (`docs/specs/<Fxx>/`). Los criterios de aceptación (`CA-xx.y`) de cada spec concretan cómo se comprueba.
- Las reglas de acceso están en [`permisos.md`](permisos.md) y los términos, en [`glosario.md`](glosario.md).
- **Recorte del TFM** (decisión 8 de la spec de F03, por la fecha de congelación del 27/11/2026): los adjuntos (F05), la consulta de la auditoría y el cuadro de mando (F06) y los comentarios sueltos quedan fuera de esta versión (**W**). La auditoría sigue registrando lo de F01 y F02.
- **Recorte de la entrega** (decisión 4 de la spec de F07, 25/11/2026): Storybook se ejecuta solo en local y el `Dockerfile`, la CI ampliada y Storybook público quedan como trabajo futuro (ver [Trabajo futuro](#trabajo-futuro)).

## Actores

| Rol | Descripción |
|---|---|
| **Admin** | Administra la aplicación: ve y hace todo, gestiona usuarios y consulta la auditoría |
| **Dirección** | Consulta: ve todas las incidencias y el cuadro de mando, sin modificar nada |
| **Responsable** | Gestiona las incidencias de sus departamentos: edita, asigna, cambia el estado, rechaza, cierra y reabre |
| **Usuario** | Registra incidencias y trabaja en las que ha creado o tiene asignadas |

Cada usuario tiene **un rol global** y pertenece a **uno o varios departamentos**.

## Empresa ficticia

**Departamentos:** DIR (Dirección) · ADM (Administración y Finanzas) · COM (Comercial) · ATC (Atención al Cliente / Postventa) · COMP (Compras) · LOG (Logística y Almacén) · PROD (Producción / Operaciones) · TEC (Departamento Técnico) · CAL (Calidad).

**Tipos de incidencia** (cada uno con un departamento por defecto):

| Tipo | Ejemplos | Dpto. por defecto |
|---|---|---|
| Transporte | Retraso, daño en mercancía, entrega errónea | LOG |
| Proveedor | Material defectuoso, retraso, error en pedido | COMP |
| Cliente / Reclamación | Queja, devolución, producto no conforme | ATC |
| Calidad | No conformidad interna, fallo de producto | CAL |
| Técnica / Instalación | Avería, fallo en instalación, garantía | TEC |
| Administrativa | Error de facturación, cobros, documentación | ADM |
| Interna / Operativa | Equipos, instalaciones, procesos | PROD |

## Historias de usuario

- **HU-01:** Como **usuario**, quiero registrar una incidencia indicando su tipo para que llegue al departamento que debe resolverla, y seguir viéndola aunque sea de otro departamento.
- **HU-02:** Como **usuario**, quiero ver las incidencias que tengo asignadas y cambiar su estado, con un comentario cuando haga falta, para informar del avance.
- **HU-03:** Como **responsable**, quiero ver las incidencias de mis departamentos, filtrarlas y asignarlas a mi equipo para repartir el trabajo.
- **HU-04:** Como **responsable**, quiero rechazar, cerrar o reabrir incidencias con un comentario para controlar la calidad de la resolución.
- **HU-05:** Como **persona de Dirección**, quiero un cuadro de mando global (abiertas por estado, tipo y departamento, y tiempo medio de resolución) para conocer la situación sin entrar en el detalle.
- **HU-06:** Como **admin**, quiero dar de alta y de baja a usuarios y cambiar su rol y sus departamentos para controlar quién accede a qué.
- **HU-07:** Como **admin**, quiero consultar un registro de auditoría (inicios de sesión, intentos fallidos y cambios de usuarios) para detectar accesos indebidos.
- **HU-08:** Como **evaluador del TFM**, quiero entrar en la demo con un usuario de cada rol para comprobar cómo cambia lo que se puede ver y hacer.

## Requisitos funcionales

| ID | Requisito | MoSCoW | Feature |
|---|---|---|---|
| RF-01 | Iniciar sesión con email y contraseña | M | F01 |
| RF-02 | Cerrar sesión, invalidando la sesión en el servidor | M | F01 |
| RF-03 | Mantener la sesión entre visitas hasta que caduque, y obtener el usuario actual | M | F01 |
| RF-04 | Restringir lo que cada usuario ve y hace según su rol y sus departamentos ([`permisos.md`](permisos.md)) | M | F02 |
| RF-05 | Gestionar usuarios (alta, edición, desactivación, rol y departamentos). Solo Admin | M | F02 |
| RF-06 | Mantener los catálogos de departamentos y de tipos de incidencia (cargados por *seed*) | M | F00 · F03 |
| RF-07 | Crear una incidencia con título, descripción, tipo, prioridad y fecha objetivo. El departamento propietario se toma del tipo | M | F03 |
| RF-08 | Asignar a cada incidencia un código único y correlativo por año: `INC-AAAA-NNNN` | M | F03 |
| RF-09 | Editar los campos de una incidencia | M | F03 |
| RF-10 | Asignar una incidencia a un usuario del departamento propietario | M | F03 |
| RF-11 | Listar incidencias con filtros (estado, prioridad, departamento, "Asignadas a mí" y texto en el código y el título) y paginación | M | F03 |
| RF-12 | Ver el detalle de una incidencia con las acciones permitidas para el usuario actual | M | F03 |
| RF-13 | Cambiar el estado de una incidencia según la máquina de estados, con comentario obligatorio donde se exige | M | F04 |
| RF-14 | Comentar una incidencia con el comentario de un cambio de estado (sin comentarios sueltos) | M | F04 |
| RF-15 | Ver el historial de una incidencia como línea de tiempo (alta, ediciones, asignaciones y cambios de estado con su comentario) | M | F04 |
| RF-16 | Adjuntar imágenes (jpg, png, webp) y PDF de hasta 5 MB a una incidencia (fuera del TFM) | W | — |
| RF-17 | Descargar los adjuntos solo si se puede ver la incidencia, con vista previa de las imágenes (fuera del TFM) | W | — |
| RF-18 | Registrar en la auditoría los inicios de sesión, los intentos fallidos y los cambios de usuarios | M | F01 · F02 |
| RF-19 | Consultar la auditoría. Solo Admin (fuera del TFM) | W | — |
| RF-20 | Consultar un cuadro de mando global (abiertas por estado, tipo y departamento, y tiempo medio de resolución). Solo Admin y Dirección (fuera del TFM) | W | — |
| RF-21 | Disponer de datos demo y de un usuario por rol con contraseña conocida | M | F01 · F07 |
| RF-22 | Notificaciones por email | W | — |
| RF-23 | Exportar incidencias a CSV | W | — |
| RF-24 | Miniaturas de los adjuntos | W | — |
| RF-25 | Cuadro de mando por departamento para Responsables | W | — |

## Requisitos no funcionales

| ID | Requisito | MoSCoW | Feature |
|---|---|---|---|
| RNF-01 | **Despliegue con coste cero:** URL pública en Render (plan gratuito) con PostgreSQL en Neon (plan gratuito). Ningún servicio, plan ni dependencia de pago | M | F00 |
| RNF-02 | **Arquitectura por capas** (Clean Architecture en la API: `domain` ← `application` ← `infrastructure`/`http` ← `composition`), comprobada con ESLint | M | F00 |
| RNF-03 | **Calidad automatizada:** lint, comprobación de tipos, tests y build en cada PR (GitHub Actions), los E2E de Playwright en un flujo propio y, en cada commit, Husky, lint-staged y commitlint. La CI ampliada (`Dockerfile` y `docker build`, gitleaks, búsqueda de términos prohibidos, `npm audit` y Dependabot) queda como **trabajo futuro** (decisión 4 de la spec de F07) | M | F00 · F07 |
| RNF-04 | **Sistema de diseño** con atomic design (tokens, átomos, moléculas, organismos y plantillas), documentado en Storybook **en local** (`npm run storybook`) y con la regla de niveles comprobada con ESLint. Publicar Storybook en GitHub Pages queda como trabajo futuro (decisión 4 de la spec de F07) | M | F00 |
| RNF-05 | **Confidencialidad:** solo datos ficticios; ningún nombre, logo, documento ni dato de una empresa o persona real | M | Todas |
| RNF-06 | **Idioma:** identificadores de código en inglés; interfaz, mensajes, documentación y commits en español | M | Todas |
| RNF-07 | **Seguridad (OWASP Top 10):** contraseñas con argon2id; sesión en BD con cookie `httpOnly`, `secure` y `sameSite=Lax`, rotada al iniciar sesión; cabecera `X-Requested-With` obligatoria en las peticiones que modifican datos; *rate limit* en el login; cabeceras de seguridad con CSP; toda entrada validada con Zod | M | F00 · F01 |
| RNF-08 | **Control de acceso:** la autorización se decide solo en el servidor (`AuthorizationPolicy`). Un recurso no visible responde 404 y una acción no permitida, 403 | M | F02 |
| RNF-09 | **Trazabilidad:** el historial de las incidencias y la auditoría solo admiten inserciones; nunca se modifican ni se borran | M | F01 · F02 · F03 · F04 |
| RNF-10 | **Accesibilidad:** etiquetas en todos los campos, navegación por teclado con foco visible, *landmarks* y contraste AA; sin violaciones del addon a11y de Storybook | S | F00 en adelante |
| RNF-11 | **Límites del plan gratuito:** datos demo moderados; el README avisa de que la demo tarda en torno a un minuto en despertar (el límite de 5 MB de los adjuntos queda para cuando se implementen, fuera del TFM) | M | F07 |
| RNF-12 | **Tests:** cobertura alta (> 85 %) en `domain` y `application`; matriz completa de autorización en la API; 3 flujos E2E | M | F02 en adelante · F07 |
| RNF-13 | **Proceso trazable:** cada feature tiene spec, plan y tareas (SDD), y cada commit cita la tarea que implementa (RF → CA → T → commit → PR) | M | Todas |
| RNF-14 | **Fechas** en formato `dd/mm/aaaa` y zona `Europe/Madrid` en la interfaz | S | F03 en adelante |

## Trabajo futuro

Fuera de esta versión por los recortes del TFM (decisión 8 de la spec de F03 y decisión 4 de la de F07):

- **Adjuntos** (RF-16, RF-17, RF-24): diseño ya decidido en [ADR-005](adr/005-adjuntos-en-bytea.md) (`bytea`, *magic bytes*, 5 MB).
- **Consulta de la auditoría y cuadro de mando** (RF-19, RF-20, RF-25). La auditoría ya registra los inicios de sesión y los cambios de usuarios.
- **Comentarios sueltos** en una incidencia (hoy solo hay comentario al cambiar de estado).
- **Docker:** `Dockerfile` multietapa construido en la CI (Render usa Node nativo y no lo necesita).
- **CI ampliada:** gitleaks, búsqueda de términos prohibidos (RNF-05), `npm audit` y Dependabot.
- **Storybook público** en GitHub Pages ([ADR-006](adr/006-despliegue-coste-cero.md) lo preveía; hoy se ejecuta en local con `npm run storybook`).
- Notificaciones por email y exportación a CSV (RF-22, RF-23).
