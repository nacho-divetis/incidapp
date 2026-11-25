# F07 · Entrega — Spec

- **Estado:** aprobada (25/11/2026, por el usuario, con las decisiones del final)
- **Depende de:** F00–F04 (en producción en https://incidapp.onrender.com). F05 (adjuntos) y F06 (auditoría y cuadro de mando) quedan **fuera del TFM**.
- **Requisitos que cubre:** RF-21 (datos demo), RNF-03 (calidad automatizada: E2E en la CI), RNF-05 (solo datos ficticios), RNF-11 (datos moderados y aviso de Render dormido), RNF-12 (3 flujos E2E), RNF-13 (proceso trazable) y el checklist oficial de `references/requisitos-tfm.md` de la skill `entrega-tfm` (README a–f, repositorio público, despliegue, slides y vídeo)

## Objetivo
Dejar el TFM listo para entregar el domingo 29/11/2026: una demo con datos ficticios y creíbles que se pueda recorrer con cada rol, los flujos principales protegidos por E2E, y la documentación, las evidencias del proceso con IA, las slides y el vídeo que pide el máster. **Plazo:** los datos demo y los E2E terminan antes de la congelación (viernes 27/11 a las 20:00); la documentación puede seguir después.

## Historias de usuario
- **HU-08** (de `requisitos.md`): Como **evaluador del TFM**, quiero entrar en la demo con un usuario de cada rol y encontrar incidencias en todos los estados para comprobar cómo cambia lo que se puede ver y hacer.
- **HU-07.1:** Como **desarrollador**, quiero que los flujos principales se comprueben de punta a punta en cada PR para no romper la demo en los últimos días.
- **HU-07.2:** Como **evaluador del TFM**, quiero un README, slides y vídeo que expliquen el proyecto, cómo arrancarlo y cómo se ha aplicado el máster.

## Criterios de aceptación

### Datos demo

#### CA-07.1 · Incidencias demo variadas
- **Dado** una base de datos con las migraciones aplicadas
- **Cuando** se ejecuta `npm run db:seed`
- **Entonces** existen entre 25 y 40 incidencias ficticias, con al menos 2 de cada uno de los 7 tipos (y, por tanto, de cada departamento propietario), los 7 estados representados, las 4 prioridades y una mezcla de asignadas y sin asignar
- **Y** el Usuario demo (`usuario@incidapp.test`, LOG) ve incidencias creadas por él, asignadas a él y de su departamento, y hay incidencias de otros departamentos que **no** ve
- **Y** Dirección ve todas y hay al menos una en cada estado para probar las transiciones con el Responsable demo (LOG)

#### CA-07.2 · Historial coherente
- **Dado** cada incidencia demo
- **Cuando** se lee su historial (`GET /api/incidents/:id/events`)
- **Entonces** empieza por `CREATED`, cada `STATUS_CHANGED` es una transición de la tabla de `docs/permisos.md` desde el estado anterior, hecha por un actor al que la política se lo permite y con comentario cuando la transición lo exige, y el último estado coincide con `status`
- **Y** las fechas son crecientes y anteriores al momento del *seed* (repartidas en las últimas semanas), `resolvedAt`/`closedAt` coinciden con la última entrada en RESUELTA/CERRADA, y el asignado pertenece al departamento propietario

#### CA-07.3 · Idempotente y moderado
- **Dado** una base de datos en la que el *seed* ya se ejecutó (también la de Neon, con incidencias creadas a mano)
- **Cuando** se vuelve a ejecutar (Render lo hace en cada arranque)
- **Entonces** no se duplica ninguna incidencia ni evento, no se modifica ninguna incidencia existente y los códigos `INC-AAAA-NNNN` siguen saliendo del contador sin chocar con los ya usados
- **Y** el total cargado por el *seed* no pasa de 40 incidencias y 200 eventos (límite de Neon)

#### CA-07.4 · Solo datos ficticios
- **Dado** los datos demo (incidencias, comentarios y usuarios adicionales si los hay)
- **Cuando** se revisan
- **Entonces** todos los emails son del dominio reservado `.test`, los nombres de personas, clientes, proveedores y productos son inventados y no aparece ninguna empresa, marca ni persona real (RNF-05)

### E2E

#### CA-07.5 · Login por rol
- **Dado** los 4 usuarios demo
- **Cuando** cada uno inicia sesión desde la pantalla de login
- **Entonces** llega al listado de incidencias con su nombre visible; solo el Admin ve "Usuarios" en la navegación; al cerrar sesión vuelve al login y una ruta protegida lo redirige allí

#### CA-07.6 · Flujo principal
- **Dado** el Usuario demo y el Responsable demo (LOG)
- **Cuando** el Usuario crea una incidencia de tipo Transporte, pulsa "Empezar" y "Marcar como resuelta" (el diálogo exige el comentario), y el Responsable la abre y pulsa "Cerrar"
- **Entonces** la incidencia tiene código `INC-AAAA-NNNN`, termina en Cerrada y la línea de tiempo muestra el alta y los tres cambios de estado con el comentario

#### CA-07.7 · Acceso denegado
- **Dado** el Usuario demo
- **Cuando** abre `/usuarios` y la URL del detalle de una incidencia de otro departamento que no ha creado ni tiene asignada
- **Entonces** ve la página de acceso denegado y la de no encontrada, respectivamente, sin ningún dato de la incidencia

#### CA-07.8 · Dirección sin acciones
- **Dado** Dirección en el listado y en el detalle de una incidencia
- **Cuando** se carga la página
- **Entonces** no ve "Nueva incidencia", ni editar, ni asignar, ni ningún botón de cambio de estado

#### CA-07.9 · E2E reproducible y en CI
- **Dado** un clon limpio con `npm ci` y el navegador de Playwright instalado
- **Cuando** se ejecuta `npm run e2e`
- **Entonces** arranca la aplicación compilada con una base PGlite **nueva y temporal** (sin Neon ni ningún servicio externo), pasa los 4 flujos con Chromium y deja informe y trazas solo si falla
- **Y** se ejecuta en GitHub Actions en cada PR sin coste (repositorio público). Nunca se lanza contra producción

### CI ampliada

#### CA-07.10 · Comprobaciones de entrega en la CI — **descartado (decisión 4)**
Se descarta el 25/11/2026: sin `Dockerfile` ni `docker build`, gitleaks, *grep* de términos prohibidos, `npm audit` en la CI, Dependabot ni Storybook en GitHub Pages. Storybook queda solo en local (`npm run storybook`) y Docker, como trabajo futuro (CA-07.11, CA-07.12).

### Documentación y entregables

#### CA-07.11 · README completo
- **Dado** el `README.md`
- **Cuando** se compara con el checklist de la skill `entrega-tfm`
- **Entonces** tiene descripción, stack, instalación y ejecución **probadas desde un clon limpio** (incluidos `npm run e2e` y Storybook), estructura, funcionalidades con capturas de la demo, usuarios demo (uno por rol, con contraseña), URLs de la demo (con el aviso de que tarda alrededor de un minuto en despertar), slides y vídeo, Storybook en local (`npm run storybook`), información del despliegue y la sección "Cómo se aplica el máster" que enlaza a `docs/master.md`
- **Y** no enlaza ni menciona archivos del harness (`.claude/`, `AGENTS.md`, `CLAUDE.md`)
- **Y** `docs/requisitos.md` refleja la decisión 4: Storybook solo en local y Docker como trabajo futuro

#### CA-07.12 · `docs/master.md`
- **Dado** `docs/master.md`
- **Cuando** se revisa
- **Entonces** tiene una fila por cada módulo del 1 al 9 con su evidencia concreta y enlaces relativos a archivos del repositorio, y **todos los enlaces existen** (comprobado con un script o un *grep*)
- **Y** en M6 y M7 dice que Storybook se ejecuta en local y que Docker queda como trabajo futuro (decisión 4)

#### CA-07.13 · Evidencias del proceso con IA
- **Dado** `docs/proceso-ia/`
- **Cuando** se revisa
- **Entonces** `harness.md` describe cada pieza del harness (subagentes, skills, hooks, reglas, permisos y `AGENTS.md`) y qué problema resuelve, con fragmentos breves y sin copiar sus archivos; `flujo.md` sigue una tarea real de punta a punta (spec → tarea → diff → revisión → commit → PR) con enlaces a commits reales; `metricas.md` da features, tareas, commits, tests y tareas con hallazgos, con el comando con que se calculó cada cifra; y `hallazgos-revisores.md` tiene al menos 3 hallazgos reales (hoy tiene 4)

#### CA-07.14 · Slides y guion del vídeo
- **Dado** la carpeta `slides/`
- **Cuando** se revisa
- **Entonces** hay unas slides de 10–12 diapositivas en HTML autocontenido (sin CDN ni dependencias) y su exportación a PDF en el repo, y un guion de vídeo de 8–10 minutos con los bloques y tiempos de la skill `entrega-tfm` (problema, demo por roles, permisos denegados, arquitectura y Storybook, calidad y seguridad, proceso con IA, cierre), con la grabación de pantalla prevista en todo el vídeo
- **Y** el README enlaza a las slides y al guion

#### CA-07.16 · Vídeo de la demo generado
- **Dado** el guion de CA-07.14 y la demo pública con los datos demo
- **Cuando** se ejecuta el script de generación del vídeo
- **Entonces** se obtiene un MP4 de 8 a 10 minutos con la **grabación de la pantalla** del navegador (Playwright, `recordVideo`) recorriendo la demo según el guion, narración con la voz sintética de Windows (System.Speech, local y gratuita) y subtítulos en español, sin la cara del usuario
- **Y** no usa ningún servicio de pago ni en la nube (montaje con `ffmpeg-static`), no muestra secretos ni datos reales, y el vídeo queda publicado con URL pública (YouTube "oculto", subido por el usuario, o GitHub Releases) y enlazado desde el README

#### CA-07.15 · Comprobación final del despliegue
- **Dado** https://incidapp.onrender.com con los datos demo
- **Cuando** se recorre justo antes de entregar
- **Entonces** los 4 usuarios demo inician sesión; el flujo crear → empezar → resolver → cerrar funciona; el Usuario no ve una incidencia de otro departamento (404) ni la gestión de usuarios (403); Dirección no tiene acciones; y los datos del formulario (URL del repo, demo, slides y vídeo, usuario y contraseña de prueba) están listos para copiar

## Permisos
- `docs/permisos.md` → **Transiciones de estado** e **Incidencias**: el historial de los datos demo las respeta (CA-07.2) y los E2E las recorren (CA-07.6–CA-07.8). F07 no cambia ninguna regla.
- `docs/permisos.md` → **Respuestas de la API** (404 si no es visible, 403 si no está permitida): CA-07.7 y CA-07.15.

## Fuera de alcance
- **Adjuntos (F05), auditoría y cuadro de mando (F06):** ni datos demo, ni E2E, ni comprobación en el despliegue. Se describen como trabajo futuro.
- Funcionalidad nueva de la aplicación (congelación el 27/11 a las 20:00): F07 solo añade datos, tests, CI y documentación.
- E2E en otros navegadores que Chromium, de accesibilidad o visuales, y E2E contra producción.
- *Ping* programado a Render para que no se duerma (decisión del 23/11).
- Subir el vídeo a YouTube y enviar el formulario: los hace el usuario (F07 genera el vídeo y prepara los valores).
- **CI ampliada (decisión 4):** `Dockerfile` y `docker build`, gitleaks, *grep* de términos prohibidos, `npm audit` en la CI, Dependabot y Storybook publicado en GitHub Pages. Docker queda como trabajo futuro.
- Vídeo con la cara del usuario o con voces de pago o en la nube.

## Decisiones (aprobadas el 25/11/2026)
1. **Usuarios adicionales:** ~8 usuarios ficticios (Responsable y Usuario de ATC, COMP, CAL y TEC, `@incidapp.test`) con una **contraseña aleatoria que no se publica**: no se puede entrar con ellos, no aparecen en el login y no son `DEMO_USERS`.
2. **Carga de las incidencias demo** con los **casos de uso reales** (`createIncident`, `assignIncident`, `changeIncidentStatus`) desde el composition root y un reloj guionizado: la coherencia del historial (CA-07.2) sale por construcción.
3. **Neon se resetea antes de T-07.04:** se pierden las incidencias de prueba de T-04.06, las sesiones y la auditoría; las migraciones y el *seed* se vuelven a ejecutar al arrancar.
4. **CI ampliada descartada** (CA-07.10, T-07.03): sin Storybook público ni `Dockerfile`. Storybook solo en local y Docker como trabajo futuro en `requisitos.md` y `master.md`.
5. **Dependencias nuevas:** `@playwright/test` y Chromium (E2E y grabación del vídeo) y `ffmpeg-static` (montaje del vídeo), todas de desarrollo y gratuitas; su instalación pide confirmación.
6. **Slides** en HTML autocontenido en `slides/` + PDF. **Vídeo** generado por el agente principal (CA-07.16): grabación automática del navegador con Playwright contra la URL pública, voz sintética de Windows y subtítulos, montaje con `ffmpeg-static`; publicado como "oculto" en YouTube (subida del usuario) o en GitHub Releases.
7. **Dos PR:** `feat/F07-entrega` con T-07.01–T-07.04 antes de la congelación, y `feat/F07-documentacion` con la documentación, las slides, el vídeo y la comprobación final.
