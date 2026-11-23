import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';

// El átomo no lleva etiqueta: en las stories se le da un nombre accesible con `aria-label`.
const meta = {
  title: 'Átomos/Input',
  component: Input,
  args: { 'aria-label': 'Título', placeholder: 'Escribe un título' },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
export const ConValor: Story = { args: { defaultValue: 'La impresora de la planta 2 no imprime' } };
export const Deshabilitado: Story = { args: { disabled: true, defaultValue: 'No editable' } };
export const ConError: Story = { args: { invalid: true, defaultValue: 'ab' } };
export const Contraseña: Story = {
  args: { type: 'password', 'aria-label': 'Contraseña', placeholder: undefined },
};
