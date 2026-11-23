import { cloneElement, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, Label, Text } from '../../atoms';

/**
 * Campo de formulario completo: etiqueta, el campo (hijo), una ayuda opcional y el mensaje de error.
 *
 * Conecta la accesibilidad sin que quien lo usa tenga que repetir ids:
 * - El campo recibe `id = htmlFor`, de modo que la etiqueta queda asociada.
 * - Genera los ids de la ayuda (`<htmlFor>-hint`) y del error (`<htmlFor>-error`) y los añade al
 *   `aria-describedby` del campo (el error primero; se conserva el `aria-describedby` que ya tuviera).
 * - Con `error`, el campo recibe `aria-invalid` y, si es un componente (los átomos `Input`, `Select`,
 *   `Textarea`), también `invalid` para el borde de error.
 * - Con `required`, la etiqueta lleva el asterisco y el campo, `aria-required`.
 *
 * El hijo tiene que ser un único elemento de campo. Los textos (etiqueta, ayuda y error) llegan por
 * props: la molécula no tiene textos propios.
 */
export interface FormFieldProps {
  /** Texto de la etiqueta. */
  label: ReactNode;
  /** `id` del campo; la etiqueta apunta a él y se usa como prefijo de los ids generados. */
  htmlFor: string;
  /** Mensaje de error; si existe, el campo se marca como no válido. */
  error?: ReactNode;
  /** Texto de ayuda bajo el campo. */
  hint?: ReactNode;
  /** El campo es obligatorio. */
  required?: boolean;
  /** El campo: un único elemento (normalmente `Input`, `Select` o `Textarea`). */
  children: ReactElement<FieldA11yProps>;
  className?: string;
}

/** Props de accesibilidad que `FormField` pasa al campo. */
interface FieldA11yProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-required'?: boolean | 'true' | 'false';
  invalid?: boolean;
}

/** Comprueba si hay algo que pintar (descarta `undefined`, `null`, `false` y la cadena vacía). */
function hasContent(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== '';
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className,
}: FormFieldProps) {
  const hasError = hasContent(error);
  const hasHint = hasContent(hint);
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;

  const own = children.props;
  const describedBy =
    [hasError && errorId, hasHint && hintId, own['aria-describedby']].filter(Boolean).join(' ') ||
    undefined;
  const isComponent = typeof children.type !== 'string';

  const field = cloneElement(children, {
    id: htmlFor,
    'aria-describedby': describedBy,
    ...(hasError && { 'aria-invalid': true }),
    ...(hasError && isComponent && { invalid: true }),
    ...(required && own['aria-required'] === undefined && { 'aria-required': true }),
  });

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {field}
      {hasHint && (
        <Text id={hintId} variant="small">
          {hint}
        </Text>
      )}
      {hasError && (
        <Text id={errorId} variant="small" className="flex items-start gap-1 text-danger-fg">
          <Icon name="circle-x" size="sm" className="mt-0.5" />
          <span>{error}</span>
        </Text>
      )}
    </div>
  );
}
