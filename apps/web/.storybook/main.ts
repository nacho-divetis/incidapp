import type { StorybookConfig } from '@storybook/react-vite';

// Storybook de la web (CA-00.16). Usa `vite.config.ts` (React, Tailwind y el alias `@/`), así que
// los componentes se ven igual que en la aplicación.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  core: {
    disableTelemetry: true,
  },
};

export default config;
