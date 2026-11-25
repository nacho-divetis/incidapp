// Mensajes de las reglas de negocio de las incidencias (400). En español: se muestran tal cual.

/** El `typeId` del alta no es de un tipo del catálogo (CA-03.3). */
export const UNKNOWN_INCIDENT_TYPE_MESSAGE = 'El tipo de incidencia no existe.';

/** El asignado no es un usuario activo del departamento propietario (CA-03.10, nota ¹). */
export const INVALID_ASSIGNEE_MESSAGE =
  'El usuario no pertenece al departamento de la incidencia o está desactivado.';

/** La transición exige comentario y no lo trae (CA-04.3). */
export const COMMENT_REQUIRED_MESSAGE = 'Esta transición requiere un comentario.';
