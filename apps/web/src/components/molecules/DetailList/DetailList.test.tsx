// CA-03.14 (datos del detalle) · DetailList: cada dato con su nombre, como lista de definiciones.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DetailList } from './DetailList';

describe('DetailList', () => {
  it('pinta cada nombre como término y su valor como definición', () => {
    render(
      <DetailList
        items={[
          { label: 'Tipo', value: 'Transporte' },
          { label: 'Asignada a', value: <strong>Marta Gil</strong> },
        ]}
      />,
    );

    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    const definitions = screen.getAllByRole('definition').map((item) => item.textContent);
    expect(terms).toEqual(['Tipo', 'Asignada a']);
    expect(definitions).toEqual(['Transporte', 'Marta Gil']);
  });

  it('sin datos pinta una lista vacía', () => {
    const { container } = render(<DetailList items={[]} />);

    expect(container.querySelector('dl')).toBeEmptyDOMElement();
  });
});
