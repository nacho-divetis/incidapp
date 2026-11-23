import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from './Spinner';

const meta = {
  title: 'Átomos/Spinner',
  component: Spinner,
  args: { label: 'Cargando…' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
export const Pequeño: Story = { args: { size: 'sm' } };
export const Grande: Story = { args: { size: 'lg', label: 'Cargando incidencias…' } };
