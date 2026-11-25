import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { INCIDENT_DEPARTMENT_LIST, INCIDENT_DEPARTMENTS } from '@/test/incident-fixtures';
import { EMPTY_INCIDENT_FILTERS, IncidentFilters } from './IncidentFilters';

const meta = {
  title: 'Organismos/IncidentFilters',
  component: IncidentFilters,
  args: {
    value: EMPTY_INCIDENT_FILTERS,
    departments: INCIDENT_DEPARTMENT_LIST,
    onChange: fn(),
  },
} satisfies Meta<typeof IncidentFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sin ningún filtro: todas las incidencias visibles. */
export const SinFiltros: Story = {};

/** Con todos los filtros puestos. */
export const ConFiltros: Story = {
  args: {
    value: {
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      departmentId: INCIDENT_DEPARTMENTS.ATC.id,
      assignedToMe: true,
      q: 'factura',
    },
  },
};

/** Sin departamentos en el catálogo: solo queda "Todos". */
export const SinDepartamentos: Story = { args: { departments: [] } };

/** Con los filtros en el estado de la story: se pueden cambiar. */
export const Interactivo: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <IncidentFilters
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
    );
  },
};
