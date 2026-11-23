import type { CurrentUser } from '@incidapp/shared';
import { cn } from '@/lib/cn';
import { ROLE_LABELS } from '@/lib/labels';
import { Badge, Button, Icon } from '../../atoms';

/** Datos del usuario que muestra la cabecera (subconjunto de `CurrentUser` de `shared`). */
export type AppHeaderUser = Pick<CurrentUser, 'name' | 'role'>;

/**
 * Contenido de la cabecera de las pantallas con sesión (CA-01.15): nombre de la aplicación a la
 * izquierda y, a la derecha, el nombre del usuario, su rol en español y el botón "Cerrar sesión".
 *
 * Va dentro del hueco `header` de `AppLayout`, que ya pone el *landmark* `<header>`: aquí no se
 * repite. El nombre de la aplicación no es un encabezado (el `h1` es de cada página). Con
 * `isLoggingOut`, el botón queda en carga y no se puede volver a pulsar.
 */
export interface AppHeaderProps {
  /** Nombre de la aplicación. */
  appName: string;
  /** Usuario con sesión. */
  user: AppHeaderUser;
  /** Se llama al pulsar "Cerrar sesión". */
  onLogout: () => void;
  /** Cierre de sesión en curso. */
  isLoggingOut?: boolean;
  className?: string;
}

export function AppHeader({
  appName,
  user,
  onLogout,
  isLoggingOut = false,
  className,
}: AppHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6',
        className,
      )}
    >
      <p className="text-lg font-semibold text-primary">{appName}</p>

      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <p className="flex min-w-0 items-center gap-2">
          <Icon name="user" size="sm" className="text-fg-muted" />
          <span className="sr-only">Sesión iniciada como </span>
          <span className="truncate font-medium text-fg">{user.name}</span>
          <span className="sr-only">, rol </span>
          <Badge tone="primary" className="shrink-0">
            {ROLE_LABELS[user.role]}
          </Badge>
        </p>
        <Button
          variant="secondary"
          size="sm"
          loading={isLoggingOut}
          leftIcon={<Icon name="log-out" size="sm" />}
          onClick={onLogout}
        >
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
