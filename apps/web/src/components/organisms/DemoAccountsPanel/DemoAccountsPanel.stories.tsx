import type { Meta, StoryObj } from '@storybook/react-vite';
import { DEMO_PASSWORD, DEMO_USERS } from '@incidapp/shared';
import { fn } from 'storybook/test';
import { DemoAccountsPanel } from './DemoAccountsPanel';

const meta = {
  title: 'Organismos/DemoAccountsPanel',
  component: DemoAccountsPanel,
  args: { accounts: DEMO_USERS, password: DEMO_PASSWORD, onSelect: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DemoAccountsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Las cuatro cuentas demo de `shared`, una por rol. */
export const PorDefecto: Story = {};

/** Una sola cuenta. */
export const UnaCuenta: Story = {
  args: { accounts: DEMO_USERS.slice(0, 1) },
};

/** Sin cuentas: solo el título y la contraseña. */
export const SinCuentas: Story = {
  args: { accounts: [] },
};

/** En un ancho de móvil, el botón baja debajo de los datos de la cuenta. */
export const Estrecho: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-64">
        <Story />
      </div>
    ),
  ],
};
