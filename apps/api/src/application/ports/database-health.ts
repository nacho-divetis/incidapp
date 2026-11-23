/** Puerto para comprobar que la base de datos responde. Lo implementa `infrastructure/db`. */
export interface DatabaseHealth {
  /** Resuelve si la base de datos responde; rechaza si no. */
  ping(): Promise<void>;
}
