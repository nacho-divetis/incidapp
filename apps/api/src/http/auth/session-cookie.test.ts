import fastifyCookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { SESSION_TTL_MS } from '../../domain/auth/session';
import {
  clearSessionCookie,
  readSessionToken,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from './session-cookie';

let app: FastifyInstance;

async function appWithCookies(secure: boolean): Promise<FastifyInstance> {
  app = Fastify({ logger: false });
  await app.register(fastifyCookie);
  app.post('/set', async (_request, reply) => {
    setSessionCookie(reply, 'token-de-prueba', { secure });
    return reply.status(204).send();
  });
  app.post('/clear', async (_request, reply) => {
    clearSessionCookie(reply, { secure });
    return reply.status(204).send();
  });
  app.get('/read', async (request) => ({ token: readSessionToken(request) ?? null }));
  await app.ready();
  return app;
}

afterEach(async () => {
  await app.close();
});

describe('cookie de sesión', () => {
  it('CA-01.1: se llama incidapp_session y es httpOnly, SameSite=Lax, Path=/ y dura 7 días', async () => {
    await appWithCookies(false);

    const response = await app.inject({ method: 'POST', url: '/set' });

    expect(SESSION_COOKIE_NAME).toBe('incidapp_session');
    expect(response.cookies).toEqual([
      {
        name: 'incidapp_session',
        value: 'token-de-prueba',
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: SESSION_TTL_MS / 1000,
      },
    ]);
  });

  it.each([
    [true, true],
    [false, undefined],
  ])('CA-01.1: con secure=%s, el atributo Secure es %s', async (secure, expected) => {
    await appWithCookies(secure);

    const response = await app.inject({ method: 'POST', url: '/set' });

    expect(response.cookies[0]?.secure).toBe(expected);
  });

  it('CA-01.7: borrarla la caduca con los mismos atributos', async () => {
    await appWithCookies(true);

    const response = await app.inject({ method: 'POST', url: '/clear' });

    const [cookie] = response.cookies;
    expect(cookie).toMatchObject({
      name: 'incidapp_session',
      value: '',
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      secure: true,
    });
    expect(cookie?.maxAge === 0 || (cookie?.expires?.getTime() ?? Infinity) <= Date.now()).toBe(
      true,
    );
  });

  it.each([
    [{ incidapp_session: 'abc' }, 'abc'],
    [{}, null],
    [{ incidapp_session: '' }, null],
    [{ otra: 'abc' }, null],
  ])('lee el token de la cookie de la petición (%o → %s)', async (cookies, expected) => {
    await appWithCookies(false);

    const response = await app.inject({ method: 'GET', url: '/read', cookies });

    expect(response.json()).toEqual({ token: expected });
  });
});
