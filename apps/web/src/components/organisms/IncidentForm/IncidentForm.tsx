import {
  CreateIncidentInput,
  Priority,
  UpdateIncidentInput,
  type IncidentTypeSummary,
} from '@incidapp/shared';
import { useEffect, useId, useRef, useState, type ElementType, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { PRIORITY_LABELS } from '@/lib/labels';
import { Button, buttonVariants, Icon, Input, Link, Select, Textarea } from '../../atoms';
import { Alert, FormField } from '../../molecules';

/** Campos del formulario (los nombres coinciden con los de `CreateIncidentInput`). */
export type IncidentFormField = 'title' | 'description' | 'typeId' | 'priority' | 'dueDate';

/** Errores por campo, p. ej. los `details` de un 400 de la API que traduce la página. */
export type IncidentFormFieldErrors = Partial<Record<IncidentFormField, string>>;

/** Valores iniciales (en la edición, los de la incidencia). */
export interface IncidentFormDefaultValues {
  title?: string;
  description?: string;
  typeId?: string;
  priority?: Priority;
  /** Fecha objetivo `AAAA-MM-DD`, o `null` si no tiene. */
  dueDate?: string | null;
}

interface IncidentFormBaseProps {
  /** Valores iniciales. Se leen al montar: para empezar de nuevo, cambia la `key` del formulario. */
  defaultValues?: IncidentFormDefaultValues;
  /** Petición en curso: botón en carga y sin reenvíos. */
  isSubmitting?: boolean;
  /** Errores de la API por campo (p. ej. `{ typeId: 'El tipo de incidencia no existe.' }`). */
  fieldErrors?: IncidentFormFieldErrors;
  /** Error general de la API, en español. */
  errorMessage?: string;
  /** Destino del enlace "Cancelar" (el listado en el alta, el detalle en la edición). */
  cancelHref: string;
  /** Componente de enlace del enrutador; recibe el destino en `to`. */
  linkAs?: ElementType;
  className?: string;
}

/** Alta de una incidencia: título, descripción, tipo, prioridad y fecha objetivo opcional. */
export interface IncidentCreateFormProps extends IncidentFormBaseProps {
  mode: 'create';
  /** Catálogo de tipos con su departamento (`GET /api/incident-types`). */
  types: IncidentTypeSummary[];
  /** Se llama con los datos validados con `CreateIncidentInput`. */
  onSubmit: (values: CreateIncidentInput) => void;
}

/** Edición de una incidencia: los mismos campos sin el tipo (no se puede cambiar). */
export interface IncidentEditFormProps extends IncidentFormBaseProps {
  mode: 'edit';
  /** Se llama con los datos validados con `UpdateIncidentInput` (`dueDate: null` la quita). */
  onSubmit: (values: UpdateIncidentInput) => void;
}

/**
 * Formulario de alta y edición de incidencias (CA-03.13, CA-03.15).
 *
 * - Valida en el cliente al enviar con `CreateIncidentInput` (alta) o `UpdateIncidentInput`
 *   (edición) de `shared`; cada error va junto a su campo (`aria-invalid` + `aria-describedby`, con
 *   `FormField`) y el foco va al primer campo con error. El error de un campo desaparece en cuanto
 *   cambia su valor.
 * - `fieldErrors` (errores de la API) se muestran igual, junto a su campo, y el foco va al primero
 *   cuando llegan. Lo escrito no se pierde.
 * - **Alta:** al elegir el tipo, la ayuda del campo dice qué departamento la recibirá (se anuncia a
 *   los lectores de pantalla). La prioridad empieza en "Media" y la fecha objetivo es opcional.
 * - **Edición:** sin el campo de tipo. Vaciar la fecha objetivo la quita (`dueDate: null`). Se
 *   envían todos los campos; la API solo aplica (y registra) lo que cambia.
 * - Presentacional: no hace la petición ni mira permisos. `errorMessage` va en un `Alert` danger.
 */
export type IncidentFormProps = IncidentCreateFormProps | IncidentEditFormProps;

const FIELD_ORDER: readonly IncidentFormField[] = [
  'title',
  'description',
  'typeId',
  'priority',
  'dueDate',
];

type Values = Record<IncidentFormField, string>;

function isField(key: PropertyKey | undefined): key is IncidentFormField {
  return typeof key === 'string' && (FIELD_ORDER as readonly string[]).includes(key);
}

export function IncidentForm(props: IncidentFormProps) {
  const {
    mode,
    defaultValues,
    isSubmitting = false,
    fieldErrors,
    errorMessage,
    cancelHref,
    linkAs,
    className,
  } = props;
  const isEdit = mode === 'edit';
  const types = props.mode === 'create' ? props.types : [];

  const id = useId();
  const ids = {
    title: `${id}-title`,
    description: `${id}-description`,
    typeId: `${id}-type`,
    priority: `${id}-priority`,
    dueDate: `${id}-due-date`,
  } satisfies Record<IncidentFormField, string>;

  const refs = {
    title: useRef<HTMLInputElement>(null),
    description: useRef<HTMLTextAreaElement>(null),
    typeId: useRef<HTMLSelectElement>(null),
    priority: useRef<HTMLSelectElement>(null),
    dueDate: useRef<HTMLInputElement>(null),
  } satisfies Record<IncidentFormField, unknown>;

  const [values, setValues] = useState<Values>(() => ({
    title: defaultValues?.title ?? '',
    description: defaultValues?.description ?? '',
    typeId: defaultValues?.typeId ?? '',
    priority: defaultValues?.priority ?? 'MEDIUM',
    dueDate: defaultValues?.dueDate ?? '',
  }));

  // Último envío: los valores con los que se validó y sus errores. Un error (del cliente o de la API)
  // solo se muestra mientras el campo conserva el valor con el que se envió.
  const [submitted, setSubmitted] = useState<{
    values: Values;
    errors: IncidentFormFieldErrors;
    formError?: string;
  }>(() => ({ values, errors: {} }));

  function errorOf(field: IncidentFormField): string | undefined {
    if (values[field] !== submitted.values[field]) return undefined;
    return submitted.errors[field] ?? fieldErrors?.[field];
  }

  // Cuando llegan errores de la API, el foco va al primer campo con error (no al montar).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const first = FIELD_ORDER.find((field) => fieldErrors?.[field]);
    if (first) refs[first].current?.focus();
    // Solo cuando cambian los errores de la API (los `ref` no cambian).
  }, [fieldErrors]);

  function setValue(field: IncidentFormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    function reject(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
      const errors: IncidentFormFieldErrors = {};
      let formError: string | undefined;
      for (const issue of issues) {
        const field = issue.path[0];
        if (isField(field)) errors[field] ??= issue.message;
        else if (issue.path.length === 0) formError ??= issue.message;
      }
      setSubmitted({ values, errors, formError });
      const first = FIELD_ORDER.find((field) => errors[field]);
      if (first) refs[first].current?.focus();
    }

    if (props.mode === 'create') {
      const result = CreateIncidentInput.safeParse({
        title: values.title,
        description: values.description,
        typeId: values.typeId,
        priority: values.priority,
        dueDate: values.dueDate === '' ? undefined : values.dueDate,
      });
      if (!result.success) return reject(result.error.issues);
      setSubmitted({ values, errors: {} });
      props.onSubmit(result.data);
      return;
    }

    const result = UpdateIncidentInput.safeParse({
      title: values.title,
      description: values.description,
      priority: values.priority,
      dueDate: values.dueDate === '' ? null : values.dueDate,
    });
    if (!result.success) return reject(result.error.issues);
    setSubmitted({ values, errors: {} });
    props.onSubmit(result.data);
  }

  const selectedType = types.find((type) => type.id === values.typeId);
  const typeHint = selectedType
    ? `Lo recibirá: ${selectedType.department.name}.`
    : 'Según el tipo, la incidencia llega a un departamento u otro.';
  const cancelTarget = linkAs ? { as: linkAs, to: cancelHref } : { href: cancelHref };

  return (
    <form noValidate onSubmit={handleSubmit} className={cn('flex flex-col gap-5', className)}>
      {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}
      {submitted.formError && <Alert tone="danger">{submitted.formError}</Alert>}

      <FormField label="Título" htmlFor={ids.title} error={errorOf('title')} required>
        <Input
          ref={refs.title}
          name="title"
          autoComplete="off"
          value={values.title}
          onChange={(event) => setValue('title', event.target.value)}
        />
      </FormField>

      <FormField
        label="Descripción"
        htmlFor={ids.description}
        error={errorOf('description')}
        required
      >
        <Textarea
          ref={refs.description}
          name="description"
          rows={6}
          value={values.description}
          onChange={(event) => setValue('description', event.target.value)}
        />
      </FormField>

      {mode === 'create' && (
        <FormField
          label="Tipo"
          htmlFor={ids.typeId}
          error={errorOf('typeId')}
          hint={<span aria-live="polite">{typeHint}</span>}
          required
        >
          <Select
            ref={refs.typeId}
            name="typeId"
            value={values.typeId}
            onChange={(event) => setValue('typeId', event.target.value)}
          >
            <option value="">Selecciona un tipo</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField label="Prioridad" htmlFor={ids.priority} error={errorOf('priority')} required>
          <Select
            ref={refs.priority}
            name="priority"
            value={values.priority}
            onChange={(event) => setValue('priority', event.target.value)}
          >
            {Priority.options.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          label="Fecha objetivo"
          htmlFor={ids.dueDate}
          error={errorOf('dueDate')}
          hint={isEdit ? 'Opcional. Déjala vacía para quitarla.' : 'Opcional.'}
        >
          <Input
            ref={refs.dueDate}
            type="date"
            name="dueDate"
            value={values.dueDate}
            onChange={(event) => setValue('dueDate', event.target.value)}
          />
        </FormField>
      </div>

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
          {isEdit ? 'Guardar cambios' : 'Crear incidencia'}
        </Button>
      </div>
    </form>
  );
}
