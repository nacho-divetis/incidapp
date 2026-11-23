import { describe, expect, it } from 'vitest';
import { HealthResponse } from './index';

describe('HealthResponse', () => {
  it.each([
    { status: 'ok', db: 'ok', version: '0.1.0' },
    { status: 'error', db: 'error', version: '0.1.0+abc1234' },
  ])('CA-00.4: acepta un cuerpo de salud válido (%o)', (body) => {
    expect(HealthResponse.parse(body)).toEqual(body);
  });

  it.each([
    ['un estado desconocido', { status: 'degraded', db: 'ok', version: '0.1.0' }],
    ['un estado de BD desconocido', { status: 'ok', db: 'down', version: '0.1.0' }],
    ['sin versión', { status: 'ok', db: 'ok' }],
    ['una versión vacía', { status: 'ok', db: 'ok', version: '' }],
  ])('CA-00.4: rechaza %s', (_case, body) => {
    expect(HealthResponse.safeParse(body).success).toBe(false);
  });
});
