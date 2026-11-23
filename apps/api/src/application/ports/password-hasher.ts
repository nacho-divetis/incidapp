/** Puerto para el *hash* de contraseñas (argon2id en `infrastructure/auth`). */
export interface PasswordHasher {
  /** Devuelve el *hash* de `password` con una sal nueva. */
  hash(password: string): Promise<string>;
  /** Indica si `password` corresponde a `hash`. Un *hash* mal formado devuelve `false`, no lanza. */
  verify(hash: string, password: string): Promise<boolean>;
}
