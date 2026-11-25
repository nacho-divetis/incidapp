import {
  INCIDENT_SEARCH_MAX_LENGTH,
  Priority,
  Status,
  type DepartmentSummary,
  type IncidentListQuery,
} from '@incidapp/shared';
import { useId, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/labels';
import { Checkbox, Input, Select } from '../../atoms';
import { FormField } from '../../molecules';

/**
 * Valor de los filtros del listado: los de `IncidentListQuery` sin la página. "Asignadas a mí" y el
 * texto de búsqueda siempre tienen valor (`false` y `''` cuando no se filtra).
 */
export type IncidentFiltersValue = Pick<
  IncidentListQuery,
  'status' | 'priority' | 'departmentId'
> & {
  assignedToMe: boolean;
  q: string;
};

/** Filtros vacíos: todas las incidencias visibles. */
export const EMPTY_INCIDENT_FILTERS: IncidentFiltersValue = { assignedToMe: false, q: '' };

export interface IncidentFiltersProps {
  /** Filtros actuales (controlado). */
  value: IncidentFiltersValue;
  /** Se llama con los filtros nuevos cada vez que cambia uno (también con cada tecla del buscador). */
  onChange: (value: IncidentFiltersValue) => void;
  /** Catálogo de departamentos para el filtro de departamento. */
  departments: DepartmentSummary[];
  /** Nombre accesible de la zona de filtros. */
  label?: string;
  className?: string;
}

/**
 * Filtros del listado de incidencias (CA-03.12): estado, prioridad, departamento (desplegables con
 * "Todos"), la casilla "Asignadas a mí" y un buscador por código o título.
 *
 * - Controlado: no guarda estado; avisa con `onChange(filtros)` en cada cambio. La página decide qué
 *   hacer (volver a la página 1, esperar a que se deje de escribir en el buscador…).
 * - Es un formulario con `role="search"`; pulsar Intro en el buscador no recarga la página.
 * - Presentacional: no hace peticiones ni mira el rol; los filtros nunca amplían lo visible porque
 *   eso lo decide la API.
 */
export function IncidentFilters({
  value,
  onChange,
  departments,
  label = 'Filtros de incidencias',
  className,
}: IncidentFiltersProps) {
  const id = useId();

  function update(changes: Partial<IncidentFiltersValue>) {
    onChange({ ...value, ...changes });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form
      role="search"
      aria-label={label}
      noValidate
      onSubmit={handleSubmit}
      className={cn(
        'grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      <FormField label="Buscar" htmlFor={`${id}-q`} className="sm:col-span-2 lg:col-span-4">
        <Input
          type="search"
          name="q"
          placeholder="Código o título"
          autoComplete="off"
          maxLength={INCIDENT_SEARCH_MAX_LENGTH}
          value={value.q}
          onChange={(event) => update({ q: event.target.value })}
        />
      </FormField>

      <FormField label="Estado" htmlFor={`${id}-status`}>
        <Select
          name="status"
          value={value.status ?? ''}
          onChange={(event) =>
            update({ status: (event.target.value || undefined) as Status | undefined })
          }
        >
          <option value="">Todos</option>
          {Status.options.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Prioridad" htmlFor={`${id}-priority`}>
        <Select
          name="priority"
          value={value.priority ?? ''}
          onChange={(event) =>
            update({ priority: (event.target.value || undefined) as Priority | undefined })
          }
        >
          <option value="">Todas</option>
          {Priority.options.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Departamento" htmlFor={`${id}-department`}>
        <Select
          name="departmentId"
          value={value.departmentId ?? ''}
          onChange={(event) => update({ departmentId: event.target.value || undefined })}
        >
          <option value="">Todos</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="flex items-end pb-2">
        <Checkbox
          name="assignedToMe"
          label="Asignadas a mí"
          checked={value.assignedToMe}
          onChange={(event) => update({ assignedToMe: event.target.checked })}
        />
      </div>
    </form>
  );
}
