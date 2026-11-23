import { LoginInput } from '@incidapp/shared';
import { useId, useRef, useState, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { Button, Icon, Input } from '../../atoms';
import { Alert, FormField } from '../../molecules';

/**
 * Formulario de inicio de sesión (CA-01.13): campos "Email" y "Contraseña" y botón "Iniciar sesión".
 *
 * - Valida en el cliente con el esquema `LoginInput` de `shared` al enviar y muestra cada error junto
 *   a su campo (`FormField` pone `aria-invalid` y `aria-describedby`). El foco va al primer campo con
 *   error. El error de un campo desaparece en cuanto se cambia su valor.
 * - Si los datos son válidos, llama a `onSubmit` con los datos ya normalizados (email sin espacios y
 *   en minúsculas). No hace la petición: es presentacional.
 * - Con `isSubmitting`, el botón está en estado de carga y el formulario no se vuelve a enviar.
 * - `errorMessage` (error de la API: 401, 429…) se muestra en un `Alert` danger (`role="alert"`) que
 *   solo se pinta cuando hay mensaje, para que se anuncie. El email escrito no se vacía.
 * - El email puede ser controlado (`email` + `onEmailChange`, p. ej. para rellenarlo desde el
 *   recuadro de usuarios demo) o interno, con `defaultEmail` como valor inicial.
 */
export interface LoginFormProps {
  /** Se llama con los datos validados y normalizados. */
  onSubmit: (values: LoginInput) => void;
  /** Petición en curso: botón en carga y sin reenvíos. */
  isSubmitting?: boolean;
  /** Mensaje de error de la API, en español. */
  errorMessage?: string;
  /** Valor inicial del email cuando no es controlado. */
  defaultEmail?: string;
  /** Valor del email controlado desde fuera. */
  email?: string;
  /** Cambio del email (obligatorio para que el email controlado se pueda editar). */
  onEmailChange?: (email: string) => void;
  className?: string;
}

type Field = 'email' | 'password';
type FieldErrors = Partial<Record<Field, string>>;

/** Primer mensaje de error de cada campo según el esquema `LoginInput`. */
function validate(values: Record<Field, string>): { data?: LoginInput; errors: FieldErrors } {
  const result = LoginInput.safeParse(values);
  if (result.success) return { data: result.data, errors: {} };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if ((field === 'email' || field === 'password') && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return { errors };
}

export function LoginForm({
  onSubmit,
  isSubmitting = false,
  errorMessage,
  defaultEmail = '',
  email: controlledEmail,
  onEmailChange,
  className,
}: LoginFormProps) {
  const id = useId();
  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [internalEmail, setInternalEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const email = controlledEmail ?? internalEmail;

  // Errores del último envío y los valores con los que se calcularon: un error solo se muestra
  // mientras el campo conserva ese valor (también si el email cambia desde fuera).
  const [validation, setValidation] = useState<{
    errors: FieldErrors;
    values: Record<Field, string>;
  }>({ errors: {}, values: { email: '', password: '' } });
  const emailError = validation.values.email === email ? validation.errors.email : undefined;
  const passwordError =
    validation.values.password === password ? validation.errors.password : undefined;

  function changeEmail(value: string) {
    if (controlledEmail === undefined) setInternalEmail(value);
    onEmailChange?.(value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const values = { email, password };
    const { data, errors } = validate(values);
    setValidation({ errors, values });

    if (!data) {
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    onSubmit(data);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className={cn('flex flex-col gap-4', className)}>
      {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}

      <FormField label="Email" htmlFor={emailId} error={emailError} required>
        <Input
          ref={emailRef}
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => changeEmail(event.target.value)}
        />
      </FormField>

      <FormField label="Contraseña" htmlFor={passwordId} error={passwordError} required>
        <Input
          ref={passwordRef}
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </FormField>

      <Button
        type="submit"
        loading={isSubmitting}
        leftIcon={<Icon name="log-in" size="md" />}
        className="w-full"
      >
        Iniciar sesión
      </Button>
    </form>
  );
}
