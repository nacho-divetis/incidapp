import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select';

// El átomo no lleva etiqueta: en las stories se le da un nombre accesible con `aria-label`.
const meta = {
  title: 'Átomos/Select',
  component: Select,
  args: {
    'aria-label': 'Prioridad',
    defaultValue: '',
    children: (
      <>
        <option value="" disabled>
          Elige una opción
        </option>
        <option value="baja">Baja</option>
        <option value="media">Media</option>
        <option value="alta">Alta</option>
      </>
    ),
  },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
export const ConValor: Story = { args: { defaultValue: 'media' } };
export const Deshabilitado: Story = { args: { disabled: true, defaultValue: 'media' } };
export const ConError: Story = { args: { invalid: true } };
