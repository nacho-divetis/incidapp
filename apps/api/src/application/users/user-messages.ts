// Mensajes de las reglas de negocio de la gestión de usuarios (409 y 400). En español: se muestran
// al Admin tal cual.

/** Email ya registrado, también si es de un usuario desactivado (CA-02.7, CA-02.8). */
export const EMAIL_TAKEN_MESSAGE = 'Ya existe un usuario con ese email.';

/** El Admin no se bloquea a sí mismo (CA-02.10, aclaración ³ de `permisos.md`). */
export const SELF_LOCKOUT_MESSAGE =
  'No puedes desactivarte ni quitarte el rol de Admin a ti mismo.';

/** Usuarios demo protegidos (CA-02.11). */
export const DEMO_USER_PROTECTED_MESSAGE = 'Los usuarios demo no se pueden modificar.';

/** Algún id de `departmentIds` no es de un departamento del catálogo (CA-02.7). */
export const UNKNOWN_DEPARTMENT_MESSAGE = 'Alguno de los departamentos no existe.';
