import type { Meta, StoryObj } from '@storybook/react-vite';
import { INCIDENT_LIST_ITEMS } from '@/test/incident-fixtures';
import { IncidentTable } from './IncidentTable';

const meta = {
  title: 'Organismos/IncidentTable',
  component: IncidentTable,
  args: {
    items: INCIDENT_LIST_ITEMS,
    getDetailHref: (id: string) => `#/incidencias/${id}`,
  },
} satisfies Meta<typeof IncidentTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Incidencias de varios departamentos, prioridades y estados; una sin asignar y sin fecha. */
export const PorDefecto: Story = {};

/** Sin resultados para los filtros. */
export const Vacía: Story = { args: { items: [] } };

/** Cargando la primera página. */
export const Cargando: Story = { args: { isLoading: true } };

/** En un ancho de móvil: la tabla se desplaza dentro de su contenedor, no la página. */
export const Móvil: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-80">
        <Story />
      </div>
    ),
  ],
};
