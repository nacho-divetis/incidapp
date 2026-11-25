import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { CheckboxGroup, type CheckboxGroupProps } from './CheckboxGroup';

// Departamentos ficticios de la empresa demo.
const DEPARTMENTS = [
  { value: 'd-adm', label: 'ADM', description: 'Administración' },
  { value: 'd-it', label: 'IT', description: 'Sistemas' },
  { value: 'd-mnt', label: 'MNT', description: 'Mantenimiento' },
  { value: 'd-rrhh', label: 'RRHH', description: 'Recursos Humanos' },
];

/** Envoltorio con estado para que las casillas se puedan marcar en Storybook. */
function Controlled(props: CheckboxGroupProps) {
  const [value, setValue] = useState(props.value);
  return (
    <CheckboxGroup
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onChange(next);
      }}
    />
  );
}

const meta = {
  title: 'Moléculas/CheckboxGroup',
  component: CheckboxGroup,
  args: {
    legend: 'Departamentos',
    options: DEPARTMENTS,
    value: ['d-it'],
    onChange: fn(),
  },
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CheckboxGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
export const Obligatorio: Story = {
  args: { required: true, hint: 'Elige al menos un departamento.' },
};
export const DosColumnas: Story = { args: { columns: 2 } };
export const SinDescripciones: Story = {
  args: { options: DEPARTMENTS.map(({ value, description }) => ({ value, label: description })) },
};
export const ConError: Story = {
  args: {
    required: true,
    value: [],
    hint: 'Elige al menos un departamento.',
    error: 'Elige al menos un departamento.',
  },
};
export const Deshabilitado: Story = {
  args: {
    disabled: true,
    value: ['d-adm', 'd-it'],
    hint: 'No se pueden cambiar los departamentos de este usuario.',
  },
};
export const Vacío: Story = {
  args: { options: [], value: [], emptyMessage: 'No hay departamentos disponibles.' },
};
