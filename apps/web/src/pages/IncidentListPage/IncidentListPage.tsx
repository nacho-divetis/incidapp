import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { buttonVariants, Icon, Link } from '../../components/atoms';
import { Alert, PageHeader, Pagination } from '../../components/molecules';
import {
  EMPTY_INCIDENT_FILTERS,
  IncidentFilters,
  IncidentTable,
  type IncidentFiltersValue,
} from '../../components/organisms';
import { INCIDENT_CREATE_PATH, incidentDetailPath } from '../../app/paths';
import { cn } from '../../lib/cn';
import { errorMessageOf } from '../../lib/api/error-messages';
import { useCurrentUser } from '../../queries/auth';
import { useDepartments } from '../../queries/departments';
import { incidentListSearch, useIncidents } from '../../queries/incidents';

/** Espera tras la última tecla del buscador antes de pedir la lista. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Devuelve `value` cuando lleva `delay` ms sin cambiar. */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Listado de incidencias (`/incidencias`, CA-03.12), para cualquier usuario con sesión: la API solo
 * devuelve las que puede ver.
 *
 * - Filtros (`IncidentFilters`) en el estado de la página, no en la URL. Cambiar uno vuelve a la
 *   página 1; el buscador espera a que se deje de escribir (`SEARCH_DEBOUNCE_MS`) para no lanzar
 *   una petición por tecla.
 * - `IncidentTable` (con su estado vacío) y `Pagination` con el total. Mientras llega otra página
 *   se sigue viendo la anterior y la paginación queda deshabilitada.
 * - Primera carga con indicador; si la API falla, un `Alert` con el mensaje en español.
 * - "Nueva incidencia" solo si las `allowedActions` globales del usuario incluyen `createIncident`
 *   (nunca por el rol).
 */
export function IncidentListPage() {
  const { data: user } = useCurrentUser();
  const departments = useDepartments();
  const [filters, setFilters] = useState<IncidentFiltersValue>(EMPTY_INCIDENT_FILTERS);
  const q = useDebouncedValue(filters.q, SEARCH_DEBOUNCE_MS);
  const effectiveFilters = { ...filters, q };
  // La página elegida pertenece a unos filtros concretos (los que ya se aplican, con el buscador
  // tras la espera). Si cambian, se vuelve a la página 1 sin otra petición intermedia: con el
  // buscador, la vuelta se produce a la vez que se aplica el texto nuevo, no al pulsar la tecla.
  const filtersKey = incidentListSearch(effectiveFilters, 1);
  const [selectedPage, setSelectedPage] = useState({ filtersKey, page: 1 });
  const page = selectedPage.filtersKey === filtersKey ? selectedPage.page : 1;
  const incidents = useIncidents(effectiveFilters, page);

  function changePage(next: number) {
    setSelectedPage({ filtersKey, page: next });
  }

  const canCreate = user?.allowedActions.includes('createIncident') ?? false;
  const isChangingPage = incidents.isPlaceholderData;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Incidencias"
        description="Incidencias que puedes ver, de la más reciente a la más antigua."
        actions={
          canCreate && (
            <Link
              as={RouterLink}
              to={INCIDENT_CREATE_PATH}
              className={cn(
                buttonVariants(),
                'no-underline hover:bg-primary-hover hover:text-primary-contrast',
              )}
            >
              <Icon name="plus" size="md" />
              Nueva incidencia
            </Link>
          )
        }
      />
      <IncidentFilters value={filters} onChange={setFilters} departments={departments.data ?? []} />
      {incidents.isError ? (
        <Alert tone="danger">{errorMessageOf(incidents.error)}</Alert>
      ) : (
        <div className="flex flex-col gap-4" aria-busy={incidents.isFetching}>
          <IncidentTable
            items={incidents.data?.items ?? []}
            isLoading={incidents.isPending}
            getDetailHref={incidentDetailPath}
            linkAs={RouterLink}
          />
          {incidents.data && incidents.data.total > 0 && (
            <Pagination
              label="Paginación de incidencias"
              page={incidents.data.page}
              pageSize={incidents.data.pageSize}
              total={incidents.data.total}
              onPageChange={changePage}
              disabled={isChangingPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
