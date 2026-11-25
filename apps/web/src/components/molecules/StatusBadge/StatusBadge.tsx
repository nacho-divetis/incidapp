import type { Status } from '@incidapp/shared';
import { STATUS_LABELS } from '@/lib/labels';
import { Badge, type BadgeProps } from '../../atoms';

/** Tono de la insignia de cada estado. El color solo refuerza: el estado está en el texto. */
const STATUS_TONES = {
  OPEN: 'info',
  IN_PROGRESS: 'primary',
  PENDING_THIRD_PARTY: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  REJECTED: 'danger',
  REOPENED: 'info',
} as const satisfies Record<Status, NonNullable<BadgeProps['tone']>>;

export interface StatusBadgeProps extends Omit<BadgeProps, 'tone' | 'children'> {
  /** Estado de la incidencia. */
  status: Status;
}

/**
 * Insignia del estado de una incidencia: `Badge` con el texto en español (`STATUS_LABELS`) y un tono
 * por estado. La usan el listado y el detalle (F03) y el historial (F04).
 */
export function StatusBadge({ status, ...props }: StatusBadgeProps) {
  return (
    <Badge tone={STATUS_TONES[status]} {...props}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
