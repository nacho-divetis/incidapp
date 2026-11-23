import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Esqueleto de T-00.02. Los providers, el router y la página inicial llegan en T-00.04.
const container = document.getElementById('root');
if (!container) throw new Error('No se encuentra el elemento #root.');

createRoot(container).render(
  <StrictMode>
    <h1>IncidApp</h1>
  </StrictMode>,
);
