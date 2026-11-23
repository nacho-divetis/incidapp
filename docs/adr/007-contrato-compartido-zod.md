# ADR-007 · Contrato compartido con Zod en `packages/shared`

- **Estado:** aceptado
- **Fecha:** 23/11/2026
- **Relacionado:** ADR-002, F00

## Contexto
La API y la web se desarrollan en paralelo. Si cada lado define a mano sus tipos y validaciones, divergen. Además, toda entrada debe validarse en el servidor.

## Decisión
`packages/shared` (`@incidapp/shared`) contiene los **esquemas Zod** de las peticiones y respuestas, los tipos inferidos y los enums (`Role`, `Status`, `Priority`…). La API valida con esos esquemas, y la web los usa para tipar y validar las respuestas. El front nunca define a mano un tipo que ya exista en `shared`. El paquete se consume como TypeScript fuente, sin paso de build.

## Alternativas consideradas
| Opción | A favor | En contra |
|---|---|---|
| Zod compartido en el monorepo | Una fuente de verdad para tipos y validación; permite trabajar front y back en paralelo | Acopla front y back al mismo repositorio (aceptable en un monolito) |
| OpenAPI + generación de cliente | Estándar e independiente del lenguaje | Paso de generación y más herramientas para un único cliente |
| tRPC | Tipado de punta a punta sin esquemas duplicados | Acopla el transporte; una API menos REST y menos explicable |
| Tipos duplicados a mano | Ninguna dependencia | Divergen con el tiempo |

## Consecuencias
- **Positivas:** un cambio de contrato rompe la compilación en los dos lados; la validación del servidor y los formularios del front parten del mismo esquema.
- **Negativas / deuda aceptada:** sin documentación OpenAPI automática.
- **Cuándo revisarla:** si apareciera un cliente fuera del monorepo.
