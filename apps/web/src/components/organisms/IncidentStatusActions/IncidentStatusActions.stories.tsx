import { Status } from '@incidapp/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { IncidentStatusActions } from './IncidentStatusActions';

// Cada story usa las transiciones que la API devolvería a un Responsable de su departamento
// (`allowedTransitions`); el organismo solo pinta lo que recibe.
const meta = {
  title: 'Organismos/IncidentStatusActions',
  component: IncidentStatusActions,
  args: { onSelect: fn(), status: 'OPEN', transitions: [] },
  argTypes: { status: { control: 'select', options: Status.options } },
} satisfies Meta<typeof IncidentStatusActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sin transiciones (Dirección, o una incidencia rechazada): no se pinta nada. */
export const SinTransiciones: Story = { args: { status: 'REJECTED', transitions: [] } };

/** Abierta: empezar o rechazar (gestión, con comentario). */
export const DesdeAbierta: Story = {
  args: {
    status: 'OPEN',
    transitions: [
      { to: 'IN_PROGRESS', requiresComment: false },
      { to: 'REJECTED', requiresComment: true },
    ],
  },
};

/** Abierta, para un Usuario creador: solo la transición operativa. */
export const DesdeAbiertaUsuario: Story = {
  args: { status: 'OPEN', transitions: [{ to: 'IN_PROGRESS', requiresComment: false }] },
};

/** En curso: pendiente de tercero o resolver (con comentario). */
export const DesdeEnCurso: Story = {
  args: {
    status: 'IN_PROGRESS',
    transitions: [
      { to: 'PENDING_THIRD_PARTY', requiresComment: false },
      { to: 'RESOLVED', requiresComment: true },
    ],
  },
};

/** Pendiente de tercero: reanudar. */
export const DesdePendienteDeTercero: Story = {
  args: {
    status: 'PENDING_THIRD_PARTY',
    transitions: [{ to: 'IN_PROGRESS', requiresComment: false }],
  },
};

/** Resuelta: devolver a en curso (con comentario) o cerrar. */
export const DesdeResuelta: Story = {
  args: {
    status: 'RESOLVED',
    transitions: [
      { to: 'IN_PROGRESS', requiresComment: true },
      { to: 'CLOSED', requiresComment: false },
    ],
  },
};

/** Cerrada: reabrir (con comentario). */
export const DesdeCerrada: Story = {
  args: { status: 'CLOSED', transitions: [{ to: 'REOPENED', requiresComment: true }] },
};

/** Reabierta: empezar de nuevo. */
export const DesdeReabierta: Story = {
  args: { status: 'REOPENED', transitions: [{ to: 'IN_PROGRESS', requiresComment: false }] },
};

/** Con un cambio en curso: botones deshabilitados. */
export const Deshabilitadas: Story = {
  args: { ...DesdeAbierta.args, disabled: true },
};
