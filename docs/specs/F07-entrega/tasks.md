# F07 · Entrega — Tareas

> Fuente de verdad del avance. El hook de inicio de sesión lee este archivo: respeta el formato (`### T-…` y las líneas `- Estado:` y `- Agente:`).
> Estados: `pendiente` · `en curso` · `hecha` · `bloqueada` · `descartada`
>
> **Plazo:** T-07.01, T-07.02 y T-07.04 antes de la congelación (viernes 27/11/2026 a las 20:00), en el PR de `feat/F07-entrega`. T-07.05 a T-07.09 son documentación, slides y vídeo, y pueden seguir hasta el domingo 29/11, en un segundo PR (`feat/F07-documentacion`). F05 y F06 quedan fuera del TFM: nada de adjuntos, auditoría ni cuadro de mando.

### T-07.01 · Cargar en el seed incidencias demo ficticias con historial coherente
- Estado: pendiente
- Agente: backend-dev · Revisores: code-reviewer
- Depende de: —
- Paralelizable con: T-07.02
- Cubre: CA-07.1, CA-07.2, CA-07.3, CA-07.4
- Archivos: apps/api/src/infrastructure/db/{demo-incidents.ts,seed.ts} (+ tests), apps/api/src/composition/db-command.ts (+ test)
- Verificación: npm test -w @incidapp/api -- seed && npm run typecheck && npm run lint && `npm run db:seed` dos veces seguidas sobre una PGlite local sin duplicados
- Notas: según `plan.md` (decisión 1: ~8 usuarios ficticios adicionales con contraseña aleatoria no publicada; decisión 2: casos de uso reales con reloj guionizado desde el composition root). ~30 incidencias y ~120 eventos (≤ 40 y ≤ 200); ≥ 2 por tipo, los 7 estados, las 4 prioridades; reparto para el Usuario y el Responsable demo de `plan.md`. Idempotencia por (título, creador); nunca se actualiza nada existente. Textos en español, creíbles y **ficticios** (sin empresas, marcas ni personas reales; emails `.test`). Test de doble ejecución y de ejecución sobre una base con incidencias previas. Sin migración nueva.

### T-07.02 · Cubrir con Playwright los flujos principales y ejecutarlos en CI
- Estado: pendiente
- Agente: qa-tester · Revisores: code-reviewer
- Depende de: —
- Paralelizable con: T-07.01
- Cubre: CA-07.5, CA-07.6, CA-07.7, CA-07.8, CA-07.9
- Archivos: e2e/{playwright.config.ts,fixtures/…,login-roles.spec.ts,flujo-incidencia.spec.ts,acceso-denegado.spec.ts,direccion-sin-acciones.spec.ts}, package.json (script `e2e` y `@playwright/test`), .gitignore, .github/workflows/e2e.yml, eslint.config.js / tsconfig si hace falta incluir `e2e/`
- Verificación: npm run e2e (dos veces seguidas, en verde) && npm run lint && npm run typecheck · el flujo `e2e.yml` en verde en el PR (`gh pr checks`)
- Notas: **la instalación de `@playwright/test` y de Chromium pide confirmación** (aprobada en la decisión 5; justificar en el resumen). `webServer` con la app compilada y PGlite en una carpeta temporal nueva, puerto propio y `LOGIN_RATE_LIMIT_MAX` alto; nunca contra producción. Cada test crea sus datos (la incidencia de otro dpto. de CA-07.7 la crea el Admin, p. ej. de tipo Calidad) y no da por supuestos los datos demo de T-07.01. Selectores accesibles (`getByRole`, `getByLabel`). `retries: 1` y trazas en CI; informe como artefacto solo si falla. No toca código de producción: si un flujo falla por un bug, se informa y se propone una tarea.

### T-07.03 · Ampliar la CI (Docker, gitleaks, términos prohibidos, npm audit, Dependabot) y publicar Storybook en GitHub Pages
- Estado: descartada
- Agente: backend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: —
- Paralelizable con: —
- Cubre: CA-07.10 (descartado)
- Archivos: —
- Verificación: —
- Notas: **descartada el 25/11/2026 por el usuario (decisión 4 de la spec)** para concentrar el tiempo que queda hasta la congelación en los datos demo y los E2E: sin `Dockerfile` ni `docker build`, gitleaks, *grep* de términos prohibidos, `npm audit` en la CI, Dependabot ni Storybook público en Pages. Storybook queda solo en local (`npm run storybook`) y Docker, como trabajo futuro: lo reflejan `docs/requisitos.md` y `docs/master.md` en T-07.05.

### T-07.04 · Desplegar los datos demo y comprobarlos en producción con cada rol
- Estado: pendiente
- Agente: principal · Revisores: code-reviewer
- Depende de: T-07.01, T-07.02
- Paralelizable con: —
- Cubre: CA-07.1 (en producción), CA-07.3 (en producción), CA-07.15 (primera pasada)
- Archivos: docs/capturas/*.png
- Verificación: `npm test` completo · CI y E2E en verde en el PR (`gh pr checks`) · en https://incidapp.onrender.com, tras el arranque: incidencias demo en todos los estados; los 4 usuarios demo inician sesión; Usuario: crear → empezar → resolver; Responsable: cerrar; 404 en una de otro dpto. y 403 en `/usuarios`; Dirección sin acciones; un reinicio no duplica nada
- Notas: **antes del viernes 27/11 a las 20:00.** Decisión 3: **resetear la base de Neon antes del merge** (pide confirmación; se pierden las incidencias de prueba de T-04.06, las sesiones y la auditoría; migraciones y *seed* se ejecutan al arrancar). Abrir el PR → `main` y *squash merge* (piden confirmación). Hacer aquí las capturas del README y de las slides (login, listado con filtros, detalle con línea de tiempo, diálogo de transición, gestión de usuarios y Storybook en local), en PNG de < 300 KB.

### T-07.05 · Completar el README y escribir docs/master.md
- Estado: pendiente
- Agente: principal · Revisores: code-reviewer
- Depende de: T-07.04
- Paralelizable con: T-07.06, T-07.07
- Cubre: CA-07.11, CA-07.12
- Archivos: README.md, docs/master.md, docs/diagramas.md (UML en Mermaid), docs/requisitos.md
- Verificación: auditoría del README con la skill `entrega-tfm` (tabla requisito → ✅/❌ → dónde, todo ✅ salvo slides y vídeo con `PENDIENTE` visible) · instalación probada en un clon limpio en una carpeta temporal (`npm ci`, `npm run dev`, `npm test`, `npm run e2e`, `npm run storybook`) · cada enlace relativo de `README.md` y `docs/master.md` existe · ninguna referencia a `.claude/`, `AGENTS.md` ni `CLAUDE.md`
- Notas: skill `entrega-tfm`, pasos 1 y 2. README: aviso de Render dormido junto a la URL, usuarios demo con contraseña, URLs de demo, slides y vídeo, Storybook en local (`npm run storybook`), despliegue (Render + Neon + `render.yaml`), estructura, funcionalidades con capturas, alcance recortado (sin adjuntos ni cuadro de mando) y sección "Cómo se aplica el máster". `master.md`: módulos 1–9 con evidencia y enlace; M1 enlaza el diagrama de estados y el de capas de `docs/diagramas.md`; M6, Storybook solo en local; M7, `render.yaml` y Render + Neon, con Docker como trabajo futuro. **Decisión 4:** ajustar `docs/requisitos.md` (RNF-03 y RNF-04: Storybook solo en local; Docker y la CI ampliada como trabajo futuro).

### T-07.06 · Documentar el proceso con IA: harness, flujo de una tarea y métricas
- Estado: pendiente
- Agente: principal · Revisores: code-reviewer
- Depende de: T-07.04
- Paralelizable con: T-07.05, T-07.07
- Cubre: CA-07.13
- Archivos: docs/proceso-ia/{harness.md,flujo.md,metricas.md,hallazgos-revisores.md}
- Verificación: `hallazgos-revisores.md` con ≥ 3 hallazgos reales (hoy 4) · cada cifra de `metricas.md` con el comando que la reproduce · ningún archivo del harness copiado (`git ls-files | grep -E '\.claude/|AGENTS\.md|CLAUDE\.md'` vacío)
- Notas: skill `entrega-tfm`, paso 3. `harness.md` describe subagentes, skills, hooks, reglas, permisos y `AGENTS.md` con fragmentos breves. `flujo.md` sigue T-04.02 (spec CA-04.2/CA-04.3 → tarea → diff → hallazgos → commit del PR #6) o la que el usuario prefiera. `metricas.md`: features, tareas (y hechas), commits, PR, tests (de `npm test`), tareas con hallazgos y hallazgos por gravedad, calculados con `git log` y los `tasks.md`. Se cierran las cifras tras T-07.04 y se actualizan en T-07.08 si cambian. Puede mencionar que el vídeo lo generó el agente (T-07.09).

### T-07.07 · Preparar las slides y el guion del vídeo
- Estado: pendiente
- Agente: principal · Revisores: —
- Depende de: T-07.04
- Paralelizable con: T-07.05, T-07.06
- Cubre: CA-07.14
- Archivos: slides/index.html, slides/incidapp.pdf, slides/guion-video.md
- Verificación: 10–12 diapositivas que se ven en el navegador sin conexión a CDN y su PDF · guion de 8–10 min con los bloques y tiempos de la skill `entrega-tfm` · revisión del usuario
- Notas: skill `entrega-tfm`, paso 5. Decisión 6: HTML autocontenido + PDF (impreso con el Chromium de Playwright). El guion es **ejecutable** para T-07.09: por escena, narración, acciones en el navegador (URL, usuario demo, clics) o diapositiva que se muestra, y duración objetivo. Capturas de `docs/capturas/`.

### T-07.08 · Comprobar el despliegue antes de entregar y preparar los datos del formulario
- Estado: pendiente
- Agente: principal · Revisores: —
- Depende de: T-07.05, T-07.06, T-07.07, T-07.09
- Paralelizable con: —
- Cubre: CA-07.15, CA-07.11 (URLs finales), CA-07.16 (enlace)
- Archivos: README.md (URLs de slides y vídeo, sin `PENDIENTE`), docs/proceso-ia/metricas.md (cifras finales)
- Verificación: recorrido de CA-07.15 en https://incidapp.onrender.com con los 4 usuarios demo (sin subida ni descarga de adjuntos) · CI en verde en el PR de documentación · repositorio público · URLs de demo, slides y vídeo abren sin sesión
- Notas: skill `entrega-tfm`, pasos 4 y 6. Necesita la URL pública del vídeo de T-07.09. Los valores del formulario (URL del repo, demo, slides, vídeo y usuario y contraseña de prueba, el de Admin) se entregan en la respuesta, **no** en el repo (el nombre y el email del alumno no se versionan). Abrir la demo justo antes de enviar para despertar Render. PR → `main` y *squash merge* (piden confirmación).

### T-07.09 · Generar el vídeo de la demo
- Estado: pendiente
- Agente: principal · Revisores: —
- Depende de: T-07.04, T-07.07
- Paralelizable con: T-07.05, T-07.06
- Cubre: CA-07.16
- Archivos: scripts/video/… (generación), slides/guion-video.srt (subtítulos), package.json (`ffmpeg-static` y un script `video`), .gitignore (`video/` con el MP4 y los intermedios)
- Verificación: MP4 de 8 a 10 min (duración leída con `ffmpeg -i`) con pantalla, voz y subtítulos · sin datos reales ni secretos en la imagen · revisión del usuario antes de publicarlo · URL pública que abre sin sesión
- Notas: según `plan.md` (decisión 6), sin la cara del usuario. Grabación automática del navegador con Playwright (`recordVideo`, 1280×720) contra https://incidapp.onrender.com (despertada antes) siguiendo el guion de T-07.07, más `slides/index.html` y Storybook en local para las escenas de arquitectura; narración con la voz sintética de Windows (`System.Speech`, local y gratis; comprobar antes que hay una voz en español); subtítulos `.srt` en español; montaje con `ffmpeg-static` (**dependencia de desarrollo gratuita, su instalación pide confirmación**). Las acciones esperan a cada respuesta de la API, no a tiempos fijos; si la duración se sale de 8–10 min, se ajusta el texto del guion. Publicación como "oculto" en YouTube (la subida la hace el usuario) o en un *release* de GitHub (`gh release create`, pide confirmación). El MP4 no se versiona.

---

## Cobertura

| Criterio | Tareas |
|---|---|
| CA-07.1 | T-07.01, T-07.04 (en producción) |
| CA-07.2 | T-07.01 |
| CA-07.3 | T-07.01, T-07.04 (en producción) |
| CA-07.4 | T-07.01 |
| CA-07.5 | T-07.02 |
| CA-07.6 | T-07.02 |
| CA-07.7 | T-07.02 |
| CA-07.8 | T-07.02 |
| CA-07.9 | T-07.02 |
| CA-07.10 | descartado (T-07.03, decisión 4) |
| CA-07.11 | T-07.05, T-07.08 (URLs finales) |
| CA-07.12 | T-07.05 |
| CA-07.13 | T-07.06 |
| CA-07.14 | T-07.07 |
| CA-07.15 | T-07.04 (primera pasada), T-07.08 |
| CA-07.16 | T-07.09, T-07.08 (enlace en el README) |
