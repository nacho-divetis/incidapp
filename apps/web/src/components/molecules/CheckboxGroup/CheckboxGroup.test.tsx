// CA-02.19 (departamentos como casillas) · CheckboxGroup: grupo con nombre (`fieldset`/`legend`),
// controlado, con el error asociado (`aria-describedby` + `aria-invalid`) y deshabilitable.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CheckboxGroup, type CheckboxGroupProps } from './CheckboxGroup';

const OPTIONS = [
  { value: 'd-adm', label: 'ADM', description: 'Administración' },
  { value: 'd-it', label: 'IT', description: 'Sistemas' },
  { value: 'd-mnt', label: 'MNT' },
];

function setup(props: Partial<CheckboxGroupProps> = {}) {
  const onChange = vi.fn();
  render(
    <CheckboxGroup
      legend="Departamentos"
      options={OPTIONS}
      value={[]}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

/** Versión con estado, para comprobar varias interacciones seguidas. */
function Controlled({ onChange }: { onChange: (value: string[]) => void }) {
  const [value, setValue] = useState<string[]>(['d-it']);
  return (
    <CheckboxGroup
      legend="Departamentos"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('CheckboxGroup', () => {
  it('CA-02.19: es un grupo con el nombre de la leyenda y una casilla por opción', () => {
    setup({ value: ['d-it'] });

    const group = screen.getByRole('group', { name: 'Departamentos' });
    expect(group.tagName).toBe('FIELDSET');
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'IT' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'ADM' })).not.toBeChecked();
  });

  it('CA-02.19: marcar y desmarcar avisa con la lista de valores resultante', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'ADM' }));
    expect(onChange).toHaveBeenLastCalledWith(['d-it', 'd-adm']);
    expect(screen.getByRole('checkbox', { name: 'ADM' })).toBeChecked();

    await userEvent.click(screen.getByRole('checkbox', { name: 'IT' }));
    expect(onChange).toHaveBeenLastCalledWith(['d-adm']);
    expect(screen.getByRole('checkbox', { name: 'IT' })).not.toBeChecked();
  });

  it('CA-02.19: se maneja con el teclado (tabulador y barra espaciadora)', async () => {
    const { onChange } = setup();

    await userEvent.tab();
    expect(screen.getByRole('checkbox', { name: 'ADM' })).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(['d-adm']);
  });

  it('conserva los valores marcados que no están entre las opciones', async () => {
    const { onChange } = setup({ value: ['otro'] });

    await userEvent.click(screen.getByRole('checkbox', { name: 'MNT' }));
    expect(onChange).toHaveBeenCalledWith(['otro', 'd-mnt']);
  });

  it('CA-02.19: con error, el grupo lo tiene como descripción y cada casilla aria-invalid', () => {
    setup({ error: 'Elige al menos un departamento.', hint: 'Puedes elegir varios.' });

    const group = screen.getByRole('group', { name: 'Departamentos' });
    expect(group).toHaveAccessibleDescription(
      'Elige al menos un departamento. Puedes elegir varios.',
    );
    screen
      .getAllByRole('checkbox')
      .forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
  });

  it('sin error ni ayuda no hay descripción ni aria-invalid', () => {
    setup({ error: '' });

    expect(screen.getByRole('group')).not.toHaveAttribute('aria-describedby');
    screen
      .getAllByRole('checkbox')
      .forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
  });

  it('la descripción de una opción describe su casilla', () => {
    setup();
    expect(screen.getByRole('checkbox', { name: 'ADM' })).toHaveAccessibleDescription(
      'Administración',
    );
    expect(screen.getByRole('checkbox', { name: 'MNT' })).not.toHaveAttribute('aria-describedby');
  });

  it('con required, la leyenda lo indica', () => {
    setup({ required: true });
    expect(screen.getByRole('group', { name: 'Departamentos (obligatorio)' })).toBeInTheDocument();
  });

  it('deshabilitado: no cambia ni avisa', async () => {
    const { onChange } = setup({ disabled: true, value: ['d-it'] });

    expect(screen.getByRole('group')).toBeDisabled();
    const checkbox = screen.getByRole('checkbox', { name: 'ADM' });
    expect(checkbox).toBeDisabled();
    await userEvent.click(checkbox);
    expect(onChange).not.toHaveBeenCalled();
    expect(checkbox).not.toBeChecked();
  });

  it('sin opciones muestra el mensaje de vacío', () => {
    setup({ options: [], emptyMessage: 'No hay departamentos.' });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('No hay departamentos.')).toBeInTheDocument();
  });

  it('el ref apunta al fieldset', () => {
    const ref = { current: null as HTMLFieldSetElement | null };
    render(
      <CheckboxGroup
        ref={ref}
        legend="Departamentos"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(ref.current).toBe(screen.getByRole('group'));
  });
});
