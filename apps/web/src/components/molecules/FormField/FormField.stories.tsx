import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input, Select, Textarea } from '../../atoms';
import { FormField } from './FormField';

const meta = {
  title: 'Moléculas/FormField',
  component: FormField,
  args: {
    label: 'Email',
    htmlFor: 'email',
    children: <Input type="email" autoComplete="email" />,
  },
  argTypes: {
    children: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
export const Obligatorio: Story = { args: { required: true } };
export const ConAyuda: Story = {
  args: {
    label: 'Contraseña',
    htmlFor: 'password',
    hint: 'Distingue mayúsculas y minúsculas.',
    children: <Input type="password" autoComplete="current-password" />,
  },
};
export const ConError: Story = {
  args: {
    required: true,
    error: 'Introduce un email válido.',
    children: <Input type="email" defaultValue="ana@" />,
  },
};
export const ConAyudaYError: Story = {
  args: {
    label: 'Contraseña',
    htmlFor: 'password',
    hint: 'Distingue mayúsculas y minúsculas.',
    error: 'Introduce la contraseña.',
    children: <Input type="password" />,
  },
};
export const Deshabilitado: Story = {
  args: { children: <Input type="email" defaultValue="ana@example.com" disabled /> },
};
export const ConSelect: Story = {
  args: {
    label: 'Prioridad',
    htmlFor: 'priority',
    error: 'Elige una prioridad.',
    children: (
      <Select defaultValue="">
        <option value="">Selecciona…</option>
        <option value="LOW">Baja</option>
        <option value="MEDIUM">Media</option>
        <option value="HIGH">Alta</option>
      </Select>
    ),
  },
};
export const ConTextarea: Story = {
  args: {
    label: 'Descripción',
    htmlFor: 'description',
    hint: 'Explica qué ocurre y desde cuándo.',
    children: <Textarea />,
  },
};
