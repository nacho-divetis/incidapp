import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from './Button';

const meta = {
  title: 'Átomos/Button',
  component: Button,
  args: { children: 'Guardar', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    leftIcon: { control: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primario: Story = { args: { variant: 'primary' } };
export const Secundario: Story = { args: { variant: 'secondary', children: 'Cancelar' } };
export const Fantasma: Story = { args: { variant: 'ghost', children: 'Ver más' } };
export const Peligro: Story = { args: { variant: 'danger', children: 'Eliminar' } };
export const Pequeño: Story = { args: { size: 'sm' } };
export const ConIcono: Story = {
  args: { children: 'Nueva incidencia', leftIcon: <Plus className="size-5" /> },
};
export const Deshabilitado: Story = { args: { disabled: true } };
export const Cargando: Story = { args: { loading: true, children: 'Guardando…' } };

/** Todas las variantes juntas, normales y deshabilitadas. */
export const Catálogo: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {([false, true] as const).map((disabled) => (
        <div key={String(disabled)} className="flex flex-wrap items-center gap-3">
          {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
            <Button key={variant} {...args} variant={variant} disabled={disabled}>
              {variant}
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
};
