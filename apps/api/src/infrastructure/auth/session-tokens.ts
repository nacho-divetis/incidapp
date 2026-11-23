// Adaptador de `SessionTokens`: 32 bytes aleatorios en base64url para la cookie y su SHA-256
// en hexadecimal como identificador en la BD (ADR-003). El token en claro nunca se guarda.
import { createHash, randomBytes } from 'node:crypto';
import type { SessionTokens } from '../../application/ports/session-tokens';

const TOKEN_BYTES = 32;

export function createSessionTokens(): SessionTokens {
  return {
    generate: () => randomBytes(TOKEN_BYTES).toString('base64url'),
    idFor: (token) => createHash('sha256').update(token).digest('hex'),
  };
}
