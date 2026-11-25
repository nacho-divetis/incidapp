# El *harness* de desarrollo con IA

IncidApp se ha construido con **Claude Code** como agente principal y un *harness* propio: las instrucciones, los subagentes, las *skills*, los *hooks*, las reglas y los permisos que convierten un asistente genérico en un equipo con un proceso. Este documento lo **describe**; sus archivos no se publican.

## Por qué no está en el repositorio

Claude Code se abre en una carpeta de trabajo que **contiene** el repositorio, pero no forma parte de él:

```
carpeta de trabajo/        harness (no se versiona)
├── instrucciones del proyecto, subagentes, skills, hooks, reglas y permisos
└── incidapp/              este repositorio (público)
```

Así el repositorio solo tiene la aplicación y su documentación, y el *harness* se puede cambiar sin ensuciar el historial. Un *hook* impide que un agente copie por error una pieza del *harness* dentro de `incidapp/` (ver más abajo). Los fragmentos de este documento son citas breves, no copias de los archivos.

## Mapa de piezas

| Pieza | Qué es | Problema que resuelve |
|---|---|---|
| Instrucciones del proyecto (`AGENTS.md`) | Fuente de verdad para cualquier agente: stack, mapa de carpetas, comandos, reglas de arquitectura y de seguridad, convenciones y *Definition of Done* | Que cualquier agente (Claude Code u otro) trabaje con las mismas reglas sin repetirlas en cada conversación |
| Instrucciones de Claude Code | El papel del agente principal (*tech lead*), qué pieza usar en cada caso y los puntos de control con el usuario | Que el agente principal coordine en lugar de programar, y que pida aprobación donde toca |
| Notas locales | Rutas a los documentos de definición del TFM y datos del entorno (Windows, sin Docker, cuentas gratuitas) | Contexto que no debe publicarse |
| 5 subagentes | `backend-dev`, `frontend-dev`, `qa-tester`, `code-reviewer`, `security-reviewer` | Especialización y **contexto limpio** por tarea |
| 6 *skills* | `sdd-feature`, `tarea`, `caso-de-uso`, `componente`, `adr`, `entrega-tfm` | Recetas repetibles: cada operación frecuente se hace siempre igual |
| 4 *hooks* | Inicio de sesión, protección de archivos, formato y *typecheck* al terminar | Reglas que **no dependen** de que el modelo se acuerde |
| 3 reglas por ruta | Backend, frontend (atomic design) y tests | Contexto específico que solo se carga cuando se tocan esos archivos |
| Permisos | Listas de permitido, preguntar y denegado | Autonomía para lo seguro y confirmación humana para lo irreversible |

## Instrucciones del proyecto

`AGENTS.md` es el documento que leen todos los agentes. Resume la arquitectura y las reglas no negociables. Por ejemplo, la regla de dependencias de la API y la de seguridad:

> **Regla de dependencias:** `domain` ← `application` ← `infrastructure` / `http` ← `composition`. Una capa nunca importa de una más externa.

> **La autorización se decide solo en `AuthorizationPolicy`** (`application/`), según `docs/permisos.md`. Todo caso de uso la llama.

Termina con la *Definition of Done* de cada tarea (test por criterio de aceptación, `typecheck`, `lint` y `test` en verde, *story* de cada componente nuevo, revisión sin hallazgos altos y `tasks.md` actualizado en el mismo commit).

Las instrucciones específicas de Claude Code le dan el papel de **tech lead**: *"lees la tarea, delegas, integras, verificas, haces el commit y actualizas `tasks.md`. La implementación la hacen los subagentes"*. Incluyen una tabla "tarea → pieza" y los **puntos de control con el usuario**: aprobar cada `spec.md`, aprobar los `plan.md` de las fundaciones y de los permisos, revisar la UI en el navegador al terminar las incidencias y los estados, y confirmar siempre `git push`, la instalación de dependencias, abrir un PR y hacer *merge*.

## Subagentes

Cada subagente tiene su propio contexto: solo ve lo que le pasa el principal y lo que lee por su cuenta.

| Subagente | Herramientas | Qué hace |
|---|---|---|
| `backend-dev` | Todas | Implementa **una** tarea de `apps/api` o `packages/shared` con TDD y Clean Architecture. No hace commit ni cambia el estado de la tarea |
| `frontend-dev` | Todas | Implementa una tarea de `apps/web` con atomic design y Storybook, contra el contrato de `shared` |
| `qa-tester` | Lectura, edición y Bash (modelo más ligero) | Escribe tests a partir de la spec y de `permisos.md`: *"demostrar con tests que el sistema cumple la spec, **no** que el código actual pasa"*. No toca código de producción; si un test falla por un bug, lo deja fallando y lo describe |
| `code-reviewer` | Solo lectura (modelo más ligero) | Revisa el diff contra la spec, la regla de capas, la calidad de los tests y los errores. *"Si no puedes describir un escenario concreto en el que falla, no es un hallazgo"* |
| `security-reviewer` | Solo lectura | Auditoría OWASP Top 10 del diff en las tareas que tocan autenticación, sesión, permisos, rutas HTTP nuevas o datos de usuarios |

Los revisores devuelven una tabla con **gravedad** (alta, media, baja), archivo y línea, problema, **escenario en que falla** y propuesta. Exigir el escenario reduce los falsos positivos: los hallazgos que se han corregido están en [hallazgos-revisores.md](hallazgos-revisores.md).

**Contexto limpio.** A los revisores se les pasa *solo* el ID de la tarea y el alcance del diff, nunca el razonamiento del principal ni el resumen del implementador. Si el revisor supiera qué pretendía el código, tendería a confirmarlo; leyéndolo en frío encuentra lo que el implementador dio por supuesto (por ejemplo, la condición de carrera de [T-03.02](flujo.md)).

## *Skills*

| *Skill* | Cuándo se usa | Qué fija |
|---|---|---|
| `sdd-feature` | Especificar una feature | `spec.md` → aprobación del usuario → `plan.md` → `tasks.md`, con plantillas. No escribe código |
| `tarea` | "Ejecuta T-xx.yy" o "siguiente" | El ciclo completo: elegir la tarea → delegar → verificar → revisar → tratar los hallazgos → commit (ver [flujo.md](flujo.md)) |
| `caso-de-uso` | Cualquier endpoint nuevo de la API | El recorrido por todas las capas: esquema Zod en `shared`, puerto, caso de uso con test, adaptador Drizzle, ruta Fastify, test de API y registro en el *composition root* |
| `componente` | Crear o cambiar un componente o una página | Inventario de lo que existe, elección del nivel atómico, construcción de abajo arriba y componente + *story* + test + `index.ts` |
| `adr` | Una decisión de arquitectura | ADR numerado con contexto, decisión, alternativas y consecuencias (los 9 de [docs/adr](../adr/README.md)) |
| `entrega-tfm` | La entrega | Auditoría del README contra los requisitos oficiales, `master.md`, estas evidencias, slides, guion del vídeo y datos del formulario |

La *skill* `tarea` también decide el **trabajo en paralelo**: si `tasks.md` marca dos tareas como *paralelizables* y el contrato de `shared` ya existe, el principal lanza los dos subagentes a la vez y el de front trabaja en un *worktree* de Git propio (`git worktree add ../.worktrees/<tarea> -b <rama>-<tarea>`), que luego se integra en la rama de la feature.

Tabla de gravedades de la *skill* `tarea`:

| Gravedad | Acción |
|---|---|
| crítica / alta | Se corrige y se vuelve a verificar |
| media | Se corrige, o se descarta con el motivo en las notas de la tarea |
| baja | Opcional |

## *Hooks*

Los *hooks* son *scripts* de Node que Claude Code ejecuta en momentos fijos. A diferencia de una instrucción, **siempre** se cumplen.

| *Hook* | Momento | Qué hace |
|---|---|---|
| Estado del proyecto | Al empezar o reanudar una sesión | Añade al contexto la rama, los cambios sin commit y las tareas en curso, bloqueadas y siguientes de los `tasks.md`. Así una sesión nueva (una por feature) retoma el trabajo sin que nadie se lo explique |
| Protección de archivos | Antes de editar o escribir | Bloquea los `.env` (secretos), las migraciones de `apps/api/drizzle/` (las genera `drizzle-kit`), `package-lock.json` (lo gestiona npm) y cualquier pieza del *harness* dentro del repositorio. El agente recibe el motivo y la alternativa |
| Formato | Después de editar | Pasa Prettier al archivo editado |
| *Typecheck* | Al terminar el turno | Si hay cambios en TypeScript, ejecuta `npm run typecheck` y, si falla, **no deja terminar** al agente hasta arreglarlo (con protección contra bucles) |

Ejemplo del mensaje de la protección de migraciones, que el agente recibe al intentar editarlas:

> Las migraciones de apps/api/drizzle/ las genera drizzle-kit y no se editan ni se crean a mano. Cambia apps/api/src/infrastructure/db/schema.ts y ejecuta `npm run db:generate`.

## Reglas por ruta

Tres archivos de reglas que Claude Code carga solo cuando trabaja con las rutas que declaran:

- **Backend** (`apps/api`, `packages/shared`): el orden fijo de un caso de uso, *"cargar → ¿visible? (404) → ¿permitido? (403, vía `AuthorizationPolicy`) → regla de dominio → persistir → devolver DTO"*; `domain` sin `Date.now()` (el tiempo llega por el puerto `Clock`); varias tablas, una transacción; historial y auditoría solo de inserción.
- **Frontend** (`apps/web`): los niveles de atomic design, qué puede importar cada uno y que solo las páginas usan datos, *router* y sesión.
- **Tests** (`*.test.ts(x)`, `e2e/`): el nombre del test cita el criterio (`"CA-04.2: …"`), reloj fijo y datos propios, matrices con `it.each`, selectores accesibles en los E2E y, sobre todo, *"un test que falla por un bug real no se salta ni se debilita: se informa"*.

## Permisos

| Lista | Ejemplos | Por qué |
|---|---|---|
| Permitido sin preguntar | `npm run …`, `npm test`, `git status/diff/log/add/commit`, `git worktree`, `gh pr view/checks` | El bucle de desarrollo no se interrumpe |
| Preguntar | `git push`, `git merge`, `git rebase`, `git reset`, `npm install`, `gh pr create`, `gh pr merge`, `gh api` | Publicar, integrar o añadir dependencias lo decide una persona |
| Denegado | Leer `.env`, `git push --force`, `rm -rf`, `drizzle-kit drop` | Secretos y acciones irreversibles |

## Qué ha funcionado y qué no

- **Funciona:** los revisores con contexto limpio encontraron problemas reales con todos los tests en verde ([hallazgos-revisores.md](hallazgos-revisores.md)); el *hook* de inicio de sesión hace innecesario resumir el estado al abrir una sesión; las *skills* `caso-de-uso` y `componente` hacen que todas las piezas se parezcan.
- **Límites:** un revisor puede proponer un cambio que rompe el *build* sin que fallen los tests (el `sideEffects` de T-00.03): por eso el principal **verifica** cada corrección, no la aplica a ciegas. Y algunos fallos solo aparecen al usar la aplicación de verdad, como el bucle de peticiones al caducar la sesión (ver [flujo.md](flujo.md#otro-hallazgo-un-test-intermitente)).
