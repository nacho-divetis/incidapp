import type { CreateUserInput } from '@incidapp/shared';
import { useMemo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { Spinner } from '../../components/atoms';
import { Alert, PageHeader } from '../../components/molecules';
import { UserForm, type UserFormField } from '../../components/organisms';
import { USERS_PATH } from '../../app/paths';
import { ApiError } from '../../lib/api/client';
import { errorMessageOf, formErrorsOf, type FormErrors } from '../../lib/api/error-messages';
import { useDepartments } from '../../queries/departments';
import { useCreateUser } from '../../queries/users';
import type { UsersPageLocationState } from '../UsersPage';

const FORM_FIELDS: readonly UserFormField[] = [
  'name',
  'email',
  'role',
  'departmentIds',
  'password',
];

/** Error del alta repartido por campo: un 409 es siempre el email repetido (CA-02.19). */
function createErrorsOf(error: unknown): FormErrors<UserFormField> {
  if (error instanceof ApiError && error.status === 409) {
    return { fieldErrors: { email: error.message } };
  }
  return formErrorsOf(error, FORM_FIELDS);
}

/**
 * Alta de un usuario (`/admin/usuarios/nuevo`, CA-02.19). Va dentro de `RequireAction('manageUsers')`.
 * Carga el catálogo de departamentos para las casillas; al crear, vuelve al listado con el aviso
 * "Usuario creado.". El email repetido (409) se muestra junto al campo "Email".
 */
export function UserCreatePage() {
  const departments = useDepartments();
  const createUser = useCreateUser();
  const navigate = useNavigate();
  const errors = useMemo(() => createErrorsOf(createUser.error), [createUser.error]);

  function submit(values: CreateUserInput) {
    createUser.mutate(values, {
      onSuccess: (user) => {
        const state: UsersPageLocationState = { notice: `Usuario ${user.name} creado.` };
        void navigate(USERS_PATH, { state });
      },
    });
  }

  let content;
  if (departments.isPending) {
    content = <Spinner label="Cargando el formulario…" />;
  } else if (departments.isError) {
    content = <Alert tone="danger">{errorMessageOf(departments.error)}</Alert>;
  } else {
    content = (
      <UserForm
        mode="create"
        departments={departments.data}
        onSubmit={submit}
        // Tras el éxito sigue bloqueado hasta que la navegación desmonta la página.
        isSubmitting={createUser.isPending || createUser.isSuccess}
        fieldErrors={errors.fieldErrors}
        errorMessage={errors.message}
        cancelHref={USERS_PATH}
        linkAs={RouterLink}
      />
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Nuevo usuario"
        description="El usuario podrá iniciar sesión con este email y la contraseña inicial."
      />
      {content}
    </div>
  );
}
