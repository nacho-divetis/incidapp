import type { AllowedTransition, Status } from '@incidapp/shared';
import { cn } from '@/lib/cn';
import { transitionLabel } from '@/lib/labels';
import { Button } from '../../atoms';

/**
 * Botones de cambio de estado de una incidencia (CA-04.8): uno por cada transición de
 * `transitions`, con su texto en español ("Empezar", "Marcar como resuelta", "Cerrar"…).
 *
 * - **Permisos:** `transitions` es `allowedTransitions` de la API tal cual. El organismo no mira el
 *   rol ni el estado para decidir qué botones hay; `status` solo sirve para elegir el texto de cada
 *   uno. Con la lista vacía no pinta nada.
 * - "Rechazar" (destino `REJECTED`) es un botón de peligro; los demás, secundarios.
 * - Pulsar un botón no cambia nada: llama a `onSelect(transition)` para que quien lo usa abra el
 *   diálogo de confirmación (`StatusTransitionDialog`).
 *
 * Presentacional: va en el hueco `actions` del resumen de la incidencia.
 */
export interface IncidentStatusActionsProps {
  /** Estado actual de la incidencia (origen de las transiciones). */
  status: Status;
  /** Transiciones que la API permite al usuario (`Incident.allowedTransitions`). */
  transitions: AllowedTransition[];
  /** Se llama con la transición elegida. */
  onSelect: (transition: AllowedTransition) => void;
  /** Deshabilita todos los botones (p. ej., mientras se envía un cambio). */
  disabled?: boolean;
  className?: string;
}

export function IncidentStatusActions({
  status,
  transitions,
  onSelect,
  disabled = false,
  className,
}: IncidentStatusActionsProps) {
  if (transitions.length === 0) return null;

  return (
    <div
      role="group"
      aria-label="Cambiar el estado"
      className={cn('flex flex-wrap gap-2', className)}
    >
      {transitions.map((transition) => (
        <Button
          key={transition.to}
          variant={transition.to === 'REJECTED' ? 'danger' : 'secondary'}
          disabled={disabled}
          onClick={() => onSelect(transition)}
        >
          {transitionLabel(status, transition.to)}
        </Button>
      ))}
    </div>
  );
}
