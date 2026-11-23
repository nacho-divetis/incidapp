import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, Button, Heading, Icon, Text } from '../../atoms';
import { AppLayout } from './AppLayout';

// Contenido de relleno para ver la disposición; en la aplicación los huecos los llenan organismos.
const header = (
  <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
    <span className="text-lg font-semibold text-fg">IncidApp</span>
    <Button variant="ghost" size="sm" leftIcon={<Icon name="log-out" size="sm" />}>
      Salir
    </Button>
  </div>
);

const nav = (
  <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col">
    {['Incidencias', 'Cuadro de mando', 'Usuarios'].map((item) => (
      <li key={item}>
        <a
          href="#"
          className="block rounded-md px-3 py-2 text-fg hover:bg-neutral-bg focus-visible:focus-ring"
        >
          {item}
        </a>
      </li>
    ))}
  </ul>
);

const content = (
  <div className="flex flex-col gap-4">
    <Heading level={1}>Incidencias</Heading>
    <Text variant="muted">
      Contenido de ejemplo de la página. Tabula desde el principio para ver el enlace «Saltar al
      contenido».
    </Text>
    <div className="flex flex-wrap gap-2">
      <Badge tone="info">Nueva</Badge>
      <Badge tone="warning">En espera</Badge>
      <Badge tone="success">Resuelta</Badge>
    </div>
  </div>
);

const meta = {
  title: 'Plantillas/AppLayout',
  component: AppLayout,
  parameters: { layout: 'fullscreen' },
  args: { header, nav, children: content },
  argTypes: {
    header: { control: false },
    nav: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof AppLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
export const SinNavegación: Story = { args: { nav: undefined } };
/** Ancho de móvil: la navegación pasa encima del contenido y no hay desplazamiento horizontal. */
export const Móvil: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-sm border-x border-border">
        <Story />
      </div>
    ),
  ],
};
