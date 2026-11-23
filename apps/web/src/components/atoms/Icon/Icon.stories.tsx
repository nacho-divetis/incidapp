import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon, iconNames } from './Icon';

const meta = {
  title: 'Átomos/Icon',
  component: Icon,
  args: { name: 'paperclip' },
  argTypes: {
    name: { control: 'select', options: iconNames },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Decorativo: oculto a los lectores de pantalla. */
export const PorDefecto: Story = {};
/** Con `label`: se anuncia como imagen. */
export const ConTextoAccesible: Story = { args: { name: 'warning', label: 'Atención' } };
export const Tamaños: Story = {
  render: (args) => (
    <div className="flex items-center gap-4">
      <Icon {...args} size="sm" />
      <Icon {...args} size="md" />
      <Icon {...args} size="lg" />
    </div>
  ),
};

/** Catálogo completo con su nombre. */
export const Catálogo: Story = {
  render: (args) => (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {iconNames.map((name) => (
        <li key={name} className="flex items-center gap-2 text-sm">
          <Icon {...args} name={name} />
          <code>{name}</code>
        </li>
      ))}
    </ul>
  ),
};
