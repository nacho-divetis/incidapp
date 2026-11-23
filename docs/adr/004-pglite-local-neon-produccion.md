# ADR-004 · PGlite en local y en tests, Neon en producción

- **Estado:** aceptado
- **Fecha:** 23/11/2026
- **Relacionado:** ADR-002, ADR-006, F00

## Contexto
El equipo de desarrollo no tiene Docker y la CI debe ser rápida. Producción usa PostgreSQL gestionado y gratuito (Neon). Se quiere probar contra PostgreSQL real, no contra un sustituto como SQLite.

## Decisión
Sin `DATABASE_URL`, la API usa **PGlite** (PostgreSQL compilado a WebAssembly, dentro del proceso): en `.data/` para desarrollo y **en memoria** para los tests. Con `DATABASE_URL`, usa **node-postgres** contra Neon con SSL. El driver se elige en el composition root y los dos comparten el mismo esquema Drizzle y las mismas migraciones. En producción, si falta `DATABASE_URL`, la app no arranca.

## Alternativas consideradas
| Opción | A favor | En contra |
|---|---|---|
| PGlite + Neon | Sin instalar nada; tests aislados y rápidos con PostgreSQL real | Dos drivers que pueden diferir en detalles; un solo proceso por directorio de datos |
| Docker Compose con PostgreSQL | Idéntico a producción | Docker no está disponible y ralentiza la CI |
| SQLite en local | Muy ligero | Dialecto distinto: el esquema y las consultas no serían los de producción |
| Neon también en local y tests | Un solo driver | Depende de la red, comparte datos entre tests y gasta el plan gratuito |

## Consecuencias
- **Positivas:** `npm ci && npm run dev` basta para trabajar; cada test arranca con una BD limpia.
- **Negativas / deuda aceptada:** las diferencias entre drivers se detectan en el despliegue, no en la CI; por eso el despliegue "hola mundo" se valida ya en F00.
- **Cuándo revisarla:** si aparece una función de PostgreSQL que PGlite no soporte.
