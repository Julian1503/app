/** Constantes de la regla de conteo. Verificadas contra los payslips: las horas
 *  dentro de la franja 22:00-06:00 se pagan como Sleepover Allowance (sin horas
 *  asociadas), por lo que no son horas trabajadas a efectos de la condicion 8105.
 *
 *  Excepcion importante: si despiertan al trabajador durante el sleepover, esas
 *  horas se pagan como `Night Hours` y SI cuentan. El detector esta en
 *  `reconcile/payslip-vs-roster.ts`, que busca esa linea en los payslips. */

/** Inicio de la franja nocturna, en minutos desde medianoche. */
export const NIGHT_START_MINUTE = 22 * 60;

/** Fin de la franja nocturna, en minutos desde medianoche. */
export const NIGHT_END_MINUTE = 6 * 60;

/** Duracion de la franja nocturna en horas. */
export const NIGHT_BAND_HOURS = 8;

/** Limite de la condicion 8105: 48 horas por quincena mientras el curso este en sesion. */
export const DEFAULT_FORTNIGHT_LIMIT = 48;

/** Umbral para pintar una quincena en amarillo antes de pasarse. */
export const WARNING_RATIO = 0.9;

/** Minimo de la franja nocturna que hay que cubrir para considerarlo sleepover. */
export const SLEEPOVER_MIN_NIGHT_HOURS = 6;

/** Lapso maximo, en horas, entre el inicio del primer bloque y el fin del ultimo
 *  para que el dia califique como turno partido segun la clausula 25.6 del SCHADS.
 *  Por encima de eso son turnos separados y el Broken Shift Allowance no corresponde. */
export const BROKEN_SHIFT_MAX_SPAN_HOURS = 12;

/** Tarifa por km que paga el empleador, deducida de los payslips. */
export const DEFAULT_KM_RATE = 0.99;

/** Km por turno que se pueden declarar sin aprobacion del manager. */
export const KM_SELF_APPROVE_LIMIT = 20;
