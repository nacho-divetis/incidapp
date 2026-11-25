import {
  TRANSITION_COMMENT_MAX_LENGTH,
  TransitionInput,
  type AllowedTransition,
  type Status,
} from '@incidapp/shared';
import { useId, useRef, useState } from 'react';
import { STATUS_LABELS, transitionLabel } from '@/lib/labels';
import { Textarea } from '../../atoms';
import { Alert, ConfirmDialog, FormField } from '../../molecules';

/** Mensaje si falta el comentario obligatorio (el mismo que da la API, CA-04.3). */
export const TRANSITION_COMMENT_REQUIRED = 'Esta transición requiere un comentario.';

/**
 * Diálogo para confirmar un cambio de estado (CA-04.8), con un campo "Comentario".
 *
 * - Sobre `ConfirmDialog` (Radix `AlertDialog`): modal, foco atrapado, `Escape` y "Cancelar" cierran
 *   sin hacer nada, y el foco vuelve al botón que lo abrió.
 * - Título "Cambiar el estado a <estado>", la descripción dice de qué estado a cuál pasa y el botón
 *   de confirmar lleva el texto de la transición ("Marcar como resuelta"). "Rechazar" es de peligro.
 * - **Comentario:** obligatorio solo si `transition.requiresComment` (lo dice la API). Se valida en
 *   el cliente con `TransitionInput` de `shared` (espacios de los extremos fuera, máximo
 *   2000 caracteres) y la regla de obligatoriedad; el error va junto al campo (`aria-invalid` y
 *   `aria-describedby`) y el foco vuelve al campo. Si es válido, llama a `onConfirm(comment)` con el
 *   comentario ya normalizado (`undefined` si está vacío).
 * - **Confirmar no cierra el diálogo:** quien lo usa lo cierra (`open=false`) cuando la API responde
 *   bien. Mientras `isSubmitting`, carga en el botón y no se puede cerrar. Si la API falla,
 *   `errorMessage` se muestra dentro del diálogo y el comentario se conserva para reintentar.
 * - Cada vez que se abre, el comentario y los errores empiezan vacíos.
 *
 * Presentacional: no hace la petición ni decide qué transiciones existen.
 */
export interface StatusTransitionDialogProps {
  /** Transición elegida (de `allowedTransitions`); `null` si no hay ninguna. */
  transition: AllowedTransition | null;
  /** Estado actual de la incidencia. */
  from: Status;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama al confirmar con un comentario válido (`undefined` si no hay comentario). */
  onConfirm: (comment?: string) => void;
  /** La petición está en curso. */
  isSubmitting?: boolean;
  /** Error de la API al cambiar el estado, ya en español. */
  errorMessage?: string;
}

/** Comentario tal como se envió y su error de validación (si lo tenía). */
interface Validation {
  value: string;
  error?: string;
}

/** Valida el comentario para `transition`: devuelve el comentario normalizado o el error. */
function validateComment(
  transition: AllowedTransition,
  value: string,
): { comment?: string; error?: string } {
  const result = TransitionInput.safeParse({ to: transition.to, comment: value });
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'El comentario no es válido.' };
  }
  if (transition.requiresComment && result.data.comment === undefined) {
    return { error: TRANSITION_COMMENT_REQUIRED };
  }
  return { comment: result.data.comment };
}

export function StatusTransitionDialog({
  transition,
  from,
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
  errorMessage,
}: StatusTransitionDialogProps) {
  const commentId = `${useId()}-comment`;
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const isOpen = open && transition !== null;

  const [comment, setComment] = useState('');
  const [validation, setValidation] = useState<Validation | null>(null);
  // El error de la API solo se muestra si se ha confirmado desde que se abrió (no uno anterior).
  const [confirmedInDialog, setConfirmedInDialog] = useState(false);

  // Al abrirse (o cambiar de transición estando abierto), el formulario empieza vacío.
  const [openedFor, setOpenedFor] = useState<Status | null>(null);
  const currentTarget = isOpen ? transition.to : null;
  if (openedFor !== currentTarget) {
    setOpenedFor(currentTarget);
    if (currentTarget !== null) {
      setComment('');
      setValidation(null);
      setConfirmedInDialog(false);
    }
  }

  // El error de validación se ve mientras el campo conserva el valor que se intentó enviar.
  const fieldError = validation?.value === comment ? validation.error : undefined;

  function handleConfirm() {
    if (!transition || isSubmitting) return;
    const result = validateComment(transition, comment);
    setValidation({ value: comment, error: result.error });
    if (result.error) {
      commentRef.current?.focus();
      return;
    }
    setConfirmedInDialog(true);
    onConfirm(result.comment);
  }

  const to = transition?.to;
  const requiresComment = transition?.requiresComment ?? false;

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      tone={to === 'REJECTED' ? 'danger' : 'default'}
      title={to ? `Cambiar el estado a ${STATUS_LABELS[to]}` : ''}
      description={
        to ? `La incidencia pasará de ${STATUS_LABELS[from]} a ${STATUS_LABELS[to]}.` : ''
      }
      confirmLabel={to ? transitionLabel(from, to) : ''}
      cancelLabel="Cancelar"
      onConfirm={handleConfirm}
      isConfirming={isSubmitting}
      confirmDisabled={!transition}
    >
      {errorMessage && confirmedInDialog && !isSubmitting && (
        <Alert tone="danger">{errorMessage}</Alert>
      )}
      <FormField
        label="Comentario"
        htmlFor={commentId}
        required={requiresComment}
        error={fieldError}
        hint={`${requiresComment ? 'Obligatorio' : 'Opcional'}. Máximo ${TRANSITION_COMMENT_MAX_LENGTH} caracteres.`}
      >
        <Textarea
          ref={commentRef}
          name="comment"
          value={comment}
          disabled={isSubmitting}
          onChange={(event) => setComment(event.target.value)}
        />
      </FormField>
    </ConfirmDialog>
  );
}
