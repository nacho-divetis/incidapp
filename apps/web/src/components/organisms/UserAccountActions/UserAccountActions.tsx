import { ResetPasswordInput, PASSWORD_MIN_LENGTH, type UserAdmin } from '@incidapp/shared';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Badge, Button, Heading, Icon, Input, Text } from '../../atoms';
import { Alert, ConfirmDialog, FormField } from '../../molecules';

/** Datos del usuario que necesita el organismo (subconjunto de `UserAdmin` de `shared`). */
export type UserAccountActionsUser = Pick<UserAdmin, 'name' | 'active' | 'allowedActions'>;

/**
 * Acciones sobre la cuenta de un usuario en su edición: estado, desactivar o reactivar (CA-02.20) y
 * restablecer la contraseña (CA-02.21).
 *
 * - **Permisos:** cada acción aparece solo si su `UserAction` está en `user.allowedActions`
 *   (`deactivate`, `activate`, `resetPassword`). No mira el rol ni recalcula nada. Sin ninguna, se
 *   muestra `lockedHint`.
 * - **Desactivar** pide una confirmación explícita (`ConfirmDialog`, tono de peligro) y solo al
 *   confirmar llama a `onDeactivate`. El diálogo sigue abierto (y no se puede cerrar) mientras
 *   `isDeactivating`; si falla, `statusErrorMessage` se muestra dentro del diálogo; cuando
 *   `user.active` cambia (la API ha respondido), se cierra solo.
 * - **Reactivar** no pide confirmación (no es destructivo): llama a `onActivate`.
 * - Tras desactivar o reactivar, el foco va al botón de la acción contraria (o al aviso, si no hay).
 * - **Restablecer la contraseña** pide la contraseña nueva dos veces, la valida con
 *   `ResetPasswordInput` de `shared` y comprueba que coinciden; llama a `onResetPassword(password)`.
 *   Cuando termina sin error (`isResettingPassword` pasa a `false` sin `passwordErrorMessage`), vacía
 *   los campos y deja el foco en el primero.
 * - `notice` (aviso de éxito que decide la página) se muestra arriba en un `Alert` success.
 *
 * Presentacional: no hace las peticiones. Contiene un `<form>` propio: no se pone dentro de otro.
 */
export interface UserAccountActionsProps {
  user: UserAccountActionsUser;
  /** Se llama al confirmar la desactivación. */
  onDeactivate: () => void;
  /** Se llama al pulsar "Reactivar usuario". */
  onActivate: () => void;
  /** Se llama con la contraseña nueva ya validada. */
  onResetPassword: (password: string) => void;
  isDeactivating?: boolean;
  isActivating?: boolean;
  isResettingPassword?: boolean;
  /** Aviso de éxito (p. ej. "Usuario desactivado."). */
  notice?: ReactNode;
  /** Error de la API al desactivar o reactivar. */
  statusErrorMessage?: string;
  /** Error de la API al restablecer la contraseña. */
  passwordErrorMessage?: string;
  /** Explicación cuando no hay ninguna acción disponible (p. ej. un usuario demo). */
  lockedHint?: string;
  className?: string;
}

type PasswordField = 'password' | 'confirmation';
type PasswordValues = Record<PasswordField, string>;
type PasswordErrors = Partial<Record<PasswordField, string>>;

const EMPTY_PASSWORDS: PasswordValues = { password: '', confirmation: '' };

function validatePasswords(values: PasswordValues): { password?: string; errors: PasswordErrors } {
  const errors: PasswordErrors = {};
  const result = ResetPasswordInput.safeParse({ password: values.password });
  if (!result.success) errors.password = result.error.issues[0]?.message;
  if (values.confirmation === '') errors.confirmation = 'Repite la contraseña nueva.';
  else if (values.confirmation !== values.password) {
    errors.confirmation = 'Las contraseñas no coinciden.';
  }
  if (result.success && !errors.confirmation) return { password: result.data.password, errors };
  return { errors };
}

export function UserAccountActions({
  user,
  onDeactivate,
  onActivate,
  onResetPassword,
  isDeactivating = false,
  isActivating = false,
  isResettingPassword = false,
  notice,
  statusErrorMessage,
  passwordErrorMessage,
  lockedHint = 'No hay acciones disponibles sobre la cuenta de este usuario.',
  className,
}: UserAccountActionsProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const passwordTitleId = `${id}-password-title`;
  const passwordId = `${id}-password`;
  const confirmationId = `${id}-confirmation`;

  const canDeactivate = user.allowedActions.includes('deactivate');
  const canActivate = user.allowedActions.includes('activate');
  const canResetPassword = user.allowedActions.includes('resetPassword');

  const deactivateRef = useRef<HTMLButtonElement>(null);
  const activateRef = useRef<HTMLButtonElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);

  // --- Desactivar / reactivar -------------------------------------------------------------------
  const [confirmOpen, setConfirmOpen] = useState(false);
  // El error solo se muestra en el diálogo si se ha confirmado desde que se abrió (no uno anterior).
  const [confirmedInDialog, setConfirmedInDialog] = useState(false);
  // Acción contraria cuyo botón recibe el foco cuando cambie `user.active`.
  const focusAfterStatusChange = useRef<'activate' | 'deactivate' | null>(null);

  // Cuando cambia el estado (la API ha respondido), el diálogo se cierra en el mismo render.
  const [previousActive, setPreviousActive] = useState(user.active);
  if (previousActive !== user.active) {
    setPreviousActive(user.active);
    setConfirmOpen(false);
  }

  useEffect(() => {
    const target = focusAfterStatusChange.current;
    if (!target) return;
    focusAfterStatusChange.current = null;
    const button = (target === 'activate' ? activateRef : deactivateRef).current;
    (button ?? noticeRef.current)?.focus();
  }, [user.active]);

  function openConfirm(next: boolean) {
    if (next) setConfirmedInDialog(false);
    setConfirmOpen(next);
  }

  function confirmDeactivate() {
    setConfirmedInDialog(true);
    focusAfterStatusChange.current = 'activate';
    onDeactivate();
  }

  function activate() {
    focusAfterStatusChange.current = 'deactivate';
    onActivate();
  }

  // --- Restablecer la contraseña ----------------------------------------------------------------
  const [passwords, setPasswords] = useState<PasswordValues>(EMPTY_PASSWORDS);
  const [passwordSubmit, setPasswordSubmit] = useState<{
    values: PasswordValues;
    errors: PasswordErrors;
  }>({ values: EMPTY_PASSWORDS, errors: {} });
  const passwordErrorOf = (field: PasswordField) =>
    passwords[field] === passwordSubmit.values[field] ? passwordSubmit.errors[field] : undefined;

  // Al terminar la petición sin error, se vacían los campos y el foco vuelve al primero.
  const [wasResetting, setWasResetting] = useState(isResettingPassword);
  const [focusPasswordAfterReset, setFocusPasswordAfterReset] = useState(false);
  if (wasResetting !== isResettingPassword) {
    setWasResetting(isResettingPassword);
    if (!isResettingPassword && !passwordErrorMessage) {
      setPasswords(EMPTY_PASSWORDS);
      setPasswordSubmit({ values: EMPTY_PASSWORDS, errors: {} });
      setFocusPasswordAfterReset(true);
    }
  }

  useEffect(() => {
    if (!focusPasswordAfterReset) return;
    setFocusPasswordAfterReset(false);
    passwordRef.current?.focus();
  }, [focusPasswordAfterReset]);

  function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isResettingPassword) return;
    const { password, errors } = validatePasswords(passwords);
    setPasswordSubmit({ values: passwords, errors });
    if (password === undefined) {
      (errors.password ? passwordRef : confirmationRef).current?.focus();
      return;
    }
    onResetPassword(password);
  }

  const hasActions = canDeactivate || canActivate || canResetPassword;

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 sm:p-6',
        className,
      )}
    >
      <Heading id={titleId} level={3} as="h2">
        Cuenta
      </Heading>

      {notice && (
        <div ref={noticeRef} tabIndex={-1} className="rounded-md focus-visible:focus-ring">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-center gap-2 text-base text-fg">
          <span>Estado:</span>
          <Badge tone={user.active ? 'success' : 'neutral'} size="md">
            {user.active ? 'Activo' : 'Desactivado'}
          </Badge>
        </p>

        {statusErrorMessage && !confirmOpen && <Alert tone="danger">{statusErrorMessage}</Alert>}

        {canDeactivate && (
          <div className="flex flex-col items-start gap-2">
            <Text variant="small">
              Un usuario desactivado no puede iniciar sesión y se cierran sus sesiones abiertas.
            </Text>
            <Button
              ref={deactivateRef}
              variant="danger"
              leftIcon={<Icon name="x" size="md" />}
              onClick={() => openConfirm(true)}
            >
              Desactivar usuario
            </Button>
          </div>
        )}

        {canActivate && (
          <div className="flex flex-col items-start gap-2">
            <Text variant="small">Al reactivarlo, podrá volver a iniciar sesión.</Text>
            <Button
              ref={activateRef}
              variant="secondary"
              loading={isActivating}
              leftIcon={<Icon name="refresh" size="md" />}
              onClick={activate}
            >
              Reactivar usuario
            </Button>
          </div>
        )}

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={openConfirm}
          tone="danger"
          title={`¿Desactivar a ${user.name}?`}
          description="No podrá iniciar sesión y se cerrarán sus sesiones abiertas. Podrás reactivar la cuenta más tarde."
          confirmLabel="Desactivar"
          cancelLabel="Cancelar"
          onConfirm={confirmDeactivate}
          isConfirming={isDeactivating}
        >
          {statusErrorMessage && confirmedInDialog && !isDeactivating && (
            <Alert tone="danger">{statusErrorMessage}</Alert>
          )}
        </ConfirmDialog>
      </div>

      {canResetPassword && (
        <form
          noValidate
          aria-labelledby={passwordTitleId}
          onSubmit={handleResetPassword}
          className="flex flex-col gap-4 border-t border-border pt-5"
        >
          <div className="flex flex-col gap-1">
            <Heading id={passwordTitleId} level={4} as="h3">
              Restablecer contraseña
            </Heading>
            <Text variant="small">
              Se cerrarán sus sesiones abiertas: tendrá que iniciar sesión de nuevo con la
              contraseña nueva.
            </Text>
          </div>

          {passwordErrorMessage && <Alert tone="danger">{passwordErrorMessage}</Alert>}

          <FormField
            label="Contraseña nueva"
            htmlFor={passwordId}
            error={passwordErrorOf('password')}
            hint={`Al menos ${PASSWORD_MIN_LENGTH} caracteres.`}
            required
          >
            <Input
              ref={passwordRef}
              type="password"
              name="new-password"
              autoComplete="new-password"
              value={passwords.password}
              onChange={(event) =>
                setPasswords((current) => ({ ...current, password: event.target.value }))
              }
            />
          </FormField>

          <FormField
            label="Repite la contraseña nueva"
            htmlFor={confirmationId}
            error={passwordErrorOf('confirmation')}
            required
          >
            <Input
              ref={confirmationRef}
              type="password"
              name="new-password-confirmation"
              autoComplete="new-password"
              value={passwords.confirmation}
              onChange={(event) =>
                setPasswords((current) => ({ ...current, confirmation: event.target.value }))
              }
            />
          </FormField>

          <div>
            <Button
              type="submit"
              variant="secondary"
              loading={isResettingPassword}
              leftIcon={<Icon name="refresh" size="md" />}
            >
              Restablecer contraseña
            </Button>
          </div>
        </form>
      )}

      {!hasActions && <Text variant="muted">{lockedHint}</Text>}
    </section>
  );
}
