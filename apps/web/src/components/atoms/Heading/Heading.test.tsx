// CA-00.19 · Heading: `level` decide la etiqueta y `as` la separa del tamaño.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Heading } from './Heading';

describe('Heading', () => {
  it.each([1, 2, 3, 4] as const)('CA-00.19: level=%i es un encabezado de ese nivel', (level) => {
    render(<Heading level={level}>Título</Heading>);
    expect(screen.getByRole('heading', { level, name: 'Título' })).toBeInTheDocument();
  });

  it('CA-00.19: con as, la etiqueta es la indicada aunque el tamaño sea el de level', () => {
    render(
      <Heading level={3} as="h1">
        Título
      </Heading>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Título' })).toBeInTheDocument();
  });
});
