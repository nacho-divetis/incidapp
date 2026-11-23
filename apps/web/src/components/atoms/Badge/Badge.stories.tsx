import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const TONES = ['neutral', 'info', 'success', 'warning', 'danger', 'primary'] as const;

const meta = {
  title: 'Átomos/Badge',
  component: Badge,
  args: { children: 'Etiqueta' },
  argTypes: {
    tone: { control: 'select', options: TONES },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutro: Story = { args: { tone: 'neutral' } };
export const Información: Story = { args: { tone: 'info', children: 'Nueva' } };
export const Éxito: Story = { args: { tone: 'success', children: 'Resuelta' } };
export const Aviso: Story = { args: { tone: 'warning', children: 'En espera' } };
export const Peligro: Story = { args: { tone: 'danger', children: 'Crítica' } };
export const Primario: Story = { args: { tone: 'primary', children: 'En curso' } };

/** Todos los tonos en los dos tamaños. */
export const Catálogo: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(['sm', 'md'] as const).map((size) => (
        <div key={size} className="flex flex-wrap gap-2">
          {TONES.map((tone) => (
            <Badge key={tone} {...args} tone={tone} size={size}>
              {tone}
            </Badge>
          ))}
        </div>
      ))}
    </div>
  ),
};
