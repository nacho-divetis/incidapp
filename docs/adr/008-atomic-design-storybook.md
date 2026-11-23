# ADR-008 · Atomic design con Storybook

- **Estado:** aceptado
- **Fecha:** 23/11/2026
- **Relacionado:** ADR-007, ADR-009, F00

## Contexto
La interfaz tiene muchas pantallas parecidas (listados, detalles, formularios) y se construye en paralelo con la API. Sin una estructura, los componentes se duplican y la lógica de datos se mezcla con la presentación.

## Decisión
Organizamos `apps/web/src` en **tokens ← átomos ← moléculas ← organismos ← plantillas ← páginas**. Solo las páginas acceden a datos (TanStack Query), al router y a la sesión; del organismo hacia abajo todo es presentacional (props de entrada, callbacks de salida). Las variantes se hacen con `class-variance-authority` y `tailwind-merge`, los estilos solo con tokens de Tailwind, y cada átomo, molécula y organismo tiene su story en **Storybook** (con el addon de accesibilidad). ESLint y un test de estructura comprueban los niveles.

## Alternativas consideradas
| Opción | A favor | En contra |
|---|---|---|
| Atomic design + Storybook | Reutilización explícita; componentes que se prueban sin API; catálogo visible | Decidir el nivel exige criterio; más carpetas |
| Organización por *feature* (`features/incidents/…`) | Todo lo de un dominio junto | Duplicación de piezas de UI entre features |
| Librería de componentes completa (MUI, Chakra) | Muchos componentes hechos | Estilo genérico, más peso y menos control de los tokens |

## Consecuencias
- **Positivas:** organismos construibles en paralelo con la API a partir de los tipos de `shared`; accesibilidad revisada componente a componente.
- **Negativas / deuda aceptada:** coste inicial (tokens, átomos y plantillas en F00) antes de la primera pantalla real.
- **Cuándo revisarla:** si las fronteras entre niveles generan más discusión que valor.
