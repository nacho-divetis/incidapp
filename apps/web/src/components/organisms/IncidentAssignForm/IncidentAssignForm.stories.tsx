import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PEOPLE } from '@/test/incident-fixtures';
import { IncidentAssignForm } from './IncidentAssignForm';

const meta = {
  title: 'Organismos/IncidentAssignForm',
  component: IncidentAssignForm,
  args: {
    assignees: Object.values(PEOPLE),
    currentAssigneeId: PEOPLE.MARTA.id,
    onAssign: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IncidentAssignForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Con el asignado actual elegido. */
export const PorDefecto: Story = {};

/** Incidencia sin asignar. */
export const SinAsignar: Story = { args: { currentAssigneeId: null } };

/** Cargando los candidatos. */
export const Cargando: Story = { args: { isLoading: true } };

/** Asignando: botón en carga. */
export const Asignando: Story = { args: { isPending: true } };

/** Tras asignar, con el aviso de éxito. */
export const Asignada: Story = { args: { notice: 'Incidencia asignada.' } };

/** La API rechaza la asignación. */
export const ConError: Story = {
  args: {
    errorMessage: 'El usuario no pertenece al departamento de la incidencia o está desactivado.',
  },
};

/** Sin usuarios activos en el departamento. */
export const SinCandidatos: Story = { args: { assignees: [], currentAssigneeId: null } };
