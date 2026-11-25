import type { CreateIncidentInput, UpdateIncidentInput } from '@incidapp/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { INCIDENT, INCIDENT_TYPE_LIST, INCIDENT_TYPES } from '@/test/incident-fixtures';
import { IncidentForm, type IncidentCreateFormProps } from './IncidentForm';

/**
 * Props de las stories: las del alta y las de la edición juntas (las props de `IncidentForm` son una
 * unión según `mode`, que los controles de Storybook no saben combinar).
 */
type IncidentFormStoryArgs = Omit<IncidentCreateFormProps, 'mode' | 'onSubmit'> & {
  mode: 'create' | 'edit';
  onSubmit: (values: CreateIncidentInput | UpdateIncidentInput) => void;
};

/** Valores de la incidencia de ejemplo, para precargar la edición. */
const EDIT_DEFAULTS = {
  title: INCIDENT.title,
  description: INCIDENT.description,
  priority: INCIDENT.priority,
  dueDate: INCIDENT.dueDate,
};

const meta = {
  title: 'Organismos/IncidentForm',
  render: ({ mode, types, ...args }) =>
    mode === 'edit' ? (
      <IncidentForm {...args} mode="edit" />
    ) : (
      <IncidentForm {...args} mode="create" types={types} />
    ),
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
  },
  args: {
    mode: 'create',
    types: INCIDENT_TYPE_LIST,
    cancelHref: '#/incidencias',
    onSubmit: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<IncidentFormStoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Alta vacía: prioridad "Media" y sin tipo elegido. */
export const Alta: Story = {};

/** Alta con un tipo elegido: la ayuda dice qué departamento la recibirá. */
export const AltaConTipo: Story = {
  args: { defaultValues: { typeId: INCIDENT_TYPES.CUSTOMER.id } },
};

/** Alta enviada vacía: errores del cliente junto a cada campo. */
export const AltaConErrores: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Crear incidencia' }));
    await expect(canvas.getByText('El título es obligatorio.')).toBeInTheDocument();
  },
};

/** Errores devueltos por la API (400 con `details`) y un error general. */
export const ErroresDeLaAPI: Story = {
  args: {
    defaultValues: {
      title: 'Faltan dos cajas en el pedido 4512',
      description: 'El albarán indica 12 cajas y han llegado 10.',
      typeId: INCIDENT_TYPES.TRANSPORT.id,
    },
    fieldErrors: { typeId: 'El tipo de incidencia no existe.' },
    errorMessage: 'No se ha podido crear la incidencia. Revisa los datos marcados.',
  },
};

/** Enviando: botón en carga y sin reenvíos. */
export const Enviando: Story = {
  args: {
    defaultValues: {
      title: 'Faltan dos cajas en el pedido 4512',
      description: 'El albarán indica 12 cajas y han llegado 10.',
      typeId: INCIDENT_TYPES.TRANSPORT.id,
    },
    isSubmitting: true,
  },
};

/** Sin tipos en el catálogo (todavía cargando o vacío). */
export const SinTipos: Story = { args: { types: [] } };

/** Edición precargada: sin campo de tipo y con la fecha objetivo borrable. */
export const Edición: Story = {
  args: { mode: 'edit', cancelHref: `#/incidencias/${INCIDENT.id}`, defaultValues: EDIT_DEFAULTS },
};

/** Edición de una incidencia sin fecha objetivo. */
export const EdiciónSinFecha: Story = {
  args: {
    mode: 'edit',
    cancelHref: `#/incidencias/${INCIDENT.id}`,
    defaultValues: { ...EDIT_DEFAULTS, dueDate: null },
  },
};

/** Edición enviando. */
export const EdiciónEnviando: Story = {
  args: {
    mode: 'edit',
    cancelHref: `#/incidencias/${INCIDENT.id}`,
    defaultValues: EDIT_DEFAULTS,
    isSubmitting: true,
  },
};
