import type { Preview } from '@storybook/react-vite';
import '../src/styles/index.css';

const preview: Preview = {
  parameters: {
    // Addon de accesibilidad: las violaciones de axe se tratan como errores, no como avisos.
    a11y: { test: 'error' },
    options: {
      // Secciones del catálogo en el orden de atomic design.
      storySort: {
        order: ['Tokens', 'Átomos', 'Moléculas', 'Organismos', 'Plantillas'],
      },
    },
  },
};

export default preview;
