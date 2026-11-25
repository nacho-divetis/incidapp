import { sql } from 'drizzle-orm';
import type { IncidentCodeCounter } from '../../../application/ports/incident-code-counter';
import type { Database } from '../client';
import { codeCounters } from '../schema';

/**
 * Adaptador Drizzle de `IncidentCodeCounter` (CA-03.4). Una sola sentencia atómica: crea el contador
 * del año con 1 o lo incrementa, y devuelve el valor. La fila queda bloqueada hasta el fin de la
 * transacción, así que dos altas a la vez no repiten número y un alta que se revierte no deja hueco.
 */
export function createDrizzleIncidentCodeCounter(db: Database): IncidentCodeCounter {
  return {
    async next(year) {
      const [row] = await db
        .insert(codeCounters)
        .values({ year, lastValue: 1 })
        .onConflictDoUpdate({
          target: codeCounters.year,
          set: { lastValue: sql`${codeCounters.lastValue} + 1` },
        })
        .returning({ lastValue: codeCounters.lastValue });
      if (!row) throw new Error(`No se ha podido reservar un código del año ${year}`);
      return row.lastValue;
    },
  };
}
