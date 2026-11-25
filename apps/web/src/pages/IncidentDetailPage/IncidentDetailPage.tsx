import type { AllowedTransition, Status } from '@incidapp/shared';
import { useEffect, useId, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { buttonVariants, Heading, Icon, Link, Spinner, Text } from '../../components/atoms';
import { Alert } from '../../components/molecules';
import {
  IncidentAssignForm,
  IncidentLoadError,
  IncidentStatusActions,
  IncidentSummary,
  IncidentTimeline,
  StatusTransitionDialog,
} from '../../components/organisms';
import { useLocationNotice } from '../../app/location-notice';
import { INCIDENTS_PATH, incidentEditPath } from '../../app/paths';
import { ApiError } from '../../lib/api/client';
import { cn } from '../../lib/cn';
import { errorMessageOf } from '../../lib/api/error-messages';
import {
  useAssignIncident,
  useIncident,
  useIncidentAssignees,
  useIncidentEvents,
  useTransitionIncident,
} from '../../queries/incidents';

/** Transición elegida y estado de origen en el momento de elegirla. */
interface SelectedTransition {
  transition: AllowedTransition;
  from: Status;
}

/**
 * Detalle de una incidencia (`/incidencias/:id`, CA-03.14, CA-03.15, CA-04.8 y CA-04.9), para
 * cualquier usuario con sesión que pueda verla (si no, la API responde 404).
 *
 * - `IncidentSummary` con los datos y, en su hueco de acciones, un botón por cada transición de
 *   `incident.allowedTransitions` (`IncidentStatusActions`) y "Editar" solo si
 *   `incident.allowedActions` incluye `update`.
 * - Cambio de estado: el botón abre `StatusTransitionDialog`; al confirmar se llama a la API y el
 *   diálogo se cierra solo si responde bien (la respuesta actualiza el resumen y los botones, y el
 *   historial se vuelve a pedir). Con error, el diálogo sigue abierto con el mensaje y el comentario.
 *   La transición elegida (y su estado de origen) se conserva al cerrar, para que el título y los
 *   botones del diálogo no cambien mientras termina de cerrarse.
 * - `IncidentAssignForm` solo si incluye `assign` (y solo entonces se piden los candidatos). Al
 *   asignar, la respuesta de la API actualiza el resumen y el control muestra un aviso de éxito. El
 *   control se monta con `key` = asignado actual, para que tras asignar empiece con el nuevo.
 * - Historial (`IncidentTimeline`) con un indicador mientras carga y un `Alert` si falla.
 * - Aviso de éxito que deja el alta o la edición en `location.state`.
 * - La web no mira el rol ni el estado: todo sale de `allowedActions` y `allowedTransitions`, que
 *   calcula la API.
 */
export function IncidentDetailPage() {
  const { id = '' } = useParams();
  const historyHeadingId = useId();
  const incident = useIncident(id);
  const events = useIncidentEvents(id);
  const canAssign = incident.data?.allowedActions.includes('assign') ?? false;
  const assignees = useIncidentAssignees(id, { enabled: canAssign });
  const assign = useAssignIncident(id);
  const changeStatus = useTransitionIncident(id);
  const notice = useLocationNotice();
  const [selected, setSelected] = useState<SelectedTransition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // El aviso y el error de la asignación son de la incidencia y del asignado de ese momento: se
  // borran al cambiar de incidencia (la ruta reutiliza la página) y cuando el asignado actual ya no
  // es el de la última asignación (p. ej., otra persona la reasigna y llega al volver a pedirla).
  // Al cambiar de incidencia también se olvida el último cambio de estado.
  const { reset: resetAssign } = assign;
  const { reset: resetChangeStatus } = changeStatus;
  const currentAssigneeId = incident.data?.assignee?.id ?? null;
  const lastAssignedId = assign.data?.assignee?.id;
  useEffect(() => {
    resetAssign();
    resetChangeStatus();
  }, [id, resetAssign, resetChangeStatus]);
  useEffect(() => {
    if (lastAssignedId !== undefined && lastAssignedId !== currentAssigneeId) resetAssign();
  }, [lastAssignedId, currentAssigneeId, resetAssign]);

  if (incident.isPending) return <Spinner label="Cargando la incidencia…" />;

  // Un fallo al volver a pedirla (p. ej. al recuperar el foco) no oculta lo que ya se ve, salvo que
  // la incidencia haya dejado de existir o de ser visible.
  const lostAccess = incident.error instanceof ApiError && incident.error.status === 404;
  if (incident.isError && (lostAccess || !incident.data)) {
    return (
      <IncidentLoadError
        notFound={lostAccess}
        title="Incidencia"
        errorMessage={errorMessageOf(incident.error)}
        backHref={INCIDENTS_PATH}
        linkAs={RouterLink}
      />
    );
  }
  const data = incident.data;
  if (!data) return null;

  const canUpdate = data.allowedActions.includes('update');
  const hasTransitions = data.allowedTransitions.length > 0;
  const assignNotice =
    assign.isSuccess && assign.data.assignee && assign.data.assignee.id === currentAssigneeId
      ? `Incidencia asignada a ${assign.data.assignee.name}.`
      : undefined;
  const assignError = assign.error ?? assignees.error;
  // Las secciones de la columna principal dejan sitio a la asignación cuando se muestra.
  const mainColumn = canAssign ? 'lg:col-span-2' : 'lg:col-span-3';

  function openTransition(transition: AllowedTransition, from: Status) {
    resetChangeStatus();
    setSelected({ transition, from });
    setDialogOpen(true);
  }

  function confirmTransition(comment?: string) {
    if (!selected) return;
    changeStatus.mutate(
      { to: selected.transition.to, comment },
      { onSuccess: () => setDialogOpen(false) },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Text variant="small">
        <Link as={RouterLink} to={INCIDENTS_PATH} className="inline-flex items-center gap-1">
          <Icon name="arrow-left" size="sm" />
          Volver al listado de incidencias
        </Link>
      </Text>
      {notice && <Alert tone="success">{notice}</Alert>}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <IncidentSummary
          className={mainColumn}
          incident={data}
          actions={
            (hasTransitions || canUpdate) && (
              <>
                <IncidentStatusActions
                  status={data.status}
                  transitions={data.allowedTransitions}
                  onSelect={(transition) => openTransition(transition, data.status)}
                  disabled={changeStatus.isPending}
                />
                {canUpdate && (
                  <Link
                    as={RouterLink}
                    to={incidentEditPath(data.id)}
                    className={cn(
                      buttonVariants({ variant: 'secondary' }),
                      'no-underline hover:bg-neutral-bg hover:text-fg',
                    )}
                  >
                    <Icon name="pencil" size="md" />
                    Editar
                  </Link>
                )}
              </>
            )
          }
        />
        {canAssign && (
          <IncidentAssignForm
            key={data.assignee?.id ?? 'sin-asignar'}
            assignees={assignees.data ?? []}
            currentAssigneeId={data.assignee?.id ?? null}
            onAssign={(assigneeId) => assign.mutate(assigneeId)}
            isPending={assign.isPending}
            isLoading={assignees.isPending}
            notice={assignNotice}
            errorMessage={assignError ? errorMessageOf(assignError) : undefined}
          />
        )}
        <section
          aria-labelledby={historyHeadingId}
          className={cn('flex flex-col gap-4', mainColumn)}
        >
          <Heading level={3} as="h2" id={historyHeadingId}>
            Historial
          </Heading>
          {/* Como en el detalle, un fallo al volver a pedirlo no oculta lo que ya se ve. */}
          {events.isPending ? (
            <Spinner label="Cargando el historial…" />
          ) : events.data ? (
            <IncidentTimeline events={events.data} />
          ) : (
            <Alert tone="danger">{errorMessageOf(events.error)}</Alert>
          )}
        </section>
      </div>
      <StatusTransitionDialog
        transition={selected?.transition ?? null}
        from={selected?.from ?? data.status}
        open={dialogOpen && selected !== null}
        onOpenChange={setDialogOpen}
        onConfirm={confirmTransition}
        isSubmitting={changeStatus.isPending}
        errorMessage={changeStatus.error ? errorMessageOf(changeStatus.error) : undefined}
      />
    </div>
  );
}
