import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from './Text';

const meta = {
  title: 'Átomos/Text',
  component: Text,
  args: { children: 'La incidencia se ha registrado y el equipo la revisará en breve.' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['body', 'muted', 'small'] },
    as: { control: 'inline-radio', options: ['p', 'span', 'div'] },
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cuerpo: Story = { args: { variant: 'body' } };
export const Atenuado: Story = { args: { variant: 'muted' } };
export const Pequeño: Story = { args: { variant: 'small', children: 'Creada el 23/11/2026' } };
