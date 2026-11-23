// CA-00.19 · Select: `invalid` → `aria-invalid`, acepta `aria-describedby`, reenvía `ref` y se elige.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

function renderSelect(props: ComponentProps<typeof Select> = {}) {
  return render(
    <Select aria-label="Prioridad" defaultValue="baja" {...props}>
      <option value="baja">Baja</option>
      <option value="alta">Alta</option>
    </Select>,
  );
}

describe('Select', () => {
  it('CA-00.19: sin invalid no expone aria-invalid', () => {
    renderSelect();
    expect(screen.getByRole('combobox', { name: 'Prioridad' })).not.toHaveAttribute('aria-invalid');
  });

  it('CA-00.19: con invalid expone aria-invalid y se asocia a su mensaje con aria-describedby', () => {
    render(
      <>
        <Select aria-label="Prioridad" invalid aria-describedby="prioridad-error">
          <option value="">Elige</option>
        </Select>
        <p id="prioridad-error">Elige una prioridad</p>
      </>,
    );

    const select = screen.getByRole('combobox', { name: 'Prioridad' });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Elige una prioridad');
  });

  it('CA-00.19: se elige una opción, avisa con onChange y reenvía ref', async () => {
    const onChange = vi.fn();
    const ref = createRef<HTMLSelectElement>();
    renderSelect({ onChange, ref });

    const select = screen.getByRole('combobox', { name: 'Prioridad' });
    await userEvent.selectOptions(select, 'alta');

    expect(select).toHaveValue('alta');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(select);
  });
});
