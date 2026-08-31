/** Seleccion de los turnos que llevan reporte.
 *
 *  Se separa del servidor porque es la regla que decide que aparece en la
 *  pantalla, y conviene poder testearla sin Deputy del otro lado. */

import type { IsoDate, Shift } from '../types.js';

export interface SelectOptions {
  /** Nombre del cliente tal como figura en el location de Deputy. */
  readonly clientName: string;
  /** Primer dia que lleva reporte. */
  readonly from: IsoDate;
  /** Hoy. Un turno de hoy o del futuro todavia no esta completo. */
  readonly today: IsoDate;
}

function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Deputy escribe el location de formas distintas segun quien cargo el turno
 *  ("Joshua Jones", "JOSHUA JONES - Community"), asi que se compara por
 *  inclusion sobre el texto normalizado en vez de por igualdad. */
export function matchesClient(area: string | null, clientName: string): boolean {
  if (!area) return false;
  return normalise(area).includes(normalise(clientName));
}

/** Turnos completados con el cliente, del mas reciente al mas viejo.
 *
 *  Solo timesheets: un roster es un turno publicado que todavia no se trabajo, y
 *  reportar sobre el seria reportar sobre algo que no paso. */
export function selectClientShifts(
  shifts: readonly Shift[],
  { clientName, from, today }: SelectOptions,
): Shift[] {
  return shifts
    .filter(
      (shift) =>
        shift.source === 'timesheet' &&
        shift.date >= from &&
        shift.date < today &&
        matchesClient(shift.area, clientName),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.startMinute - a.startMinute);
}
