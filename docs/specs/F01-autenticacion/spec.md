# F01 · Autenticación — Spec

- **Estado:** aprobada (23/11/2026)
- **Depende de:** F00 (bloque A para la API; bloque B —átomos, `AuthLayout` y `AppLayout`— para la interfaz)
- **Requisitos que cubre:** RF-01 (iniciar sesión), RF-02 (cerrar sesión), RF-03 (mantener la sesión y obtener el usuario actual), RF-18 (en parte: inicios de sesión e intentos fallidos), RF-21 (en parte: un usuario demo por rol), RNF-07 (argon2id, cookie de sesión, `X-Requested-With`, *rate limit*)

## Objetivo
Que cada persona entre en IncidApp con su email y contraseña, mantenga la sesión entre visitas hasta que caduque y pueda cerrarla de verdad, con una sesión revocable en la BD (ADR-003). Deja la base sobre la que F02 aplica los permisos: el usuario actual con su rol y sus departamentos, y cuatro usuarios demo (uno por rol) para que el evaluador pruebe la app.

## Historias de usuario
- **HU-01.1:** Como **usuario de cualquier rol**, quiero iniciar sesión con mi email y contraseña para acceder a la aplicación.
- **HU-01.2:** Como **usuario**, quiero que la aplicación me recuerde entre visitas hasta que la sesión caduque, y poder cerrarla cuando termine, para no dejarla abierta en un equipo compartido.
- **HU-01.3:** Como **admin**, quiero que queden registrados los inicios de sesión y los intentos fallidos, y que se frenen los intentos repetidos, para detectar y dificultar los accesos indebidos.
- **HU-08** (de `requisitos.md`): Como **evaluador del TFM**, quiero entrar con un usuario de cada rol para comprobar cómo cambia lo que se puede ver y hacer.

## Criterios de aceptación

### API

#### CA-01.1 · Inicio de sesión correcto
- **Dado** un usuario activo con email y contraseña conocidos
- **Cuando** hace `POST /api/auth/login` con `{ email, password }`
- **Entonces** responde 200 con el usuario actual (esquema `CurrentUser` de `shared`: `id`, `email`, `name`, `role` y `departments`), sin `passwordHash` ni ningún otro dato interno
- **Y** fija una cookie de sesión `httpOnly`, `sameSite=Lax`, `Path=/` y con `Secure` cuando la app se sirve por HTTPS (producción)
- **Y** existe una fila en `sessions` para ese usuario con su fecha de caducidad
- **Y** el email se compara sin distinguir mayúsculas ni espacios al principio o al final

#### CA-01.2 · Credenciales incorrectas sin revelar el motivo
- **Dado** un email que no existe, una contraseña incorrecta o un usuario desactivado
- **Cuando** hace `POST /api/auth/login`
- **Entonces** responde 401 con `ErrorResponse` (`code: "UNAUTHORIZED"`) y el mismo mensaje en los tres casos: "Email o contraseña incorrectos."
- **Y** no fija ninguna cookie ni crea ninguna sesión

#### CA-01.3 · Validación de la entrada del login
- **Dado** un cuerpo sin email, con un email mal formado, con la contraseña vacía o con una contraseña de más de 200 caracteres
- **Cuando** hace `POST /api/auth/login`
- **Entonces** responde 400 con `ErrorResponse` (`code: "VALIDATION"`) y `details` en español, sin llegar a calcular ningún hash
- **Y** los campos que no son `email` ni `password` se ignoran

#### CA-01.4 · Rotación de la sesión al iniciar sesión
- **Dado** una petición de login que ya trae una cookie de sesión válida
- **Cuando** el login es correcto
- **Entonces** la sesión anterior se borra de `sessions` y la nueva tiene un identificador distinto
- **Y** una petición con la cookie anterior a `GET /api/auth/me` responde 401

#### CA-01.5 · Usuario actual
- **Dado** una cookie de sesión válida de un usuario activo
- **Cuando** hace `GET /api/auth/me`
- **Entonces** responde 200 con `CurrentUser`, incluidos sus departamentos (`id`, `code`, `name`)
- **Y** sin cookie, con un identificador que no existe o con una sesión caducada, responde 401 con `ErrorResponse` (`code: "UNAUTHORIZED"`)

#### CA-01.6 · Caducidad y usuario desactivado
- **Dado** una sesión creada en el instante *t*
- **Cuando** se usa después de *t* + la duración de la sesión (reloj inyectado en los tests)
- **Entonces** responde 401 y la sesión caducada se borra
- **Y dado** un usuario con sesión abierta que pasa a `active = false` (en F01, directamente en la BD), su siguiente petición protegida responde 401 y sus sesiones se borran (`permisos.md`, definición de "usuario desactivado")

#### CA-01.7 · Cierre de sesión real
- **Dado** una cookie de sesión válida
- **Cuando** hace `POST /api/auth/logout`
- **Entonces** responde 204, la sesión se borra de `sessions` y la respuesta borra la cookie
- **Y** una petición posterior con la misma cookie a `GET /api/auth/me` responde 401
- **Y** sin sesión (o con una ya cerrada), `POST /api/auth/logout` también responde 204 (idempotente)

#### CA-01.8 · Límite de intentos de login
- **Dado** una misma IP de cliente (la real, detrás del *proxy* de Render)
- **Cuando** supera el número máximo de intentos de `POST /api/auth/login` en la ventana de tiempo, aunque sean correctos
- **Entonces** responde 429 con `ErrorResponse` (`code: "TOO_MANY_REQUESTS"`), un mensaje en español y la cabecera `Retry-After`
- **Y** el límite solo se aplica al login: `GET /api/auth/me` y `POST /api/auth/logout` no se ven afectados

#### CA-01.9 · Auditoría de los inicios de sesión
- **Dado** un login correcto
- **Cuando** termina
- **Entonces** se inserta en `audit_log` una fila `LOGIN_SUCCEEDED` con el usuario como actor, la entidad `user`, su id y la IP del cliente
- **Y dado** un login fallido por credenciales (CA-01.2), se inserta una fila `LOGIN_FAILED` con la IP y el email intentado, sin actor si el email no existe y **nunca** con la contraseña
- **Y** el puerto de auditoría solo ofrece inserción: no hay operaciones para actualizar ni borrar (RNF-09)

#### CA-01.10 · Cabecera anti-CSRF obligatoria
- **Dado** cualquier petición a `/api` con un método distinto de GET, HEAD u OPTIONS
- **Cuando** no lleva la cabecera `X-Requested-With`
- **Entonces** responde 403 con `ErrorResponse` (`code: "FORBIDDEN"`) y un mensaje en español, antes de validar el cuerpo y antes de contar el intento para el límite de CA-01.8
- **Y** con la cabecera, la petición sigue su curso normal

#### CA-01.11 · Contraseñas protegidas
- **Dado** cualquier usuario guardado
- **Cuando** se lee su fila de `users`
- **Entonces** `password_hash` es un hash argon2id (empieza por `$argon2id$`) y nunca la contraseña en claro
- **Y** la contraseña no aparece en los logs (el *logger* redacta `password` de los cuerpos), ni en ninguna respuesta, ni en `audit_log`

#### CA-01.12 · Usuarios demo
- **Dado** una base de datos migrada
- **Cuando** se ejecuta `npm run db:seed` dos veces seguidas
- **Entonces** existen exactamente cuatro usuarios demo activos, uno por rol (`ADMIN`, `DIRECTOR`, `MANAGER`, `USER`), con emails del dominio reservado `incidapp.test`, nombres ficticios, sus departamentos asignados y la contraseña demo documentada
- **Y** se puede iniciar sesión con cada uno de ellos
- **Y** el segundo `db:seed` no duplica usuarios ni cambia sus contraseñas

### Web

#### CA-01.13 · Pantalla de inicio de sesión
- **Dado** la ruta `/login`
- **Cuando** se carga
- **Entonces** muestra, dentro de `AuthLayout`, un formulario con los campos "Email" y "Contraseña" etiquetados y el botón "Iniciar sesión"
- **Y** valida en el cliente con el esquema de `shared` y muestra los errores junto a cada campo (`aria-invalid` + `aria-describedby`)
- **Y** mientras espera la respuesta, el botón está en estado de carga y no se puede volver a enviar
- **Y** si la API responde 401, 429 u otro error, muestra el mensaje en español en una región `role="alert"` sin vaciar el email

#### CA-01.14 · Rutas protegidas y vuelta a la ruta pedida
- **Dado** un visitante sin sesión
- **Cuando** abre una ruta protegida (`/` o cualquier otra que no sea `/login`)
- **Entonces** se le redirige a `/login`, y tras iniciar sesión vuelve a la ruta que había pedido (o a `/` si no había ninguna)
- **Y** mientras se comprueba la sesión (`GET /api/auth/me`) se muestra un indicador de carga, sin parpadeo del formulario ni del contenido protegido
- **Y dado** un usuario con sesión, si abre `/login` se le redirige a `/`

#### CA-01.15 · Cabecera con el usuario y cierre de sesión
- **Dado** un usuario con sesión en cualquier página protegida
- **Cuando** se muestra la página dentro de `AppLayout`
- **Entonces** la cabecera muestra su nombre y su rol en español (Admin, Dirección, Responsable o Usuario) y un botón "Cerrar sesión"
- **Y** al pulsarlo se llama a `POST /api/auth/logout`, se vacía la caché de datos del cliente y se navega a `/login`
- **Y** volver atrás en el navegador no muestra datos de la sesión cerrada

#### CA-01.16 · Sesión caducada durante el uso
- **Dado** un usuario con la página abierta cuya sesión ha caducado o se ha revocado
- **Cuando** cualquier petición a la API responde 401
- **Entonces** se vacía la caché, se redirige a `/login` conservando la ruta en la que estaba y se muestra el aviso "Tu sesión ha caducado. Vuelve a iniciar sesión."

#### CA-01.17 · Página no encontrada
- **Dado** una ruta de cliente que no existe
- **Cuando** se abre
- **Entonces** se muestra una página en español ("Página no encontrada") con un enlace a la página de inicio, en lugar de la página por defecto de React Router

## Permisos
- `docs/permisos.md` → **Administración y consulta** → fila "Ver y cerrar su propia sesión" (los cuatro roles).
- `docs/permisos.md` → **Definiciones** → "Usuario desactivado" (no inicia sesión y sus sesiones dejan de valer).
- `docs/permisos.md` → **Respuestas de la API** → "Sin sesión válida en un endpoint protegido → 401".
- `docs/permisos.md` → **Lo que nunca decide el cliente** → el login no acepta `role` ni ningún otro campo del usuario.
- La `AuthorizationPolicy` y las `allowedActions` son de F02: en F01 solo hay "con sesión" o "sin sesión".

## Fuera de alcance
- Gestión de usuarios (alta, edición, desactivación desde la interfaz, rol y departamentos) y su auditoría (F02).
- `AuthorizationPolicy`, `allowedActions` y cualquier permiso por rol o departamento (F02).
- Panel de auditoría (F06): en F01 solo se registra.
- Registro público de usuarios, recuperación o cambio de contraseña, "recordarme", MFA y login con proveedores externos (OAuth/SSO).
- Bloqueo de cuentas por intentos fallidos (se usa solo el *rate limit* por IP).
- Listado de sesiones abiertas y "cerrar las demás sesiones".
- Tarea programada de limpieza de sesiones caducadas (se borran al detectarlas y al iniciar sesión).
- Navegación lateral (`NavSidebar`) con enlaces por rol: llega con las primeras páginas de F02/F03.
- Datos demo de incidencias y usuarios adicionales (F03 y F07). E2E con Playwright (F07).

## Dudas resueltas (23/11/2026)
1. **Duración de la sesión:** 7 días fijos desde el login, sin renovación al usarla.
2. **Límite de intentos de login:** 10 intentos por IP cada 15 minutos, configurable por variables de entorno (en los tests, un valor bajo).
3. **Usuarios demo:** una sola contraseña para los cuatro, `Demo2026!`, documentada en el README. `admin@incidapp.test` (ADM), `direccion@incidapp.test` (DIR), `responsable@incidapp.test` (LOG) y `usuario@incidapp.test` (LOG).
4. **Usuarios demo en producción:** el arranque de Render pasa a ser `npm run db:migrate && npm run db:seed && npm start`.
5. **Ayuda en `/login`:** se muestra un recuadro "Usuarios demo" con los cuatro emails, su rol y la contraseña.
