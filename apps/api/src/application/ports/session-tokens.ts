/** Puerto para los *tokens* de sesión que viajan en la cookie. */
export interface SessionTokens {
  /** Genera un *token* aleatorio nuevo (el valor de la cookie). */
  generate(): string;
  /** Identificador con el que se guarda la sesión: derivado del *token* de forma determinista e irreversible. */
  idFor(token: string): string;
}
