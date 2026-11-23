// Comprueba la regla de capas del backend (CA-00.13) pasando ESLint sobre fragmentos de ejemplo.
// Se usa la configuración real de la raíz (`eslint.config.js`) sobre un proyecto temporal que
// reproduce `apps/api/src/<capa>/`, porque la regla solo clasifica importaciones que se resuelven
// a un archivo existente.
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const LAYERS = ['domain', 'application', 'infrastructure', 'http', 'composition'] as const;
type Layer = (typeof LAYERS)[number];

const ARCHITECTURE_RULES = new Set(['boundaries/dependencies', 'no-restricted-imports']);

let projectDir: string;
let eslint: ESLint;

beforeAll(async () => {
  projectDir = await mkdtemp(path.join(tmpdir(), 'incidapp-capas-'));
  // Un módulo de destino real en cada capa para que las importaciones se resuelvan.
  for (const layer of LAYERS) {
    const dir = path.join(projectDir, 'apps/api/src', layer);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'target.ts'), 'export const target = 1;\n');
  }
  eslint = new ESLint({
    cwd: projectDir,
    overrideConfigFile: path.join(repoRoot, 'eslint.config.js'),
  });
});

afterAll(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

/** Errores de arquitectura que da ESLint para `code` escrito en un archivo de la capa `layer`. */
async function architectureErrors(layer: Layer, code: string): Promise<string[]> {
  const filePath = path.join(projectDir, 'apps/api/src', layer, 'sample.ts');
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) throw new Error('ESLint no ha devuelto resultado');
  return result.messages
    .filter((message) => message.ruleId !== null && ARCHITECTURE_RULES.has(message.ruleId))
    .map((message) => `${message.ruleId}: ${message.message}`);
}

const importFrom = (target: Layer) =>
  `import { target } from '../${target}/target';\nexport const value = target;\n`;

describe('CA-00.13: regla de capas del backend', () => {
  const forbidden: [Layer, Layer][] = [
    ['domain', 'application'],
    ['domain', 'infrastructure'],
    ['domain', 'http'],
    ['domain', 'composition'],
    ['application', 'infrastructure'],
    ['application', 'http'],
    ['application', 'composition'],
    ['infrastructure', 'http'],
    ['infrastructure', 'composition'],
    ['http', 'infrastructure'],
    ['http', 'composition'],
  ];

  it.each(forbidden)('CA-00.13: "%s" no puede importar de "%s"', async (from, to) => {
    const errors = await architectureErrors(from, importFrom(to));
    expect(errors).toEqual([expect.stringContaining('boundaries/dependencies')]);
  });

  const allowed: [Layer, Layer][] = [
    ['domain', 'domain'],
    ['application', 'domain'],
    ['application', 'application'],
    ['infrastructure', 'domain'],
    ['infrastructure', 'application'],
    ['http', 'domain'],
    ['http', 'application'],
    ['composition', 'domain'],
    ['composition', 'application'],
    ['composition', 'infrastructure'],
    ['composition', 'http'],
  ];

  it.each(allowed)('CA-00.13: "%s" sí puede importar de "%s"', async (from, to) => {
    expect(await architectureErrors(from, importFrom(to))).toEqual([]);
  });

  it.each([
    'fastify',
    '@fastify/helmet',
    'drizzle-orm',
    'drizzle-orm/pg-core',
    'zod',
    'node:fs',
    'node:crypto',
    'fs',
  ])('CA-00.13: el dominio no puede importar "%s"', async (pkg) => {
    const errors = await architectureErrors(
      'domain',
      `import * as forbidden from '${pkg}';\nexport const value = forbidden;\n`,
    );
    expect(errors).toEqual([expect.stringContaining('no-restricted-imports')]);
  });

  it('CA-00.13: las capas externas sí pueden usar paquetes externos', async () => {
    const code = `import { z } from 'zod';\nimport fs from 'node:fs';\nexport const value = [z, fs];\n`;
    expect(await architectureErrors('application', code)).toEqual([]);
    expect(await architectureErrors('infrastructure', code)).toEqual([]);
  });
});
