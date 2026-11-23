import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind: acepta condiciones (`clsx`) y resuelve los conflictos dejando la
 * última (`tailwind-merge`), p. ej. `cn('p-2', 'p-4')` → `'p-4'`. La pueden usar todos los niveles.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
