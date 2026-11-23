import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Átomos/Checkbox',
  component: Checkbox,
  args: { label: 'Recordar mi sesión', onChange: fn() },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
export const Marcada: Story = { args: { defaultChecked: true } };
export const Deshabilitada: Story = { args: { disabled: true } };
export const ConError: Story = { args: { invalid: true } };
/** Sin texto propio: el nombre accesible llega por `aria-label` (p. ej., en una tabla). */
export const SinEtiqueta: Story = { args: { label: undefined, 'aria-label': 'Seleccionar fila' } };
