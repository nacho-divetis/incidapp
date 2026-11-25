import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Icon, Link } from '../../atoms';
import { PageHeader } from './PageHeader';

const meta = {
  title: 'Moléculas/PageHeader',
  component: PageHeader,
  args: { title: 'Usuarios' },
  argTypes: {
    actions: { control: false },
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SoloTítulo: Story = {};
export const ConDescripción: Story = {
  args: { description: 'Altas, roles, departamentos y acceso de las personas de la empresa.' },
};
export const ConAcciones: Story = {
  args: {
    description: 'Altas, roles, departamentos y acceso de las personas de la empresa.',
    actions: <Button leftIcon={<Icon name="plus" size="sm" />}>Nuevo usuario</Button>,
  },
};
export const ConVariasAcciones: Story = {
  args: {
    title: 'Editar usuario',
    actions: (
      <>
        <Link href="#">Volver al listado</Link>
        <Button variant="secondary">Exportar</Button>
      </>
    ),
  },
};
/** Un título largo en un ancho de móvil: las acciones bajan bajo el título. */
export const TítuloLargo: Story = {
  args: {
    title: 'Incidencias pendientes de un tercero en el departamento de Mantenimiento',
    actions: <Button>Nueva incidencia</Button>,
  },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
};
