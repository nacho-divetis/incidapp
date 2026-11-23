import { useRef, type MouseEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Disposición de las pantallas de la aplicación con sesión: cabecera arriba, navegación (lateral en
 * escritorio, encima del contenido en móvil) y contenido principal.
 *
 * - Pone los *landmarks*: `header` (banner), `nav` (navigation) y `main`. Lo que llega por los huecos
 *   no debe repetirlos (la navegación que se pase en `nav` no lleva otro `<nav>`).
 * - El primer elemento enfocable es el enlace "Saltar al contenido", visible solo al recibir el
 *   foco, que lleva el foco a `main`.
 * - No fija anchos: en móvil no hay desplazamiento horizontal.
 */
export interface AppLayoutProps {
  /** Contenido de la cabecera (normalmente el organismo `AppHeader`). */
  header?: ReactNode;
  /** Contenido de la navegación principal (enlaces). */
  nav?: ReactNode;
  /** Contenido principal de la página. */
  children: ReactNode;
  /** Texto del enlace de salto. */
  skipLinkLabel?: string;
  /** Nombre accesible de la navegación. */
  navLabel?: string;
  /** `id` del contenido principal (destino del enlace de salto). */
  mainId?: string;
  className?: string;
}

export function AppLayout({
  header,
  nav,
  children,
  skipLinkLabel = 'Saltar al contenido',
  navLabel = 'Navegación principal',
  mainId = 'contenido-principal',
  className,
}: AppLayoutProps) {
  const mainRef = useRef<HTMLElement>(null);

  // El navegador solo desplaza la vista con el ancla; además se mueve el foco a `main` para que la
  // siguiente tabulación empiece en el contenido (y para no depender del enrutador con el `#`).
  function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    mainRef.current?.focus();
  }

  return (
    <div className={cn('flex min-h-dvh flex-col bg-surface-muted', className)}>
      <a
        href={`#${mainId}`}
        onClick={skipToContent}
        className="sr-only rounded-md bg-surface font-medium text-primary shadow-md focus:not-sr-only focus:px-4 focus:py-2 focus:fixed focus:top-2 focus:left-2 focus:z-50 focus-visible:focus-ring"
      >
        {skipLinkLabel}
      </a>

      {header && <header className="border-b border-border bg-surface">{header}</header>}

      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        {nav && (
          <nav
            aria-label={navLabel}
            className="min-w-0 border-b border-border bg-surface md:w-60 md:shrink-0 md:border-r md:border-b-0"
          >
            {nav}
          </nav>
        )}
        <main
          ref={mainRef}
          id={mainId}
          tabIndex={-1}
          className="min-w-0 flex-1 p-4 focus:outline-none sm:p-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
