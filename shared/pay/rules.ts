/** Constantes de la liquidacion semanal, todas verificadas contra los payslips.
 *
 *  Cada numero de este archivo sale de comparar la prediccion contra las 35
 *  liquidaciones reales que hay en `payslips/`. Lo que no se pudo verificar
 *  esta marcado como tal en su comentario. */

/** La semana de pago va de jueves a miercoles: 4 = jueves en `weekday()`. */
export const PAY_WEEK_START_WEEKDAY = 4;

/** Dias entre el fin del periodo (miercoles) y el deposito (jueves siguiente). */
export const PAYMENT_LAG_DAYS = 1;

/** Desde esta hora las horas de un dia habil se liquidan como `Evening Hours`.
 *  No es el criterio del award (que carga el turno entero si termina despues de
 *  las 20:00): el empleador paga el recargo solo por las horas posteriores. */
export const EVENING_START_MINUTE = 20 * 60;

/** Horas pagables seguidas a partir de las cuales el excedente va a overtime.
 *  Deducido de un unico caso en 35 payslips (domingo 9 ago 2026: 11 h seguidas,
 *  10 a tarifa dominical y 1 a overtime). Ninguna otra semana llego a 10 h
 *  seguidas, asi que el umbral esta acotado por arriba pero no por abajo. */
export const MAX_CONTINUOUS_PAID_HOURS = 10;

/** El overtime se liquido a 1.5x la tarifa de la categoria del turno
 *  ($92.99 = 1.5 x $61.99 dominical). Un solo caso observado. */
export const OVERTIME_MULTIPLIER = 1.5;

/** Garantia de jubilacion. 12% desde el 1 de julio de 2025; reproduce exacto el
 *  SGC de los 35 payslips. La base excluye el overtime. */
export const SUPER_RATE = 0.12;

/** Tarifas de respaldo, por si todavia no hay payslips leidos. Son las vigentes
 *  desde el 1 de julio de 2026. */
export const FALLBACK_RATES = {
  ordinary: 34.44,
  evening: 37.88,
  saturday: 48.21,
  sunday: 61.99,
  holiday: 72.33,
  night: 36.82,
  sleepover: 62.87,
  brokenShift: 21.81,
  firstAid: 0.56,
} as const;

/** Desde esta semana el empleador empezo a liquidar el Broken Shift Allowance.
 *  Antes habia dias partidos y no lo pagaba: pronosticarlo hacia atras daria
 *  plata que nunca entro. */
export const BROKEN_SHIFT_PAID_FROM = '2026-02-26';
