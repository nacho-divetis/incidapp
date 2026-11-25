# ADR-002 · Clean Architecture con puertos y adaptadores

- **Estado:** aceptado
- **Fecha:** 23/11/2026
- **Relacionado:** ADR-001, ADR-004, F00

## Contexto
La API debe funcionar con dos bases de datos (PGlite en local y tests, Neon en producción), probarse sin levantar servidores y mantener reglas críticas (máquina de estados y permisos) aisladas del framework. El TFM valora además la aplicación de patrones de arquitectura.

## Decisión
Organizamos `apps/api/src` en las capas `domain` ← `application` ← `infrastructure` / `http` ← `composition`. `domain` es TypeScript puro; `application` define los casos de uso y los **puertos** (interfaces); `infrastructure` y `http` los implementan o los usan; `composition` es el único sitio que conecta implementaciones. La regla se comprueba con ESLint en cada commit y en la CI.

## Alternativas consideradas
| Opción | A favor | En contra |
|---|---|---|
| Clean Architecture con puertos | Dominio testeable sin BD; el driver se cambia en un solo sitio; reglas de negocio independientes de Fastify y Drizzle | Más archivos y algo de ceremonia por cada caso de uso |
| Capas clásicas (rutas → servicios → ORM) | Menos código | La lógica acaba dependiendo de Drizzle y Fastify; más difícil de probar en aislado |
| Rutas "gordas" con la lógica dentro | Lo más rápido al principio | Sin aislamiento de reglas; los permisos se dispersan |

## Consecuencias
- **Positivas:** máquina de estados y `AuthorizationPolicy` probadas con tests unitarios puros; errores tipados que solo `http/` traduce a HTTP; una receta repetible para cada caso de uso.
- **Negativas / deuda aceptada:** más archivos por operación; se acepta a cambio de consistencia.
- **Cuándo revisarla:** si la ceremonia frena más de lo que protege (casos de uso que solo delegan en el repositorio).

## Nota (F02, 23/11/2026): `UnitOfWork` para cambios con auditoría
Cuando un caso de uso escribe en varias tablas y el cambio debe quedar junto con su fila de auditoría (p. ej., desactivar un usuario: `users` + borrado de `sessions` + `audit_log`), usa el puerto `UnitOfWork` (`application/ports/unit-of-work.ts`). Su método `run(work)` entrega a `work` repositorios que trabajan sobre una misma transacción; si `work` lanza, no queda nada. El adaptador (`infrastructure/db/unit-of-work.ts`) usa `db.transaction` de Drizzle, que funciona igual con PGlite y con node-postgres, y crea los repositorios sobre la transacción (los adaptadores aceptan la BD o la transacción). Reglas:
- Las lecturas y comprobaciones previas (permiso, 404, 409) y el trabajo caro (*hash* de contraseñas) van **antes** de `run`, para no alargar la transacción.
- Dentro de `work` solo se usan los repositorios recibidos: con PGlite (una sola conexión), una consulta con la BD de fuera esperaría a que termine la transacción.
- F03 y F04 lo amplían con sus repositorios (incidencia + evento de historial + auditoría).
