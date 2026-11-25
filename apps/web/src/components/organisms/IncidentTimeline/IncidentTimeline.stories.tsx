import type { IncidentEvent } from '@incidapp/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IncidentTimeline } from './IncidentTimeline';

// Datos ficticios con la forma de `IncidentEvent` (respuesta de `GET /api/incidents/:id/events`).
const ANA = { id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e01', name: 'Ana Ruiz' };
const PABLO = { id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e02', name: 'Pablo Sanz' };
const ELENA = { id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e03', name: 'Elena Mora' };

const CREATED: IncidentEvent = {
  id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f01',
  type: 'CREATED',
  actor: ANA,
  createdAt: '2026-11-20T08:05:00.000Z',
  data: {},
};

const ALL_TYPES: IncidentEvent[] = [
  CREATED,
  {
    id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f02',
    type: 'UPDATED',
    actor: ANA,
    createdAt: '2026-11-20T08:30:00.000Z',
    data: {
      changes: [
        { field: 'title', before: 'Lector roto', after: 'Lector de códigos sin batería' },
        { field: 'priority', before: 'LOW', after: 'HIGH' },
      ],
    },
  },
  {
    id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f03',
    type: 'ASSIGNED',
    actor: ELENA,
    createdAt: '2026-11-20T09:00:00.000Z',
    data: { from: null, to: PABLO },
  },
  {
    id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f04',
    type: 'STATUS_CHANGED',
    actor: PABLO,
    createdAt: '2026-11-20T10:00:00.000Z',
    data: { from: 'OPEN', to: 'IN_PROGRESS', comment: null },
  },
  {
    id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f05',
    type: 'STATUS_CHANGED',
    actor: PABLO,
    createdAt: '2026-11-21T15:45:00.000Z',
    data: {
      from: 'IN_PROGRESS',
      to: 'RESOLVED',
      comment: 'Cambiada la batería del lector.\nProbado en el muelle 2 sin errores.',
    },
  },
];

const meta = {
  title: 'Organismos/IncidentTimeline',
  component: IncidentTimeline,
  args: { events: ALL_TYPES },
} satisfies Meta<typeof IncidentTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Los 4 tipos de evento: alta, edición, asignación y cambios de estado (con y sin comentario). */
export const CuatroTipos: Story = {};

/** Recién creada: solo el evento de alta. */
export const SoloAlta: Story = { args: { events: [CREATED] } };

/** Ciclo completo: resuelta, devuelta a en curso, cerrada, reabierta y reasignada. */
export const CicloCompleto: Story = {
  args: {
    events: [
      ...ALL_TYPES,
      {
        id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f06',
        type: 'STATUS_CHANGED',
        actor: ELENA,
        createdAt: '2026-11-22T09:10:00.000Z',
        data: {
          from: 'RESOLVED',
          to: 'IN_PROGRESS',
          comment: 'El lector sigue apagándose a media mañana.',
        },
      },
      {
        id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f07',
        type: 'ASSIGNED',
        actor: ELENA,
        createdAt: '2026-11-22T09:12:00.000Z',
        data: { from: PABLO, to: ANA },
      },
      {
        id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f08',
        type: 'STATUS_CHANGED',
        actor: ANA,
        createdAt: '2026-11-23T11:00:00.000Z',
        data: { from: 'IN_PROGRESS', to: 'RESOLVED', comment: 'Sustituido el lector completo.' },
      },
      {
        id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f09',
        type: 'STATUS_CHANGED',
        actor: ELENA,
        createdAt: '2026-11-23T12:00:00.000Z',
        data: { from: 'RESOLVED', to: 'CLOSED', comment: null },
      },
      {
        id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f10',
        type: 'STATUS_CHANGED',
        actor: ELENA,
        createdAt: '2026-11-24T08:00:00.000Z',
        data: {
          from: 'CLOSED',
          to: 'REOPENED',
          comment: 'Ha vuelto a fallar en el turno de noche.',
        },
      },
    ],
  },
};

/** Sin eventos (no debería ocurrir: toda incidencia tiene su alta). */
export const SinEventos: Story = { args: { events: [] } };
