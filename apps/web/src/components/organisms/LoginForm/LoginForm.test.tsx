// CA-01.13 (formulario) · LoginForm: campos etiquetados, validación en el cliente con `LoginInput` y
// errores accesibles por campo, estado de carga sin reenvíos y error de la API en `role="alert"`
// sin vaciar el email.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm';

function fields() {
  return {
    email: screen.getByRole('textbox', { name: /email/i }),
    // Los campos de contraseña no tienen rol accesible: se buscan por su etiqueta.
    password: screen.getByLabelText(/contraseña/i),
    submit: screen.getByRole('button', { name: 'Iniciar sesión' }),
  };
}

describe('LoginForm', () => {
  it('CA-01.13: muestra los campos "Email" y "Contraseña" etiquetados y el botón "Iniciar sesión"', () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    const { email, password, submit } = fields();
    expect(email).toHaveAttribute('type', 'email');
    expect(password).toHaveAttribute('type', 'password');
    expect(submit).toHaveAttribute('type', 'submit');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('CA-01.13: con los campos vacíos no envía y marca cada campo con su error de shared', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    const { email, password, submit } = fields();
    await user.click(submit);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('El email es obligatorio.');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAccessibleDescription('La contraseña es obligatoria.');
    // El foco va al primer campo con error.
    expect(email).toHaveFocus();
  });

  it('CA-01.13: con un email mal formado lo indica junto al campo y el foco va a él', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    const { email, password, submit } = fields();
    await user.type(email, 'elena@');
    await user.type(password, 'secreta');
    await user.click(submit);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(email).toHaveAccessibleDescription('El email no es válido.');
    expect(password).not.toHaveAttribute('aria-invalid');
    expect(email).toHaveFocus();
  });

  it('CA-01.13: el error de un campo desaparece al cambiar su valor', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);

    const { email, password, submit } = fields();
    await user.click(submit);
    await user.type(password, 'x');

    expect(password).not.toHaveAttribute('aria-invalid');
    expect(password).not.toHaveAccessibleDescription();
    // El otro campo conserva su error.
    expect(email).toHaveAttribute('aria-invalid', 'true');
  });

  it('CA-01.13: con datos válidos llama a onSubmit con el email normalizado y la contraseña tal cual', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    const { email, password, submit } = fields();
    await user.type(email, '  Admin@IncidApp.test ');
    await user.type(password, ' Demo2026! ');
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'admin@incidapp.test',
      password: ' Demo2026! ',
    });
  });

  it('CA-01.13: enviando, el botón está en carga y el formulario no se vuelve a enviar (ni con Intro)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} isSubmitting defaultEmail="admin@incidapp.test" />);

    const { password, submit } = fields();
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');

    await user.type(password, 'Demo2026!{Enter}');
    await user.click(submit);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('CA-01.13: el error de la API se muestra en una región role="alert" sin vaciar el email', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(<LoginForm onSubmit={onSubmit} />);

    const { email, password, submit } = fields();
    await user.type(email, 'admin@incidapp.test');
    await user.type(password, 'mala');
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledOnce();

    rerender(<LoginForm onSubmit={onSubmit} errorMessage="Email o contraseña incorrectos." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.');
    expect(email).toHaveValue('admin@incidapp.test');
  });

  it('usa defaultEmail como valor inicial del email no controlado', () => {
    render(<LoginForm onSubmit={vi.fn()} defaultEmail="usuario@incidapp.test" />);

    expect(fields().email).toHaveValue('usuario@incidapp.test');
  });

  it('con email controlado, refleja el valor de fuera y avisa de los cambios con onEmailChange', async () => {
    const user = userEvent.setup();
    const onEmailChange = vi.fn();
    function Controlled() {
      const [email, setEmail] = useState('direccion@incidapp.test');
      return (
        <>
          <button type="button" onClick={() => setEmail('responsable@incidapp.test')}>
            Elegir responsable
          </button>
          <LoginForm
            onSubmit={vi.fn()}
            email={email}
            onEmailChange={(value) => {
              onEmailChange(value);
              setEmail(value);
            }}
          />
        </>
      );
    }
    render(<Controlled />);

    const { email } = fields();
    expect(email).toHaveValue('direccion@incidapp.test');

    await user.click(screen.getByRole('button', { name: 'Elegir responsable' }));
    expect(email).toHaveValue('responsable@incidapp.test');

    await user.type(email, 'x');
    expect(onEmailChange).toHaveBeenLastCalledWith('responsable@incidapp.testx');
    expect(email).toHaveValue('responsable@incidapp.testx');
  });

  it('con email controlado, el error del email desaparece si el valor cambia desde fuera', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LoginForm onSubmit={vi.fn()} email="" onEmailChange={vi.fn()} />);

    await user.click(fields().submit);
    expect(fields().email).toHaveAttribute('aria-invalid', 'true');

    rerender(<LoginForm onSubmit={vi.fn()} email="admin@incidapp.test" onEmailChange={vi.fn()} />);
    expect(fields().email).not.toHaveAttribute('aria-invalid');
  });
});
