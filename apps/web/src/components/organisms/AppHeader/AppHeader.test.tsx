// CA-01.15 (cabecera) · AppHeader: nombre del usuario, rol en español y botón "Cerrar sesión" que
// llama a `onLogout` y no se puede volver a pulsar mientras se cierra la sesión.
import type { Role } from '@incidapp/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('CA-01.15: muestra el nombre de la aplicación, el del usuario y el botón "Cerrar sesión"', () => {
    render(
      <AppHeader
        appName="IncidApp"
        user={{ name: 'Elena Ruiz', role: 'ADMIN' }}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByText('IncidApp')).toBeInTheDocument();
    expect(screen.getByText('Elena Ruiz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled();
    // No repite el landmark de AppLayout ni añade encabezados.
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it.each<[Role, string]>([
    ['ADMIN', 'Admin'],
    ['DIRECTOR', 'Dirección'],
    ['MANAGER', 'Responsable'],
    ['USER', 'Usuario'],
  ])('CA-01.15: el rol %s se muestra como "%s"', (role, label) => {
    render(<AppHeader appName="IncidApp" user={{ name: 'Ana', role }} onLogout={vi.fn()} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(role)).not.toBeInTheDocument();
  });

  it('CA-01.15: al pulsar "Cerrar sesión" llama a onLogout', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(
      <AppHeader
        appName="IncidApp"
        user={{ name: 'Pablo Moreno', role: 'USER' }}
        onLogout={onLogout}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('CA-01.15: cerrando la sesión, el botón está en carga y no se puede volver a pulsar', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(
      <AppHeader
        appName="IncidApp"
        user={{ name: 'Pablo Moreno', role: 'USER' }}
        onLogout={onLogout}
        isLoggingOut
      />,
    );

    const button = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await user.click(button);
    expect(onLogout).not.toHaveBeenCalled();
  });
});
