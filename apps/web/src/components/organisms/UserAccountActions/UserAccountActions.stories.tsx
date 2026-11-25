import type { UserAction } from '@incidapp/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn, userEvent, within } from 'storybook/test';
import { UserAccountActions, type UserAccountActionsProps } from './UserAccountActions';

const EDIT: UserAction[] = ['rename', 'changeEmail', 'changeRole', 'changeDepartments'];
const ACTIVE = {
  name: 'Marta Gil',
  active: true,
  allowedActions: [...EDIT, 'deactivate', 'resetPassword'] as UserAction[],
};
const INACTIVE = {
  name: 'Marta Gil',
  active: false,
  allowedActions: [...EDIT, 'activate', 'resetPassword'] as UserAction[],
};

/** Simula la API: cada acción tarda un poco y actualiza el usuario como lo haría la página. */
function Simulated(props: UserAccountActionsProps) {
  const [user, setUser] = useState(props.user);
  const [pending, setPending] = useState<'deactivate' | 'activate' | 'password' | null>(null);
  const [notice, setNotice] = useState<string>();

  function run(kind: NonNullable<typeof pending>, done: () => void) {
    setPending(kind);
    setNotice(undefined);
    setTimeout(() => {
      setPending(null);
      done();
    }, 800);
  }

  return (
    <UserAccountActions
      {...props}
      user={user}
      notice={notice}
      isDeactivating={pending === 'deactivate'}
      isActivating={pending === 'activate'}
      isResettingPassword={pending === 'password'}
      onDeactivate={() => {
        props.onDeactivate();
        run('deactivate', () => {
          setUser(INACTIVE);
          setNotice('Usuario desactivado.');
        });
      }}
      onActivate={() => {
        props.onActivate();
        run('activate', () => {
          setUser(ACTIVE);
          setNotice('Usuario reactivado.');
        });
      }}
      onResetPassword={(password) => {
        props.onResetPassword(password);
        run('password', () =>
          setNotice('Contraseña restablecida. El usuario deberá iniciar sesión de nuevo.'),
        );
      }}
    />
  );
}

const meta = {
  title: 'Organismos/UserAccountActions',
  component: UserAccountActions,
  args: {
    user: ACTIVE,
    onDeactivate: fn(),
    onActivate: fn(),
    onResetPassword: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UserAccountActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Usuario activo con todas las acciones permitidas. */
export const Activo: Story = {};

/** Usuario desactivado: "Reactivar usuario" en lugar de "Desactivar usuario". */
export const Desactivado: Story = { args: { user: INACTIVE } };

/** El Admin en su propio usuario: no puede desactivarse (sin `deactivate`), pero sí cambiar su contraseña. */
export const UnoMismo: Story = {
  args: { user: { ...ACTIVE, allowedActions: [...EDIT, 'resetPassword'] } },
};

/** Usuario demo: ninguna acción sobre la cuenta (solo `rename`). */
export const UsuarioDemo: Story = {
  args: {
    user: { name: 'Pablo Moreno', active: true, allowedActions: ['rename'] },
    lockedHint: 'Los usuarios demo no se pueden modificar.',
  },
};

/** Confirmación de la desactivación abierta (el foco empieza en "Cancelar"). */
export const ConfirmandoDesactivación: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Desactivar usuario' }));
  },
};

/** Reactivación en curso. */
export const Reactivando: Story = { args: { user: INACTIVE, isActivating: true } };

/** La reactivación ha fallado. */
export const ErrorAlReactivar: Story = {
  args: {
    user: INACTIVE,
    statusErrorMessage: 'No se ha podido reactivar el usuario. Inténtalo de nuevo.',
  },
};

/** Contraseña enviada vacía: errores de validación junto a cada campo. */
export const ContraseñaConErrores: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Restablecer contraseña' }));
  },
};

/** Restablecimiento en curso. */
export const RestableciendoContraseña: Story = { args: { isResettingPassword: true } };

/** El restablecimiento ha fallado. */
export const ErrorAlRestablecer: Story = {
  args: { passwordErrorMessage: 'No se ha podido restablecer la contraseña. Inténtalo de nuevo.' },
};

/** Aviso de éxito tras restablecer la contraseña (CA-02.21). */
export const ContraseñaRestablecida: Story = {
  args: { notice: 'Contraseña restablecida. El usuario deberá iniciar sesión de nuevo.' },
};

/** Interactivo: simula las respuestas de la API (desactivar, reactivar y restablecer). */
export const Interactivo: Story = {
  render: (args) => <Simulated {...args} />,
};
