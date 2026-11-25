import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Checkbox, Icon, Text } from '../../atoms';

/**
 * Grupo de casillas para elegir varios valores de una lista (p. ej., departamentos).
 *
 * - Semántica de grupo: `<fieldset>` con `<legend>`, que da nombre al conjunto.
 * - Controlado: recibe `value` (los valores marcados) y avisa con `onChange(nuevosValores)`. Marcar
 *   añade el valor al final; desmarcar lo quita. Los valores que no están en `options` se conservan.
 * - Con `error`, el mensaje se enlaza al `fieldset` con `aria-describedby` (junto a la ayuda, el
 *   error primero) y cada casilla recibe `aria-invalid`.
 * - Cada opción puede llevar una `description`, que describe su casilla (`aria-describedby`).
 * - `disabled` deshabilita el grupo entero (el `fieldset` y cada casilla).
 * - `ref` apunta al `fieldset` (p. ej., para llevar el foco a su primera casilla si hay un error).
 *
 * Sin textos propios: leyenda, opciones, ayuda, error y mensaje de vacío llegan por props.
 */
export const checkboxGroupOptionsVariants = cva('grid gap-3', {
  variants: {
    columns: {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
    },
  },
  defaultVariants: { columns: 1 },
});

export interface CheckboxGroupOption {
  value: string;
  label: ReactNode;
  /** Texto secundario bajo la etiqueta de la casilla. */
  description?: ReactNode;
}

export interface CheckboxGroupProps extends VariantProps<typeof checkboxGroupOptionsVariants> {
  /** Nombre del grupo (`<legend>`). */
  legend: ReactNode;
  options: CheckboxGroupOption[];
  /** Valores marcados. */
  value: string[];
  onChange: (value: string[]) => void;
  /** Mensaje de error del grupo. */
  error?: ReactNode;
  /** Texto de ayuda bajo la leyenda. */
  hint?: ReactNode;
  /** Deshabilita todas las casillas. */
  disabled?: boolean;
  /** Elegir al menos una opción es obligatorio: asterisco visual y texto accesible en la leyenda. */
  required?: boolean;
  /** Texto que leen los lectores de pantalla en lugar del asterisco. */
  requiredText?: string;
  /** Mensaje cuando no hay opciones. */
  emptyMessage?: ReactNode;
  /** `name` de las casillas (opcional). */
  name?: string;
  /** `id` del `fieldset`; también es el prefijo de los ids generados. */
  id?: string;
  className?: string;
}

/** Comprueba si hay algo que pintar (descarta `undefined`, `null`, `false` y la cadena vacía). */
function hasContent(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== '';
}

export const CheckboxGroup = forwardRef<HTMLFieldSetElement, CheckboxGroupProps>(
  function CheckboxGroup(
    {
      legend,
      options,
      value,
      onChange,
      error,
      hint,
      disabled = false,
      required = false,
      requiredText = 'obligatorio',
      emptyMessage,
      name,
      id,
      columns,
      className,
    },
    ref,
  ) {
    const generatedId = useId();
    const baseId = id ?? generatedId;
    const errorId = `${baseId}-error`;
    const hintId = `${baseId}-hint`;
    const hasError = hasContent(error);
    const hasHint = hasContent(hint);
    const describedBy =
      [hasError && errorId, hasHint && hintId].filter(Boolean).join(' ') || undefined;

    function toggle(optionValue: string, checked: boolean) {
      onChange(
        checked
          ? [...value.filter((item) => item !== optionValue), optionValue]
          : value.filter((item) => item !== optionValue),
      );
    }

    return (
      <fieldset
        ref={ref}
        id={baseId}
        disabled={disabled}
        aria-describedby={describedBy}
        className={cn('flex min-w-0 flex-col gap-2', className)}
      >
        <legend className="mb-1.5 text-sm font-medium text-fg">
          {legend}
          {required && (
            <>
              <span aria-hidden="true" className="ml-1 text-danger">
                *
              </span>{' '}
              <span className="sr-only">({requiredText})</span>
            </>
          )}
        </legend>
        {hasHint && (
          <Text id={hintId} variant="small">
            {hint}
          </Text>
        )}
        {options.length === 0 ? (
          hasContent(emptyMessage) && <Text variant="muted">{emptyMessage}</Text>
        ) : (
          <div className={checkboxGroupOptionsVariants({ columns })}>
            {options.map((option, index) => {
              const descriptionId = `${baseId}-option-${index}-description`;
              const hasDescription = hasContent(option.description);
              return (
                <div key={option.value} className="flex flex-col gap-0.5">
                  <Checkbox
                    name={name}
                    value={option.value}
                    label={option.label}
                    checked={value.includes(option.value)}
                    onChange={(event) => toggle(option.value, event.target.checked)}
                    disabled={disabled}
                    invalid={hasError}
                    aria-describedby={hasDescription ? descriptionId : undefined}
                  />
                  {hasDescription && (
                    <Text id={descriptionId} variant="small" className="pl-6">
                      {option.description}
                    </Text>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {hasError && (
          <Text id={errorId} variant="small" className="flex items-start gap-1 text-danger-fg">
            <Icon name="circle-x" size="sm" className="mt-0.5" />
            <span>{error}</span>
          </Text>
        )}
      </fieldset>
    );
  },
);
