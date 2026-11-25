// CA-02.20 (confirmación) · ConfirmDialog: diálogo modal accesible (Radix AlertDialog) con el foco
// inicial en "Cancelar", que solo llama a `onConfirm` al confirmar de forma explícita.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../atoms';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';

const TEXTS = {
  title: '¿Desactivar a Marta Gil?',
  description: 'No podrá iniciar sesión.',
  confirmLabel: 'Desactivar',
  cancelLabel: 'Cancelar',
};

type Overrides = Partial<Omit<ConfirmDialogProps, 'open' | 'onOpenChange'>>;

/** Diálogo con estado y botón que lo abre, como lo usará un organismo. */
function WithTrigger({
  onOpenChange,
  ...props
}: Overrides & { onOpenChange?: (o: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <ConfirmDialog
      {...TEXTS}
      onConfirm={vi.fn()}
      {...props}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
      trigger={<Button>Desactivar usuario</Button>}
    />
  );
}

describe('ConfirmDialog', () => {
  it('CA-02.20: abierto, es un alertdialog con título y descripción y el foco en "Cancelar"', () => {
    render(<ConfirmDialog {...TEXTS} open onOpenChange={vi.fn()} onConfirm={vi.fn()} />);

    const dialog = screen.getByRole('alertdialog', { name: TEXTS.title });
    expect(dialog).toHaveAccessibleDescription(TEXTS.description);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('CA-02.20: el botón abre la confirmación sin ejecutar la acción; confirmar llama a onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<WithTrigger onConfirm={onConfirm} />);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar usuario' }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Confirmar no cierra el diálogo: lo cierra quien lo usa cuando termina la acción.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('CA-02.20: Enter sobre el foco inicial cancela, no confirma, y el foco vuelve al botón', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(<WithTrigger onConfirm={onConfirm} onOpenChange={onOpenChange} />);

    const trigger = screen.getByRole('button', { name: 'Desactivar usuario' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Enter}');

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('CA-02.20: Escape cierra sin confirmar', async () => {
    const onConfirm = vi.fn();
    render(<WithTrigger onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar usuario' }));
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('el foco queda atrapado dentro del diálogo', async () => {
    render(<WithTrigger />);

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar usuario' }));
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Desactivar' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('tone="danger": el botón de confirmar es de peligro', () => {
    render(
      <ConfirmDialog {...TEXTS} tone="danger" open onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Desactivar' })).toHaveClass('bg-danger');
  });

  it('tone por defecto: el botón de confirmar es el primario', () => {
    render(<ConfirmDialog {...TEXTS} open onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Desactivar' })).toHaveClass('bg-primary');
  });

  it('isConfirming: carga en confirmar, "Cancelar" deshabilitado y Escape no cierra', async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        {...TEXTS}
        open
        isConfirming
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Desactivar' });
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('sin trigger, al cerrar devuelve el foco al elemento que lo tenía antes de abrir', async () => {
    function WithoutTrigger() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <ConfirmDialog {...TEXTS} open={open} onOpenChange={setOpen} onConfirm={vi.fn()} />
        </>
      );
    }
    render(<WithoutTrigger />);

    const opener = screen.getByRole('button', { name: 'Abrir' });
    await userEvent.click(opener);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('confirmDisabled: confirmar no hace nada, pero "Cancelar" y Escape siguen cerrando', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        {...TEXTS}
        open
        confirmDisabled
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Desactivar' });
    expect(confirm).toBeDisabled();
    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('muestra el contenido extra dentro del diálogo', () => {
    render(
      <ConfirmDialog {...TEXTS} open onOpenChange={vi.fn()} onConfirm={vi.fn()}>
        <p>No se ha podido desactivar.</p>
      </ConfirmDialog>,
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent('No se ha podido desactivar.');
  });
});
