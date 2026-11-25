import { Link as RouterLink } from 'react-router';
import { Link, Text } from '../../components/atoms';
import { AuthLayout } from '../../components/templates';
import { HOME_PATH } from '../../app/paths';

/**
 * Página de ruta inexistente (CA-01.17), para cualquier visitante, con o sin sesión. Reutiliza el
 * panel centrado de `AuthLayout` y enlaza a la página de inicio (el listado de incidencias) con el átomo `Link` sobre el `Link`
 * de React Router (navegación sin recargar).
 */
export function NotFoundPage() {
  return (
    <AuthLayout title="Página no encontrada">
      <Text variant="muted" className="mb-6 text-center">
        La página que buscas no existe o ha cambiado de dirección.
      </Text>
      <Text className="text-center">
        <Link as={RouterLink} to={HOME_PATH}>
          Volver a la página de inicio
        </Link>
      </Text>
    </AuthLayout>
  );
}
