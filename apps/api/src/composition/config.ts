// Configuración de la API a partir de las variables de entorno (documentadas en `.env.example`).
// Se valida al arrancar: un error de configuración se detecta antes de la primera petición.
import path from 'node:path';
import { z } from 'zod';
import type { DatabaseConfig } from '../infrastructure/db/client';
import packageJson from '../../package.json' with { type: 'json' };

/** Error de configuración. Su mensaje está en español y nunca incluye valores secretos. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  host: string;
  database: DatabaseConfig;
  /** Carpeta del build de la web que sirve la API. */
  webDistDir: string;
  /** Versión del paquete de la API y, si existe, el commit desplegado. */
  version: string;
  /**
   * Exige HTTPS en el navegador (HSTS y la directiva CSP `upgrade-insecure-requests`). Solo en producción:
   * en local, `npm start` sirve sobre `http://localhost` y esas cabeceras romperían la carga de la web.
   */
  enforceHttps: boolean;
  /**
   * Saltos de *proxy* de confianza para obtener la IP real del cliente (`X-Forwarded-For`). Nunca
   * «confiar en todos»: el cliente podría falsear la cabecera para saltarse el límite de intentos.
   */
  trustProxyHops: number;
  /** Límite de intentos de `POST /api/auth/login` por IP (CA-01.8). */
  loginRateLimit: { max: number; timeWindowMs: number };
}

/** 10 intentos de login por IP cada 15 minutos (spec F01, duda 2). */
const DEFAULT_LOGIN_RATE_LIMIT = { max: 10, timeWindowMs: 15 * 60 * 1000 };

/** Una variable vacía (`DATABASE_URL=` en `.env.example`) cuenta como no definida. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const EnvSchema = z.object({
  NODE_ENV: optional(z.enum(['development', 'test', 'production'])),
  PORT: optional(z.coerce.number().int().min(1).max(65535)),
  HOST: optional(z.string()),
  DATABASE_URL: optional(z.string().regex(/^postgres(ql)?:\/\//)),
  // Rutas relativas a `apps/api`, que es el directorio de trabajo de los scripts de npm de la API.
  PGLITE_DATA_DIR: optional(z.string()),
  WEB_DIST_DIR: optional(z.string()),
  // La define Render en cada despliegue.
  RENDER_GIT_COMMIT: optional(z.string()),
  TRUST_PROXY_HOPS: optional(z.coerce.number().int().min(0)),
  LOGIN_RATE_LIMIT_MAX: optional(z.coerce.number().int().min(1)),
  LOGIN_RATE_LIMIT_WINDOW_MS: optional(z.coerce.number().int().min(1)),
});

/** `NOMBRE: problema` de cada variable no válida, sin repetir su valor. */
const describeIssues = (error: z.ZodError) =>
  error.issues
    .map(
      (issue) =>
        `${issue.path.join('.')}: ${issue.code === 'invalid_format' ? 'formato no válido' : issue.message}`,
    )
    .join('; ');

export function loadConfig(
  env: Record<string, string | undefined>,
  cwd: string = process.cwd(),
): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      `Configuración no válida en las variables de entorno. ${describeIssues(parsed.error)}`,
    );
  }
  const vars = parsed.data;
  const nodeEnv = vars.NODE_ENV ?? 'development';

  if (nodeEnv === 'production' && !vars.DATABASE_URL) {
    throw new ConfigError(
      'Falta la variable DATABASE_URL: es obligatoria en producción (en producción nunca se usa PGlite).',
    );
  }

  const database: DatabaseConfig = vars.DATABASE_URL
    ? { driver: 'pg', url: vars.DATABASE_URL }
    : { driver: 'pglite', dataDir: path.resolve(cwd, vars.PGLITE_DATA_DIR ?? '.data/pglite') };

  const commit = vars.RENDER_GIT_COMMIT?.slice(0, 7);

  return {
    nodeEnv,
    port: vars.PORT ?? 3000,
    host: vars.HOST ?? '0.0.0.0',
    database,
    webDistDir: path.resolve(cwd, vars.WEB_DIST_DIR ?? '../web/dist'),
    version: commit ? `${packageJson.version}+${commit}` : packageJson.version,
    enforceHttps: nodeEnv === 'production',
    // En producción, el proxy de Render es un salto; en local no hay proxy.
    trustProxyHops: vars.TRUST_PROXY_HOPS ?? (nodeEnv === 'production' ? 1 : 0),
    loginRateLimit: {
      max: vars.LOGIN_RATE_LIMIT_MAX ?? DEFAULT_LOGIN_RATE_LIMIT.max,
      timeWindowMs: vars.LOGIN_RATE_LIMIT_WINDOW_MS ?? DEFAULT_LOGIN_RATE_LIMIT.timeWindowMs,
    },
  };
}
