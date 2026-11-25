import type {
  CreateUserInput,
  DepartmentSummary,
  UpdateUserInput,
  UserAction,
} from '@incidapp/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent, within } from 'storybook/test';
import { UserForm, type UserCreateFormProps } from './UserForm';

/**
 * Props de las stories: las del alta y las de la edición juntas (las props de `UserForm` son una
 * unión según `mode`, que los controles de Storybook no saben combinar).
 */
type UserFormStoryArgs = Omit<UserCreateFormProps, 'mode' | 'onSubmit'> & {
  mode: 'create' | 'edit';
  allowedActions?: UserAction[];
  lockedHint?: string;
  onSubmit: (values: CreateUserInput | UpdateUserInput) => void;
};

// Catálogo ficticio con la forma de `DepartmentSummary` (respuesta de `GET /api/departments`).
const DEPARTMENTS: DepartmentSummary[] = [
  { id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a01', code: 'ADM', name: 'Administración y Finanzas' },
  {
    id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a02',
    code: 'ATC',
    name: 'Atención al Cliente / Postventa',
  },
  { id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a03', code: 'COM', name: 'Comercial' },
  { id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a04', code: 'COMP', name: 'Compras' },
  { id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a05', code: 'TEC', name: 'Departamento Técnico' },
  { id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a06', code: 'DIR', name: 'Dirección' },
  { id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a07', code: 'LOG', name: 'Logística y Almacén' },
  { id: '6f1c1d4e-1b7a-4c35-9a51-0b1d2e3f4a08', code: 'PROD', name: 'Producción / Operaciones' },
];

const MARTA = {
  name: 'Marta Gil',
  email: 'marta.gil@incidapp.test',
  role: 'MANAGER' as const,
  departmentIds: [DEPARTMENTS[6]!.id, DEPARTMENTS[2]!.id],
};

const meta = {
  title: 'Organismos/UserForm',
  render: ({ mode, allowedActions = [], lockedHint, ...args }) =>
    mode === 'edit' ? (
      <UserForm {...args} mode="edit" allowedActions={allowedActions} lockedHint={lockedHint} />
    ) : (
      <UserForm {...args} mode="create" />
    ),
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
  },
  args: {
    mode: 'create',
    departments: DEPARTMENTS,
    cancelHref: '#/admin/usuarios',
    onSubmit: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<UserFormStoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Alta vacía, tal como se abre `/admin/usuarios/nuevo`. El rol empieza en "Usuario". */
export const AltaVacía: Story = {};

/** Alta enviada vacía: cada campo muestra el error de validación de `shared`. */
export const AltaConErrores: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Crear usuario' }));
  },
};

/** La API ha respondido 409: el email ya existe (se muestra junto al campo). */
export const EmailRepetido: Story = {
  args: {
    defaultValues: MARTA,
    fieldErrors: { email: 'Ya existe un usuario con ese email.' },
  },
};

/** Esperando la respuesta de la API: botón en carga y sin reenvíos. */
export const Enviando: Story = {
  args: { defaultValues: MARTA, isSubmitting: true },
};

/** Error general de la API. */
export const ErrorDeLaApi: Story = {
  args: {
    defaultValues: MARTA,
    errorMessage: 'No se ha podido conectar con el servidor. Inténtalo de nuevo.',
  },
};

/** Catálogo de departamentos vacío. */
export const SinDepartamentos: Story = { args: { departments: [] } };

/** Edición de un usuario con todos los cambios permitidos. */
export const Edición: Story = {
  args: {
    mode: 'edit',
    defaultValues: MARTA,
    allowedActions: [
      'rename',
      'changeEmail',
      'changeRole',
      'changeDepartments',
      'deactivate',
      'resetPassword',
    ],
  },
};

/** El Admin edita su propio usuario: no puede cambiarse el rol (sin `changeRole`). */
export const EdiciónDeUnoMismo: Story = {
  args: {
    mode: 'edit',
    defaultValues: {
      name: 'Ana Prieto',
      email: 'ana.prieto@incidapp.test',
      role: 'ADMIN',
      departmentIds: [DEPARTMENTS[0]!.id],
    },
    allowedActions: ['rename', 'changeEmail', 'changeDepartments', 'resetPassword'],
    lockedHint: 'No puedes cambiar tu propio rol.',
  },
};

/** Usuario demo: solo se puede cambiar el nombre (`rename`). */
export const EdiciónDeUsuarioDemo: Story = {
  args: {
    mode: 'edit',
    defaultValues: {
      name: 'Pablo Moreno',
      email: 'usuario@incidapp.test',
      role: 'USER',
      departmentIds: [DEPARTMENTS[6]!.id],
    },
    allowedActions: ['rename'],
    lockedHint: 'Los usuarios demo no se pueden modificar.',
  },
};
