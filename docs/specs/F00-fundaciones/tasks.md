# F00 · Fundaciones — Tareas

> Fuente de verdad del avance. El hook de inicio de sesión lee este archivo: respeta el formato (`### T-…` y las líneas `- Estado:` y `- Agente:`).
> Estados: `pendiente` · `en curso` · `hecha` · `bloqueada`
>
> **Bloque A** (T-00.01 a T-00.05) en la rama `feat/F00-fundaciones`. **Bloque B** (T-00.06 y T-00.07) en la rama `feat/F00-base-ui`, que sale de `main` cuando el bloque A ya está fusionado y puede avanzar en paralelo con F01.
> La instalación de dependencias pide confirmación al usuario; cada tarea justifica en su resumen las dependencias que añade.

### T-00.01 · Escribir la documentación de base y los ADR iniciales
- Estado: pendiente
- Agente: principal · Revisores: code-reviewer
- Depende de: —
- Paralelizable con: T-00.02, T-00.03, T-00.04
- Cubre: CA-00.14
- Archivos: docs/requisitos.md, docs/permisos.md, docs/glosario.md, docs/adr/001…007-*.md, README.md
- Verificación: revisión de `docs/` y del README; `grep -rniE "\.claude|AGENTS\.md|CLAUDE\.md" README.md docs/` no devuelve nada fuera de `docs/specs/`
- Notas: fuentes = documentos de definición v3 y v4 (la v4 prevalece) y los recortes del 23/11. `requisitos.md` fija los IDs de RF y RNF (incluidos RNF-01…06, que cita la spec de F00) con MoSCoW e historias. `permisos.md` recoge la matriz de la v4 (apartado 2.2) y las transiciones (apartado 2.1), con el cuadro de mando **solo para Admin y Dirección** y "visibles" = sus departamentos + creadas + asignadas. ADR con la skill `adr` (lista en `plan.md`). README mínimo: qué es, stack, cómo arrancar en local, URL de la demo (pendiente hasta T-00.05) y aviso de que Render tarda en despertar.

### T-00.02 · Montar el monorepo con el contrato base, las herramientas de calidad y la CI
- Estado: pendiente
- Agente: backend-dev · Revisores: code-reviewer
- Depende de: —
- Paralelizable con: T-00.01
- Cubre: CA-00.1, CA-00.11, CA-00.12, CA-00.13
- Archivos: package.json, tsconfig.base.json, eslint.config.js, .prettierrc.json, .prettierignore, commitlint.config.js, .lintstagedrc.json, .husky/{pre-commit,commit-msg}, .env.example, .nvmrc, .github/workflows/ci.yml, packages/shared/{package.json,tsconfig.json,src/index.ts,src/health.ts,src/errors.ts (+ .test.ts)}, apps/api/{package.json,tsconfig.json,tsup.config.ts,src/domain/index.ts,src/architecture.test.ts}, apps/web/{package.json,tsconfig.json,vite.config.ts,index.html,src/main.tsx}
- Verificación: npm run typecheck && npm run lint && npm test && npm run build · `echo "arreglos varios" | npx commitlint` termina con error
- Notas: workspaces `@incidapp/api`, `@incidapp/web` y `@incidapp/shared` con ESM, TS `strict` y `noUncheckedIndexedAccess`. `shared` sin build (`exports` → `src/index.ts`) con `HealthResponse`, `ErrorCode` y `ErrorResponse` según `plan.md`. Scripts raíz con los nombres exactos de `AGENTS.md`; `dev` con `concurrently` sobre los `dev` de api y web (que en esta tarea pueden ser un esqueleto). La API y la web quedan como esqueletos que compilan (la web solo con un `main.tsx` mínimo). ESLint 9 *flat* en la raíz con typescript-eslint, Prettier y la **regla de capas** del backend (`eslint-plugin-boundaries` + `no-restricted-imports` para `fastify`, `drizzle-orm`, `zod` y `node:*` en `domain`), probada en `architecture.test.ts` con `ESLint#lintText`. La regla de niveles atómicos es de T-00.06. CI: `pull_request` y `push` a `main`, Node 24 con caché de npm, `npm ci` → lint → typecheck → test → build. `prepare: "husky"` tolerante a la ausencia de `.git`.

### T-00.03 · Implementar la API base: servidor, errores, salud, base de datos, migraciones, *seed* y servicio de la SPA
- Estado: pendiente
- Agente: backend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-00.02
- Paralelizable con: T-00.04, T-00.01
- Cubre: CA-00.2, CA-00.3, CA-00.4, CA-00.5, CA-00.6, CA-00.8, CA-00.9
- Archivos: apps/api/src/application/{errors.ts,ports/database-health.ts,health/get-health.ts (+ .test.ts)}, apps/api/src/infrastructure/db/{schema.ts,client.ts,migrate.ts,seed.ts,database-health.ts,test-database.ts (+ tests)}, apps/api/src/http/{app.ts,error-handler.ts,routes/health.ts (+ tests)}, apps/api/src/composition/{config.ts,container.ts,main.ts (+ tests)}, apps/api/drizzle/ (generada), apps/api/drizzle.config.ts
- Verificación: npm test -w @incidapp/api && npm run db:migrate && npm run db:migrate && npm run db:seed && npm run db:seed && npm run build
- Notas: seguir la skill `caso-de-uso` para `getHealth`. Driver por `config` en el composition root (PGlite sin `DATABASE_URL`; node-postgres con SSL y `max: 5`; en producción sin `DATABASE_URL` → error en español y salida). Tabla `departments` y migración **generada** con `npm run db:generate`. *Seed* con los 9 departamentos ficticios y `onConflictDoNothing`. `buildApp(deps)` con Helmet (CSP), el *type provider* de Zod, el prefijo `/api`, `@fastify/static` sobre `WEB_DIST_DIR` y el *not found handler* (JSON en `/api/*`, `index.html` en el resto). Mapeo de errores según `plan.md`; un 500 nunca expone *stack*. Logger con `redact` de `authorization`, `cookie` y `set-cookie`. `dev` de la API: `db:migrate` → `db:seed` → `tsx watch`. `start`: `node dist/main.js`. `createTestDatabase()` (PGlite en memoria + migraciones) reutilizable por las features siguientes.

### T-00.04 · Crear la web base: cliente de la API, *providers* y página inicial con el estado de la API
- Estado: pendiente
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-00.02
- Paralelizable con: T-00.03, T-00.01
- Cubre: CA-00.2, CA-00.7
- Archivos: apps/web/vite.config.ts (proxy `/api`), apps/web/src/main.tsx, apps/web/src/app/{providers.tsx,router.tsx}, apps/web/src/lib/api/{client.ts,client.test.ts}, apps/web/src/queries/health.ts, apps/web/src/pages/HomePage/{HomePage.tsx,HomePage.test.tsx,index.ts}, apps/web/src/test/setup.ts, apps/web/vitest.config.ts
- Verificación: npm test -w @incidapp/web && npm run build -w @incidapp/web
- Notas: en un worktree de `.worktrees/` (receta de la skill `tarea`), porque va en paralelo con T-00.03. Solo usa `HealthResponse` y `ErrorResponse` de `shared`, que crea T-00.02. `apiGet(path, schema)` valida con Zod y convierte `ErrorResponse` en `ApiError`; los métodos que no son GET llevan `credentials: 'include'` y `X-Requested-With: fetch`. React Router 7 (`createBrowserRouter`) y TanStack Query. `HomePage` muestra "IncidApp" y "Conectada" / "Sin conexión", con estado de carga. Sin estilos de diseño: los tokens llegan en T-00.06. Tests con `fetch` simulado (`vi.stubGlobal`) y Testing Library.

### T-00.05 · Desplegar en Render + Neon y fusionar el bloque A
- Estado: pendiente
- Agente: principal · Revisores: code-reviewer
- Depende de: T-00.01, T-00.03, T-00.04
- Paralelizable con: —
- Cubre: CA-00.10
- Archivos: render.yaml, README.md (URL de la demo)
- Verificación: CI en verde en el PR (`gh pr checks`) · tras el despliegue, `curl -s https://<servicio>.onrender.com/api/health` → 200 con `"db":"ok"` y `/` muestra la página inicial · `npm run dev` en local arranca API y web (CA-00.2 de punta a punta)
- Notas: `render.yaml` según `plan.md` (free, Frankfurt, Node 24, `npm ci --include=dev && npm run build`, `npm run db:migrate && npm start`, `healthCheckPath`, `autoDeployTrigger: checksPass`, `DATABASE_URL` con `sync: false`). Abrir el PR `feat/F00-fundaciones` → `main` y hacer *squash merge* (ambos piden confirmación). Después, el usuario crea el Blueprint en Render siguiendo las pautas dadas el 23/11 y pega `DATABASE_URL` de Neon. Anotar aquí la URL y el resultado del `curl`.

### T-00.06 · Definir los tokens, configurar Storybook y las reglas de UI
- Estado: pendiente
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-00.05
- Paralelizable con: tareas de F01 que no toquen `apps/web/src/components`
- Cubre: CA-00.15, CA-00.16, CA-00.17, CA-00.18
- Archivos: apps/web/src/styles/{tokens.css,index.css,Tokens.stories.tsx}, apps/web/.storybook/{main.ts,preview.ts}, apps/web/src/components/{atoms,molecules,organisms,templates}/index.ts, apps/web/src/components/architecture.test.ts, apps/web/src/lib/cn.ts, eslint.config.js (niveles atómicos), apps/web/package.json (scripts `storybook` y `build-storybook`), package.json (scripts raíz)
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build-storybook
- Notas: rama `feat/F00-base-ui` desde `main`. Tailwind 4 con `@tailwindcss/vite` y tokens en `@theme` (colores semánticos con `-bg`, `-fg` y `-border`, superficie, texto, tipografía Inter con *fallback* del sistema y sin fuentes externas, espaciado, radios, sombras y anillo de foco), con contraste AA. Storybook con `@storybook/react-vite` y `addon-a11y`, que reutiliza `vite.config.ts`. `architecture.test.ts` comprueba: niveles con `ESLint#lintText` (subir de nivel, mismo nivel salvo organismos, átomo → `@incidapp/shared`, `components/` → `@tanstack/react-query`, `lib/api`, `queries/`, `useNavigate`/`useParams`), estructura de carpetas (CA-00.17) y ausencia de hexadecimales y valores arbitrarios en `components/` (CA-00.15). Alias `@/` → `src/`.

### T-00.07 · Crear los átomos base y las plantillas AppLayout y AuthLayout
- Estado: pendiente
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-00.06
- Paralelizable con: tareas de F01 que no toquen `apps/web/src/components`
- Cubre: CA-00.19, CA-00.20
- Archivos: apps/web/src/components/atoms/{Button,Input,Textarea,Select,Checkbox,Label,Badge,Spinner,Heading,Text,Icon}/…, apps/web/src/components/templates/{AppLayout,AuthLayout}/…, índices de nivel
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build-storybook
- Notas: skill `componente`. Props y variantes según la tabla de `plan.md` (con `cva` + `cn`). Cada átomo con story (título `Átomos/<Nombre>`, con los estados normal, deshabilitado, cargando o error según el caso). Tests de interacción: `Button` (no dispara `onClick` con `disabled` ni `loading`, `aria-busy`), `Input`/`Textarea`/`Select` (`aria-invalid`, `aria-describedby`), `Label` (`htmlFor`), `Checkbox`. Plantillas: *landmarks* `banner`, `navigation` y `main`, enlace "Saltar al contenido" que lleva el foco a `main`, `AuthLayout` con el panel centrado, y sin desplazamiento horizontal en móvil. Sin textos de negocio fijos. Iconos con `lucide-react`. Sin violaciones del addon a11y.

---

## Cobertura

| Criterio | Tareas |
|---|---|
| CA-00.1 | T-00.02 |
| CA-00.2 | T-00.03, T-00.04 (verificación de punta a punta en T-00.05) |
| CA-00.3 | T-00.03 |
| CA-00.4 | T-00.02 (esquema), T-00.03 |
| CA-00.5 | T-00.02 (esquema), T-00.03 |
| CA-00.6 | T-00.03 |
| CA-00.7 | T-00.04 |
| CA-00.8 | T-00.03 |
| CA-00.9 | T-00.03 |
| CA-00.10 | T-00.05 |
| CA-00.11 | T-00.02 |
| CA-00.12 | T-00.02 |
| CA-00.13 | T-00.02 |
| CA-00.14 | T-00.01 |
| CA-00.15 | T-00.06 |
| CA-00.16 | T-00.06 |
| CA-00.17 | T-00.06 |
| CA-00.18 | T-00.06 |
| CA-00.19 | T-00.07 |
| CA-00.20 | T-00.07 |
