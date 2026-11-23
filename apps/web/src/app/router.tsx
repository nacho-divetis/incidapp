// Rutas de la web (React Router en modo librería). Cada ruta apunta a una página de `pages/`.
import { createBrowserRouter } from 'react-router';
import { HomePage } from '../pages/HomePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
]);
