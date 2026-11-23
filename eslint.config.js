// Configuración única de ESLint (flat config) para todo el monorepo.
// Incluye la regla de capas del backend (Clean Architecture) y la de niveles atómicos de la web.
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

const WEB_SRC = 'apps/web/src';
const WEB_COMPONENTS = `${WEB_SRC}/components`;

// Niveles de atomic design, de abajo arriba: atoms ← molecules ← organisms ← templates ← pages.
// Cada nivel indica de qué niveles superiores NO puede importar.
const atomicLevels = {
  atoms: ['molecules', 'organisms', 'templates', 'pages'],
  molecules: ['organisms', 'templates', 'pages'],
  organisms: ['templates', 'pages'],
  templates: ['pages'],
};
// En el mismo nivel, solo los organismos pueden usar otros componentes de su nivel.
const levelsWithoutSiblings = ['atoms', 'molecules', 'templates'];

// Lo que ningún archivo de `components/` puede importar: los componentes son presentacionales
// (datos por props, acciones por callbacks). Datos, router y sesión solo en `pages/`.
const componentsForbiddenPatterns = [
  {
    group: ['@tanstack/react-query', '@tanstack/react-query/*'],
    message: 'Los componentes son presentacionales: TanStack Query solo se usa en pages/.',
  },
  {
    group: ['**/lib/api', '**/lib/api/**'],
    message: 'Los componentes son presentacionales: el cliente de la API solo se usa en pages/.',
  },
  {
    group: ['**/queries', '**/queries/**'],
    message: 'Los componentes son presentacionales: los hooks de queries/ solo se usan en pages/.',
  },
  {
    group: ['**/app', '**/app/**'],
    message:
      'Los componentes no usan el router, los providers ni la sesión de app/: reciben props.',
  },
  {
    group: ['react-router', 'react-router/*', 'react-router-dom'],
    importNamePattern: '^use',
    message:
      'Los hooks de React Router (useNavigate, useParams…) solo se usan en pages/: pasa datos y callbacks por props.',
  },
  {
    group: ['@/components', '@/components/**', '@/pages', '@/pages/**'],
    message:
      'Dentro de components/ se importa con rutas relativas, para que ESLint compruebe los niveles atómicos.',
  },
];

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

  // Web: regla de niveles atómicos (CA-00.18). Cada carpeta de componente es un elemento (se
  // captura su nombre en `component`); un componente puede importar sus propios archivos, pero no
  // los de otro componente de su mismo nivel salvo en organismos.
  {
    files: [`${WEB_SRC}/**/*.{ts,tsx}`],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        // Cada carpeta de componente es un elemento de su nivel, con su nombre en `component`.
        ...Object.keys(atomicLevels).map((type) => ({
          type,
          pattern: `${WEB_COMPONENTS}/${type}/*`,
          capture: ['component'],
        })),
        // Lo que queda en la carpeta del nivel (su `index.ts`) también es del nivel.
        ...Object.keys(atomicLevels).map((type) => ({
          type,
          pattern: `${WEB_COMPONENTS}/${type}`,
        })),
        { type: 'pages', pattern: `${WEB_SRC}/pages/*` },
      ],
      'import/resolver': {
        node: { extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'] },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            ...Object.entries(atomicLevels).map(([from, forbidden]) => ({
              from: { element: { type: from } },
              disallow: { to: { element: { types: forbidden } } },
              message: `Regla de niveles: "${from}" no puede importar de {{ to.element.types.[0] }} (atoms ← molecules ← organisms ← templates ← pages).`,
            })),
            // El índice de un nivel sí reexporta sus componentes; un componente no puede usar ni
            // otro componente de su nivel ni el índice de su nivel.
            ...levelsWithoutSiblings.map((level) => ({
              from: { element: { type: level, path: `**/components/${level}/*` } },
              disallow: [
                {
                  to: {
                    element: {
                      type: level,
                      path: `**/components/${level}/*`,
                      captured: { component: '!{{ from.element.captured.component }}' },
                    },
                  },
                },
                { to: { element: { type: level, path: `**/components/${level}` } } },
              ],
              message: `Regla de niveles: un componente de "${level}" no puede usar otro de su mismo nivel (solo los organismos pueden usar organismos).`,
            })),
          ],
        },
      ],
    },
  },

  // Web: lo que no pueden importar los componentes (CA-00.18). Las reglas de un mismo nombre no se
  // suman entre bloques, por eso los átomos repiten la lista común y añaden `@incidapp/shared`.
  {
    files: [`${WEB_COMPONENTS}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['error', { patterns: componentsForbiddenPatterns }],
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Los componentes son presentacionales: las peticiones van en lib/api y pages/.',
        },
      ],
    },
  },
  {
    files: [`${WEB_COMPONENTS}/atoms/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...componentsForbiddenPatterns,
            {
              group: ['@incidapp/shared', '@incidapp/shared/*'],
              message:
                'Los átomos no conocen el dominio: no importan @incidapp/shared. Usa una molécula.',
            },
          ],
        },
      ],
    },
  },

  // Desactiva las reglas de estilo que chocan con Prettier (siempre al final).
  prettier,
);
