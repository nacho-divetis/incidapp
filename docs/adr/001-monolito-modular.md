# ADR-001 · Monolito modular

- **Estado:** aceptado
- **Fecha:** 23/11/2026
- **Relacionado:** ADR-002, ADR-006, F00

## Contexto
IncidApp se construye en 7 días, con una sola persona y agentes de código, y se despliega en el plan gratuito de Render, que admite un único servicio web sin coste. El dominio (incidencias, usuarios, permisos, adjuntos, auditoría) está muy acoplado: casi todas las operaciones consultan los permisos y escriben en el historial dentro de la misma transacción.

## Decisión
Construimos **un único proceso Node** (Fastify) que expone la API y sirve el front compilado, organizado por módulos de dominio dentro de las capas de Clean Architecture. No se añaden servicios, colas ni cachés sin un ADR nuevo.

## Alternativas consideradas
| Opción | A favor | En contra |
|---|---|---|
| Monolito modular | Un despliegue, transacciones locales, un mismo origen para la cookie de sesión, coste cero | Escala solo en vertical; los límites entre módulos los tiene que vigilar el equipo |
| Microservicios (incidencias, usuarios, ficheros…) | Despliegue y escalado independientes | Varias instancias de pago o dormidas, consistencia distribuida y mucha más infraestructura para un MVP |
| API y front desplegados por separado (p. ej., front en un CDN) | Front servido desde el borde | CORS y cookies entre orígenes (`sameSite=None`), dos despliegues y más configuración |

## Consecuencias
- **Positivas:** un solo `render.yaml`, sesión con `sameSite=Lax` sin CORS, transacciones simples (incidencia + evento + contador) y un E2E que prueba todo junto.
- **Negativas / deuda aceptada:** si un módulo creciera mucho, habría que extraerlo; la separación depende de la regla de capas (ADR-002) y de la disciplina por módulos.
- **Cuándo revisarla:** si una parte necesita escalar o desplegarse con otro ritmo (p. ej., el procesamiento de adjuntos).
