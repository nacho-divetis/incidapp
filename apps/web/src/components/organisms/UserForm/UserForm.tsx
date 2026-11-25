import {
  CreateUserInput,
  PASSWORD_MIN_LENGTH,
  Role,
  UpdateUserInput,
  type DepartmentSummary,
  type UserAction,
} from '@incidapp/shared';
import { useEffect, useId, useRef, useState, type ElementType, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { ROLE_LABELS } from '@/lib/labels';
import { Button, buttonVariants, Icon, Input, Link, Select } from '../../atoms';
import { Alert, CheckboxGroup, FormField } from '../../molecules';

/** Campos del formulario (los nombres coinciden con los de `CreateUserInput`). */
export type UserFormField = 'name' | 'email' | 'role' | 'departmentIds' | 'password';

/** Errores por campo, p. ej. el 409 de email repetido que traduce la página. */
export type UserFormFieldErrors = Partial<Record<UserFormField, string>>;

/** Valores iniciales (en la edición, los del usuario). */
export interface UserFormDefaultValues {
  name?: string;
  email?: string;
  role?: Role;
  departmentIds?: string[];
}

interface UserFormBaseProps {
  /** Catálogo de departamentos (`GET /api/departments`). */
  departments: DepartmentSummary[];
  /** Valores iniciales. Se leen al montar: para empezar de nuevo, cambia la `key` del formulario. */
  defaultValues?: UserFormDefaultValues;
  /** Petición en curso: botón en carga y sin reenvíos. */
  isSubmitting?: boolean;
  /** Errores de la API por campo (p. ej. `{ email: 'Ya existe un usuario con ese email.' }`). */
  fieldErrors?: UserFormFieldErrors;
  /** Error general de la API, en español. */
  errorMessage?: string;
  /** Destino del enlace "Cancelar" (normalmente, el listado). */
  cancelHref: string;
  /** Componente de enlace del enrutador; recibe el destino en `to`. */
  linkAs?: ElementType;
  className?: string;
}

/** Alta de un usuario: todos los campos, incluida la contraseña inicial. */
export interface UserCreateFormProps extends UserFormBaseProps {
  mode: 'create';
  /** Se llama con los datos validados con `CreateUserInput`. */
  onSubmit: (values: CreateUserInput) => void;
}

/** Edición de un usuario: sin contraseña; los campos que no permite `allowedActions`, deshabilitados. */
export interface UserEditFormProps extends UserFormBaseProps {
  mode: 'edit';
  /** Acciones permitidas sobre el usuario (`UserAdmin.allowedActions`). */
  allowedActions: UserAction[];
  /** Explicación de los campos bloqueados (p. ej. "Los usuarios demo no se pueden modificar."). */
  lockedHint?: string;
  /** Se llama con los campos que se pueden cambiar, validados con `UpdateUserInput`. */
  onSubmit: (values: UpdateUserInput) => void;
}

/**
 * Formulario de alta y edición de usuarios (CA-02.19): nombre, email, rol, departamentos (casillas)
 * y, solo en el alta, la contraseña inicial.
 *
 * - Valida en el cliente al enviar con `CreateUserInput` (alta) o `UpdateUserInput` (edición) de
 *   `shared`; cada error va junto a su campo (`aria-invalid` + `aria-describedby`, con `FormField` y
 *   `CheckboxGroup`) y el foco va al primer campo con error. El error de un campo desaparece en
 *   cuanto cambia su valor.
 * - `fieldErrors` (errores de la API, p. ej. el 409 de email repetido) se muestran igual, junto a su
 *   campo, y el foco va al primero cuando llegan.
 * - **Edición:** un campo cuya `UserAction` (`rename`, `changeEmail`, `changeRole`,
 *   `changeDepartments`) no está en `allowedActions` aparece deshabilitado con una explicación
 *   (`lockedHint`) y no se envía. Se envían todos los demás (la API solo aplica lo que cambia).
 *   El formulario no mira el rol ni recalcula permisos.
 * - En el alta, el rol empieza en "Usuario" (el de menos privilegios).
 * - Presentacional: no hace la petición. `errorMessage` se muestra en un `Alert` danger.
 */
export type UserFormProps = UserCreateFormProps | UserEditFormProps;

type EditableField = Exclude<UserFormField, 'password'>;

/** `UserAction` que hace falta para cambiar cada campo en la edición. */
const FIELD_ACTION = {
  name: 'rename',
  email: 'changeEmail',
  role: 'changeRole',
  departmentIds: 'changeDepartments',
} as const satisfies Record<EditableField, UserAction>;

const FIELD_ORDER: readonly UserFormField[] = [
  'name',
  'email',
  'role',
  'departmentIds',
  'password',
];

const DEFAULT_LOCKED_HINT = 'Este dato no se puede cambiar en este usuario.';

interface Values {
  name: string;
  email: string;
  role: Role;
  departmentIds: string[];
  password: string;
}

function sameValue(a: string | string[], b: string | string[]): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }
  return a === b;
}

function isField(key: PropertyKey | undefined): key is UserFormField {
  return typeof key === 'string' && (FIELD_ORDER as readonly string[]).includes(key);
}

export function UserForm(props: UserFormProps) {
  const {
    mode,
    departments,
    defaultValues,
    isSubmitting = false,
    fieldErrors,
    errorMessage,
    cancelHref,
    linkAs,
    className,
  } = props;
  const isEdit = props.mode === 'edit';
  const allowedActions = props.mode === 'edit' ? props.allowedActions : undefined;
  const lockedHint = (props.mode === 'edit' && props.lockedHint) || DEFAULT_LOCKED_HINT;

  const id = useId();
  const ids = {
    name: `${id}-name`,
    email: `${id}-email`,
    role: `${id}-role`,
    departmentIds: `${id}-departments`,
    password: `${id}-password`,
  } satisfies Record<UserFormField, string>;

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLSelectElement>(null);
  const departmentsRef = useRef<HTMLFieldSetElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<Values>(() => ({
    name: defaultValues?.name ?? '',
    email: defaultValues?.email ?? '',
    role: defaultValues?.role ?? 'USER',
    departmentIds: defaultValues?.departmentIds ?? [],
    password: '',
  }));

  // Último envío: los valores con los que se validó y sus errores. Un error (del cliente o de la API)
  // solo se muestra mientras el campo conserva el valor con el que se envió.
  const [submitted, setSubmitted] = useState<{
    values: Values;
    errors: UserFormFieldErrors;
    formError?: string;
  }>(() => ({ values, errors: {} }));

  function errorOf(field: UserFormField): string | undefined {
    if (!sameValue(values[field], submitted.values[field])) return undefined;
    return submitted.errors[field] ?? fieldErrors?.[field];
  }

  function isLocked(field: UserFormField): boolean {
    if (!allowedActions || field === 'password') return false;
    return !allowedActions.includes(FIELD_ACTION[field]);
  }

  function focusField(field: UserFormField) {
    if (field === 'departmentIds') {
      departmentsRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
      return;
    }
    const refs = { name: nameRef, email: emailRef, role: roleRef, password: passwordRef };
    refs[field].current?.focus();
  }

  // Cuando llegan errores de la API, el foco va al primer campo con error (no al montar).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const first = FIELD_ORDER.find((field) => fieldErrors?.[field]);
    if (first) focusField(first);
    // Solo cuando cambian los errores de la API (`focusField` solo usa refs).
  }, [fieldErrors]);

  function setValue<K extends keyof Values>(field: K, value: Values[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    function reject(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
      const errors: UserFormFieldErrors = {};
      let formError: string | undefined;
      for (const issue of issues) {
        const field = issue.path[0];
        if (isField(field)) errors[field] ??= issue.message;
        else if (issue.path.length === 0) formError ??= issue.message;
      }
      setSubmitted({ values, errors, formError });
      const first = FIELD_ORDER.find((field) => errors[field]);
      if (first) focusField(first);
    }

    if (props.mode === 'create') {
      const result = CreateUserInput.safeParse(values);
      if (!result.success) return reject(result.error.issues);
      setSubmitted({ values, errors: {} });
      props.onSubmit(result.data);
      return;
    }

    const editable = (Object.keys(FIELD_ACTION) as EditableField[]).filter(
      (field) => !isLocked(field),
    );
    const result = UpdateUserInput.safeParse(
      Object.fromEntries(editable.map((field) => [field, values[field]])),
    );
    if (!result.success) return reject(result.error.issues);
    setSubmitted({ values, errors: {} });
    props.onSubmit(result.data);
  }

  const hintFor = (field: UserFormField) => (isLocked(field) ? lockedHint : undefined);
  const cancelTarget = linkAs ? { as: linkAs, to: cancelHref } : { href: cancelHref };

  return (
    <form noValidate onSubmit={handleSubmit} className={cn('flex flex-col gap-5', className)}>
      {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}
      {submitted.formError && <Alert tone="danger">{submitted.formError}</Alert>}

      <FormField
        label="Nombre"
        htmlFor={ids.name}
        error={errorOf('name')}
        hint={hintFor('name')}
        required
      >
        <Input
          ref={nameRef}
          name="name"
          autoComplete="off"
          value={values.name}
          disabled={isLocked('name')}
          onChange={(event) => setValue('name', event.target.value)}
        />
      </FormField>

      <FormField
        label="Email"
        htmlFor={ids.email}
        error={errorOf('email')}
        hint={hintFor('email')}
        required
      >
        <Input
          ref={emailRef}
          type="email"
          name="email"
          autoComplete="off"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={values.email}
          disabled={isLocked('email')}
          onChange={(event) => setValue('email', event.target.value)}
        />
      </FormField>

      <FormField
        label="Rol"
        htmlFor={ids.role}
        error={errorOf('role')}
        hint={hintFor('role')}
        required
      >
        <Select
          ref={roleRef}
          name="role"
          value={values.role}
          disabled={isLocked('role')}
          onChange={(event) => setValue('role', event.target.value as Role)}
        >
          {Role.options.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </FormField>

      <CheckboxGroup
        ref={departmentsRef}
        id={ids.departmentIds}
        legend="Departamentos"
        name="departmentIds"
        required
        columns={2}
        options={departments.map((department) => ({
          value: department.id,
          label: `${department.name} (${department.code})`,
        }))}
        value={values.departmentIds}
        onChange={(next) => setValue('departmentIds', next)}
        error={errorOf('departmentIds')}
        hint={hintFor('departmentIds')}
        disabled={isLocked('departmentIds')}
        emptyMessage="No hay departamentos disponibles."
      />

      {mode === 'create' && (
        <FormField
          label="Contraseña inicial"
          htmlFor={ids.password}
          error={errorOf('password')}
          hint={`Al menos ${PASSWORD_MIN_LENGTH} caracteres. Comunícasela al usuario por un canal seguro.`}
          required
        >
          <Input
            ref={passwordRef}
            type="password"
            name="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) => setValue('password', event.target.value)}
          />
        </FormField>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          {...cancelTarget}
          className={cn(
            buttonVariants({ variant: 'secondary' }),
            'no-underline hover:bg-neutral-bg hover:text-fg',
          )}
        >
          Cancelar
        </Link>
        <Button
          type="submit"
          loading={isSubmitting}
          leftIcon={<Icon name={isEdit ? 'check' : 'plus'} size="md" />}
        >
          {isEdit ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  );
}
