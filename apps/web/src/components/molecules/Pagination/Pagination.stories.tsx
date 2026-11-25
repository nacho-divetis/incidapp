import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Pagination } from './Pagination';

const meta = {
  title: 'Moléculas/Pagination',
  component: Pagination,
  args: { page: 2, pageSize: 20, total: 45, onPageChange: fn() },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

/** En una página intermedia: los dos botones activos. */
export const PáginaIntermedia: Story = {};

/** En la primera página: "Anterior" deshabilitado. */
export const PrimeraPágina: Story = { args: { page: 1 } };

/** En la última página: "Siguiente" deshabilitado. */
export const ÚltimaPágina: Story = { args: { page: 3 } };

/** Sin resultados: una sola página y los dos botones deshabilitados. */
export const SinResultados: Story = { args: { page: 1, total: 0 } };

/** Mientras se carga otra página. */
export const Deshabilitada: Story = { args: { disabled: true } };

/** Con la página en el estado de la story: los botones funcionan. */
export const Interactiva: Story = {
  render: function Render(args) {
    const [page, setPage] = useState(1);
    return (
      <Pagination
        {...args}
        page={page}
        onPageChange={(next) => {
          setPage(next);
          args.onPageChange(next);
        }}
      />
    );
  },
};
