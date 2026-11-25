# Guion del vídeo de la demo

Vídeo de **unos 9 minutos y medio** (objetivo entre 8 y 10) para la entrega del TFM. Lo narra una **voz sintética** en español sobre una **grabación automática del navegador** (Playwright, 1280×720). Todo el vídeo muestra la pantalla: la demo pública, las diapositivas de [`index.html`](index.html), Storybook en local o páginas públicas del repositorio. No sale la cara de nadie ni ningún dato real.

Este guion es **ejecutable**: el generador del vídeo (T-07.09) lee las escenas en orden y, para cada una, sintetiza la narración, ejecuta las acciones mientras se graba y añade el subtítulo. Por eso cada escena sigue siempre el mismo formato (ver [Formato de una escena](#formato-de-una-escena)).

## Bloques y tiempos

Los bloques siguen el guion de la entrega del máster: problema → demo por roles → permisos denegados → arquitectura y Storybook → calidad y seguridad → proceso con IA → cierre.

| Bloque | Escenas | Inicio | Duración |
|---|---|---|---|
| 1 · El problema | E01–E02 | 0:00 | 0:45 |
| 2 · Demo por roles | E03–E10 | 0:45 | 3:25 |
| 3 · Permisos denegados | E11 | 4:10 | 0:30 |
| 4 · Arquitectura, atomic design y Storybook | E12–E15 | 4:40 | 1:20 |
| 5 · Calidad, CI y seguridad | E16–E17 | 6:00 | 1:10 |
| 6 · Proceso con IA: harness, agentes, SDD y hallazgos | E18–E20 | 7:10 | 1:55 |
| 7 · Recortes y cierre | E21–E22 | 9:05 | 0:30 |
| **Total** | **22 escenas** | | **9:35** |

La narración suma unas **1.025 palabras**: unos 7 minutos de voz a ritmo natural (≈ 145 palabras por minuto). El resto del tiempo son las acciones en la demo y las pausas para que se lea la pantalla.

| Escena | Pantalla | Duración |
|---|---|---|
| E01 · Portada | diapositiva 1 | 15 s |
| E02 · El problema | diapositiva 2 | 30 s |
| E03 · Acceso y usuarios demo | demo · `/login` | 15 s |
| E04 · Ciclo de vida | diapositiva 4 | 20 s |
| E05 · Usuario: listado y filtros | demo · usuario@ | 25 s |
| E06 · Usuario: nueva incidencia | demo · usuario@ | 30 s |
| E07 · Usuario: empezar y resolver | demo · usuario@ | 35 s |
| E08 · Responsable: revisar y cerrar | demo · responsable@ | 35 s |
| E09 · Dirección: todo visible, sin acciones | demo · direccion@ | 25 s |
| E10 · Admin: gestión de usuarios | demo · admin@ | 20 s |
| E11 · Acceso denegado y no encontrada | demo · usuario@ | 30 s |
| E12 · Permisos en el servidor | diapositiva 5 | 20 s |
| E13 · Clean Architecture y ADR | diapositiva 6 | 20 s |
| E14 · Atomic design | diapositiva 7 | 15 s |
| E15 · Storybook | Storybook local | 25 s |
| E16 · Calidad y seguridad | diapositiva 8 | 50 s |
| E17 · Integración continua | GitHub · Actions | 20 s |
| E18 · El harness | diapositiva 9 | 55 s |
| E19 · Hallazgos de los revisores | diapositiva 10 | 45 s |
| E20 · Trazabilidad | GitHub · commits del PR #6 | 15 s |
| E21 · Recortes y trabajo futuro | diapositiva 11 | 15 s |
| E22 · Cierre | diapositiva 12 | 15 s |

## Preparación de la grabación

**Variables** (las usan las acciones):

| Variable | Valor |
|---|---|
| `DEMO` | `https://incidapp.onrender.com` |
| `SLIDES` | `file:///<ruta del repo>/slides/index.html?limpio` (`?limpio` oculta los controles; `#N` abre la diapositiva N) |
| `SB` | `http://localhost:6006` (`npm run storybook`, arrancado antes de grabar) |
| `REPO` | `https://github.com/nacho-divetis/incidapp` |
| `PASS` | `Demo2026!` (contraseña pública de los 4 usuarios demo) |
| `TITULO` | `Retraso en la ruta de reparto de la zona norte` |

**Antes de grabar:**
1. **Despertar la demo:** pedir `DEMO/api/health` hasta que responda 200 (Render gratuito tarda alrededor de un minuto si estaba dormido). Abrir `DEMO/login` una vez sin grabar.
2. Comprobar que los datos demo están cargados: con `direccion@` hay incidencias en los 7 estados y alguna del departamento Calidad.
3. Arrancar Storybook en local y comprobar que abren los tres identificadores de E15 (si alguno cambia, buscarlo en `SB/index.json`).
4. Navegador Chromium de Playwright a 1280×720, idioma `es-ES`, sin extensiones y con el zoom al 100 %.

**Reglas de las acciones:**
- **Iniciar sesión como X:** ir a `DEMO/login`, rellenar **Email** con X y **Contraseña** con `PASS`, pulsar **Iniciar sesión** y esperar el título **Incidencias**.
- **Cerrar sesión:** pulsar **Cerrar sesión** en la cabecera y esperar el título **Iniciar sesión**.
- Cada acción que llama a la API **espera su respuesta** (`/api/...`) y el cambio visible en la página, nunca un tiempo fijo. Entre acciones, una pausa breve (≈ 0,8 s) para que se vea qué ocurre.
- Los clics se hacen por rol y texto accesible (`getByRole`, `getByLabel`), como en los E2E.
- **Duración real de una escena** = la mayor entre la narración (+ 0,6 s de margen) y sus acciones. Si la pantalla acaba antes, se mantiene la última imagen; si la narración acaba antes, las acciones siguen sin voz.
- Cada grabación deja en la demo una incidencia de transporte cerrada por Carmen: es esperado y son datos ficticios. Los usuarios ficticios adicionales del *seed* no se usan para entrar.

**Si el total se sale de 8–10 minutos,** se ajusta el texto de la narración (primero E18, E16 y E19), no la velocidad de la voz.

### Pronunciación (solo para la voz)

La narración está escrita para leerse tal cual. Si la voz de Windows pronuncia mal algún término, el generador puede sustituirlo **solo en el texto que se sintetiza** (los subtítulos conservan la forma escrita):

| Escrito | Para la voz |
|---|---|
| IncidApp | Incid App |
| argon2 | argon dos |
| GitHub | Guit Jab |
| Storybook | Stori buk |
| Playwright | Pléi rait |
| Claude Code | Clod Coud |
| worktrees | uórc tris |
| API | a pe i |

## Formato de una escena

Cada escena es un apartado `### Exx · Título` con estos campos, siempre en este orden:

- **Bloque:** número del bloque de la tabla.
- **Duración:** objetivo en segundos.
- **Pantalla:** `diapositiva N` (abrir `SLIDES#N`), `demo` (con el usuario que tiene la sesión), `storybook` o `web` (URL pública).
- **Acciones:** lista numerada de pasos concretos (URL, usuario, clic, campo y valor, espera).
- **Narración:** el texto que lee la voz, en frases cortas.
- **Subtítulo:** rótulo breve de la escena (el `.srt` completo se genera a partir de la narración).

---

## Bloque 1 · El problema

### E01 · Portada
- **Bloque:** 1
- **Duración:** 15 s
- **Pantalla:** diapositiva 1
- **Acciones:**
  1. Abrir `SLIDES#1` y esperar a que se pinte la portada.
  2. Mantener la imagen hasta el final de la narración.
- **Narración:**
  > Hola. Esto es IncidApp, mi trabajo de fin de máster. Es una aplicación web para gestionar incidencias en una empresa ficticia. Y la he construido con un equipo de agentes de inteligencia artificial.
- **Subtítulo:** IncidApp · gestión de incidencias con un equipo de agentes de IA

### E02 · El problema
- **Bloque:** 1
- **Duración:** 30 s
- **Pantalla:** diapositiva 2
- **Acciones:**
  1. Pulsar `ArrowRight` (diapositiva 2).
  2. Mantener la imagen.
- **Narración:**
  > En muchas empresas, las incidencias viajan por correo o en hojas de cálculo. Un transporte llega tarde y nadie sabe quién lo lleva. No queda rastro de qué pasó, ni cuándo. IncidApp lo ordena. Cada incidencia tiene un departamento propietario, una prioridad y una persona asignada. Sigue un ciclo de vida con reglas. Y cada rol ve y hace solo lo que le corresponde.
- **Subtítulo:** Del correo y la hoja de cálculo a un ciclo de vida con reglas

## Bloque 2 · Demo por roles

### E03 · Acceso y usuarios demo
- **Bloque:** 2
- **Duración:** 15 s
- **Pantalla:** demo, sin sesión
- **Acciones:**
  1. Ir a `DEMO/login` y esperar el título **Iniciar sesión**.
  2. Desplazar la vista hasta el panel de cuentas demo (los cuatro botones **Usar la cuenta de …**) y mantenerla.
- **Narración:**
  > La demo está publicada en Render, en el plan gratuito. Hay un usuario por rol. La pantalla de acceso los muestra, con la contraseña común.
- **Subtítulo:** Demo pública · un usuario por rol · contraseña Demo2026!

### E04 · Ciclo de vida
- **Bloque:** 2
- **Duración:** 20 s
- **Pantalla:** diapositiva 4
- **Acciones:**
  1. Abrir `SLIDES#4`.
  2. Mantener la imagen.
- **Narración:**
  > Antes de entrar, el ciclo de vida. Una incidencia nace abierta, se empieza, se resuelve y se cierra. Puede quedar pendiente de un tercero, rechazarse o reabrirse. Las líneas continuas son operativas. Las discontinuas, de gestión. Y algunas exigen un comentario.
- **Subtítulo:** 7 estados · 9 transiciones · historial que no se borra

### E05 · Usuario: listado y filtros
- **Bloque:** 2
- **Duración:** 25 s
- **Pantalla:** demo · `usuario@incidapp.test` (Pablo Moreno, Usuario, Logística)
- **Acciones:**
  1. Iniciar sesión como `usuario@incidapp.test`.
  2. En **Estado**, elegir **En curso**; esperar la respuesta de `/api/incidents`.
  3. Marcar **Asignadas a mí**; esperar la respuesta.
  4. Desmarcar **Asignadas a mí** y, en **Estado**, volver a **Todos**; esperar la respuesta.
- **Narración:**
  > Entro como Pablo, con el rol de Usuario, en Logística. Solo ve las incidencias de su departamento, las que ha creado y las que tiene asignadas. Puede filtrarlas por estado o por prioridad, o quedarse solo con las suyas.
- **Subtítulo:** Usuario · ve las de su departamento, las suyas y las asignadas

### E06 · Usuario: nueva incidencia
- **Bloque:** 2
- **Duración:** 30 s
- **Pantalla:** demo · `usuario@incidapp.test`
- **Acciones:**
  1. Pulsar **Nueva incidencia** y esperar el título **Nueva incidencia**.
  2. **Título:** `TITULO`.
  3. **Descripción:** `El camión de la ruta norte salió con dos horas de retraso y tres clientes no han recibido su pedido.`
  4. **Tipo:** **Transporte**. **Prioridad:** **Alta**. **Fecha objetivo:** hoy + 3 días.
  5. Pulsar **Crear incidencia**; esperar la respuesta de `POST /api/incidents` y el aviso **Incidencia creada.**
  6. Guardar la URL actual como `urlIncidencia`. Mantener la imagen sobre el código `INC-…`.
- **Narración:**
  > Pablo da de alta una incidencia de transporte, con prioridad alta y una fecha objetivo. El tipo decide el departamento propietario: no lo elige el usuario. Al guardar, el servidor le asigna un código correlativo y abre su historial.
- **Subtítulo:** Alta · el servidor fija el código, el departamento y el estado

### E07 · Usuario: empezar y resolver
- **Bloque:** 2
- **Duración:** 35 s
- **Pantalla:** demo · `usuario@incidapp.test`, en `urlIncidencia`
- **Acciones:**
  1. Pulsar **Empezar**; en el diálogo, pulsar el botón de confirmar **Empezar**; esperar la respuesta y el estado **En curso**.
  2. Pulsar **Marcar como resuelta**; en el diálogo, con el **Comentario** vacío, pulsar **Marcar como resuelta** y mantener 2 s el error del campo.
  3. **Comentario:** `Ruta reprogramada con otro transportista. Los tres pedidos se entregan hoy por la tarde.`
  4. Pulsar **Marcar como resuelta**; esperar la respuesta y el estado **Resuelta**.
  5. Desplazar la vista hasta **Historial** y mantenerla. No aparece el botón **Cerrar**.
- **Narración:**
  > Pablo la empieza y luego la marca como resuelta. Para resolver, el comentario es obligatorio. Si lo dejo vacío, el diálogo no deja continuar. Cada cambio aparece en el historial: quién, cuándo y por qué. Fíjate en que Pablo no tiene el botón de cerrar. Eso le corresponde a su responsable.
- **Subtítulo:** Empezar → Resolver (comentario obligatorio) · el Usuario no cierra

### E08 · Responsable: revisar y cerrar
- **Bloque:** 2
- **Duración:** 35 s
- **Pantalla:** demo · `responsable@incidapp.test` (Carmen Vidal, Responsable, Logística)
- **Acciones:**
  1. Cerrar sesión e iniciar sesión como `responsable@incidapp.test`.
  2. En **Buscar**, escribir `TITULO`; esperar la respuesta.
  3. Pulsar el enlace con el código de la **primera fila** (la más reciente). Si la URL no es `urlIncidencia`, ir a `urlIncidencia`.
  4. Mantener 2 s el panel **Asignar a** (sin cambiarlo).
  5. Pulsar **Cerrar**; en el diálogo, pulsar el botón de confirmar **Cerrar**; esperar la respuesta y el estado **Cerrada**.
  6. Desplazar la vista hasta **Historial** y mantenerla.
- **Narración:**
  > Ahora entra Carmen, responsable de Logística. Busca la incidencia y la abre. Ella sí puede asignarla a alguien de su departamento, rechazarla o cerrarla. Comprueba la solución y la cierra. El historial queda completo: alta, empezar, resolver y cerrar. Nadie puede editarlo ni borrarlo.
- **Subtítulo:** Responsable · asigna, rechaza, cierra y reabre en su departamento

### E09 · Dirección: todo visible, sin acciones
- **Bloque:** 2
- **Duración:** 25 s
- **Pantalla:** demo · `direccion@incidapp.test` (Javier Ortega, Dirección)
- **Acciones:**
  1. Cerrar sesión e iniciar sesión como `direccion@incidapp.test`. No aparece **Nueva incidencia**.
  2. En **Departamento**, elegir **Calidad**; esperar la respuesta.
  3. Pulsar el enlace con el código de una fila que **Pablo no pueda ver**: el generador lo comprueba antes de grabar (con la sesión de `usuario@`, `GET /api/incidents/:id` responde 404). Normalmente, la primera fila.
  4. Guardar la URL como `urlOtroDepartamento`. Mantener la imagen: no hay botones de estado, ni **Editar**, ni **Asignar a**.
- **Narración:**
  > Javier, de Dirección, ve todas las incidencias de todos los departamentos. Abro una de Calidad. Puede consultarlo todo, pero no tiene ningún botón de acción. Su rol es de solo lectura.
- **Subtítulo:** Dirección · ve todas · ninguna acción

### E10 · Admin: gestión de usuarios
- **Bloque:** 2
- **Duración:** 20 s
- **Pantalla:** demo · `admin@incidapp.test` (Elena Ruiz, Admin)
- **Acciones:**
  1. Cerrar sesión e iniciar sesión como `admin@incidapp.test`.
  2. En la navegación principal, pulsar **Usuarios**; esperar el título **Usuarios** (`DEMO/admin/usuarios`).
  3. Mantener la imagen del listado (sin crear ni editar a nadie).
- **Narración:**
  > Elena es la administradora. Es la única que ve la gestión de usuarios: altas, roles, departamentos y desactivaciones. Los cuatro usuarios demo están protegidos, para que nadie pueda romper la demo.
- **Subtítulo:** Admin · única con gestión de usuarios

## Bloque 3 · Permisos denegados

### E11 · Acceso denegado y no encontrada
- **Bloque:** 3
- **Duración:** 30 s
- **Pantalla:** demo · `usuario@incidapp.test`
- **Acciones:**
  1. Cerrar sesión e iniciar sesión como `usuario@incidapp.test`.
  2. Ir a `DEMO/admin/usuarios`; esperar el texto **No tienes permiso para ver esta página.** y mantener 3 s.
  3. Ir a `urlOtroDepartamento`; esperar el título **Página no encontrada** y mantenerlo.
- **Narración:**
  > ¿Y si Pablo intenta saltarse las reglas? Si escribe la dirección de la gestión de usuarios, ve una página de acceso denegado. Si pega el enlace de esa incidencia de Calidad, la aplicación responde que no existe. Ni siquiera revela que está ahí. Es un error cuatrocientos cuatro, y no un cuatrocientos tres.
- **Subtítulo:** Sin permiso → 403 · no visible → 404 (no se revela que existe)

## Bloque 4 · Arquitectura, atomic design y Storybook

### E12 · Permisos en el servidor
- **Bloque:** 4
- **Duración:** 20 s
- **Pantalla:** diapositiva 5
- **Acciones:**
  1. Abrir `SLIDES#5`.
  2. Mantener la imagen.
- **Narración:**
  > Todo esto lo decide el servidor, en una única política de autorización que sigue la matriz de permisos. Cada respuesta incluye las acciones permitidas. La interfaz solo muestra u oculta botones. Nunca recalcula permisos.
- **Subtítulo:** Una sola AuthorizationPolicy · la interfaz no recalcula permisos

### E13 · Clean Architecture y ADR
- **Bloque:** 4
- **Duración:** 20 s
- **Pantalla:** diapositiva 6
- **Acciones:**
  1. Pulsar `ArrowRight` (diapositiva 6).
  2. Mantener la imagen.
- **Narración:**
  > El backend es un monolito modular con arquitectura limpia. El dominio, con la máquina de estados, no depende de nada. Los casos de uso reciben sus dependencias desde fuera. Y cada decisión importante está en un registro de decisiones de arquitectura. Hay nueve.
- **Subtítulo:** Clean Architecture · dependencias hacia dentro · 9 ADR

### E14 · Atomic design
- **Bloque:** 4
- **Duración:** 15 s
- **Pantalla:** diapositiva 7
- **Acciones:**
  1. Pulsar `ArrowRight` (diapositiva 7).
  2. Mantener la imagen.
- **Narración:**
  > La interfaz sigue atomic design: átomos, moléculas, organismos, plantillas y páginas. Solo las páginas tocan datos. Y una regla de lint impide saltarse los niveles.
- **Subtítulo:** Átomos → moléculas → organismos → plantillas → páginas

### E15 · Storybook
- **Bloque:** 4
- **Duración:** 25 s
- **Pantalla:** storybook (local)
- **Acciones:**
  1. Ir a `SB/?path=/story/organismos-statustransitiondialog--comentario-obligatorio`; esperar el diálogo en el lienzo y mantener 8 s.
  2. Ir a `SB/?path=/story/organismos-incidenttimeline--ciclo-completo`; esperar la línea de tiempo y mantener 8 s.
  3. Ir a `SB/?path=/story/organismos-incidentstatusactions--desde-resuelta` y mantener hasta el final.
- **Narración:**
  > Cada componente tiene su historia en Storybook, que se ejecuta en local. Aquí está el diálogo de cambio de estado, con el comentario obligatorio. Y aquí, la línea de tiempo con un ciclo completo. Se diseñan y se prueban aislados, sin servidor.
- **Subtítulo:** Storybook en local · cada componente con su story y su test

## Bloque 5 · Calidad, CI y seguridad

### E16 · Calidad y seguridad
- **Bloque:** 5
- **Duración:** 50 s
- **Pantalla:** diapositiva 8
- **Acciones:**
  1. Abrir `SLIDES#8`.
  2. Mantener la imagen.
- **Narración:**
  > La calidad está automatizada. Hay unos tres mil tests: del dominio, de los casos de uso, de la API y de los componentes. La matriz de permisos se convierte en una tabla de tests, rol por rol y acción por acción. Además, hay cuatro flujos de punta a punta con Playwright: el acceso de cada rol, el ciclo completo de una incidencia, el acceso denegado y Dirección sin acciones. Se ejecutan contra una base temporal, nunca contra producción. En seguridad: contraseñas con argon2, sesión en base de datos con cookie segura, límite de intentos de acceso, validación de toda entrada y un historial que solo admite inserciones.
- **Subtítulo:** ≈ 3.000 tests · 4 flujos E2E · argon2id, sesión en BD, Zod

### E17 · Integración continua
- **Bloque:** 5
- **Duración:** 20 s
- **Pantalla:** web · `REPO/actions`
- **Acciones:**
  1. Ir a `REPO/actions` (página pública, sin sesión de GitHub); esperar la lista de ejecuciones.
  2. Mantener la imagen sobre las ejecuciones en verde de los flujos **CI** y **E2E**.
- **Narración:**
  > Cada cambio pasa por la integración continua de GitHub: lint, tipos, tests, compilación y los flujos de punta a punta. Si no está en verde, no se fusiona. Y no cuesta nada, porque el repositorio es público.
- **Subtítulo:** GitHub Actions en cada PR · sin verde no hay merge

## Bloque 6 · Proceso con IA: harness, agentes, SDD y hallazgos

### E18 · El harness
- **Bloque:** 6
- **Duración:** 55 s
- **Pantalla:** diapositiva 9
- **Acciones:**
  1. Abrir `SLIDES#9`.
  2. Mantener la imagen.
- **Narración:**
  > Ahora, lo más importante del máster: el proceso con inteligencia artificial. Monté un harness para Claude Code. Un archivo de instrucciones es la fuente de verdad para cualquier agente. Cada funcionalidad empieza con una especificación con criterios de aceptación, que apruebo yo. Después vienen un plan y una lista de tareas. El agente principal actúa como jefe técnico. Delega cada tarea en un subagente de backend o de frontend, que trabaja con los tests primero. Si el contrato ya existe, front y back avanzan en paralelo, en worktrees separados. Y los hooks y los permisos ponen los límites: formatean, protegen archivos, comprueban los tipos y piden permiso antes de publicar.
- **Subtítulo:** SDD: spec → plan → tareas · subagentes · worktrees en paralelo

### E19 · Hallazgos de los revisores
- **Bloque:** 6
- **Duración:** 45 s
- **Pantalla:** diapositiva 10
- **Acciones:**
  1. Pulsar `ArrowRight` (diapositiva 10).
  2. Mantener la imagen.
- **Narración:**
  > Cada cambio lo revisan otros agentes, con contexto limpio. Solo reciben el identificador de la tarea y el alcance del cambio, nunca el razonamiento de quien lo escribió. Así no heredan sus sesgos. Y encontraron fallos reales. Un email de un mega en el login se guardaba entero en la auditoría, y unos cientos de intentos podían llenar la base de datos gratuita. Una condición de carrera al editar dejaba el historial desfasado, con más de mil tests en verde. Y un ajuste de empaquetado hacía desaparecer los mensajes en español sin que fallara ningún test. Todo está documentado en el repositorio.
- **Subtítulo:** Revisores con contexto limpio · fallos reales que los tests no veían

### E20 · Trazabilidad
- **Bloque:** 6
- **Duración:** 15 s
- **Pantalla:** web · `REPO/pull/6/commits`
- **Acciones:**
  1. Ir a `REPO/pull/6/commits` (página pública); esperar la lista de commits.
  2. Desplazar despacio la lista para que se lean los identificadores `[T-03.xx]` y `[T-04.xx]`.
- **Narración:**
  > Cada commit lleva el identificador de su tarea. Así se puede seguir el camino completo, de la especificación al código.
- **Subtítulo:** Cada commit con su tarea · de la spec al código

## Bloque 7 · Recortes y cierre

### E21 · Recortes y trabajo futuro
- **Bloque:** 7
- **Duración:** 15 s
- **Pantalla:** diapositiva 11
- **Acciones:**
  1. Abrir `SLIDES#11`.
  2. Mantener la imagen.
- **Narración:**
  > Para llegar a la entrega con una demo sólida, recorté alcance, por decisión y por escrito: los adjuntos, el cuadro de mando, Storybook público y Docker. Son el siguiente paso.
- **Subtítulo:** Trabajo futuro · adjuntos, cuadro de mando, Storybook público y Docker

### E22 · Cierre
- **Bloque:** 7
- **Duración:** 15 s
- **Pantalla:** diapositiva 12
- **Acciones:**
  1. Pulsar `ArrowRight` (diapositiva 12).
  2. Mantener la imagen 2 s más que la narración y terminar.
- **Narración:**
  > IncidApp está en producción, con coste cero y datos ficticios. Los enlaces y los usuarios de prueba están en pantalla. Gracias por tu atención.
- **Subtítulo:** incidapp.onrender.com · Gracias
