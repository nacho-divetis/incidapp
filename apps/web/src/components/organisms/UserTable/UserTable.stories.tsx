import type { DepartmentSummary, UserAdmin } from '@incidapp/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { UserTable } from './UserTable';

// Datos ficticios con la forma de `UserAdmin` (respuesta de `GET /api/users`).
const DEPARTMENTS = {
  ADM: {
    id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a01',
    code: 'ADM',
    name: 'Administración y Finanzas',
  },
  DIR: { id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a02', code: 'DIR', name: 'Dirección' },
  LOG: { id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a03', code: 'LOG', name: 'Logística y Almacén' },
  COM: { id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a04', code: 'COM', name: 'Comercial' },
  TEC: { id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a05', code: 'TEC', name: 'Departamento Técnico' },
} satisfies Record<string, DepartmentSummary>;

const USERS: UserAdmin[] = [
  {
    id: '0d6f3c1a-5b2e-4f7d-8a9b-1c2d3e4f5a01',
    email: 'admin@incidapp.test',
    name: 'Elena Ruiz',
    role: 'ADMIN',
    active: true,
    departments: [DEPARTMENTS.ADM],
    createdAt: '2026-11-01T08:00:00.000Z',
    allowedActions: ['rename'],
  },
  {
    id: '0d6f3c1a-5b2e-4f7d-8a9b-1c2d3e4f5a02',
    email: 'direccion@incidapp.test',
    name: 'Javier Ortega',
    role: 'DIRECTOR',
    active: true,
    departments: [DEPARTMENTS.DIR],
    createdAt: '2026-11-01T08:00:00.000Z',
    allowedActions: ['rename'],
  },
  {
    id: '0d6f3c1a-5b2e-4f7d-8a9b-1c2d3e4f5a03',
    email: 'marta.gil@incidapp.test',
    name: 'Marta Gil',
    role: 'MANAGER',
    active: true,
    departments: [DEPARTMENTS.LOG, DEPARTMENTS.COM, DEPARTMENTS.TEC],
    createdAt: '2026-11-20T09:30:00.000Z',
    allowedActions: [
      'rename',
      'changeEmail',
      'changeRole',
      'changeDepartments',
      'deactivate',
      'resetPassword',
    ],
  },
  {
    id: '0d6f3c1a-5b2e-4f7d-8a9b-1c2d3e4f5a04',
    email: 'luis.navarro@incidapp.test',
    name: 'Luis Navarro',
    role: 'USER',
    active: false,
    departments: [DEPARTMENTS.COM],
    createdAt: '2026-11-21T10:00:00.000Z',
    allowedActions: [
      'rename',
      'changeEmail',
      'changeRole',
      'changeDepartments',
      'activate',
      'resetPassword',
    ],
  },
];

const meta = {
  title: 'Organismos/UserTable',
  component: UserTable,
  args: {
    users: USERS,
    getEditHref: (id: string) => `#/admin/usuarios/${id}`,
  },
} satisfies Meta<typeof UserTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Listado con usuarios de cada rol, uno con varios departamentos y otro desactivado. */
export const PorDefecto: Story = {};

/** Sin usuarios. */
export const Vacío: Story = { args: { users: [] } };

/** En un ancho de móvil: la tabla se desplaza dentro de su contenedor, no la página. */
export const Móvil: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-80">
        <Story />
      </div>
    ),
  ],
};
