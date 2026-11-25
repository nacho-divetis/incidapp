import type { Meta, StoryObj } from '@storybook/react-vite';
import { IncidentLoadError } from './IncidentLoadError';

const meta = {
  title: 'Organismos/IncidentLoadError',
  component: IncidentLoadError,
  args: { title: 'Incidencia', backHref: '/incidencias', notFound: true },
} satisfies Meta<typeof IncidentLoadError>;

export default meta;
type Story = StoryObj<typeof meta>;

/** La API responde 404: no existe, no es visible o el id no es válido. */
export const NoEncontrada: Story = {};

/** Otro error (sin conexión, error del servidor…), con su mensaje en español. */
export const OtroError: Story = {
  args: {
    notFound: false,
    title: 'Editar incidencia',
    errorMessage: 'No se ha podido conectar con el servidor. Inténtalo de nuevo.',
  },
};
