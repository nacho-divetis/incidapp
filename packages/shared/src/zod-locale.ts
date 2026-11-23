// Mensajes de Zod en español para todo consumidor del contrato (API y web).
// `z.config` es global: basta con que se evalúe este módulo, y lo hace `index.ts` al importar `@incidapp/shared`.
import { z } from 'zod';

z.config(z.locales.es());
