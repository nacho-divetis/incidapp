// CA-01.17 (enlace) · Link: pinta un `<a>` con foco visible, es polimórfico con `as` (para el `Link`
// de React Router, que pasa la página) y protege los enlaces que abren otra pestaña.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type ComponentPropsWithRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Link } from './Link';

/** Componente de enlace ficticio con la forma del `Link` de React Router (`to` en lugar de `href`). */
function FakeRouterLink({
  to,
  ...props
}: { to: string } & Omit<ComponentPropsWithRef<'a'>, 'href'>) {
  return <a href={to} data-router-link="" {...props} />;
}

describe('Link', () => {
  it('CA-01.17: por defecto es un enlace <a> con su href y su texto', () => {
    render(<Link href="/">Volver al inicio</Link>);

    const link = screen.getByRole('link', { name: 'Volver al inicio' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/');
  });

  it('CA-01.17: con as pinta el componente indicado y le reenvía sus props y el estilo', () => {
    render(
      <Link as={FakeRouterLink} to="/incidencias" className="mt-4">
        Ver incidencias
      </Link>,
    );

    const link = screen.getByRole('link', { name: 'Ver incidencias' });
    expect(link).toHaveAttribute('data-router-link');
    expect(link).toHaveAttribute('href', '/incidencias');
    expect(link).toHaveClass('mt-4', 'underline');
  });

  it('CA-01.17: recibe el foco con el teclado, responde al clic y reenvía ref', async () => {
    const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const ref = createRef<HTMLAnchorElement>();
    render(
      <Link href="/" ref={ref} onClick={onClick}>
        Inicio
      </Link>,
    );

    await userEvent.tab();
    const link = screen.getByRole('link', { name: 'Inicio' });
    expect(link).toHaveFocus();
    expect(ref.current).toBe(link);

    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('con target="_blank" añade rel="noopener noreferrer"', () => {
    render(
      <Link href="https://example.com" target="_blank">
        Documentación
      </Link>,
    );
    expect(screen.getByRole('link', { name: 'Documentación' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('respeta el rel indicado y no añade rel si no abre otra pestaña', () => {
    render(
      <>
        <Link href="https://example.com" target="_blank" rel="noreferrer">
          Externo
        </Link>
        <Link href="/">Interno</Link>
      </>,
    );
    expect(screen.getByRole('link', { name: 'Externo' })).toHaveAttribute('rel', 'noreferrer');
    expect(screen.getByRole('link', { name: 'Interno' })).not.toHaveAttribute('rel');
  });

  it('la variante subtle no lleva subrayado fijo', () => {
    render(
      <Link href="/" variant="subtle">
        Ayuda
      </Link>,
    );
    expect(screen.getByRole('link', { name: 'Ayuda' })).toHaveClass('no-underline');
  });
});
