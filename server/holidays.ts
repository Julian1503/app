/** Calendario de feriados que aplican en el lugar de trabajo.
 *
 *  Vive en la tabla `holidays` y se edita a mano a proposito, ahora desde el
 *  table editor de Supabase: los feriados regionales (el Toowoomba Show Day,
 *  sin ir mas lejos) cambian de fecha todos los años y no hay forma de
 *  calcularlos. Cuando falta uno, el payslip liquida `Public Holiday` en una
 *  semana donde la app no lo esperaba y el hallazgo `holiday-missing` avisa
 *  cual agregar. */

export { type Holiday, readHolidays } from './db/calendar.ts';
