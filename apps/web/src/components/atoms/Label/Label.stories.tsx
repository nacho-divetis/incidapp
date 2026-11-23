import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from './Label';

const meta = {
  title: 'Átomos/Label',
  component: Label,
  args: { children: 'Correo electrónico', htmlFor: 'campo-ejemplo' },
  // La etiqueta se muestra junto a un campo para que la asociación por `htmlFor` sea real.
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-1">
      <Label {...args} />
      <input
        id="campo-ejemplo"
        className="h-10 rounded-md border border-border-strong bg-surface px-3"
      />
    </div>
  ),
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
export const Obligatorio: Story = { args: { required: true } };
export const Grande: Story = { args: { size: 'md' } };
