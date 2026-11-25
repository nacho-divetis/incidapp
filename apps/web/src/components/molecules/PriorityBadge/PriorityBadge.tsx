import type { Priority } from '@incidapp/shared';
import { PRIORITY_LABELS } from '@/lib/labels';
import { Badge, type BadgeProps } from '../../atoms';

/** Tono de la insignia de cada prioridad. El color solo refuerza: la prioridad está en el texto. */
const PRIORITY_TONES = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
} as const satisfies Record<Priority, NonNullable<BadgeProps['tone']>>;

export interface PriorityBadgeProps extends Omit<BadgeProps, 'tone' | 'children'> {
  /** Prioridad de la incidencia. */
  priority: Priority;
}

/**
 * Insignia de la prioridad de una incidencia: `Badge` con el texto en español (`PRIORITY_LABELS`) y
 * un tono que sube con la prioridad (Urgente = peligro, Alta = aviso…).
 */
export function PriorityBadge({ priority, ...props }: PriorityBadgeProps) {
  return (
    <Badge tone={PRIORITY_TONES[priority]} {...props}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
