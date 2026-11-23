# Hallazgos de los agentes revisores

Hallazgos reales de `code-reviewer` y `security-reviewer` que se corrigieron. Cada tarea pasa por revisores con contexto limpio: reciben solo el ID de la tarea y el alcance del diff, sin el razonamiento de quien la implementó.

| Tarea | Revisor | Gravedad | Problema | Corrección |
|---|---|---|---|---|
| T-00.03 (ajuste) | code-reviewer | media | Los mensajes de validación en español dependían de un efecto lateral: la API solo cargaba la configuración de Zod porque una ruta (`/api/health`) importaba un valor de `@incidapp/shared`. El test que lo comprobaba importaba `shared` por su cuenta y ocultaba el problema: si esa ruta cambiaba, los 400 volvían a salir en inglés sin que fallara ningún test | Import explícito de `@incidapp/shared` en `http/app.ts` y un test aislado que construye la app sin importar valores de `shared` |
| T-00.03 (ajuste) | code-reviewer → implementador | baja → bug de build | La revisión propuso declarar `"sideEffects": ["./src/zod-locale.ts"]` en `shared`. Al aplicarlo, el implementador comprobó que esbuild y Vite descartaban entonces `index.ts` y la configuración desaparecía de los dos bundles **con todos los tests en verde** (Vitest no hace *tree-shaking*) | `"sideEffects": ["./src/index.ts", "./src/zod-locale.ts"]`, verificado buscando la configuración en `dist/` de la API y de la web |
