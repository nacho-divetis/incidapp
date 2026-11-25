// CA-04.8 (diálogo de transición) · StatusTransitionDialog: diálogo accesible con el campo
// "Comentario", obligatorio solo si la transición lo exige (validado en el cliente), que conserva el
// comentario y muestra dentro el error de la API.
import { TRANSITION_COMMENT_MAX_LENGTH, type AllowedTransition } from '@incidapp/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StatusTransitionDialog, type StatusTransitionDialogProps } from './StatusTransitionDialog';

const RESOLVE: AllowedTransition = { to: 'RESOLVED', requiresComment: true };
const START: AllowedTransition = { to: 'IN_PROGRESS', requiresComment: false };
const REJECT: AllowedTransition = { to: 'REJECTED', requiresComment: true };

type Props = Partial<StatusTransitionDialogProps>;

function renderOpen(props: Props = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  const all: StatusTransitionDialogProps = {
    transition: RESOLVE,
    from: 'IN_PROGRESS',
    open: true,
    onOpenChange,
    onConfirm,
    ...props,
  };
  const view = render(<StatusTransitionDialog {...all} />);
  return { ...view, onConfirm, onOpenChange, props: all };
}

/** Botón que abre el diálogo, como lo usará la página con `IncidentStatusActions`. */
function WithOpener({ transition, ...props }: Props & { transition: AllowedTransition }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <StatusTransitionDialog
        from="IN_PROGRESS"
        onConfirm={vi.fn()}
        {...props}
        transition={transition}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

const comment = () => screen.getByRole('textbox', { name: /Comentario/ });
const confirmButton = (name = 'Marcar como resuelta') => screen.getByRole('button', { name });

describe('StatusTransitionDialog', () => {
  it('CA-04.8: es un diálogo con título, descripción, campo "Comentario" y el texto de la transición', () => {
    renderOpen();

    const dialog = screen.getByRole('alertdialog', { name: 'Cambiar el estado a Resuelta' });
    expect(dialog).toHaveAccessibleDescription('La incidencia pasará de En curso a Resuelta.');
    expect(comment()).toBeInTheDocument();
    expect(confirmButton()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('cerrado o sin transición, no pinta nada', () => {
    const { rerender, props } = renderOpen({ open: false });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    rerender(<StatusTransitionDialog {...props} open transition={null} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('CA-04.8: con comentario obligatorio, vacío no confirma y muestra el error junto al campo', async () => {
    const { onConfirm } = renderOpen();

    expect(comment()).toBeRequired();
    await userEvent.type(comment(), '   ');
    await userEvent.click(confirmButton());

    expect(onConfirm).not.toHaveBeenCalled();
    expect(comment()).toHaveAttribute('aria-invalid', 'true');
    expect(comment()).toHaveAccessibleDescription(
      expect.stringContaining('Esta transición requiere un comentario.'),
    );
    expect(comment()).toHaveFocus();
  });

  it('CA-04.8: con comentario obligatorio, confirma con el comentario sin espacios en los extremos', async () => {
    const { onConfirm } = renderOpen();

    await userEvent.click(confirmButton());
    expect(comment()).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(comment(), '  Cambiada la batería del lector.  ');
    // Al cambiar el texto, el error deja de mostrarse.
    expect(comment()).not.toHaveAttribute('aria-invalid');
    await userEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith('Cambiada la batería del lector.');
  });

  it('CA-04.8: con comentario opcional, se puede confirmar sin comentario', async () => {
    const { onConfirm } = renderOpen({ transition: START, from: 'OPEN' });

    expect(comment()).not.toBeRequired();
    expect(comment()).toHaveAccessibleDescription(expect.stringContaining('Opcional.'));
    await userEvent.click(confirmButton('Empezar'));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('CA-04.8: con comentario opcional, lo envía si se escribe', async () => {
    const { onConfirm } = renderOpen({ transition: START, from: 'OPEN' });

    await userEvent.type(comment(), 'Empiezo esta tarde.');
    await userEvent.click(confirmButton('Empezar'));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith('Empiezo esta tarde.');
  });

  it(`un comentario de más de ${TRANSITION_COMMENT_MAX_LENGTH} caracteres no se envía`, async () => {
    const { onConfirm } = renderOpen({ transition: START, from: 'OPEN' });

    await userEvent.click(comment());
    await userEvent.paste('a'.repeat(TRANSITION_COMMENT_MAX_LENGTH + 1));
    await userEvent.click(confirmButton('Empezar'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(comment()).toHaveAccessibleDescription(
      expect.stringContaining(
        `El comentario no puede tener más de ${TRANSITION_COMMENT_MAX_LENGTH} caracteres.`,
      ),
    );
  });

  it('CA-04.8: si la API falla, el error se ve dentro del diálogo y el comentario se conserva', async () => {
    const { rerender, props, onConfirm } = renderOpen();

    await userEvent.type(comment(), 'Reparado.');
    await userEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledOnce();

    rerender(<StatusTransitionDialog {...props} isSubmitting />);
    expect(confirmButton()).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(
      <StatusTransitionDialog
        {...props}
        isSubmitting={false}
        errorMessage="No se puede pasar de Rechazada a En curso."
      />,
    );
    const dialog = screen.getByRole('alertdialog');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se puede pasar de Rechazada a En curso.',
    );
    expect(dialog).toContainElement(screen.getByRole('alert'));
    expect(comment()).toHaveValue('Reparado.');
  });

  it('no muestra un error de la API anterior a abrir el diálogo', () => {
    renderOpen({ errorMessage: 'Error de un intento anterior.' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('isSubmitting: carga en confirmar, campo deshabilitado y Escape no cierra', async () => {
    const { onOpenChange } = renderOpen({ isSubmitting: true });

    expect(confirmButton()).toBeDisabled();
    expect(comment()).toBeDisabled();
    await userEvent.keyboard('{Escape}');

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('CA-04.8: Escape cierra sin confirmar y el foco vuelve al botón que lo abrió', async () => {
    const onConfirm = vi.fn();
    render(<WithOpener transition={RESOLVE} onConfirm={onConfirm} />);

    const opener = screen.getByRole('button', { name: 'Abrir' });
    await userEvent.click(opener);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it('CA-04.8: el foco queda atrapado dentro del diálogo', async () => {
    render(<WithOpener transition={RESOLVE} />);

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    // Foco inicial en "Cancelar" (como en ConfirmDialog); Tab recorre solo el diálogo.
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await userEvent.tab();
    expect(confirmButton()).toHaveFocus();
    await userEvent.tab();
    expect(comment()).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('al volver a abrirlo, el comentario y los errores empiezan vacíos', async () => {
    render(<WithOpener transition={RESOLVE} />);

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await userEvent.click(confirmButton());
    await userEvent.type(comment(), 'Texto a medias');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(comment()).toHaveValue('');
    expect(comment()).not.toHaveAttribute('aria-invalid');
  });

  it('"Rechazar" usa el tono de peligro', () => {
    renderOpen({ transition: REJECT, from: 'OPEN' });

    expect(
      screen.getByRole('alertdialog', { name: 'Cambiar el estado a Rechazada' }),
    ).toBeInTheDocument();
    expect(confirmButton('Rechazar')).toHaveClass('bg-danger');
  });
});
