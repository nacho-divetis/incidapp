import type { UpdateIncidentInput } from '@incidapp/shared';
import { useMemo } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { Spinner } from '../../components/atoms';
import { PageHeader } from '../../components/molecules';
import {
  IncidentForm,
  IncidentLoadError,
  type IncidentFormField,
} from '../../components/organisms';
import type { LocationNoticeState } from '../../app/location-notice';
import { INCIDENTS_PATH, incidentDetailPath } from '../../app/paths';
import { ApiError } from '../../lib/api/client';
import { errorMessageOf, formErrorsOf } from '../../lib/api/error-messages';
import { useIncident, useUpdateIncident } from '../../queries/incidents';
import { ForbiddenPage } from '../ForbiddenPage';

const FORM_FIELDS: readonly IncidentFormField[] = ['title', 'description', 'priority', 'dueDate'];

/** Aviso que ve el usuario en el detalle tras guardar. */
export const INCIDENT_UPDATED_NOTICE = 'Cambios guardados.';

/**
 * Edición de una incidencia (`/incidencias/:id/editar`, CA-03.15).
 *
 * - Solo si `incident.allowedActions` incluye `update`; si no, `ForbiddenPage` (la API también lo
 *   comprueba: 403). 404 → "Incidencia no encontrada.".
 * - `IncidentForm` en modo `edit` precargado con la incidencia (sin el tipo). Se monta con
 *   `key` = id: volver a pedir la incidencia en segundo plano no borra lo escrito.
 * - Al guardar, navega al detalle, que muestra los datos nuevos (la respuesta de la API ya está en
 *   la caché) y el aviso "Cambios guardados.". Los errores de la API se muestran en español sin
 *   perder lo escrito (400 → junto a cada campo).
 */
export function IncidentEditPage() {
  const { id = '' } = useParams();
  const incident = useIncident(id);
  const updateIncident = useUpdateIncident(id);
  const navigate = useNavigate();
  // Referencia estable mientras no llegue otro error (el formulario enfoca el campo con error).
  const errors = useMemo(
    () => formErrorsOf(updateIncident.error, FORM_FIELDS),
    [updateIncident.error],
  );

  function submit(values: UpdateIncidentInput) {
    updateIncident.mutate(values, {
      onSuccess: (saved) => {
        const state: LocationNoticeState = { notice: INCIDENT_UPDATED_NOTICE };
        void navigate(incidentDetailPath(saved.id), { state });
      },
    });
  }

  if (incident.isPending) return <Spinner label="Cargando la incidencia…" />;
  if (incident.isError && !incident.data) {
    return (
      <IncidentLoadError
        notFound={incident.error instanceof ApiError && incident.error.status === 404}
        title="Editar incidencia"
        errorMessage={errorMessageOf(incident.error)}
        backHref={INCIDENTS_PATH}
        linkAs={RouterLink}
      />
    );
  }
  const data = incident.data;
  if (!data) return null;
  if (!data.allowedActions.includes('update')) return <ForbiddenPage />;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Editar incidencia" description={`${data.code} · ${data.title}`} />
      <IncidentForm
        key={data.id}
        mode="edit"
        defaultValues={{
          title: data.title,
          description: data.description,
          priority: data.priority,
          dueDate: data.dueDate,
        }}
        onSubmit={submit}
        // Tras el éxito sigue bloqueado hasta que la navegación desmonta la página.
        isSubmitting={updateIncident.isPending || updateIncident.isSuccess}
        fieldErrors={errors.fieldErrors}
        errorMessage={errors.message}
        cancelHref={incidentDetailPath(data.id)}
        linkAs={RouterLink}
      />
    </div>
  );
}
