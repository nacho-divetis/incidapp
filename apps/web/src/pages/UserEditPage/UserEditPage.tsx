import { isDemoUserEmail, type UpdateUserInput, type UserAdmin } from '@incidapp/shared';
import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { Link, Spinner, Text } from '../../components/atoms';
import { Alert, PageHeader } from '../../components/molecules';
import { UserAccountActions, UserForm, type UserFormField } from '../../components/organisms';
import { USERS_PATH } from '../../app/paths';
import { ApiError } from '../../lib/api/client';
import { errorMessageOf, formErrorsOf, type FormErrors } from '../../lib/api/error-messages';
import { useCurrentUser } from '../../queries/auth';
import { useDepartments } from '../../queries/departments';
import {
  useResetUserPassword,
  useSetUserActive,
  useUpdateUser,
  useUser,
} from '../../queries/users';
import type { UsersPageLocationState } from '../UsersPage';

const FORM_FIELDS: readonly UserFormField[] = ['name', 'email', 'role', 'departmentIds'];

const NOT_FOUND_MESSAGE = 'No existe ese usuario.';
const DEMO_FORM_HINT = 'Los usuarios demo no se pueden modificar: solo se puede cambiar el nombre.';
const DEMO_ACCOUNT_HINT = 'Los usuarios demo no se pueden desactivar ni cambiar de contraseña.';
const SELF_FORM_HINT = 'No puedes cambiar tu propio rol.';
const PASSWORD_RESET_NOTICE = 'Contraseña restablecida. El usuario deberá iniciar sesión de nuevo.';

/**
 * Error de la edición repartido por campo. Un 409 es el email repetido solo si el envío cambiaba el
 * email; si no, es una regla de negocio (usuario demo, uno mismo) y va al aviso general.
 */
function updateErrorsOf(
  error: unknown,
  sent: UpdateUserInput | undefined,
  currentEmail: string | undefined,
): FormErrors<UserFormField> {
  if (error instanceof ApiError && error.status === 409) {
    const changedEmail = sent?.email !== undefined && sent.email !== currentEmail;
    return changedEmail ? { fieldErrors: { email: error.message } } : { message: error.message };
  }
  return formErrorsOf(error, FORM_FIELDS);
}

/**
 * Explicación de los datos bloqueados. Qué se bloquea lo deciden las `allowedActions` de la API; aquí
 * solo se elige el texto que explica el motivo (usuario demo o el propio Admin).
 */
function lockedHintsOf(user: UserAdmin, currentUserId: string | undefined) {
  if (isDemoUserEmail(user.email)) return { form: DEMO_FORM_HINT, account: DEMO_ACCOUNT_HINT };
  if (user.id === currentUserId) return { form: SELF_FORM_HINT, account: undefined };
  return { form: undefined, account: undefined };
}

/**
 * Edición de un usuario (`/admin/usuarios/:id`, CA-02.19 a CA-02.21). Va dentro de
 * `RequireAction('manageUsers')`.
 *
 * - Formulario `UserForm` con las `allowedActions` del usuario: los campos que no permiten aparecen
 *   deshabilitados con una explicación. Al guardar vuelve al listado con un aviso de éxito; el email
 *   repetido (409) se muestra junto al campo "Email".
 * - `UserAccountActions`: desactivar (con confirmación), reactivar y restablecer la contraseña, cada
 *   una solo si su `UserAction` está en `allowedActions`. El estado nuevo se ve en la página (la
 *   respuesta de la API actualiza la caché) y en el listado.
 * - Carga, 404 ("No existe ese usuario.") y otros errores con su mensaje en español.
 */
export function UserEditPage() {
  const { id = '' } = useParams();
  const user = useUser(id);
  const departments = useDepartments();
  const { data: currentUser } = useCurrentUser();
  const updateUser = useUpdateUser(id);
  const setActive = useSetUserActive(id);
  const resetPassword = useResetUserPassword(id);
  const navigate = useNavigate();
  const [accountNotice, setAccountNotice] = useState<string>();

  // Referencia estable mientras no llegue otro error: `UserForm` lleva el foco al campo con error
  // cada vez que cambian sus `fieldErrors`.
  const currentEmail = user.data?.email;
  const formErrors = useMemo(
    () => updateErrorsOf(updateUser.error, updateUser.variables, currentEmail),
    [updateUser.error, updateUser.variables, currentEmail],
  );

  function submit(values: UpdateUserInput) {
    updateUser.mutate(values, {
      onSuccess: (saved) => {
        const state: UsersPageLocationState = { notice: `Cambios de ${saved.name} guardados.` };
        void navigate(USERS_PATH, { state });
      },
    });
  }

  function changeActive(active: boolean) {
    setAccountNotice(undefined);
    setActive.mutate(active, {
      onSuccess: () =>
        setAccountNotice(
          active ? 'Usuario reactivado.' : 'Usuario desactivado. Se han cerrado sus sesiones.',
        ),
    });
  }

  function resetUserPassword(password: string) {
    setAccountNotice(undefined);
    resetPassword.mutate(password, { onSuccess: () => setAccountNotice(PASSWORD_RESET_NOTICE) });
  }

  const backLink = (
    <Link as={RouterLink} to={USERS_PATH}>
      Volver al listado de usuarios
    </Link>
  );

  if (user.isPending || departments.isPending) {
    return <Spinner label="Cargando el usuario…" />;
  }

  if (user.isError || departments.isError) {
    const error = user.error ?? departments.error;
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={notFound ? NOT_FOUND_MESSAGE : 'Editar usuario'} />
        {!notFound && <Alert tone="danger">{errorMessageOf(error)}</Alert>}
        <Text>{backLink}</Text>
      </div>
    );
  }

  const hints = lockedHintsOf(user.data, currentUser?.id);
  const statusMutationActive = setActive.variables;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Editar usuario" description={`${user.data.name} · ${user.data.email}`} />
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <UserForm
          key={`${user.data.id}:${user.dataUpdatedAt}`}
          className="lg:col-span-2"
          mode="edit"
          departments={departments.data}
          defaultValues={{
            name: user.data.name,
            email: user.data.email,
            role: user.data.role,
            departmentIds: user.data.departments.map((department) => department.id),
          }}
          allowedActions={user.data.allowedActions}
          lockedHint={hints.form}
          onSubmit={submit}
          // Tras el éxito sigue bloqueado hasta que la navegación desmonta la página.
          isSubmitting={updateUser.isPending || updateUser.isSuccess}
          fieldErrors={formErrors.fieldErrors}
          errorMessage={formErrors.message}
          cancelHref={USERS_PATH}
          linkAs={RouterLink}
        />
        <UserAccountActions
          user={user.data}
          onDeactivate={() => changeActive(false)}
          onActivate={() => changeActive(true)}
          onResetPassword={resetUserPassword}
          isDeactivating={setActive.isPending && statusMutationActive === false}
          isActivating={setActive.isPending && statusMutationActive === true}
          isResettingPassword={resetPassword.isPending}
          notice={accountNotice}
          statusErrorMessage={setActive.error ? errorMessageOf(setActive.error) : undefined}
          passwordErrorMessage={
            resetPassword.error ? errorMessageOf(resetPassword.error) : undefined
          }
          lockedHint={hints.account}
        />
      </div>
    </div>
  );
}
