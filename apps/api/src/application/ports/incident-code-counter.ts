/**
 * Puerto del contador de códigos de incidencia por año (tabla `code_counters`, CA-03.4). Se usa
 * dentro de la `UnitOfWork` del alta: el número queda reservado hasta el fin de la transacción, así
 * que dos altas simultáneas no lo repiten y un alta que falla no deja hueco.
 */
export interface IncidentCodeCounter {
  /** Siguiente número del año (1 si es el primero). */
  next(year: number): Promise<number>;
}
