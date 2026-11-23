// @vitest-environment node
// Comprueba los tokens de diseño (CA-00.15): que existen los que pide la spec y que los pares de
// texto y fondo tienen contraste AA (WCAG 2.2: 4,5:1 para texto; 3:1 para bordes y foco).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Se lee el archivo tal cual: Vitest no procesa el CSS importado (ni con `?raw`).
const tokensCss = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

const TONES = ['primary', 'neutral', 'success', 'warning', 'danger', 'info'] as const;
const SURFACES = ['surface', 'surface-muted'] as const;

/** Variables `--color-*` de `tokens.css` con su valor hexadecimal. */
function readColorTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const match of css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, value] = match;
    if (name && value) tokens.set(name, value);
  }
  return tokens;
}

const colors = readColorTokens(tokensCss);

function color(name: string): string {
  const value = colors.get(name);
  if (!value) throw new Error(`Falta el token --color-${name} en tokens.css`);
  return value;
}

/** Luminancia relativa de un color `#rrggbb` (WCAG). */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste entre dos colores `#rrggbb` (de 1 a 21). */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe('CA-00.15: tokens de diseño', () => {
  it('CA-00.15: cada tono semántico define sólido, hover, contraste, fondo, texto y borde', () => {
    for (const tone of TONES) {
      for (const suffix of ['', '-hover', '-contrast', '-bg', '-fg', '-border']) {
        expect(colors.has(`${tone}${suffix}`), `--color-${tone}${suffix}`).toBe(true);
      }
    }
  });

  it('CA-00.15: define superficie, texto, bordes y anillo de foco', () => {
    for (const name of [...SURFACES, 'fg', 'fg-muted', 'border', 'border-strong', 'focus-ring']) {
      expect(colors.has(name), `--color-${name}`).toBe(true);
    }
  });

  it('CA-00.15: define tipografía (Inter con fallback del sistema), espaciado, radios y sombras', () => {
    expect(tokensCss).toMatch(/--font-sans:\s*'Inter',[^;]*system-ui/);
    expect(tokensCss).not.toMatch(/@import|@font-face|url\(/);
    expect(tokensCss).toMatch(/--spacing:/);
    for (const size of ['sm', 'md', 'lg']) {
      expect(tokensCss).toMatch(new RegExp(`--radius-${size}:`));
      expect(tokensCss).toMatch(new RegExp(`--shadow-${size}:`));
    }
    expect(tokensCss).toMatch(/--text-base:/);
  });

  it.each(TONES)('CA-00.15: "%s": el texto suave sobre su fondo tiene contraste AA', (tone) => {
    expect(contrast(color(`${tone}-fg`), color(`${tone}-bg`))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TONES)(
    'CA-00.15: "%s": el texto sobre el sólido tiene contraste AA (normal y hover)',
    (tone) => {
      expect(contrast(color(`${tone}-contrast`), color(tone))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color(`${tone}-contrast`), color(`${tone}-hover`))).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );

  it.each(TONES)('CA-00.15: "%s": el texto del tono es legible sobre las superficies', (tone) => {
    for (const surface of SURFACES) {
      expect(contrast(color(`${tone}-fg`), color(surface))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(SURFACES)(
    'CA-00.15: el texto general y el atenuado tienen contraste AA sobre "%s"',
    (surface) => {
      expect(contrast(color('fg'), color(surface))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color('fg-muted'), color(surface))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(SURFACES)(
    'CA-00.15: el borde de los controles y el anillo de foco destacan (≥ 3:1) sobre "%s"',
    (surface) => {
      expect(contrast(color('border-strong'), color(surface))).toBeGreaterThanOrEqual(3);
      expect(contrast(color('focus-ring'), color(surface))).toBeGreaterThanOrEqual(3);
    },
  );
});
