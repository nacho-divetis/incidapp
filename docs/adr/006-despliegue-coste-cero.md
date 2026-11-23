# ADR-006 · Despliegue con coste cero: Render, Neon y GitHub Pages

- **Estado:** aceptado
- **Fecha:** 23/11/2026
- **Relacionado:** ADR-001, ADR-004, ADR-005, F00, F07

## Contexto
El TFM exige una demo desplegada y el proyecto tiene una restricción no negociable de **coste cero**. El plan gratuito de Render duerme el servicio tras unos 15 minutos sin tráfico y no tiene `preDeployCommand` ni disco persistente.

## Decisión
- **App** (API + front compilado): *web service* gratuito de **Render** con runtime Node nativo, definido en `render.yaml` (Blueprint). Se despliega al hacer merge en `main` **solo si la CI está en verde**.
- **Migraciones al arrancar:** `npm run db:migrate && npm start`.
- **Base de datos:** **Neon**, plan gratuito, en la misma región que el servicio (Frankfurt).
- **Storybook:** **GitHub Pages**.
- **Secretos** (`DATABASE_URL`): solo en el panel de Render, nunca en el repositorio.

## Alternativas consideradas
| Opción | A favor | En contra |
|---|---|---|
| Render + Neon | Gratis, Node nativo, infraestructura como código | Arranque en frío de alrededor de un minuto; sin disco |
| Railway | Despliegue muy cómodo | Sin plan gratuito permanente |
| Fly.io | Máquinas cercanas y volúmenes | Requiere tarjeta |
| Vercel o Netlify con funciones | CDN y vistas previas por PR | Funciones sin estado; front y API separados; no encaja con la sesión ni con el monolito |

## Consecuencias
- **Positivas:** URL pública desde el primer día, despliegue automático y reproducible, coste cero.
- **Negativas / deuda aceptada:** la primera visita tarda en despertar el servicio (se avisa en el README; sin *ping* programado, recorte del 23/11). Una migración fallida impide arrancar, y eso es lo deseado.
- **Cuándo revisarla:** si la demo necesitara estar siempre despierta o el plan gratuito cambiara sus límites.
