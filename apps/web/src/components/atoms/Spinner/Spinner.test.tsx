// CA-00.19 · Spinner: región de estado con el texto accesible que recibe por props.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('CA-00.19: es un role="status" que anuncia su label', () => {
    render(<Spinner label="Cargando incidencias…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando incidencias…');
  });
});
