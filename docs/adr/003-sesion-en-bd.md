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

## Notas
- **23/11/2026 (F01, T-01.02):** en la BD no se guarda el *token* de la cookie sino su **SHA-256 en hexadecimal** (`sessions.id`). El *token* (32 bytes aleatorios en base64url) solo viaja en la cookie; si se filtrara la tabla `sessions`, sus identificadores no servirían como cookie. Al tener el *token* 256 bits de entropía, basta un *hash* rápido sin sal. Las contraseñas usan argon2id (`@node-rs/argon2`) con los parámetros mínimos de OWASP: 19 MiB, 2 pasadas y 1 hilo.
