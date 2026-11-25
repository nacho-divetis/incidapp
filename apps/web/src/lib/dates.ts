/**
 * Formato de fechas de la interfaz (RNF-14): `dd/mm/aaaa`, en la zona `Europe/Madrid`.
 *
 * - Las fechas sin hora (`AAAA-MM-DD`, como la fecha objetivo) se muestran tal cual, sin pasar por
 *   ninguna zona horaria: el 2026-11-30 es el 30/11/2026 en cualquier navegador.
 * - Las marcas de tiempo (ISO en UTC, como `createdAt`) se pasan a la hora de Madrid antes de
 *   formatearlas, así que una incidencia creada el 31/12 a las 23:30 UTC aparece el 01/01.
 */

/** Zona horaria de la aplicación. */
export const APP_TIME_ZONE = 'Europe/Madrid';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const dateTimeParts = new Intl.DateTimeFormat('es-ES', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Día, mes, año, hora y minuto de una marca de tiempo en la zona de la aplicación. */
function madridParts(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Fecha no válida: ${iso}`);
  const parts = Object.fromEntries(
    dateTimeParts.formatToParts(date).map((part) => [part.type, part.value]),
  ) as Record<Intl.DateTimeFormatPartTypes, string>;
  return parts;
}

/** `AAAA-MM-DD` o marca de tiempo ISO → `dd/mm/aaaa` (en `Europe/Madrid` si tiene hora). */
export function formatDate(value: string): string {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return `${day}/${month}/${year}`;
  }
  const { day, month, year } = madridParts(value);
  return `${day}/${month}/${year}`;
}

/** Marca de tiempo ISO → `dd/mm/aaaa HH:mm` en `Europe/Madrid`. */
export function formatDateTime(iso: string): string {
  const { day, month, year, hour, minute } = madridParts(iso);
  return `${day}/${month}/${year} ${hour}:${minute}`;
}
