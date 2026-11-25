// Código legible de una incidencia: `INC-AAAA-NNNN` (RF-08). TypeScript puro: usa `Intl`, que es
// parte del lenguaje, no de Node.

/** Zona horaria de la empresa ficticia: el año del código es el de Madrid, no el de UTC. */
const INCIDENT_TIME_ZONE = 'Europe/Madrid';

const yearFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: INCIDENT_TIME_ZONE,
  year: 'numeric',
});

/** Año de la fecha de alta en `Europe/Madrid` (decisión 5 de F03). */
export function incidentYear(date: Date): number {
  return Number(yearFormat.format(date));
}

/** `INC-2026-0001`: el número, rellenado con ceros a 4 cifras como mínimo. */
export function formatIncidentCode(year: number, n: number): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`El número de una incidencia debe ser un entero positivo: ${n}`);
  }
  return `INC-${year}-${String(n).padStart(4, '0')}`;
}
