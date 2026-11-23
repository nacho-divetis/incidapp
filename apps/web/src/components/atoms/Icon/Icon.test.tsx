// CA-00.19 · Icon: decorativo (oculto) salvo que reciba `label`, entonces es una imagen con nombre.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';

describe('Icon', () => {
  it('CA-00.19: sin label queda oculto a los lectores de pantalla', () => {
    const { container } = render(<Icon name="paperclip" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('CA-00.19: con label se anuncia como imagen con ese nombre', () => {
    render(<Icon name="warning" label="Atención" />);

    const icon = screen.getByRole('img', { name: 'Atención' });
    expect(icon).not.toHaveAttribute('aria-hidden');
  });
});
