import type { DemoUser } from '@incidapp/shared';
import { useId } from 'react';
import { cn } from '@/lib/cn';
import { ROLE_LABELS } from '@/lib/labels';
import { Badge, Button, Heading, Text } from '../../atoms';

/** Cuenta demo que se muestra en el recuadro (subconjunto de `DemoUser` de `shared`). */
export type DemoAccount = Pick<DemoUser, 'email' | 'name' | 'role'>;

/**
 * Recuadro "Usuarios demo" de `/login` (HU-08): lista accesible de las cuentas demo con su nombre,
 * su rol en español y su email, y la contraseña común. El botón "Usar" de cada cuenta llama a
 * `onSelect(email)` para que la página rellene el email del formulario.
 *
 * Las cuentas y la contraseña llegan por props (la página le pasa `DEMO_USERS` y `DEMO_PASSWORD`).
 */
export interface DemoAccountsPanelProps {
  /** Cuentas demo, en el orden en que se muestran. */
  accounts: readonly DemoAccount[];
  /** Contraseña común de las cuentas demo. */
  password: string;
  /** Se llama con el email de la cuenta elegida. */
  onSelect: (email: string) => void;
  className?: string;
}

export function DemoAccountsPanel({
  accounts,
  password,
  onSelect,
  className,
}: DemoAccountsPanelProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col gap-3 rounded-md border border-border bg-surface-muted p-4',
        className,
      )}
    >
      <Heading id={titleId} level={4} as="h2">
        Usuarios demo
      </Heading>
      <Text variant="small">
        Contraseña para todas las cuentas:{' '}
        <code className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-fg">{password}</code>
      </Text>

      {accounts.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {accounts.map((account) => (
            <li
              key={account.email}
              className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-fg">{account.name}</span>
                  <Badge tone="primary">{ROLE_LABELS[account.role]}</Badge>
                </span>
                <Text as="span" variant="small" className="break-all">
                  {account.email}
                </Text>
              </div>
              <Button
                variant="secondary"
                size="sm"
                aria-label={`Usar la cuenta de ${account.name} (${ROLE_LABELS[account.role]})`}
                onClick={() => onSelect(account.email)}
              >
                Usar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
