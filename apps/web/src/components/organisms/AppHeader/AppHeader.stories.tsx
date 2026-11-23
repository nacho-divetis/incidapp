import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { AppHeader } from './AppHeader';

const meta = {
  title: 'Organismos/AppHeader',
  component: AppHeader,
  args: {
    appName: 'IncidApp',
    user: { name: 'Elena Ruiz', role: 'ADMIN' },
    onLogout: fn(),
  },
  decorators: [
    (Story) => (
      <div className="border-b border-border bg-surface">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Admin: Story = {};
export const Dirección: Story = { args: { user: { name: 'Javier Ortega', role: 'DIRECTOR' } } };
export const Responsable: Story = { args: { user: { name: 'Carmen Vidal', role: 'MANAGER' } } };
export const Usuario: Story = { args: { user: { name: 'Pablo Moreno', role: 'USER' } } };

/** Esperando la respuesta de `POST /api/auth/logout`. */
export const CerrandoSesión: Story = { args: { isLoggingOut: true } };

/** Nombre largo en un ancho de móvil: se recorta sin desplazamiento horizontal. */
export const NombreLargoEnMóvil: Story = {
  args: { user: { name: 'María de los Ángeles Fernández-Castillo', role: 'MANAGER' } },
  decorators: [
    (Story) => (
      <div className="max-w-80">
        <Story />
      </div>
    ),
  ],
};
