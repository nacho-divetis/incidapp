// CA-01.13 (recuadro de usuarios demo, duda resuelta 5) · DemoAccountsPanel: lista las cuentas con su
// rol en español y la contraseña, y al elegir una devuelve su email con `onSelect`.
import { DEMO_PASSWORD, DEMO_USERS } from '@incidapp/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DemoAccountsPanel } from './DemoAccountsPanel';

describe('DemoAccountsPanel', () => {
  it('muestra el recuadro "Usuarios demo" con la contraseña y cada cuenta con su nombre, rol y email', () => {
    render(<DemoAccountsPanel accounts={DEMO_USERS} password={DEMO_PASSWORD} onSelect={vi.fn()} />);

    const panel = screen.getByRole('region', { name: 'Usuarios demo' });
    expect(within(panel).getByText(DEMO_PASSWORD)).toBeInTheDocument();

    const items = within(panel).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent('Elena Ruiz');
    expect(items[0]).toHaveTextContent('Admin');
    expect(items[0]).toHaveTextContent('admin@incidapp.test');
    expect(items[1]).toHaveTextContent('Dirección');
    expect(items[2]).toHaveTextContent('Responsable');
    expect(items[3]).toHaveTextContent('Usuario');
  });

  it('al pulsar "Usar" en una cuenta llama a onSelect con su email', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DemoAccountsPanel accounts={DEMO_USERS} password={DEMO_PASSWORD} onSelect={onSelect} />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Usar la cuenta de Carmen Vidal (Responsable)' }),
    );

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('responsable@incidapp.test');
  });

  it('cada botón tiene un nombre accesible distinto que empieza por su texto visible', () => {
    render(<DemoAccountsPanel accounts={DEMO_USERS} password={DEMO_PASSWORD} onSelect={vi.fn()} />);

    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(new Set(names).size).toBe(DEMO_USERS.length);
    for (const name of names) expect(name).toMatch(/^Usar /);
  });

  it('sin cuentas no pinta ningún botón', () => {
    render(<DemoAccountsPanel accounts={[]} password={DEMO_PASSWORD} onSelect={vi.fn()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
