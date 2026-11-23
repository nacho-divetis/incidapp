# ADR-005 · Adjuntos guardados en la base de datos (`bytea`)

- **Estado:** aceptado
- **Fecha:** 23/11/2026
- **Relacionado:** ADR-006, F05

## Contexto
Las incidencias admiten fotos y PDF. El plan gratuito de Render **no tiene disco persistente** (los archivos se pierden en cada despliegue) y el proyecto no puede usar servicios de pago. Neon tiene un almacenamiento limitado.

## Decisión
Guardamos el contenido de los adjuntos en una columna `bytea` de la tabla `attachments`, detrás del puerto `FileStorage`. Límite de **5 MB** por archivo y tipos jpg, png, webp y pdf validados por *magic bytes*. La descarga pasa por la API, que comprueba que el usuario puede ver la incidencia.

## Alternativas consideradas
| Opción | A favor | En contra |
|---|---|---|
| `bytea` en PostgreSQL | Sin servicios extra; transaccional con la incidencia; permisos en el mismo sitio | Engorda la BD y las copias; no escala a muchos GB |
| Disco local del servidor | Lo más simple | Se pierde en cada despliegue de Render |
| Almacenamiento de objetos (S3, R2…) | Escala y permite descarga directa | Cuentas y credenciales extra; planes gratuitos con tarjeta o límites; URLs firmadas que gestionar |

## Consecuencias
- **Positivas:** coste cero, sin configuración adicional y un único punto de control de acceso.
- **Negativas / deuda aceptada:** datos demo moderados; sin miniaturas (recorte del 23/11).
- **Cuándo revisarla:** si el volumen de adjuntos se acerca al límite de Neon. El puerto `FileStorage` permite cambiar a almacenamiento de objetos sin tocar los casos de uso.
