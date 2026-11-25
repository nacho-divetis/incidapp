import type { CreateIncidentInput } from '@incidapp/shared';
import { useMemo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { Spinner } from '../../components/atoms';
import { Alert, PageHeader } from '../../components/molecules';
import { IncidentForm, type IncidentFormField } from '../../components/organisms';
import type { LocationNoticeState } from '../../app/location-notice';
import { INCIDENTS_PATH, incidentDetailPath } from '../../app/paths';
import { errorMessageOf, formErrorsOf } from '../../lib/api/error-messages';
import { useIncidentTypes } from '../../queries/incident-types';
import { useCreateIncident } from '../../queries/incidents';

const FORM_FIELDS: readonly IncidentFormField[] = [
  'title',
  'description',
  'typeId',
  'priority',
  'dueDate',
];

/** Aviso que ve el usuario en el detalle de la incidencia recién creada. */
export const INCIDENT_CREATED_NOTICE = 'Incidencia creada.';

/**
 * Alta de una incidencia (`/incidencias/nueva`, CA-03.13). Va dentro de
 * `RequireAction('createIncident')`: sin la acción no se monta (ni se piden los tipos).
 *
 * - Carga el catálogo de tipos para el formulario (`IncidentForm` muestra el departamento que la
 *   recibirá al elegir el tipo).
 * - Al crear, navega al detalle de la incidencia nueva con el aviso "Incidencia creada.".
 * - Errores de la API en español sin perder lo escrito: un 400 con `details` va junto a cada campo
 *   (p. ej. un tipo que ya no existe); el resto, al aviso general.
 */
export function IncidentCreatePage() {
  const types = useIncidentTypes();
  const createIncident = useCreateIncident();
  const navigate = useNavigate();
  // Referencia estable mientras no llegue otro error: `IncidentForm` lleva el foco al campo con
  // error cada vez que cambian sus `fieldErrors`.
  const errors = useMemo(
    () => formErrorsOf(createIncident.error, FORM_FIELDS),
    [createIncident.error],
  );

  function submit(values: CreateIncidentInput) {
    createIncident.mutate(values, {
      onSuccess: (incident) => {
        const state: LocationNoticeState = { notice: INCIDENT_CREATED_NOTICE };
        void navigate(incidentDetailPath(incident.id), { state });
      },
    });
  }

  let content;
  if (types.isPending) {
    content = <Spinner label="Cargando el formulario…" />;
  } else if (types.isError) {
    content = <Alert tone="danger">{errorMessageOf(types.error)}</Alert>;
  } else {
    content = (
      <IncidentForm
        mode="create"
        types={types.data}
        onSubmit={submit}
        // Tras el éxito sigue bloqueado hasta que la navegación desmonta la página.
        isSubmitting={createIncident.isPending || createIncident.isSuccess}
        fieldErrors={errors.fieldErrors}
        errorMessage={errors.message}
        cancelHref={INCIDENTS_PATH}
        linkAs={RouterLink}
      />
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Nueva incidencia"
        description="Describe el problema; según el tipo, la recibirá un departamento u otro."
      />
      {content}
    </div>
  );
}
