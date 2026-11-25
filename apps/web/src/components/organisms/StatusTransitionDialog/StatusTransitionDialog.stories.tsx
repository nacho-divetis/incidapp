import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn, userEvent, within } from 'storybook/test';
import { StatusTransitionDialog, type StatusTransitionDialogProps } from './StatusTransitionDialog';

/** Envoltorio con estado: el diálogo se abre y se cierra de verdad en Storybook. */
function Controlled(props: StatusTransitionDialogProps) {
  const [open, setOpen] = useState(props.open);
  return (
    <StatusTransitionDialog
      {...props}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        props.onOpenChange(next);
      }}
    />
  );
}

const meta = {
  title: 'Organismos/StatusTransitionDialog',
  component: StatusTransitionDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
    from: 'IN_PROGRESS',
    transition: { to: 'RESOLVED', requiresComment: true },
  },
  render: (args) => <Controlled {...args} />,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof StatusTransitionDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** EN CURSO → RESUELTA: el comentario es obligatorio (asterisco y error si se confirma vacío). */
export const ComentarioObligatorio: Story = {};

/** ABIERTA → EN CURSO: el comentario es opcional. */
export const ComentarioOpcional: Story = {
  args: { from: 'OPEN', transition: { to: 'IN_PROGRESS', requiresComment: false } },
};

/** ABIERTA → RECHAZADA: tono de peligro y comentario obligatorio. */
export const Rechazar: Story = {
  args: { from: 'OPEN', transition: { to: 'REJECTED', requiresComment: true } },
};

/** CERRADA → REABIERTA: comentario obligatorio. */
export const Reabrir: Story = {
  args: { from: 'CLOSED', transition: { to: 'REOPENED', requiresComment: true } },
};

/** Petición en curso: carga en el botón, campo deshabilitado y no se puede cerrar. */
export const Enviando: Story = { args: { isSubmitting: true } };

/** Comentario obligatorio enviado vacío: error de validación junto al campo y foco en él. */
export const ComentarioVacío: Story = {
  play: async ({ canvasElement }) => {
    // El diálogo se pinta en un portal, fuera del lienzo de la story.
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole('button', { name: 'Marcar como resuelta' }));
  },
};

/**
 * Error de la API dentro del diálogo, con el comentario conservado. El diálogo solo enseña el error
 * de un intento hecho desde que se abrió, así que la story escribe el comentario y confirma.
 */
export const ErrorDeLaApi: Story = {
  args: { errorMessage: 'No se ha podido cambiar el estado. Inténtalo de nuevo.' },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.type(
      page.getByRole('textbox', { name: /Comentario/ }),
      'Cambiada la batería del lector de códigos.',
    );
    await userEvent.click(page.getByRole('button', { name: 'Marcar como resuelta' }));
  },
};
