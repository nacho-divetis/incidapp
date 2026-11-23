// @vitest-environment node
// Reglas de arquitectura de la web (atomic design):
// - CA-00.18: niveles atómicos e importaciones prohibidas, pasando ESLint (configuración real de la
//   raíz) sobre fragmentos de ejemplo en un proyecto temporal que reproduce `apps/web/src/`, porque
//   la regla de niveles solo clasifica importaciones que se resuelven a un archivo existente.
// - CA-00.17: estructura obligatoria de cada carpeta de componente.
// - CA-00.15: sin colores hexadecimales ni valores arbitrarios de Tailwind en `components/`.
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const componentsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(componentsDir, '../../../..');

const LEVELS = ['atoms', 'molecules', 'organisms', 'templates'] as const;
type Level = (typeof LEVELS)[number];

// ---------------------------------------------------------------------------------------------
// Utilidades de comprobación (se aplican al código real y se prueban con casos de ejemplo)
// ---------------------------------------------------------------------------------------------

/** Problemas de estructura de las carpetas de componentes de `dir` (CA-00.17). */
async function structureProblems(dir: string): Promise<string[]> {
  const problems: string[] = [];
  for (const level of LEVELS) {
    const levelDir = path.join(dir, level);
    const entries = await readdir(levelDir, { withFileTypes: true }).catch(() => null);
    if (!entries) {
      problems.push(`${level}: falta la carpeta del nivel`);
      continue;
    }
    const levelIndex = await readFile(path.join(levelDir, 'index.ts'), 'utf8').catch(() => null);
    if (levelIndex === null) problems.push(`${level}: falta ${level}/index.ts`);

    for (const entry of entries.filter((item) => item.isDirectory())) {
      const name = entry.name;
      const where = `${level}/${name}`;
      const files = new Set(await readdir(path.join(levelDir, name)));
      if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) problems.push(`${where}: el nombre no es PascalCase`);
      if (!files.has(`${name}.tsx`)) problems.push(`${where}: falta ${name}.tsx`);
      if (!files.has('index.ts')) problems.push(`${where}: falta index.ts`);
      if (level !== 'templates' && !files.has(`${name}.stories.tsx`)) {
        problems.push(`${where}: falta ${name}.stories.tsx`);
      }
      const exportPattern = new RegExp(`from\\s+['"]\\./${name}(/index)?['"]`);
      if (levelIndex !== null && !exportPattern.test(levelIndex)) {
        problems.push(`${where}: no se exporta desde ${level}/index.ts`);
      }
    }
  }
  return problems;
}

const HEX_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
// `p-[13px]`, `bg-[#fff]`… pero no las variantes con corchetes (`data-[state=open]:`), que no son valores.
const ARBITRARY_VALUE = /\b[a-z][\w-]*-\[[^\]\s]+\](?!:)/g;
// Propiedades arbitrarias: `[mask-type:luminance]`.
const ARBITRARY_PROPERTY = /\[[a-z-]+:[^\]\s]+\]/g;
// Atajo de Tailwind 4 para variables CSS sueltas: `bg-(--brand)`.
const ARBITRARY_VARIABLE = /\b[a-z][\w-]*-\(--[\w-]+\)/g;

/** Colores hexadecimales y valores arbitrarios de Tailwind que hay en `source` (CA-00.15). */
function styleProblems(source: string): string[] {
  return [HEX_COLOR, ARBITRARY_VALUE, ARBITRARY_PROPERTY, ARBITRARY_VARIABLE].flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[0]),
  );
}

/** Archivos de código de `dir`, recursivamente, salvo este test. */
async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(ts|tsx|css)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => file !== fileURLToPath(import.meta.url));
}

// ---------------------------------------------------------------------------------------------
// CA-00.18 · Regla de niveles atómicos (ESLint)
// ---------------------------------------------------------------------------------------------

const ARCHITECTURE_RULES = new Set([
  'boundaries/dependencies',
  'no-restricted-imports',
  'no-restricted-globals',
]);

let projectDir: string;
let eslint: ESLint;

/** Crea `relativePath` con `content` dentro del proyecto temporal. */
async function writeProjectFile(relativePath: string, content: string) {
  const file = path.join(projectDir, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

beforeAll(async () => {
  projectDir = await mkdtemp(path.join(tmpdir(), 'incidapp-niveles-'));
  // Un componente de destino real en cada nivel y en pages/, para que las importaciones se resuelvan.
  for (const level of [...LEVELS.map((name) => `components/${name}`), 'pages']) {
    await writeProjectFile(
      `apps/web/src/${level}/Target/Target.tsx`,
      'export const Target = () => null;\n',
    );
    await writeProjectFile(`apps/web/src/${level}/Target/index.ts`, "export * from './Target';\n");
    // Archivo propio del componente de ejemplo, para probar las importaciones internas.
    await writeProjectFile(`apps/web/src/${level}/Sample/helper.ts`, 'export const helper = 1;\n');
  }
  // Índice de cada nivel, como el real (`components/<nivel>/index.ts`).
  for (const level of LEVELS) {
    await writeProjectFile(
      `apps/web/src/components/${level}/index.ts`,
      "export * from './Target';\n",
    );
  }
  await writeProjectFile('apps/web/src/lib/cn.ts', 'export const cn = () => "";\n');
  await writeProjectFile('apps/web/src/lib/api/client.ts', 'export const apiGet = () => null;\n');
  await writeProjectFile(
    'apps/web/src/queries/health.ts',
    'export const useHealth = () => null;\n',
  );
  await writeProjectFile('apps/web/src/app/providers.tsx', 'export const AppProviders = 1;\n');

  eslint = new ESLint({
    cwd: projectDir,
    overrideConfigFile: path.join(repoRoot, 'eslint.config.js'),
  });
}, 30_000);

afterAll(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

type Origin = Level | 'pages';

/** Errores de arquitectura que da ESLint para `code` escrito en un componente de `origin`. */
async function architectureErrors(origin: Origin, code: string): Promise<string[]> {
  const folder = origin === 'pages' ? 'pages' : `components/${origin}`;
  const filePath = path.join(projectDir, 'apps/web/src', folder, 'Sample/Sample.tsx');
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) throw new Error('ESLint no ha devuelto resultado');
  return result.messages
    .filter((message) => message.ruleId !== null && ARCHITECTURE_RULES.has(message.ruleId))
    .map((message) => `${message.ruleId}: ${message.message}`);
}

/** Código que importa y usa el componente `Target` del nivel `target` (o de su mismo nivel). */
function importTarget(origin: Origin, target: Origin): string {
  const targetFolder = target === 'pages' ? 'pages' : `components/${target}`;
  const originFolder = origin === 'pages' ? 'pages' : `components/${origin}`;
  const fromSample = path.posix.relative(`${originFolder}/Sample`, `${targetFolder}/Target`);
  return `import { Target } from '${fromSample}';\nexport const value = Target;\n`;
}

describe('CA-00.18: regla de niveles atómicos', () => {
  const forbidden: [Origin, Origin][] = [
    ['atoms', 'molecules'],
    ['atoms', 'organisms'],
    ['atoms', 'templates'],
    ['atoms', 'pages'],
    ['molecules', 'organisms'],
    ['molecules', 'templates'],
    ['molecules', 'pages'],
    ['organisms', 'templates'],
    ['organisms', 'pages'],
    ['templates', 'pages'],
  ];

  it.each(forbidden)('CA-00.18: "%s" no puede importar de "%s"', async (from, to) => {
    const errors = await architectureErrors(from, importTarget(from, to));
    expect(errors).toEqual([expect.stringContaining('boundaries/dependencies')]);
  });

  it.each(['atoms', 'molecules', 'templates'] as const)(
    'CA-00.18: un componente de "%s" no puede usar otro de su mismo nivel',
    async (level) => {
      const errors = await architectureErrors(level, importTarget(level, level));
      expect(errors).toEqual([expect.stringContaining('mismo nivel')]);
    },
  );

  // Importar el índice de un nivel (`../../molecules`) cuenta como importar de ese nivel.
  const forbiddenIndex: [Origin, Level][] = [
    ['atoms', 'molecules'],
    ['atoms', 'atoms'],
    ['molecules', 'organisms'],
    ['molecules', 'molecules'],
    ['organisms', 'templates'],
    ['templates', 'templates'],
  ];

  it.each(forbiddenIndex)(
    'CA-00.18: "%s" no puede importar del índice de "%s"',
    async (from, to) => {
      const code = `import { Target } from '../../${to}';\nexport const value = Target;\n`;
      expect(await architectureErrors(from, code)).toEqual([
        expect.stringContaining('boundaries/dependencies'),
      ]);
    },
  );

  it.each(LEVELS)('CA-00.18: el índice de "%s" sí reexporta sus componentes', async (level) => {
    const filePath = path.join(projectDir, 'apps/web/src/components', level, 'index.ts');
    const [result] = await eslint.lintText("export * from './Target';\n", { filePath });
    expect(result?.messages).toEqual([]);
  });

  it.each([
    ['molecules', 'atoms'],
    ['organisms', 'molecules'],
    ['templates', 'organisms'],
    ['pages', 'templates'],
  ] as const)('CA-00.18: "%s" sí puede importar del índice de "%s"', async (from, to) => {
    const prefix = from === 'pages' ? '../../components' : '../..';
    const code = `import { Target } from '${prefix}/${to}';\nexport const value = Target;\n`;
    expect(await architectureErrors(from, code)).toEqual([]);
  });

  const allowed: [Origin, Origin][] = [
    ['molecules', 'atoms'],
    ['organisms', 'atoms'],
    ['organisms', 'molecules'],
    ['organisms', 'organisms'],
    ['templates', 'atoms'],
    ['templates', 'molecules'],
    ['templates', 'organisms'],
    ['pages', 'atoms'],
    ['pages', 'molecules'],
    ['pages', 'organisms'],
    ['pages', 'templates'],
  ];

  it.each(allowed)('CA-00.18: "%s" sí puede importar de "%s"', async (from, to) => {
    expect(await architectureErrors(from, importTarget(from, to))).toEqual([]);
  });

  it.each(LEVELS)(
    'CA-00.18: un componente de "%s" sí puede importar sus propios archivos y lib/',
    async (level) => {
      const code = [
        "import { helper } from './helper';",
        "import { cn } from '@/lib/cn';",
        "import { cn as cnRelative } from '../../../lib/cn';",
        'export const value = [helper, cn, cnRelative];',
        '',
      ].join('\n');
      expect(await architectureErrors(level, code)).toEqual([]);
    },
  );

  const forbiddenImports: [string, string][] = [
    ['TanStack Query', "import { useQuery } from '@tanstack/react-query';"],
    ['el cliente de la API (relativo)', "import { apiGet } from '../../../lib/api/client';"],
    ['el cliente de la API (alias)', "import { apiGet } from '@/lib/api/client';"],
    ['un hook de queries/ (relativo)', "import { useHealth } from '../../../queries/health';"],
    ['un hook de queries/ (alias)', "import { useHealth } from '@/queries/health';"],
    ['useNavigate', "import { useNavigate } from 'react-router';"],
    ['useParams', "import { useParams } from 'react-router';"],
    ['useLocation', "import { useLocation } from 'react-router-dom';"],
    ['los providers o la sesión de app/', "import { AppProviders } from '../../../app/providers';"],
    ['otro componente por el alias', "import { Target } from '@/components/atoms/Target';"],
  ];

  const levelAndImport = LEVELS.flatMap((level) =>
    forbiddenImports.map(([what, code]) => [level, what, code] as const),
  );

  it.each(levelAndImport)(
    'CA-00.18: un componente de "%s" no puede importar %s',
    async (level, _what, code) => {
      const errors = await architectureErrors(level, `${code}\nexport const value = 1;\n`);
      expect(errors).toEqual([expect.stringContaining('no-restricted-imports')]);
    },
  );

  it.each(LEVELS)('CA-00.18: un componente de "%s" no puede llamar a fetch', async (level) => {
    const code = "export const load = () => fetch('/api/health');\n";
    expect(await architectureErrors(level, code)).toEqual([
      expect.stringContaining('no-restricted-globals'),
    ]);
  });

  it('CA-00.18: un átomo no puede importar @incidapp/shared', async () => {
    const code = "import type { Health } from '@incidapp/shared';\nexport type Value = Health;\n";
    expect(await architectureErrors('atoms', code)).toEqual([
      expect.stringContaining('no conocen el dominio'),
    ]);
  });

  it.each(['molecules', 'organisms', 'templates'] as const)(
    'CA-00.18: "%s" sí puede usar los tipos de @incidapp/shared',
    async (level) => {
      const code = "import type { Health } from '@incidapp/shared';\nexport type Value = Health;\n";
      expect(await architectureErrors(level, code)).toEqual([]);
    },
  );

  it('CA-00.18: las páginas sí pueden usar datos, router y queries', async () => {
    const code = [
      "import { useQuery } from '@tanstack/react-query';",
      "import { useNavigate, useParams } from 'react-router';",
      "import { useHealth } from '../../queries/health';",
      "import { apiGet } from '../../lib/api/client';",
      'export const value = [useQuery, useNavigate, useParams, useHealth, apiGet];',
      '',
    ].join('\n');
    expect(await architectureErrors('pages', code)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// CA-00.17 · Estructura obligatoria de cada componente
// ---------------------------------------------------------------------------------------------

describe('CA-00.17: estructura de las carpetas de componentes', () => {
  it('CA-00.17: todos los componentes de components/ cumplen la estructura', async () => {
    expect(await structureProblems(componentsDir)).toEqual([]);
  });

  /** Crea una carpeta `components/` de ejemplo con un componente y devuelve sus problemas. */
  async function problemsOf(
    level: Level,
    name: string,
    files: string[],
    levelIndex = `export * from './${name}';\n`,
  ): Promise<string[]> {
    const dir = await mkdtemp(path.join(tmpdir(), 'incidapp-estructura-'));
    try {
      for (const each of LEVELS) {
        await mkdir(path.join(dir, each), { recursive: true });
        await writeFile(path.join(dir, each, 'index.ts'), each === level ? levelIndex : '');
      }
      await mkdir(path.join(dir, level, name));
      for (const file of files) await writeFile(path.join(dir, level, name, file), '');
      return await structureProblems(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  it.each([
    ['atoms', 'Button', ['Button.tsx', 'Button.stories.tsx', 'index.ts']],
    ['organisms', 'IncidentTable', ['IncidentTable.tsx', 'IncidentTable.stories.tsx', 'index.ts']],
    ['templates', 'AppLayout', ['AppLayout.tsx', 'index.ts']],
  ] as const)('CA-00.17: "%s/%s" completo no da problemas', async (level, name, files) => {
    expect(await problemsOf(level, name, [...files])).toEqual([]);
  });

  it.each([
    ['atoms', 'Button', ['Button.stories.tsx', 'index.ts'], 'falta Button.tsx'],
    ['atoms', 'Button', ['Button.tsx', 'Button.stories.tsx'], 'falta index.ts'],
    ['molecules', 'FormField', ['FormField.tsx', 'index.ts'], 'falta FormField.stories.tsx'],
    ['organisms', 'Header', ['Header.tsx', 'index.ts'], 'falta Header.stories.tsx'],
    ['atoms', 'button', ['button.tsx', 'button.stories.tsx', 'index.ts'], 'no es PascalCase'],
  ] as const)(
    'CA-00.17: "%s/%s" incompleto da un problema',
    async (level, name, files, expected) => {
      expect(await problemsOf(level, name, [...files])).toEqual([
        expect.stringContaining(expected),
      ]);
    },
  );

  it('CA-00.17: un componente que no se exporta desde el index.ts de su nivel da un problema', async () => {
    const files = ['Badge.tsx', 'Badge.stories.tsx', 'index.ts'];
    expect(await problemsOf('atoms', 'Badge', files, 'export {};\n')).toEqual([
      expect.stringContaining('no se exporta desde atoms/index.ts'),
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// CA-00.15 · Solo tokens: sin hexadecimales ni valores arbitrarios en components/
// ---------------------------------------------------------------------------------------------

describe('CA-00.15: estilos solo con tokens en components/', () => {
  it('CA-00.15: ningún archivo de components/ tiene colores hexadecimales ni valores arbitrarios', async () => {
    const found: string[] = [];
    for (const file of await sourceFiles(componentsDir)) {
      const problems = styleProblems(await readFile(file, 'utf8'));
      if (problems.length > 0) {
        found.push(`${path.relative(componentsDir, file)}: ${problems.join(', ')}`);
      }
    }
    expect(found).toEqual([]);
  });

  it.each([
    "className='bg-[#1d4ed8]'",
    "className='p-[13px]'",
    "className='w-[calc(100%-1rem)]'",
    "style={{ color: '#ff0000' }}",
    "const border = '#abc';",
    "className='[mask-type:luminance]'",
    "className='bg-(--brand)'",
    "className='data-[state=open]:bg-[#fff]'",
  ])('CA-00.15: detecta %s', (source) => {
    expect(styleProblems(source)).not.toEqual([]);
  });

  it.each([
    "className='bg-primary text-primary-contrast hover:bg-primary-hover'",
    "className='rounded-md p-4 shadow-sm text-sm text-fg-muted'",
    "className='data-[state=open]:bg-primary-bg aria-[sort=ascending]:font-medium'",
    "href='#contenido'",
    'const first = items[0];',
    'type Props = { [key: string]: string };',
  ])('CA-00.15: no confunde %s con un valor arbitrario', (source) => {
    expect(styleProblems(source)).toEqual([]);
  });
});
