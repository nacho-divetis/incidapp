import { Link as RouterLink } from 'react-router';
import { Link, Text } from '../../components/atoms';
import { PageHeader } from '../../components/molecules';
import { HOME_PATH } from '../../app/paths';

/**
 * Página que pinta `RequireAction` cuando el usuario no tiene la acción que exige la ruta
 * (CA-02.17). Va dentro de `AppLayout` (la cabecera y la navegación siguen visibles) y no pide datos.
 */
export function ForbiddenPage() {
  return (
    <>
      <PageHeader
        title="No tienes permiso para ver esta página."
        description="Tu cuenta no tiene acceso a esta sección."
      />
      <Text className="mt-6">
        <Link as={RouterLink} to={HOME_PATH}>
          Volver a la página de inicio
        </Link>
      </Text>
    </>
  );
}
