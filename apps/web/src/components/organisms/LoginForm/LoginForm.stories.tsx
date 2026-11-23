import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent, within } from 'storybook/test';
import { LoginForm } from './LoginForm';

const meta = {
  title: 'Organismos/LoginForm',
  component: LoginForm,
  args: { onSubmit: fn(), onEmailChange: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Formulario vacío, tal como se abre `/login`. */
export const Vacío: Story = {};

/** Se envía vacío: cada campo muestra el error de validación de `shared`. */
export const ConErrores: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Iniciar sesión' }));
  },
};

/** Email mal formado: solo ese campo muestra el error. */
export const EmailNoVálido: Story = {
  args: { defaultEmail: 'elena@' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText(/contraseña/i), 'secreta');
    await userEvent.click(canvas.getByRole('button', { name: 'Iniciar sesión' }));
  },
};

/** Esperando la respuesta de la API: botón en carga y sin reenvíos. */
export const Enviando: Story = {
  args: { isSubmitting: true, defaultEmail: 'admin@incidapp.test' },
};

/** La API ha respondido con un error (401): el aviso se anuncia y el email se conserva. */
export const ErrorDeLaApi: Story = {
  args: {
    defaultEmail: 'admin@incidapp.test',
    errorMessage: 'Email o contraseña incorrectos.',
  },
};

/** Demasiados intentos (429). */
export const DemasiadosIntentos: Story = {
  args: {
    defaultEmail: 'admin@incidapp.test',
    errorMessage: 'Demasiados intentos de inicio de sesión. Inténtalo de nuevo en unos minutos.',
  },
};
