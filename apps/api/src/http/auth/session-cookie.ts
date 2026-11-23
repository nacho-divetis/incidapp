// Cookie de sesión (ADR-003): solo transporta el *token*; la sesión vive en la BD.
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SESSION_TTL_MS } from '../../domain/auth/session';

export const SESSION_COOKIE_NAME = 'incidapp_session';

export interface SessionCookieSettings {
  /** Atributo `Secure`: solo cuando la app se sirve por HTTPS (producción). */
  secure: boolean;
}

/** Atributos comunes al fijarla y al borrarla: si no coinciden, el navegador no la borra. */
const baseOptions = ({ secure }: SessionCookieSettings): CookieSerializeOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure,
});

/** Fija la cookie con el *token* de una sesión nueva. Dura lo mismo que la sesión (7 días). */
export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  settings: SessionCookieSettings,
): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    ...baseOptions(settings),
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** Borra la cookie de sesión del navegador. */
export function clearSessionCookie(reply: FastifyReply, settings: SessionCookieSettings): void {
  reply.clearCookie(SESSION_COOKIE_NAME, baseOptions(settings));
}

/** *Token* de la cookie de sesión de la petición, si la trae. */
export function readSessionToken(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE_NAME] || undefined;
}
