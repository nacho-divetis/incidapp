import { z } from 'zod';

/**
 * Acciones que se registran en `audit_log` (solo inserción). F01 audita los inicios de sesión;
 * F02 añade los cambios de usuarios.
 */
export const AuditAction = z.enum(['LOGIN_SUCCEEDED', 'LOGIN_FAILED']);
export type AuditAction = z.infer<typeof AuditAction>;
