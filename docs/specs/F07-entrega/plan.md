# F07 · Entrega — Plan

- **Estado:** aprobado (25/11/2026, junto con la spec)
- **Spec:** `spec.md` (aprobada el 25/11, con las 7 decisiones de su sección "Decisiones")

## Contrato (`packages/shared`)
Sin cambios. Los E2E y el *seed* usan los esquemas y los `DEMO_USERS` existentes.

## API
Sin endpoints nuevos ni cambios de respuesta. Solo cambia el *seed* (`npm run db:seed`).

## Dominio y aplicación
Sin cambios. El *seed* demo reutiliza los casos de uso de F03 y F04 (decisión 2).

## Datos demo (T-07.01)

- **Datos:** `apps/api/src/infrastructure/db/demo-incidents.ts` con datos puros (sin lógica): usuarios adicionales (decisión 1) e incidencias. Cada incidencia: `typeCode`, `priority`, creador y asignado (por email), título, descripción, fecha objetivo relativa, y una lista de pasos `{ daysAgo, actor, action: 'assign' | 'transition', to?, comment? }`.
- **Carga:** `seedDemoIncidents` se ejecuta desde `composition/db-command.ts` tras `seedDatabase`, con los casos de uso reales (`createIncident`, `assignIncident`, `changeIncidentStatus`) cableados con un **reloj guionizado** (`Clock` que devuelve la fecha de cada paso). Así la máquina de estados, la política, los eventos, los códigos del contador y `resolvedAt`/`closedAt` son los de producción por construcción. Si un paso no está permitido, el *seed* falla con un mensaje en español (y el test lo detecta antes del despliegue).
- **Idempotencia:** cada incidencia demo se identifica por (título, creador); si ya existe, se salta entera. Los usuarios adicionales, por email con `onConflictDoNothing` (como los demo). Nunca se actualiza nada existente.
- **Volumen:** ~30 incidencias y ~120 eventos (≤ 40 y ≤ 200, CA-07.3). Fechas en las últimas 3–4 semanas respecto al momento del *seed*.
- **Reparto mínimo:** ≥ 2 por tipo; los 7 estados; las 4 prioridades; para el Usuario demo: creadas por él, asignadas a él, de LOG y de otros dptos. no visibles; para el Responsable demo: al menos una de LOG en ABIERTA, EN CURSO, RESUELTA y CERRADA para probar sus transiciones.
- **Usuarios adicionales (decisión 1):** ~8 personas ficticias (`@incidapp.test`) con una contraseña aleatoria generada en cada *seed* que no se guarda ni se registra; no son `DEMO_USERS`.
- **Tests (`seed.test.ts` y `demo-incidents.test.ts`, PGlite):** recuentos y reparto (CA-07.1); reproducir el historial de cada incidencia con `findTransition` y la política (CA-07.2); dos ejecuciones seguidas, y una con incidencias previas creadas a mano, sin duplicados ni cambios (CA-07.3); todos los emails en `.test` (CA-07.4).

## E2E (T-07.02)

- **Dependencia:** `@playwright/test` (devDependency de la raíz) y solo Chromium (`npx playwright install --with-deps chromium`).
- **Estructura:** `e2e/` en la raíz con `playwright.config.ts`, `fixtures/` (login por rol con los `DEMO_USERS`) y una *spec* por flujo: `login-roles`, `flujo-incidencia`, `acceso-denegado`, `direccion-sin-acciones`. Script `npm run e2e` en la raíz.
- **Servidor:** `webServer` de Playwright arranca la app **compilada** (`npm run build` previo; `db:migrate` → `db:seed` → `start`) con `PGLITE_DATA_DIR` en una carpeta temporal nueva por ejecución, un puerto propio y `LOGIN_RATE_LIMIT_MAX` alto. Si la configuración de producción exige `DATABASE_URL`, se usa `NODE_ENV` distinto de `production` (sin tocar código de producción).
- **Independencia de los datos demo:** cada test crea lo que necesita (la incidencia de otro dpto. de CA-07.7 la crea el Admin); los datos demo pueden existir pero no se dan por supuestos. Selectores por rol y texto accesible (`getByRole`, `getByLabel`).
- **Informe:** `retries: 1` en CI, `trace: 'on-first-retry'`, informe HTML subido como artefacto solo si falla.
- **CI:** flujo propio `.github/workflows/e2e.yml` (en cada PR y push a `main`), separado de `ci.yml` para que un fallo se identifique de un vistazo. GitHub Actions es gratuito en repositorios públicos.

## CI ampliada (T-07.03) — descartada
Decisión 4 de la spec: sin `Dockerfile`, gitleaks, *grep* de términos prohibidos, `npm audit` en la CI, Dependabot ni Storybook en GitHub Pages. T-07.05 deja Storybook como "solo en local" y Docker como trabajo futuro en `docs/requisitos.md` y `docs/master.md`.

## Interfaz (atomic design)
Sin componentes ni páginas nuevos (congelación). Las capturas del README se hacen sobre producción con los datos demo.

## Documentación (T-07.05 a T-07.07)

- **README:** rehacer siguiendo la auditoría de la skill `entrega-tfm` (tabla requisito → ✅/❌ → dónde). Capturas en `docs/capturas/` (PNG optimizados, < 300 KB cada uno): login, listado con filtros, detalle con línea de tiempo y diálogo de transición, gestión de usuarios y Storybook en local. Instalación probada en un clon limpio en una carpeta temporal (`git clone` → `npm ci` → `npm run dev` / `npm test` / `npm run e2e`).
- **`docs/master.md`:** módulos 1–9 → evidencia → enlace. M1 necesita un diagrama UML: se añade a `docs/` un diagrama Mermaid de estados (máquina de `permisos.md`) y uno de componentes o de capas, que GitHub renderiza sin coste. M6: Storybook con `npm run storybook` (solo en local); M7: `render.yaml` y despliegue en Render + Neon, con Docker como trabajo futuro. Comprobación de enlaces con un *grep* de las rutas relativas y `test -e`.
- **`docs/requisitos.md`:** reflejar la decisión 4 (Storybook solo en local; Docker y la CI ampliada como trabajo futuro) en RNF-03 y RNF-04.
- **`docs/proceso-ia/`:** `harness.md` (describe; sin copiar `.claude/`), `flujo.md` (propuesta: T-04.02, con spec, tarea, revisores y el commit del PR #6), `metricas.md` (con los comandos: `git log --oneline | wc -l`, recuento de `### T-` y `Estado: hecha` en los `tasks.md`, nº de tests de `npm test`, filas de `hallazgos-revisores.md`). Añadir a `hallazgos-revisores.md` los de F07 si los hay.
- **Slides y guion (decisión 6):** `slides/index.html` autocontenido (10–12 diapositivas, sin CDN ni dependencias) + `slides/incidapp.pdf` (impresión del navegador, p. ej. Chromium de Playwright con `page.pdf()`) + `slides/guion-video.md` con los bloques y tiempos de la skill, escrito como **guion ejecutable** para T-07.09: por cada escena, texto de la narración, acciones en el navegador (URL, usuario, clics) o diapositiva que se muestra, y duración objetivo; capturas reutilizadas de `docs/capturas/`.

## Vídeo de la demo (T-07.09, decisión 6)

- **Dependencias** (desarrollo, gratuitas, piden confirmación): `ffmpeg-static`; Playwright y Chromium ya vienen de T-07.02.
- **Script:** `scripts/video/` (Node, fuera de `apps/`): lee las escenas de `slides/guion-video.md` (o un `escenas.json` derivado), y para cada una:
  1. **Narración:** genera un WAV con la voz sintética de Windows (`System.Speech.Synthesis` vía `powershell -Command`, voz en español instalada en el equipo; sin servicios en la nube) y mide su duración.
  2. **Pantalla:** Playwright con `recordVideo` (1280×720) contra https://incidapp.onrender.com (despertada antes) o, para las escenas de arquitectura, `slides/index.html` y Storybook en local; las acciones se espacian para durar lo que la narración.
  3. **Subtítulos:** un `.srt` en español con los tiempos de cada frase.
- **Montaje:** `ffmpeg-static` une los clips con su audio, quema o adjunta los subtítulos y produce `video/incidapp-demo.mp4` (H.264 + AAC, 8–10 min). El MP4 y los intermedios **no se versionan** (`.gitignore`); el repo guarda el script y el `.srt`.
- **Datos:** solo usuarios demo y datos ficticios; la contraseña demo es pública a propósito. Los usuarios ficticios de la decisión 1 no se usan para entrar.
- **Publicación:** YouTube como "oculto" (subida del usuario) o un *release* de GitHub con el MP4 adjunto (`gh release create`, pide confirmación). La URL va en el README (T-07.08).

## Tests
- **Unitarios / integración:** los del *seed* (arriba).
- **E2E:** los 4 flujos de CA-07.5–CA-07.8, en local y en CI.
- **Vídeo:** duración del MP4 entre 8 y 10 min (leída con `ffmpeg -i`), audio y subtítulos presentes, y revisión visual del usuario antes de publicarlo (CA-07.16).
- **Documentación:** comprobación de enlaces de `README.md` y `docs/master.md`, y *grep* de que el repo no contiene ni enlaza `.claude/`, `AGENTS.md` ni `CLAUDE.md`.

## Riesgos y decisiones
- **Congelación el viernes 27/11 a las 20:00** → T-07.01 y T-07.02 en paralelo desde el primer momento; T-07.04 (despliegue) como muy tarde el viernes por la tarde.
- **Vídeo generado** (T-07.09): voz sintética poco natural o sin voz española instalada → comprobar las voces de `System.Speech` antes de escribir el script; si no hay voz en español, avisar al usuario (instalar el paquete de idioma de Windows es gratis). Render dormido o lento durante la grabación → despertar la demo antes y esperar a cada respuesta, no tiempos fijos. Duración fuera de 8–10 min → ajustar el texto del guion, no la velocidad.
- **El *seed* se ejecuta en cada arranque de Render** → idempotencia por incidencia y test de doble ejecución; un fallo del *seed* tumba el arranque, así que se prueba con una copia de PGlite con incidencias previas.
- **Neon con incidencias de prueba** (decisión 3) → reset de la base antes del merge de T-07.04 (el usuario lo hace en el panel de Neon o se recrea la rama; pide confirmación); el *seed* sigue siendo robusto a incidencias previas (CA-07.3).
- **E2E inestables** por el arranque de PGlite o el *rate limit* del login → base temporal por ejecución, límite alto solo en el `webServer` de E2E y `retries: 1` en CI.
- **Render dormido** al evaluar → aviso en el README y abrir la demo justo antes de enviar el formulario.
- **Sin ADR nuevo:** los datos demo, los E2E, las slides y el vídeo no son decisiones de arquitectura; el descarte del `Dockerfile` se documenta como trabajo futuro en `requisitos.md` y `master.md`.
