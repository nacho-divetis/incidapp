import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createSessionTokens } from './session-tokens';

const tokens = createSessionTokens();

describe('createSessionTokens', () => {
  it('CA-01.1: genera tokens aleatorios de 32 bytes en base64url', () => {
    const token = tokens.generate();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('CA-01.4: cada token es distinto', () => {
    const generated = new Set(Array.from({ length: 100 }, () => tokens.generate()));

    expect(generated.size).toBe(100);
  });

  it('CA-01.1: idFor es el SHA-256 del token en hexadecimal, determinista y distinto del token', () => {
    const token = tokens.generate();
    const id = tokens.idFor(token);

    expect(id).toBe(createHash('sha256').update(token).digest('hex'));
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens.idFor(token)).toBe(id);
    expect(id).not.toBe(token);
    expect(tokens.idFor(tokens.generate())).not.toBe(id);
  });
});
