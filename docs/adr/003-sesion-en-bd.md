# ADR-003 · Sesión en base de datos frente a JWT

- **Estado:** aceptado
- **Fecha:** 23/11/2026
- **Relacionado:** ADR-001, F01

## Contexto
La app necesita autenticación propia con email y contraseña, un logout real y poder dejar sin acceso a un usuario desactivado al momento. La API y el front comparten origen (ADR-001).

## Decisión
Usamos **sesiones guardadas en la BD** (tabla `sessions`, identificador aleatorio de 256 bits y caducidad) en una cookie `httpOnly`, `secure` y `sameSite=Lax`, que se **rota** al iniciar sesión. Las peticiones que modifican datos exigen la cabecera `X-Requested-With` como defensa adicional frente a CSRF. Las contraseñas se guardan con **argon2id**.

## Alternativas consideradas
| Opción | A favor | En contra |
|---|---|---|
| Sesión en BD + cookie | Revocable al instante (logout, desactivación); sin secretos de firma que rotar; simple con un mismo origen | Una consulta a la BD por petición |
| JWT en cookie | Sin consulta por petición | No se puede revocar sin lista negra; *refresh tokens* y rotación añaden complejidad |
| JWT en `localStorage` | Fácil desde el front | Expuesto a XSS |
| Proveedor externo (OAuth/SSO) | Sin gestionar contraseñas | Dependencia externa y fuera del alcance |

## Consecuencias
- **Positivas:** logout y desactivación efectivos; menos superficie (sin tokens accesibles desde JavaScript).
- **Negativas / deuda aceptada:** una consulta por petición (despreciable a esta escala) y limpieza de sesiones caducadas.
- **Cuándo revisarla:** si la API pasara a tener clientes de otros orígenes (app móvil, terceros).
