import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { AppProviders } from './app/providers';
import { createSessionExpiredHandler, router } from './app/router';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('No se encuentra el elemento #root.');

createRoot(container).render(
  <StrictMode>
    <AppProviders onSessionExpired={createSessionExpiredHandler(router)}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
