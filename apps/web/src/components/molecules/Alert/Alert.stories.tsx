import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert } from './Alert';

const TONES = ['info', 'success', 'warning', 'danger'] as const;

const meta = {
  title: 'Moléculas/Alert',
  component: Alert,
  args: { children: 'Los cambios se aplicarán en la próxima sincronización.' },
  argTypes: {
    tone: { control: 'select', options: TONES },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Información: Story = { args: { tone: 'info' } };
export const Éxito: Story = {
  args: { tone: 'success', children: 'La incidencia se ha guardado.' },
};
export const Aviso: Story = {
  args: {
    tone: 'warning',
    children: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  },
};
export const Peligro: Story = {
  args: { tone: 'danger', children: 'Email o contraseña incorrectos.' },
};
export const ConTítulo: Story = {
  args: {
    tone: 'danger',
    title: 'No se ha podido iniciar sesión',
    children: 'Demasiados intentos. Espera un momento y vuelve a probar.',
  },
};
export const TextoLargo: Story = {
  args: {
    tone: 'info',
    title: 'Cuentas de demostración',
    children:
      'Esta instalación usa datos ficticios. Puedes entrar con cualquiera de las cuentas de demostración; los cambios que hagas se perderán cuando se vuelvan a cargar los datos de ejemplo.',
  },
};

/** Los cuatro tonos, con título. */
export const Catálogo: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {TONES.map((tone) => (
        <Alert key={tone} {...args} tone={tone} title={`Tono ${tone}`} />
      ))}
    </div>
  ),
};
