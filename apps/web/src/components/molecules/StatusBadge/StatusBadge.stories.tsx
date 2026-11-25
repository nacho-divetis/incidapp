import { Status } from '@incidapp/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusBadge } from './StatusBadge';

const meta = {
  title: 'Moléculas/StatusBadge',
  component: StatusBadge,
  args: { status: 'OPEN' },
  argTypes: {
    status: { control: 'select', options: Status.options },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Abierta: Story = {};
export const EnCurso: Story = { args: { status: 'IN_PROGRESS' } };
export const Resuelta: Story = { args: { status: 'RESOLVED' } };
export const Rechazada: Story = { args: { status: 'REJECTED' } };

/** Los siete estados en los dos tamaños. */
export const Catálogo: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(['sm', 'md'] as const).map((size) => (
        <div key={size} className="flex flex-wrap gap-2">
          {Status.options.map((status) => (
            <StatusBadge key={status} {...args} status={status} size={size} />
          ))}
        </div>
      ))}
    </div>
  ),
};
