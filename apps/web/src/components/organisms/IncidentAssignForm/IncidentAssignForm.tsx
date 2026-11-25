import { AssignIncidentInput, type UserSummary } from '@incidapp/shared';
import { useId, useRef, useState, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { Button, Heading, Icon, Select, Spinner, type HeadingTag } from '../../atoms';
import { Alert, FormField } from '../../molecules';

export interface IncidentAssignFormProps {
  /** Usuarios activos del departamento propietario (`GET /api/incidents/:id/assignees`). */
  assignees: UserSummary[];
  /** Asignado actual (`incident.assignee?.id`), que aparece elegido al principio. */
  currentAssigneeId: string | null;
  /** Se llama con el usuario elegido, validado con `AssignIncidentInput`. */
  onAssign: (assigneeId: string) => void;
  /** Asignación en curso: botón en carga y sin reenvíos. */
  isPending?: boolean;
  /** Cargando los candidatos: indicador en lugar del selector. */
  isLoading?: boolean;
  /** Aviso de éxito (p. ej. "Incidencia asignada."). */
  notice?: string;
  /** Error de la API, en español. */
  errorMessage?: string;
  /** Título de la sección. */
  title?: string;
  /** Etiqueta del título (`h2` por defecto, bajo el `h1` del detalle). */
  headingAs?: HeadingTag;
  className?: string;
}

/**
 * Control de asignación del detalle de una incidencia (CA-03.15): selector "Asignar a" con los
 * usuarios activos del departamento propietario y el botón "Asignar".
 *
 * - Empieza con el asignado actual elegido. Al pulsar "Asignar" valida con `AssignIncidentInput` de
 *   `shared` (sin elegir a nadie, el error va junto al selector) y avisa con `onAssign(id)`.
 * - `notice` (éxito) y `errorMessage` (error de la API) se muestran en un `Alert`; la elección no se
 *   pierde si la API responde con error.
 * - Sin candidatos, lo explica y deshabilita el control.
 * - Presentacional: la página lo pinta solo si `incident.allowedActions` incluye `assign` (nunca por
 *   el rol) y hace la petición.
 */
export function IncidentAssignForm({
  assignees,
  currentAssigneeId,
  onAssign,
  isPending = false,
  isLoading = false,
  notice,
  errorMessage,
  title = 'Asignación',
  headingAs = 'h2',
  className,
}: IncidentAssignFormProps) {
  const id = useId();
  const headingId = `${id}-heading`;
  const selectRef = useRef<HTMLSelectElement>(null);
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? '');
  // Error del cliente y el valor con el que se produjo: desaparece al cambiar la elección.
  const [error, setError] = useState<{ value: string; message: string }>();

  const isEmpty = !isLoading && assignees.length === 0;
  const fieldError = error && error.value === assigneeId ? error.message : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || isLoading || isEmpty) return;
    const result = AssignIncidentInput.safeParse({ assigneeId });
    if (!result.success) {
      setError({ value: assigneeId, message: result.error.issues[0]?.message ?? '' });
      selectRef.current?.focus();
      return;
    }
    setError(undefined);
    onAssign(result.data.assigneeId);
  }

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-border bg-surface p-4',
        className,
      )}
    >
      <Heading level={3} as={headingAs} id={headingId}>
        {title}
      </Heading>

      {notice && <Alert tone="success">{notice}</Alert>}
      {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}

      {isLoading ? (
        <Spinner label="Cargando usuarios…" />
      ) : (
        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <FormField
            label="Asignar a"
            htmlFor={`${id}-assignee`}
            error={fieldError}
            hint={
              isEmpty ? 'No hay usuarios activos en el departamento de la incidencia.' : undefined
            }
            className="flex-1"
          >
            <Select
              ref={selectRef}
              name="assigneeId"
              value={assigneeId}
              disabled={isEmpty}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">Selecciona una persona</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </Select>
          </FormField>
          <Button
            type="submit"
            loading={isPending}
            disabled={isEmpty}
            leftIcon={<Icon name="user" size="md" />}
            className="sm:mt-7"
          >
            Asignar
          </Button>
        </form>
      )}
    </section>
  );
}
