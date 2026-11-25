import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../../atoms';
import { DetailList } from './DetailList';

const meta = {
  title: 'Moléculas/DetailList',
  component: DetailList,
  args: {
    items: [
      { label: 'Tipo', value: 'Transporte' },
      { label: 'Departamento', value: 'Logística y Almacén (LOG)' },
      { label: 'Creada por', value: 'Luis Navarro' },
      { label: 'Asignada a', value: 'Marta Gil' },
      { label: 'Fecha objetivo', value: '30/11/2026' },
      { label: 'Etiqueta', value: <Badge tone="info">Con una insignia</Badge> },
    ],
  },
  argTypes: { columns: { control: 'inline-radio', options: [1, 2, 3] } },
} satisfies Meta<typeof DetailList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Dos columnas desde `sm` (por defecto). */
export const PorDefecto: Story = {};

/** Una sola columna. */
export const UnaColumna: Story = { args: { columns: 1 } };

/** Tres columnas desde `lg`. */
export const TresColumnas: Story = { args: { columns: 3 } };

/** Un valor largo no desborda la rejilla. */
export const ValorLargo: Story = {
  args: {
    items: [
      { label: 'Referencia', value: 'ALBARAN-2026-000000000000000000000000000000000000001' },
      { label: 'Departamento', value: 'Atención al Cliente / Postventa (ATC)' },
    ],
  },
};
