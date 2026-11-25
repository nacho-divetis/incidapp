import { Priority } from '@incidapp/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PriorityBadge } from './PriorityBadge';

const meta = {
  title: 'Moléculas/PriorityBadge',
  component: PriorityBadge,
  args: { priority: 'MEDIUM' },
  argTypes: {
    priority: { control: 'select', options: Priority.options },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof PriorityBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Media: Story = {};
export const Urgente: Story = { args: { priority: 'URGENT' } };

/** Las cuatro prioridades en los dos tamaños. */
export const Catálogo: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(['sm', 'md'] as const).map((size) => (
        <div key={size} className="flex flex-wrap gap-2">
          {Priority.options.map((priority) => (
            <PriorityBadge key={priority} {...args} priority={priority} size={size} />
          ))}
        </div>
      ))}
    </div>
  ),
};
