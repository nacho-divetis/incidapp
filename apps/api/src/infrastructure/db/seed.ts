// Datos mínimos de la empresa ficticia. Idempotente: se puede ejecutar tantas veces como se quiera.
import type { Database } from './client';
import { departments } from './schema';

/** Los 9 departamentos de la empresa ficticia (ver `docs/requisitos.md`). */
export const DEPARTMENTS = [
  { code: 'DIR', name: 'Dirección' },
  { code: 'ADM', name: 'Administración y Finanzas' },
  { code: 'COM', name: 'Comercial' },
  { code: 'ATC', name: 'Atención al Cliente / Postventa' },
  { code: 'COMP', name: 'Compras' },
  { code: 'LOG', name: 'Logística y Almacén' },
  { code: 'PROD', name: 'Producción / Operaciones' },
  { code: 'TEC', name: 'Departamento Técnico' },
  { code: 'CAL', name: 'Calidad' },
] as const;

export async function seedDatabase(db: Database): Promise<void> {
  await db
    .insert(departments)
    .values([...DEPARTMENTS])
    .onConflictDoNothing({ target: departments.code });
}
