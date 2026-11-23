// Configuración única de ESLint (flat config) para todo el monorepo.
// Incluye la regla de capas del backend (Clean Architecture). La de niveles atómicos de la web
// se añade en T-00.06.
import { builtinModules } from 'node:module';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const API_SRC = 'apps/api/src';

// Capas de la API, de dentro afuera: domain ← application ← infrastructure / http ← composition.
// Cada capa indica de qué otras capas NO puede importar.
const layers = {
  domain: ['application', 'infrastructure', 'http', 'composition'],
  application: ['infrastructure', 'http', 'composition'],
  infrastructure: ['http', 'composition'],
  http: ['infrastructure', 'composition'],
  composition: [],
};

// Paquetes que el dominio no puede usar: es TypeScript puro.
const domainForbiddenPackages = ['fastify', 'drizzle-orm', 'zod'];

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/build/',
    '**/coverage/',
    '**/storybook-static/',
    '.worktrees/',
    '.data/',
    'apps/api/drizzle/',
  ]),

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Web: código de navegador.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // API: regla de capas (CA-00.13).
  // Los tests (*.test.ts) quedan fuera: montan dependencias como lo haría el composition root.
  {
    files: [`${API_SRC}/**/*.ts`],
    ignores: [`${API_SRC}/**/*.test.ts`],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': Object.keys(layers).map((type) => ({
        type,
        pattern: `${API_SRC}/${type}`,
      })),
      'import/resolver': {
        node: { extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'] },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: Object.entries(layers)
            .filter(([, forbidden]) => forbidden.length > 0)
            .map(([from, forbidden]) => ({
              from: { element: { type: from } },
              disallow: { to: { element: { types: forbidden } } },
              message: `Regla de capas: "${from}" no puede importar de {{ to.element.types.[0] }} (domain ← application ← infrastructure / http ← composition).`,
            })),
        },
      ],
    },
  },

  // API: el dominio no usa Fastify, Drizzle, Zod ni módulos de Node (CA-00.13).
  {
    files: [`${API_SRC}/domain/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...domainForbiddenPackages,
            ...builtinModules.filter((name) => !name.startsWith('_')),
          ].map((name) => ({
            name,
            message:
              'El dominio es TypeScript puro: no puede depender de paquetes externos ni de Node.',
          })),
          patterns: [
            {
              group: [
                'node:*',
                ...domainForbiddenPackages.map((name) => `${name}/*`),
                '@fastify/*',
              ],
              message:
                'El dominio es TypeScript puro: no puede depender de paquetes externos ni de Node.',
            },
          ],
        },
      ],
    },
  },

  // Desactiva las reglas de estilo que chocan con Prettier (siempre al final).
  prettier,
);
