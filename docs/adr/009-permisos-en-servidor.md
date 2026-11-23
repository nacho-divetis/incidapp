# ADR-009 · Permisos calculados en el servidor (`allowedActions`)

- **Estado:** aceptado
- **Fecha:** 23/11/2026
- **Relacionado:** ADR-002, ADR-008, F02

## Contexto
Los permisos dependen del rol, de los departamentos, del creador, del asignado y del estado de la incidencia ([`permisos.md`](../permisos.md)). Si la web los recalcula, la regla vive en dos sitios y acaba divergiendo de la que aplica la API.

## Decisión
Una única **`AuthorizationPolicy`** en `application/` decide todos los permisos. Los casos de uso la consultan antes de actuar (404 si el recurso no es visible, 403 si la acción no está permitida), y las respuestas de la API incluyen **`allowedActions`**, calculadas con esa misma política, con las acciones y transiciones posibles para el usuario actual. La web muestra u oculta botones solo a partir de `allowedActions`.

## Alternativas consideradas
| Opción | A favor | En contra |
|---|---|---|
| Política única + `allowedActions` | Una sola fuente de verdad; la UI no puede desincronizarse; matriz testeable con una tabla | Respuestas algo más grandes |
| Reglas duplicadas en el front | Sin campos extra en las respuestas | Divergencia segura con el tiempo |
| Comprobaciones de rol en cada ruta | Rápido de escribir | Permisos dispersos y difíciles de auditar |
| Motor de políticas externo (Casbin, OPA) | Muy flexible | Dependencia y configuración desproporcionadas para 4 roles |

## Consecuencias
- **Positivas:** la matriz de `permisos.md` se convierte directamente en una tabla de tests; ocultar un botón es solo usabilidad.
- **Negativas / deuda aceptada:** cada DTO con acciones debe calcularlas (coste despreciable a esta escala).
- **Cuándo revisarla:** si los permisos pasaran a ser configurables.
