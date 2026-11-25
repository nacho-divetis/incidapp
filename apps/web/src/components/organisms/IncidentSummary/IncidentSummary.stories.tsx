import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Icon } from '../../atoms';
import { INCIDENT, UNASSIGNED_INCIDENT } from '@/test/incident-fixtures';
import { IncidentSummary } from './IncidentSummary';

const meta = {
  title: 'Organismos/IncidentSummary',
  component: IncidentSummary,
  args: { incident: INCIDENT },
} satisfies Meta<typeof IncidentSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Con la acción "Editar" (la página la pinta si `allowedActions` incluye `update`). */
export const ConAcciones: Story = {
  args: {
    actions: (
      <Button variant="secondary" leftIcon={<Icon name="pencil" size="md" />}>
        Editar
      </Button>
    ),
  },
};

/** Sin acciones permitidas (p. ej., Dirección). */
export const SinAcciones: Story = {};

/** Sin asignado ni fecha objetivo. */
export const SinAsignar: Story = { args: { incident: UNASSIGNED_INCIDENT } };

/** Resuelta y cerrada: aparecen sus fechas (las rellena F04). */
export const Cerrada: Story = {
  args: {
    incident: {
      ...INCIDENT,
      status: 'CLOSED',
      resolvedAt: '2026-11-26T11:20:00.000Z',
      closedAt: '2026-11-27T08:00:00.000Z',
      allowedActions: [],
    },
  },
};

/** Un título y una descripción largos no desbordan en móvil. */
export const Móvil: Story = {
  args: {
    incident: {
      ...INCIDENT,
      title:
        'Retraso continuado en las entregas de la ruta norte por cambio de proveedor de transporte',
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-80">
        <Story />
      </div>
    ),
  ],
};
