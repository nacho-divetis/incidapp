import type { ElementType } from 'react';
import { cn } from '@/lib/cn';
import { Icon, Link, Text } from '../../atoms';
import { Alert, PageHeader } from '../../molecules';

export interface IncidentLoadErrorProps {
  /**
   * La incidencia no existe, no es visible o el id no es válido (la API responde 404 en los tres
   * casos): el título pasa a ser `notFoundTitle` y no se muestra `errorMessage`.
   */
  notFound: boolean;
  /** Título de la página cuando el error no es un 404 (p. ej. "Editar incidencia"). */
  title: string;
  /** Mensaje del error en español (para cualquier error que no sea un 404). */
  errorMessage?: string;
  /** Destino del enlace de vuelta al listado. */
  backHref: string;
  /** Componente de enlace del enrutador; recibe el destino en `to`. */
  linkAs?: ElementType;
  /** Título con un 404. */
  notFoundTitle?: string;
  /** Texto del enlace de vuelta. */
  backLabel?: string;
  className?: string;
}

/**
 * Estado de error al cargar una incidencia en el detalle o la edición (CA-03.14): con un 404,
 * "Incidencia no encontrada."; con otro error, el título de la página y un `Alert` con el mensaje.
 * Siempre con un enlace al listado.
 *
 * Presentacional: la página decide si es un 404 a partir del error de la API y le pasa el mensaje.
 */
export function IncidentLoadError({
  notFound,
  title,
  errorMessage,
  backHref,
  linkAs,
  notFoundTitle = 'Incidencia no encontrada.',
  backLabel = 'Volver al listado de incidencias',
  className,
}: IncidentLoadErrorProps) {
  const backTarget = linkAs ? { as: linkAs, to: backHref } : { href: backHref };
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <PageHeader title={notFound ? notFoundTitle : title} />
      {!notFound && errorMessage && <Alert tone="danger">{errorMessage}</Alert>}
      <Text>
        <Link {...backTarget} className="inline-flex items-center gap-1">
          <Icon name="arrow-left" size="sm" />
          {backLabel}
        </Link>
      </Text>
    </div>
  );
}
