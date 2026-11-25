// Orden alfabético en español. La colación de PGlite y de Neon (`C.UTF-8`) ordena por bytes y deja
// las palabras con tilde detrás de la "z" ("Técnica" después de "Transporte"); para listas cortas
// (catálogos, candidatos a asignar) se ordena aquí.
const collator = new Intl.Collator('es', { sensitivity: 'base' });

/** Copia de `items` ordenada por `name` en español (y por `id` si empatan). */
export function sortByName<T extends { id: string; name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id));
}
