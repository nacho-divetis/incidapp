import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Heading } from '../../atoms';

/**
 * Disposición de las pantallas sin sesión (inicio de sesión): un panel centrado dentro de `main`,
 * con el título de la página como `h1` y el contenido debajo. En móvil el panel ocupa el ancho
 * disponible con un margen lateral, sin desplazamiento horizontal.
 */
export interface AuthLayoutProps {
  /** Texto del título (se pinta como `h1`; no pases otro encabezado). */
  title: ReactNode;
  /** Contenido del panel (normalmente un formulario). */
  children: ReactNode;
  className?: string;
}

export function AuthLayout({ title, children, className }: AuthLayoutProps) {
  return (
    <main
      className={cn(
        'flex min-h-dvh items-center justify-center bg-surface-muted px-4 py-8 sm:px-6',
        className,
      )}
    >
      <div className="w-full max-w-md min-w-0 rounded-lg border border-border bg-surface p-6 shadow-md sm:p-8">
        <Heading level={1} className="mb-6 text-center">
          {title}
        </Heading>
        {children}
      </div>
    </main>
  );
}
