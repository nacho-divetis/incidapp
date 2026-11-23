import type { HealthResponse } from '@incidapp/shared';
import type { DatabaseHealth } from '../ports/database-health';

/** Tiempo máximo que se espera a la base de datos antes de darla por caída. */
export const DATABASE_PING_TIMEOUT_MS = 2000;

export interface GetHealthDeps {
  databaseHealth: DatabaseHealth;
  /** Versión desplegada (versión del paquete y, si existe, el commit). */
  version: string;
}

export type GetHealth = () => Promise<HealthResponse>;

/** Caso de uso público: estado de la API y de la base de datos. Nunca lanza. */
export const makeGetHealth =
  ({ databaseHealth, version }: GetHealthDeps): GetHealth =>
  async () => {
    const dbOk = await pingWithTimeout(databaseHealth, DATABASE_PING_TIMEOUT_MS);
    const state = dbOk ? 'ok' : 'error';
    return { status: state, db: state, version };
  };

async function pingWithTimeout(
  databaseHealth: DatabaseHealth,
  timeoutMs: number,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const ping = databaseHealth.ping().then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([ping, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
