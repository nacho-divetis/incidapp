import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useRef, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button, Heading, Icon, Text } from '../../atoms';

/**
 * Diálogo de confirmación modal para acciones que hay que confirmar de forma explícita (p. ej.,
 * desactivar un usuario). Usa `AlertDialog` de Radix: foco atrapado dentro, `Escape` para cancelar,
 * `role="alertdialog"` con título y descripción enlazados, y el resto de la página inerte.
 *
 * - **Controlado:** `open` y `onOpenChange`. Si se pasa `trigger` (un botón), abrirlo lo gestiona Radix
 *   y el foco vuelve a él al cerrar; sin `trigger`, quien lo usa abre el diálogo con `open` y el foco
 *   vuelve al elemento que lo tenía antes de abrirlo (si sigue en la página).
 * - **Foco inicial en "Cancelar"**, para que un `Enter` despistado no ejecute la acción.
 * - **Confirmar no cierra el diálogo:** llama a `onConfirm` y quien lo usa lo cierra (`open=false`)
 *   cuando la acción termina. Mientras `isConfirming`, el botón de confirmar muestra la carga y el
 *   diálogo no se puede cerrar (ni con "Cancelar" ni con `Escape`).
 * - `confirmDisabled`: el botón de confirmar queda deshabilitado (no hay nada que confirmar todavía).
 * - `children`: contenido entre la descripción y los botones, como un campo o un `Alert` de error.
 * - `tone="danger"`: botón de confirmar de peligro e icono de aviso junto al título.
 *
 * Sin textos propios: título, descripción y textos de los botones llegan por props.
 */
export type ConfirmDialogTone = 'default' | 'danger';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título del diálogo (nombre accesible). */
  title: ReactNode;
  /** Qué va a pasar y sus consecuencias (descripción accesible). */
  description: ReactNode;
  /** Texto del botón que ejecuta la acción. */
  confirmLabel: ReactNode;
  /** Texto del botón que cierra sin hacer nada. */
  cancelLabel: ReactNode;
  onConfirm: () => void;
  /** La acción está en curso: carga en el botón y el diálogo no se cierra. */
  isConfirming?: boolean;
  /** Deshabilita el botón de confirmar (sin afectar a "Cancelar" ni a `Escape`). */
  confirmDisabled?: boolean;
  tone?: ConfirmDialogTone;
  /** Botón que abre el diálogo (opcional). Debe ser un único elemento que reenvíe `ref`. */
  trigger?: ReactElement;
  /** Contenido extra entre la descripción y los botones (p. ej., un campo o un `Alert` de error). */
  children?: ReactNode;
  className?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  isConfirming = false,
  confirmDisabled = false,
  tone = 'default',
  trigger,
  children,
  className,
}: ConfirmDialogProps) {
  // Elemento con el foco antes de abrir, para devolvérselo al cerrar.
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const isDanger = tone === 'danger';

  function handleOpenChange(next: boolean) {
    if (!next && isConfirming) return;
    onOpenChange(next);
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      {trigger && <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-fg/50" />
        <AlertDialog.Content
          onOpenAutoFocus={() => {
            // Sin `preventDefault`: Radix sigue llevando el foco a "Cancelar".
            const active = document.activeElement;
            previouslyFocused.current = active instanceof HTMLElement ? active : null;
          }}
          onCloseAutoFocus={(event) => {
            const target = previouslyFocused.current;
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
          className={cn(
            'fixed inset-x-4 top-1/2 z-50 mx-auto flex max-h-full max-w-md -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg focus-visible:focus-ring',
            className,
          )}
        >
          <div className="flex items-start gap-3">
            {isDanger && <Icon name="warning" size="lg" className="text-danger" />}
            <div className="flex min-w-0 flex-col gap-2">
              <AlertDialog.Title asChild>
                <Heading level={3} as="h2">
                  {title}
                </Heading>
              </AlertDialog.Title>
              <AlertDialog.Description asChild>
                <Text variant="muted">{description}</Text>
              </AlertDialog.Description>
            </div>
          </div>
          {children}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={isConfirming}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={isDanger ? 'danger' : 'primary'}
              loading={isConfirming}
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
