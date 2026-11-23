import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Checkbox, Input, Label } from '../../atoms';
import { AuthLayout } from './AuthLayout';

// Formulario de relleno para ver la disposición; en la aplicación lo pone el organismo de login.
const form = (
  <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
    <div className="flex flex-col gap-1">
      <Label htmlFor="auth-email" required>
        Correo electrónico
      </Label>
      <Input id="auth-email" type="email" autoComplete="username" />
    </div>
    <div className="flex flex-col gap-1">
      <Label htmlFor="auth-password" required>
        Contraseña
      </Label>
      <Input id="auth-password" type="password" autoComplete="current-password" />
    </div>
    <Checkbox label="Recordar mi sesión" />
    <Button type="submit" className="w-full">
      Entrar
    </Button>
  </form>
);

const meta = {
  title: 'Plantillas/AuthLayout',
  component: AuthLayout,
  parameters: { layout: 'fullscreen' },
  args: { title: 'Iniciar sesión', children: form },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
/** Ancho de móvil: el panel ocupa el ancho disponible con margen lateral. */
export const Móvil: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-xs border-x border-border">
        <Story />
      </div>
    ),
  ],
};
