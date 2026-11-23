# F00 · Fundaciones — Spec

- **Estado:** aprobada (23/11/2026)
- **Depende de:** —
- **Requisitos que cubre:** RNF-01 (despliegue con coste cero), RNF-02 (arquitectura por capas), RNF-03 (calidad automatizada), RNF-04 (sistema de diseño con atomic design), RNF-05 (solo datos ficticios), RNF-06 (idioma). Los IDs se fijan en `docs/requisitos.md`, que crea esta misma feature.

## Objetivo
Dejar el proyecto listo para construir funcionalidades: un monorepo que compila, se prueba y se despliega solo, con una URL pública viva en Render + Neon desde el primer día, y una base de UI (tokens, átomos y plantillas en Storybook) sobre la que F01–F06 montan sus pantallas.

La feature se entrega en **dos bloques**, cada uno con su rama y su PR:

| Bloque | Rama | Contenido | Puede empezar |
|---|---|---|---|
| **A · Camino a la URL viva** | `feat/F00-fundaciones` | Documentación de base, monorepo, contrato compartido, API Fastify que sirve el front, Drizzle + PGlite/Neon, migraciones al arrancar, *seed* mínimo, `render.yaml`, CI básica, Husky | Ya |
| **B · Base de UI** | `feat/F00-base-ui` | Tokens, Storybook (solo en local), ESLint de niveles atómicos, átomos base, `AppLayout` y `AuthLayout` | Cuando A esté en `main` (en paralelo con F01) |

## Historias de usuario
- **HU-00.1:** Como desarrollador, quiero clonar el repositorio y tener la app funcionando en local con un solo comando y sin instalar una base de datos, para empezar a trabajar en minutos.
- **HU-00.2:** Como evaluador del TFM, quiero abrir una URL pública y ver la aplicación funcionando, para comprobar que el despliegue es real.
- **HU-00.3:** Como desarrollador, quiero que la CI y los *hooks* de git rechacen el código que no compila, no pasa los tests o rompe las reglas de arquitectura, para no degradar la calidad.
- **HU-00.4:** Como desarrollador de frontend, quiero un catálogo de tokens, átomos y plantillas en Storybook, para construir pantallas reutilizando en vez de duplicar.

## Criterios de aceptación

### Bloque A · Camino a la URL viva

#### CA-00.1 · Monorepo verde desde un clon limpio
- **Dado** un clon limpio del repositorio con Node 24
- **Cuando** se ejecuta `npm ci` y después `npm run typecheck`, `npm run lint`, `npm test` y `npm run build`
- **Entonces** los cuatro comandos terminan con código 0 y abarcan los workspaces `@incidapp/api`, `@incidapp/web` y `@incidapp/shared`

#### CA-00.2 · Desarrollo local sin base de datos instalada
- **Dado** un entorno sin `DATABASE_URL`
- **Cuando** se ejecuta `npm run dev`
- **Entonces** arrancan la API y la web, la API usa PGlite con los datos en `.data/` (ignorada por git) y la web llega a la API a través del *proxy* de Vite en `/api`

#### CA-00.3 · Elección del driver de base de datos
- **Dado** el composition root
- **Cuando** arranca sin `DATABASE_URL`
- **Entonces** usa PGlite; **y cuando** arranca con `DATABASE_URL`, usa node-postgres con SSL
- **Y** si `NODE_ENV=production` y falta `DATABASE_URL`, el proceso termina con un error en español que lo indica (en producción nunca se usa PGlite)

#### CA-00.4 · Endpoint de salud con contrato compartido
- **Dado** la API arrancada con la base de datos disponible
- **Cuando** se hace `GET /api/health`
- **Entonces** responde 200 con un cuerpo que valida el esquema `HealthResponse` de `@incidapp/shared` (`status: "ok"`, `db: "ok"`, `version`)
- **Y** si la base de datos no responde, responde 503 con `status: "error"` y `db: "error"`

#### CA-00.5 · Errores HTTP uniformes y seguros
- **Dado** un caso de uso que lanza `NotFoundError`, `ForbiddenError`, `ValidationError` o `ConflictError`
- **Cuando** llega a la capa `http/`
- **Entonces** se responde 404, 403, 400 o 409 con un cuerpo que valida el esquema `ErrorResponse` de `shared` y un mensaje en español
- **Y** un error no previsto devuelve 500 con un mensaje genérico en español, sin *stack*, SQL ni rutas internas
- **Y** toda respuesta lleva las cabeceras de seguridad de `@fastify/helmet`, incluida una CSP

#### CA-00.6 · La API sirve el front compilado
- **Dado** el build de producción de la web
- **Cuando** se pide `GET /`
- **Entonces** se devuelve el `index.html` de la SPA
- **Y** una ruta de cliente desconocida (`GET /incidencias/123`) también devuelve el `index.html`
- **Y** una ruta de API desconocida (`GET /api/no-existe`) devuelve 404 con `ErrorResponse`, nunca el HTML

#### CA-00.7 · Página inicial con el estado de la API
- **Dado** la web cargada en el navegador
- **Cuando** la página inicial consulta `/api/health` (mediante el cliente de `lib/api` y un hook de `queries/`)
- **Entonces** muestra el nombre "IncidApp" y el estado de la API ("Conectada" o "Sin conexión"), con estado de carga mientras espera

#### CA-00.8 · Migraciones al arrancar e idempotentes
- **Dado** una base de datos vacía
- **Cuando** se ejecuta `npm run db:migrate`
- **Entonces** se aplican las migraciones generadas por drizzle-kit (con la tabla `departments`)
- **Y** ejecutarlo una segunda vez no falla ni cambia nada
- **Y** el comando de arranque de producción es `npm run db:migrate && npm start`

#### CA-00.9 · *Seed* mínimo idempotente con datos ficticios
- **Dado** una base de datos migrada
- **Cuando** se ejecuta `npm run db:seed` dos veces seguidas
- **Entonces** existen exactamente los 9 departamentos de la empresa ficticia (DIR, ADM, COM, ATC, COMP, LOG, PROD, TEC, CAL), sin duplicados

#### CA-00.10 · Despliegue en Render + Neon con coste cero
- **Dado** `render.yaml` en la raíz (servicio web gratuito, runtime Node 24, `DATABASE_URL` como variable sin valor en el archivo)
- **Cuando** se hace merge en `main`
- **Entonces** Render construye y arranca la app, aplica las migraciones contra Neon
- **Y** `GET https://<servicio>.onrender.com/api/health` responde 200 con `db: "ok"` y `/` muestra la página inicial
- *Verificación manual con `curl` y el navegador; el resultado y la URL se anotan en la tarea.*

#### CA-00.11 · CI en cada PR
- **Dado** un PR contra `main`
- **Cuando** se ejecuta GitHub Actions
- **Entonces** corren `lint`, `typecheck`, `test` y `build` con Node 24 y la caché de npm
- **Y** si cualquiera falla, el check del PR queda en rojo

#### CA-00.12 · Barreras en el commit
- **Dado** el repositorio con Husky instalado
- **Cuando** se hace un commit cuyo mensaje no sigue Conventional Commits (p. ej., `arreglos varios`)
- **Entonces** commitlint lo rechaza
- **Y** el *pre-commit* ejecuta lint-staged (Prettier y ESLint) sobre los archivos preparados

#### CA-00.13 · Regla de capas del backend
- **Dado** un archivo de `apps/api/src/domain/` que importa de `application/`, `infrastructure/`, `http/` o `composition/`, o de `fastify`, `drizzle-orm`, `zod` o un módulo `node:*`
- **Cuando** se ejecuta `npm run lint`
- **Entonces** ESLint da error; y lo mismo ocurre con cualquier capa que importe de otra más externa (`domain` ← `application` ← `infrastructure`/`http` ← `composition`)
- *Se comprueba con un test que pasa ESLint sobre fragmentos de ejemplo.*

#### CA-00.14 · Documentación de base
- **Dado** el repositorio
- **Cuando** se revisa `docs/`
- **Entonces** existen `requisitos.md` (RF y RNF con ID, MoSCoW e historias), `permisos.md` (matriz de permisos, con el cuadro de mando **solo para Admin y Dirección**), `glosario.md` (español ↔ identificador en inglés), los ADR iniciales en `docs/adr/` y un `README.md` mínimo (qué es, cómo arrancar en local y URL de la demo)
- **Y** ninguno contiene datos reales ni enlaza al harness (`.claude/`, `AGENTS.md`, `CLAUDE.md`)

### Bloque B · Base de UI

#### CA-00.15 · Tokens de diseño
- **Dado** `apps/web/src/styles/`
- **Cuando** se revisa el tema
- **Entonces** define como variables CSS expuestas en el tema de Tailwind: colores semánticos (`primary`, `neutral`, `success`, `warning`, `danger`, `info`) con sus variantes de fondo y texto, tipografía, espaciado, radios y sombras, con contraste AA entre texto y fondo
- **Y** una story "Tokens" los muestra
- **Y** un test falla si algún archivo de `components/` contiene colores hexadecimales o valores arbitrarios de Tailwind (`bg-[#…]`, `p-[13px]`)

#### CA-00.16 · Storybook en local
- **Dado** la web
- **Cuando** se ejecutan `npm run storybook` y `npm run build-storybook`
- **Entonces** el catálogo arranca y el build estático termina sin errores, con el addon de accesibilidad activo y las secciones "Tokens", "Átomos" y "Plantillas"

#### CA-00.17 · Estructura obligatoria de cada componente
- **Dado** cualquier carpeta de componente en `atoms/`, `molecules/`, `organisms/` o `templates/`
- **Cuando** se ejecuta `npm test`
- **Entonces** un test comprueba que contiene `Nombre.tsx` e `index.ts`, que se exporta desde el `index.ts` de su nivel y, salvo en plantillas, que tiene `Nombre.stories.tsx`

#### CA-00.18 · Regla de niveles atómicos
- **Dado** un componente que importa de un nivel superior (p. ej., un átomo que importa una molécula, o una molécula que importa otra molécula)
- **Cuando** se ejecuta `npm run lint`
- **Entonces** ESLint da error
- **Y** también da error si un átomo importa `@incidapp/shared`, o si cualquier archivo de `components/` importa `@tanstack/react-query`, `lib/api`, `queries/` o los hooks de navegación de React Router (`useNavigate`, `useParams`…)
- *Se comprueba con un test que pasa ESLint sobre fragmentos de ejemplo.*

#### CA-00.19 · Átomos base accesibles
- **Dado** los átomos `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Label`, `Badge`, `Spinner`, `Heading`, `Text` e `Icon`
- **Cuando** se usan en sus stories y tests
- **Entonces** cada uno tiene variantes con `cva` (`variant`, `size` donde aplique), sin textos de negocio fijos
- **Y** `Button` con `disabled` o `loading` no dispara `onClick`, y en `loading` muestra el `Spinner` y expone `aria-busy`
- **Y** `Input`, `Textarea` y `Select` con `invalid` exponen `aria-invalid` y aceptan `aria-describedby`
- **Y** `Label` se asocia a su campo por `htmlFor`, y todos tienen foco visible

#### CA-00.20 · Plantillas `AppLayout` y `AuthLayout`
- **Dado** `AppLayout` con los huecos `header`, `nav` y `children`
- **Cuando** se renderiza
- **Entonces** expone los *landmarks* `banner`, `navigation` y `main`, y un enlace "Saltar al contenido" que lleva el foco a `main`
- **Y** `AuthLayout` (huecos `title` y `children`) centra un panel dentro de un `main`
- **Y** en anchos de móvil ninguna de las dos produce desplazamiento horizontal

## Permisos
No aplica: F00 no tiene endpoints protegidos ni usuarios. La matriz se crea en `docs/permisos.md` (CA-00.14) y se aplica a partir de F01–F02.

## Fuera de alcance
- Usuarios, sesiones, login y cualquier endpoint protegido (F01) · CSRF con `X-Requested-With` y *rate limit* (F01).
- Tablas distintas de `departments` (cada feature añade las suyas).
- Enums de dominio (`Status`, `Role`, `Priority`) en `shared`: se crean en la feature que los usa.
- Moléculas, organismos y el resto de plantillas (`ListPageTemplate`…): se crean en la feature que los necesita.
- Primitivas Radix (diálogos y menús): con la primera molécula que las use.
- Aplicar `AppLayout`/`AuthLayout` a páginas reales: F01.
- `Dockerfile` y `docker build` en CI, gitleaks, grep de términos prohibidos, `npm audit`, Dependabot y Storybook en GitHub Pages (F07).
- Playwright y `npm run e2e` (con el primer E2E).
- *Ping* programado para que Render no se duerma (recorte decidido: se avisa en el README).
- Modo oscuro.

## Dudas resueltas (23/11/2026)
1. **Repositorio:** `incidapp`, público, en la cuenta `nacho-divetis` de GitHub.
2. **Render y Neon:** región Frankfurt en los dos; servicio `incidapp`. Los pasos en las webs los hace el usuario siguiendo las pautas de la tarea de despliegue.
3. **Seed de F00:** solo los 9 departamentos. Los tipos de incidencia van con F03 y los usuarios demo con F01.
