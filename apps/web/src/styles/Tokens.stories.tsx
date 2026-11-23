// Catálogo de los tokens de diseño de `tokens.css` (CA-00.15). Las muestras usan las variables CSS
// (`var(--color-…)`) para enseñar el valor real del tema, también si cambia.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type ReactNode } from 'react';

const TONES = [
  { name: 'primary', label: 'Primario' },
  { name: 'neutral', label: 'Neutro' },
  { name: 'success', label: 'Éxito' },
  { name: 'warning', label: 'Aviso' },
  { name: 'danger', label: 'Peligro' },
  { name: 'info', label: 'Información' },
] as const;

const BASE_COLORS = [
  { name: 'surface', label: 'Superficie' },
  { name: 'surface-muted', label: 'Superficie atenuada (fondo de página)' },
  { name: 'fg', label: 'Texto' },
  { name: 'fg-muted', label: 'Texto atenuado' },
  { name: 'border', label: 'Borde (separadores)' },
  { name: 'border-strong', label: 'Borde de controles' },
  { name: 'focus-ring', label: 'Anillo de foco' },
] as const;

const TEXT_SIZES = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'] as const;
const SPACING_STEPS = [1, 2, 3, 4, 6, 8, 12, 16] as const;
const RADII = ['sm', 'md', 'lg', 'xl'] as const;
const SHADOWS = ['sm', 'md', 'lg'] as const;

/** Valor calculado de una variable CSS del tema (p. ej., `--color-primary` → `#1d4ed8`). */
function useCssVariable(name: string): string {
  const [value, setValue] = useState('');
  useEffect(() => {
    setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  }, [name]);
  return value;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function VariableName({ name }: { name: string }) {
  const value = useCssVariable(name);
  return (
    <span className="font-mono text-xs text-fg-muted">
      {name}
      {value && ` · ${value}`}
    </span>
  );
}

function Swatch({ variable, label }: { variable: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="size-10 shrink-0 rounded-md border border-border"
        style={{ background: `var(${variable})` }}
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        <VariableName name={variable} />
      </span>
    </div>
  );
}

function TonePalette({ name, label }: (typeof TONES)[number]) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-base font-semibold">{label}</h3>
      {/* Pares de texto y fondo tal y como se usan (contraste AA comprobado en tokens.test.ts). */}
      <div className="flex flex-wrap gap-2">
        <span
          className="rounded-md px-3 py-1.5 text-sm font-medium"
          style={{
            background: `var(--color-${name})`,
            color: `var(--color-${name}-contrast)`,
          }}
        >
          Sólido
        </span>
        <span
          className="rounded-md px-3 py-1.5 text-sm font-medium"
          style={{
            background: `var(--color-${name}-hover)`,
            color: `var(--color-${name}-contrast)`,
          }}
        >
          Sólido (hover)
        </span>
        <span
          className="rounded-md border px-3 py-1.5 text-sm font-medium"
          style={{
            background: `var(--color-${name}-bg)`,
            color: `var(--color-${name}-fg)`,
            borderColor: `var(--color-${name}-border)`,
          }}
        >
          Suave
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Swatch variable={`--color-${name}`} label="Sólido" />
        <Swatch variable={`--color-${name}-hover`} label="Sólido (hover)" />
        <Swatch variable={`--color-${name}-contrast`} label="Texto sobre el sólido" />
        <Swatch variable={`--color-${name}-bg`} label="Fondo suave" />
        <Swatch variable={`--color-${name}-fg`} label="Texto suave" />
        <Swatch variable={`--color-${name}-border`} label="Borde suave" />
      </div>
    </div>
  );
}

function TokensCatalog() {
  return (
    <div className="flex flex-col gap-10 bg-surface-muted p-6 font-sans text-fg">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Tokens de diseño</h1>
        <p className="text-fg-muted">
          Variables de <code className="font-mono text-sm">styles/tokens.css</code>, disponibles
          como clases de Tailwind (<code className="font-mono text-sm">bg-primary</code>,{' '}
          <code className="font-mono text-sm">text-danger-fg</code>…) y como variables CSS.
        </p>
      </header>

      <Section title="Colores semánticos">
        <div className="grid gap-4 lg:grid-cols-2">
          {TONES.map((tone) => (
            <TonePalette key={tone.name} {...tone} />
          ))}
        </div>
      </Section>

      <Section title="Superficie, texto, bordes y foco">
        <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
          {BASE_COLORS.map(({ name, label }) => (
            <Swatch key={name} variable={`--color-${name}`} label={label} />
          ))}
        </div>
        <button
          type="button"
          className="focus-ring w-fit rounded-md border border-border-strong bg-surface px-4 py-2 text-sm"
        >
          Ejemplo de foco visible
        </button>
      </Section>

      <Section title="Tipografía">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <VariableName name="--font-sans" />
          {TEXT_SIZES.map((size) => (
            <p key={size} style={{ fontSize: `var(--text-${size})` }}>
              <span className="font-mono text-xs text-fg-muted">text-{size} · </span>
              Gestión de incidencias
            </p>
          ))}
        </div>
      </Section>

      <Section title="Espaciado">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <VariableName name="--spacing" />
          {SPACING_STEPS.map((step) => (
            <div key={step} className="flex items-center gap-3">
              <span className="w-12 font-mono text-xs text-fg-muted">{step}</span>
              <span
                aria-hidden="true"
                className="h-3 rounded-sm bg-primary"
                style={{ width: `calc(var(--spacing) * ${step})` }}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radios y sombras">
        <div className="flex flex-wrap gap-6 rounded-lg border border-border bg-surface p-4">
          {RADII.map((radius) => (
            <div key={radius} className="flex flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className="size-16 border border-border-strong bg-neutral-bg"
                style={{ borderRadius: `var(--radius-${radius})` }}
              />
              <span className="font-mono text-xs text-fg-muted">rounded-{radius}</span>
            </div>
          ))}
          {SHADOWS.map((shadow) => (
            <div key={shadow} className="flex flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className="size-16 rounded-md bg-surface"
                style={{ boxShadow: `var(--shadow-${shadow})` }}
              />
              <span className="font-mono text-xs text-fg-muted">shadow-{shadow}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

const meta = {
  title: 'Tokens/Paleta',
  component: TokensCatalog,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TokensCatalog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Todos los tokens del tema: colores, tipografía, espaciado, radios y sombras. */
export const Paleta: Story = {};
