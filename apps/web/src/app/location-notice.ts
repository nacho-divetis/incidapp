// Avisos de éxito que una página deja a la siguiente en el estado de navegación
// (`navigate(ruta, { state: { notice } })`), p. ej. "Incidencia creada." tras el alta.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

/** Estado de navegación con un aviso de éxito para la página de destino. */
export interface LocationNoticeState {
  notice: string;
}

/** Lee el aviso del estado de navegación (puede venir de cualquier parte: se comprueba la forma). */
export function noticeOf(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null || !('notice' in state)) return undefined;
  const { notice } = state as { notice: unknown };
  return typeof notice === 'string' && notice !== '' ? notice : undefined;
}

/**
 * Aviso de éxito que trae la navegación a la página actual. Se lee al montar y se borra del
 * historial (sustituyendo la entrada), para que no reaparezca al recargar o volver atrás.
 */
export function useLocationNotice(): string | undefined {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice] = useState(() => noticeOf(location.state));

  useEffect(() => {
    if (noticeOf(location.state)) {
      void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, [location.state, location.pathname, location.search, navigate]);

  return notice;
}
