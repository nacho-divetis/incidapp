import { describe, expect, it } from 'vitest';
import { z } from 'zod';
// Basta con importar el contrato para que Zod quede configurado en español.
import { ErrorResponse } from './index';

describe('mensajes de Zod', () => {
  it('CA-00.5: importar @incidapp/shared configura Zod en español para cualquier esquema', () => {
    const schema = z.object({ title: z.string().min(1), tags: z.array(z.string()) });

    const result = schema.safeParse({ title: '', tags: [1] });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Demasiado pequeño: se esperaba que texto tuviera >=1 caracteres',
      'Entrada inválida: se esperaba texto, recibido número',
    ]);
  });

  it('CA-00.5: los esquemas del contrato también devuelven los mensajes en español', () => {
    const result = ErrorResponse.safeParse({ error: { code: 'TEAPOT', message: 'Error.' } });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/^Opción inválida: se esperaba una de/);
  });
});
