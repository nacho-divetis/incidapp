import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Button, Text } from '../../atoms';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';

/** Envoltorio con estado: el diálogo se abre y se cierra de verdad en Storybook. */
function Controlled(props: ConfirmDialogProps) {
  const [open, setOpen] = useState(props.open);
  return (
    <ConfirmDialog
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
  title: 'Moléculas/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
    tone: 'danger',
    title: '¿Desactivar a Marta Gil?',
    description:
      'No podrá iniciar sesión y se cerrarán sus sesiones abiertas. Podrás reactivarla más tarde.',
    confirmLabel: 'Desactivar',
    cancelLabel: 'Cancelar',
  },
  argTypes: {
    tone: { control: 'select', options: ['default', 'danger'] },
    trigger: { control: false },
    children: { control: false },
  },
  render: (args) => <Controlled {...args} />,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Acción destructiva: botón de peligro e icono de aviso. El foco empieza en "Cancelar". */
export const Peligro: Story = {};

export const PorDefecto: Story = {
  args: {
    tone: 'default',
    title: '¿Reactivar a Marta Gil?',
    description: 'Podrá volver a iniciar sesión con su contraseña actual.',
    confirmLabel: 'Reactivar',
  },
};

/** Acción en curso: carga en el botón de confirmar; no se puede cerrar. */
export const Confirmando: Story = { args: { isConfirming: true } };

/** Con contenido extra, como el error de un intento anterior (en la app, un `Alert`). */
export const ConError: Story = {
  args: {
    children: (
      <Text role="alert" variant="small" className="text-danger-fg">
        No se ha podido desactivar el usuario. Inténtalo de nuevo.
      </Text>
    ),
  },
};

/** Cerrado, con su botón: al cerrar, el foco vuelve al botón. */
export const ConBotón: Story = {
  args: {
    open: false,
    trigger: <Button variant="danger">Desactivar usuario</Button>,
  },
  parameters: { layout: 'padded' },
};
