import type {
  DepartmentSummary,
  IncidentTypeSummary,
  Priority,
  Status,
  UserSummary,
} from '@incidapp/shared';
import type { IncidentVisibilityScope } from '../authorization/authorization-policy';

/** Incidencia tal como la guarda el repositorio, con sus relaciones resueltas y sin permisos. */
export interface IncidentRecord {
  id: string;
  /** `INC-AAAA-NNNN`. */
  code: string;
  title: string;
  description: string;
  type: Omit<IncidentTypeSummary, 'department'>;
  /** Departamento propietario. */
  department: DepartmentSummary;
  priority: Priority;
  status: Status;
  createdBy: UserSummary;
  assignee: UserSummary | null;
  /** Fecha objetivo `AAAA-MM-DD` o `null`. */
  dueDate: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

/** Datos de una incidencia nueva: todos los decide el caso de uso, ninguno el cliente. */
export interface NewIncidentData {
  code: string;
  title: string;
  description: string;
  typeId: string;
  departmentId: string;
  priority: Priority;
  status: Status;
  createdById: string;
  dueDate: string | null;
  createdAt: Date;
}

/** Cambios de una incidencia. Solo se tocan los campos presentes; `updatedAt` siempre. */
export interface IncidentChanges {
  title?: string;
  description?: string;
  priority?: Priority;
  dueDate?: string | null;
  assignedToId?: string;
  updatedAt: Date;
}

/** Filtros del listado (CA-03.8), ya convertidos: se combinan con Y y nunca amplían el `scope`. */
export interface IncidentListFilters {
  status?: Status;
  priority?: Priority;
  departmentId?: string;
  /** Solo las asignadas a este usuario ("Asignadas a mí"). */
  assignedToId?: string;
  /** Texto que se busca, sin distinguir mayúsculas, en el código y el título. */
  q?: string;
}

export interface IncidentListQueryData {
  /** Qué incidencias ve el actor: lo decide la `AuthorizationPolicy`. */
  scope: IncidentVisibilityScope;
  filters: IncidentListFilters;
  /** Página, desde 1. */
  page: number;
  pageSize: number;
}

/** Puerto de las incidencias (tabla `incidents`). */
export interface IncidentRepository {
  /** La incidencia con ese id, o `null` si no existe (también si `id` no es un UUID). */
  findById(id: string): Promise<IncidentRecord | null>;
  /**
   * Como `findById`, pero bloquea la fila hasta el fin de la transacción (`SELECT … FOR UPDATE`).
   * Se usa dentro de la `UnitOfWork` de toda mutación: la autorización y las reglas se deciden sobre
   * esta lectura, así que una petición concurrente no puede cambiar la incidencia entre la decisión
   * y la escritura.
   */
  findByIdForUpdate(id: string): Promise<IncidentRecord | null>;
  /**
   * Una página de las incidencias del `scope` que cumplen los filtros, de la más reciente a la más
   * antigua (`id` como desempate), y el total de las que los cumplen.
   */
  list(query: IncidentListQueryData): Promise<{ items: IncidentRecord[]; total: number }>;
  create(data: NewIncidentData): Promise<IncidentRecord>;
  /** Aplica los cambios y devuelve la incidencia actualizada. */
  update(id: string, changes: IncidentChanges): Promise<IncidentRecord>;
}
