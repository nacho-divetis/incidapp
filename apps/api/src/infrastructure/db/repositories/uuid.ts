/** UUID en su forma textual: lo que Postgres acepta en una columna `uuid`. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ¿Es `id` un UUID? Un id que no lo es no existe: se responde 404 sin consultar, porque Postgres
 * rechazaría la consulta (500).
 */
export const isUuid = (id: string): boolean => UUID_PATTERN.test(id);
