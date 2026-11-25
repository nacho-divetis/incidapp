// CA-02.20 (desactivar y reactivar) y CA-02.21 (restablecer la contraseña) · UserAccountActions:
// cada acción aparece solo si su `UserAction` está en `allowedActions`; desactivar pide confirmación
// explícita; el restablecimiento pide la contraseña dos veces y vacía los campos al terminar.
import type { UserAction } from '@incidapp/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

function setup(overrides: Partial<UserAccountActionsProps> = {}) {
  const props: UserAccountActionsProps = {
    user: ACTIVE,
    onDeactivate: vi.fn(),
    onActivate: vi.fn(),
    onResetPassword: vi.fn(),
    ...overrides,
  };
  const view = render(<UserAccountActions {...props} />);
  const rerender = (next: Partial<UserAccountActionsProps>) =>
    view.rerender(<UserAccountActions {...props} {...next} />);
  return { props, rerender };
}

function passwordFields() {
  return {
    password: screen.getByLabelText(/^contraseña nueva/i),
    confirmation: screen.getByLabelText(/^repite la contraseña nueva/i),
    submit: screen.getByRole('button', { name: 'Restablecer contraseña' }),
  };
}

describe('UserAccountActions · desactivar y reactivar', () => {
  it('CA-02.20: con deactivate muestra el estado y "Desactivar usuario", sin "Reactivar usuario"', () => {
    setup();

    const section = screen.getByRole('region', { name: 'Cuenta' });
    expect(section).toHaveTextContent('Estado:Activo');
    expect(screen.getByRole('button', { name: 'Desactivar usuario' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reactivar usuario' })).not.toBeInTheDocument();
  });

  it('CA-02.20: desactivar pide confirmación antes de llamar a onDeactivate', async () => {
    const user = userEvent.setup();
    const { props } = setup();

    await user.click(screen.getByRole('button', { name: 'Desactivar usuario' }));

    const dialog = screen.getByRole('alertdialog', { name: '¿Desactivar a Marta Gil?' });
    expect(dialog).toHaveAccessibleDescription(/no podrá iniciar sesión/i);
    expect(props.onDeactivate).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
    expect(props.onDeactivate).toHaveBeenCalledOnce();
  });

  it('CA-02.20: cancelar la confirmación no desactiva y devuelve el foco al botón', async () => {
    const user = userEvent.setup();
    const { props } = setup();

    const trigger = screen.getByRole('button', { name: 'Desactivar usuario' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(props.onDeactivate).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it('CA-02.20: al desactivarse, el diálogo se cierra, el estado cambia y el foco va a "Reactivar usuario"', async () => {
    const user = userEvent.setup();
    const { rerender } = setup();

    await user.click(screen.getByRole('button', { name: 'Desactivar usuario' }));
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    rerender({ isDeactivating: true });
    expect(screen.getByRole('button', { name: 'Desactivar' })).toHaveAttribute('aria-busy', 'true');

    rerender({ isDeactivating: false, user: INACTIVE, notice: 'Usuario desactivado.' });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cuenta' })).toHaveTextContent('Estado:Desactivado');
    expect(screen.getByRole('status')).toHaveTextContent('Usuario desactivado.');
    expect(screen.queryByRole('button', { name: 'Desactivar usuario' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reactivar usuario' })).toHaveFocus(),
    );
  });

  it('CA-02.20: si la API falla, el error se muestra dentro del diálogo, que sigue abierto', async () => {
    const user = userEvent.setup();
    const { rerender } = setup();

    await user.click(screen.getByRole('button', { name: 'Desactivar usuario' }));
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    rerender({ isDeactivating: true });
    rerender({ isDeactivating: false, statusErrorMessage: 'No se ha podido desactivar.' });

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('No se ha podido desactivar.');
  });

  it('un error anterior no aparece al volver a abrir la confirmación', async () => {
    const user = userEvent.setup();
    setup({ statusErrorMessage: 'No se ha podido desactivar.' });

    await user.click(screen.getByRole('button', { name: 'Desactivar usuario' }));

    expect(within(screen.getByRole('alertdialog')).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('CA-02.20: desactivado y con activate, "Reactivar usuario" llama a onActivate sin confirmación', async () => {
    const user = userEvent.setup();
    const { props, rerender } = setup({ user: INACTIVE });

    expect(screen.queryByRole('button', { name: 'Desactivar usuario' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reactivar usuario' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(props.onActivate).toHaveBeenCalledOnce();

    rerender({ user: ACTIVE });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Desactivar usuario' })).toHaveFocus(),
    );
  });

  it('reactivando, el botón está en carga', () => {
    setup({ user: INACTIVE, isActivating: true });
    const button = screen.getByRole('button', { name: 'Reactivar usuario' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('el error al reactivar se muestra en la sección', () => {
    setup({ user: INACTIVE, statusErrorMessage: 'No se ha podido reactivar.' });
    expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido reactivar.');
  });

  it('CA-02.20: sin deactivate ni activate (p. ej., uno mismo) no aparece ningún botón de estado', () => {
    setup({ user: { ...ACTIVE, allowedActions: [...EDIT, 'resetPassword'] } });

    expect(screen.queryByRole('button', { name: 'Desactivar usuario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reactivar usuario' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restablecer contraseña' })).toBeInTheDocument();
  });

  it('sin ninguna acción (usuario demo) muestra la explicación', () => {
    setup({
      user: { ...ACTIVE, allowedActions: ['rename'] },
      lockedHint: 'Los usuarios demo no se pueden modificar.',
    });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Los usuarios demo no se pueden modificar.')).toBeInTheDocument();
  });
});

describe('UserAccountActions · restablecer la contraseña', () => {
  it('CA-02.21: sin resetPassword no aparece el formulario', () => {
    setup({ user: { ...ACTIVE, allowedActions: [...EDIT, 'deactivate'] } });
    expect(screen.queryByRole('form', { name: 'Restablecer contraseña' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña nueva/i)).not.toBeInTheDocument();
  });

  it('CA-02.21: pide la contraseña dos veces; vacía no se envía y marca los dos campos', async () => {
    const user = userEvent.setup();
    const { props } = setup();

    expect(screen.getByRole('form', { name: 'Restablecer contraseña' })).toBeInTheDocument();
    const { password, confirmation, submit } = passwordFields();
    await user.click(submit);

    expect(props.onResetPassword).not.toHaveBeenCalled();
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAccessibleDescription(/La contraseña es obligatoria\./);
    expect(confirmation).toHaveAccessibleDescription('Repite la contraseña nueva.');
    expect(password).toHaveFocus();
  });

  it('CA-02.21: valida la longitud con shared y que las dos coinciden', async () => {
    const user = userEvent.setup();
    const { props } = setup();

    const { password, confirmation, submit } = passwordFields();
    await user.type(password, 'corta');
    await user.type(confirmation, 'corta');
    await user.click(submit);
    expect(password).toHaveAccessibleDescription(/al menos 8 caracteres\./);

    await user.clear(password);
    await user.type(password, 'Nueva2026!');
    await user.clear(confirmation);
    await user.type(confirmation, 'Otra2026!');
    await user.click(submit);

    expect(props.onResetPassword).not.toHaveBeenCalled();
    expect(confirmation).toHaveAccessibleDescription('Las contraseñas no coinciden.');
    expect(confirmation).toHaveFocus();
  });

  it('CA-02.21: con las dos iguales llama a onResetPassword y, al terminar bien, vacía los campos', async () => {
    const user = userEvent.setup();
    const { props, rerender } = setup();

    const { password, confirmation, submit } = passwordFields();
    await user.type(password, ' Nueva 2026! ');
    await user.type(confirmation, ' Nueva 2026! ');
    await user.click(submit);
    expect(props.onResetPassword).toHaveBeenCalledWith(' Nueva 2026! ');

    rerender({ isResettingPassword: true });
    expect(passwordFields().submit).toHaveAttribute('aria-busy', 'true');

    const message = 'Contraseña restablecida. El usuario deberá iniciar sesión de nuevo.';
    rerender({ isResettingPassword: false, notice: message });

    expect(password).toHaveValue('');
    expect(confirmation).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent(message);
    await waitFor(() => expect(password).toHaveFocus());
  });

  it('CA-02.21: si la API falla, conserva los campos y muestra el error', async () => {
    const user = userEvent.setup();
    const { rerender } = setup();

    const { password, confirmation, submit } = passwordFields();
    await user.type(password, 'Nueva2026!');
    await user.type(confirmation, 'Nueva2026!');
    await user.click(submit);
    rerender({ isResettingPassword: true });
    rerender({ isResettingPassword: false, passwordErrorMessage: 'No se ha podido restablecer.' });

    expect(password).toHaveValue('Nueva2026!');
    expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido restablecer.');
  });

  it('enviando, no se vuelve a enviar', async () => {
    const user = userEvent.setup();
    const { props } = setup({ isResettingPassword: true });

    const { password, confirmation } = passwordFields();
    await user.type(password, 'Nueva2026!');
    await user.type(confirmation, 'Nueva2026!{Enter}');

    expect(props.onResetPassword).not.toHaveBeenCalled();
  });
});
