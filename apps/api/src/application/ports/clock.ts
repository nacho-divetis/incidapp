/** Puerto del reloj: permite fijar la hora en los tests (caducidad de sesiones, auditoría). */
export interface Clock {
  now(): Date;
}
