// CA-00.19 · Textarea: `invalid` → `aria-invalid`, acepta `aria-describedby`, reenvía `ref` y se escribe.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('CA-00.19: sin invalid no expone aria-invalid', () => {
    render(<Textarea aria-label="Descripción" />);
    expect(screen.getByRole('textbox', { name: 'Descripción' })).not.toHaveAttribute(
      'aria-invalid',
    );
  });

  it('CA-00.19: con invalid expone aria-invalid y se asocia a su mensaje con aria-describedby', () => {
    render(
      <>
        <Textarea aria-label="Descripción" invalid aria-describedby="descripcion-error" />
        <p id="descripcion-error">Describe la incidencia</p>
      </>,
    );

    const textarea = screen.getByRole('textbox', { name: 'Descripción' });
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription('Describe la incidencia');
  });

  it('CA-00.19: admite varias líneas y reenvía ref', async () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea aria-label="Descripción" ref={ref} />);

    const textarea = screen.getByRole('textbox', { name: 'Descripción' });
    await userEvent.type(textarea, 'Primera línea{enter}Segunda línea');

    expect(textarea).toHaveValue('Primera línea\nSegunda línea');
    expect(ref.current).toBe(textarea);
  });
});
