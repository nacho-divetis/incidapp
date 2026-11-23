# IncidApp

Aplicación web para registrar y hacer seguimiento de las incidencias de una **empresa ficticia**: roles y departamentos, estados con historial, adjuntos, auditoría y cuadro de mando.

Trabajo Fin de Máster del *Máster de Desarrollo con IA*. Todos los datos son **sintéticos**.

> En construcción. Este README se completa en la fase de entrega.

## Demo

- **URL:** pendiente del primer despliegue.
- La demo está en el plan gratuito de Render: si nadie la ha usado en los últimos minutos, **la primera carga tarda alrededor de un minuto** mientras el servicio despierta.

## Stack

| Parte | Tecnología |
|---|---|
| Monorepo | npm workspaces: `apps/api`, `apps/web`, `packages/shared` |
| API | Node 24, TypeScript, Fastify, Zod · Clean Architecture |
| Base de datos | PostgreSQL con Drizzle ORM · PGlite en local y en tests, Neon en producción |
| Web | React, Vite, React Router, TanStack Query, Tailwind · atomic design con Storybook |
| Tests | Vitest, Testing Library, Playwright |
| Calidad | ESLint, Prettier, Husky, lint-staged, commitlint, GitHub Actions |
| Despliegue | Render (plan gratuito) + Neon (plan gratuito) |

## Arrancar en local

Requisitos: **Node 24** y npm 11. No hace falta instalar ninguna base de datos: en local se usa PGlite (PostgreSQL embebido) y los datos se guardan en `.data/`.

```bash
npm ci
npm run dev      # API en http://localhost:3000 y web en http://localhost:5173
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | API + web en modo desarrollo |
| `npm run typecheck` | Comprobación de tipos en todos los workspaces |
| `npm run lint` | ESLint, incluidas las reglas de arquitectura |
| `npm test` | Tests de todos los workspaces |
| `npm run build` | Build de producción |
| `npm run db:generate` | Genera una migración a partir del esquema |
| `npm run db:migrate` | Aplica las migraciones |
| `npm run db:seed` | Carga los datos iniciales de la empresa ficticia |

## Documentación

- [Requisitos](docs/requisitos.md)
- [Matriz de permisos](docs/permisos.md)
- [Glosario](docs/glosario.md)
- [Decisiones de arquitectura (ADR)](docs/adr/README.md)
- [Especificaciones por feature](docs/specs/)
