// Adaptador de `PasswordHasher` con argon2id (`@node-rs/argon2`: binarios precompilados, sin node-gyp).
import { hash, verify, type Algorithm, type Options } from '@node-rs/argon2';
import type { PasswordHasher } from '../../application/ports/password-hasher';

// `Algorithm` es un `const enum` ambiental: con `isolatedModules` no se puede leer su valor, así
// que se usa el literal de `Algorithm.Argon2id` (2) con el tipo del enum.
const ARGON2ID: Algorithm.Argon2id = 2;

/** Parámetros mínimos recomendados por OWASP para argon2id: 19 MiB, 2 pasadas y 1 hilo. */
export const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const satisfies Options;

export function createArgon2PasswordHasher(): PasswordHasher {
  return {
    hash: (password) => hash(password, ARGON2_OPTIONS),
    async verify(passwordHash, password) {
      try {
        return await verify(passwordHash, password);
      } catch {
        // Un hash mal formado no debe tumbar el login: simplemente no coincide.
        return false;
      }
    },
  };
}
