import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Heading, Text } from '../../atoms';

/**
 * Cabecera de una página: título principal (`h1`), una descripción opcional y un hueco `actions`
 * para los botones o enlaces de la página (p. ej., "Nuevo usuario"). En móvil, las acciones van
 * debajo del título; desde `sm`, a su derecha.
 *
 * Sin textos propios: título, descripción y acciones llegan por props.
 */
export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Título de la página (`h1`). */
  title: ReactNode;
  /** Texto secundario bajo el título. */
  description?: ReactNode;
  /** Acciones de la página (botones o enlaces). */
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <Heading level={1}>{title}</Heading>
        {description && <Text variant="muted">{description}</Text>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
