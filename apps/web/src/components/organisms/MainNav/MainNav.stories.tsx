import type { Meta, StoryObj } from '@storybook/react-vite';
import { MainNav } from './MainNav';

const meta = {
  title: 'Organismos/MainNav',
  component: MainNav,
  args: {
    items: [
      { label: 'Inicio', href: '#inicio', current: true, icon: 'dashboard' },
      { label: 'Usuarios', href: '#usuarios', current: false, icon: 'users' },
    ],
  },
  // En la aplicación va dentro del `<nav>` de `AppLayout`; aquí se reproduce ese contenedor.
  decorators: [
    (Story) => (
      <nav aria-label="Navegación principal" className="max-w-60 border border-border bg-surface">
        <Story />
      </nav>
    ),
  ],
} satisfies Meta<typeof MainNav>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Admin (con `manageUsers`) en la página de inicio. */
export const EnInicio: Story = {};

/** Admin en la gestión de usuarios: "Usuarios" es la página actual. */
export const EnUsuarios: Story = {
  args: {
    items: [
      { label: 'Inicio', href: '#inicio', current: false, icon: 'dashboard' },
      { label: 'Usuarios', href: '#usuarios', current: true, icon: 'users' },
    ],
  },
};

/** Usuario sin `manageUsers`: solo "Inicio". */
export const SinGestionarUsuarios: Story = {
  args: { items: [{ label: 'Inicio', href: '#inicio', current: true, icon: 'dashboard' }] },
};

/** Sin iconos. */
export const SinIconos: Story = {
  args: {
    items: [
      { label: 'Inicio', href: '#inicio', current: false },
      { label: 'Usuarios', href: '#usuarios', current: true },
    ],
  },
};
