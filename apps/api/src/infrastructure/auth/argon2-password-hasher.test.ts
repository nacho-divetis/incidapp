import { describe, expect, it } from 'vitest';
import { createArgon2PasswordHasher } from './argon2-password-hasher';

const hasher = createArgon2PasswordHasher();
const PASSWORD = 'Demo2026!';

describe('createArgon2PasswordHasher', () => {
  it('CA-01.11: genera un hash argon2id con los parámetros de OWASP (19 MiB, t=2, p=1), nunca la contraseña', async () => {
    const hash = await hasher.hash(PASSWORD);

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain('$m=19456,t=2,p=1$');
    expect(hash).not.toContain(PASSWORD);
  });

  it('CA-01.11: usa una sal nueva en cada hash', async () => {
    expect(await hasher.hash(PASSWORD)).not.toBe(await hasher.hash(PASSWORD));
  });

  it('CA-01.2: verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hasher.hash(PASSWORD);

    expect(await hasher.verify(hash, PASSWORD)).toBe(true);
    expect(await hasher.verify(hash, 'demo2026!')).toBe(false);
  });

  it('CA-01.2: un hash mal formado devuelve false en lugar de lanzar', async () => {
    expect(await hasher.verify('no-es-un-hash', PASSWORD)).toBe(false);
    expect(await hasher.verify('', PASSWORD)).toBe(false);
  });
});
