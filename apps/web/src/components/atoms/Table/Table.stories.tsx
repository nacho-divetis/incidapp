import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from './Table';

// Datos ficticios genéricos (el átomo no conoce el dominio).
const ROWS = [
  { name: 'Sala Norte', floor: 'Planta 1', seats: 12, status: 'Disponible' },
  { name: 'Sala Sur', floor: 'Planta 1', seats: 8, status: 'Ocupada' },
  { name: 'Aula de formación', floor: 'Planta 2', seats: 24, status: 'En obras' },
];

const meta = {
  title: 'Átomos/Table',
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sin nada enfocable dentro y más ancha que un móvil: lleva `regionLabel` para desplazarla con el teclado. */
export const PorDefecto: Story = {
  args: { regionLabel: 'Salas de reuniones' },
  render: (args) => (
    <Table {...args}>
      <TableCaption>Salas de reuniones</TableCaption>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Sala</TableHeaderCell>
          <TableHeaderCell>Planta</TableHeaderCell>
          <TableHeaderCell className="text-right">Plazas</TableHeaderCell>
          <TableHeaderCell>Estado</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.name}>
            <TableHeaderCell scope="row">{row.name}</TableHeaderCell>
            <TableCell>{row.floor}</TableCell>
            <TableCell className="text-right">{row.seats}</TableCell>
            <TableCell>{row.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

/** El nombre de la tabla puede ir oculto a la vista si ya hay un título en la página. */
export const ConNombreOculto: Story = {
  render: (args) => (
    <Table {...args}>
      <TableCaption className="sr-only">Salas de reuniones</TableCaption>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Sala</TableHeaderCell>
          <TableHeaderCell>Planta</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.name}>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.floor}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

/** Sin filas: una sola celda que ocupa todas las columnas con el mensaje de vacío. */
export const Vacía: Story = {
  render: (args) => (
    <Table {...args} aria-label="Salas de reuniones">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Sala</TableHeaderCell>
          <TableHeaderCell>Planta</TableHeaderCell>
          <TableHeaderCell>Estado</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell colSpan={3} className="py-8 text-center text-fg-muted">
            No hay salas que mostrar.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

/**
 * Más ancha que su contenedor (como en un móvil): se desplaza la tabla, no la página. Sin nada
 * enfocable dentro, `regionLabel` permite desplazarla con el teclado.
 */
export const AnchaConDesplazamiento: Story = {
  args: { regionLabel: 'Salas de reuniones (desplazable)' },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Table {...args}>
      <TableCaption>Salas de reuniones</TableCaption>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Sala</TableHeaderCell>
          <TableHeaderCell>Planta</TableHeaderCell>
          <TableHeaderCell>Plazas</TableHeaderCell>
          <TableHeaderCell>Estado</TableHeaderCell>
          <TableHeaderCell>Equipamiento</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.name}>
            <TableHeaderCell scope="row" className="whitespace-nowrap">
              {row.name}
            </TableHeaderCell>
            <TableCell className="whitespace-nowrap">{row.floor}</TableCell>
            <TableCell>{row.seats}</TableCell>
            <TableCell className="whitespace-nowrap">{row.status}</TableCell>
            <TableCell className="whitespace-nowrap">
              Pantalla, pizarra y videoconferencia
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
