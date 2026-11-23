import type { Clock } from '../../application/ports/clock';

/** Reloj real del sistema. En los tests se inyecta uno fijo. */
export const systemClock: Clock = {
  now: () => new Date(),
};
