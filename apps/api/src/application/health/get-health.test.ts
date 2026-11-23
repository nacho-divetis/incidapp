import { HealthResponse } from '@incidapp/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseHealth } from '../ports/database-health';
import { makeGetHealth } from './get-health';

const VERSION = '0.1.0+abc1234';

const databaseHealth = (ping: DatabaseHealth['ping']): DatabaseHealth => ({ ping });

describe('getHealth', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('CA-00.4: con la base de datos disponible devuelve status y db "ok" con la versión', async () => {
    const getHealth = makeGetHealth({
      databaseHealth: databaseHealth(async () => {}),
      version: VERSION,
    });

    const health = await getHealth();

    expect(health).toEqual({ status: 'ok', db: 'ok', version: VERSION });
    expect(HealthResponse.parse(health)).toEqual(health);
  });

  it('CA-00.4: si la base de datos falla devuelve status y db "error"', async () => {
    const getHealth = makeGetHealth({
      databaseHealth: databaseHealth(async () => {
        throw new Error('connection refused');
      }),
      version: VERSION,
    });

    expect(await getHealth()).toEqual({ status: 'error', db: 'error', version: VERSION });
  });

  it('CA-00.4: si la base de datos tarda más de 2 s devuelve status y db "error"', async () => {
    vi.useFakeTimers();
    const getHealth = makeGetHealth({
      databaseHealth: databaseHealth(() => new Promise<void>(() => {})),
      version: VERSION,
    });

    const pending = getHealth();
    await vi.advanceTimersByTimeAsync(2000);

    expect(await pending).toEqual({ status: 'error', db: 'error', version: VERSION });
  });

  it('CA-00.4: una respuesta por debajo de 2 s se considera correcta', async () => {
    vi.useFakeTimers();
    const getHealth = makeGetHealth({
      databaseHealth: databaseHealth(
        () => new Promise<void>((resolve) => setTimeout(resolve, 1500)),
      ),
      version: VERSION,
    });

    const pending = getHealth();
    await vi.advanceTimersByTimeAsync(1500);

    expect(await pending).toEqual({ status: 'ok', db: 'ok', version: VERSION });
  });
});
