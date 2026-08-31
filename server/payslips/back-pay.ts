/** Desglose del Back Pay a partir del bloque MESSAGES del payslip.
 *
 *  Cuando el empleador reconoce un reclamo no emite un payslip nuevo por la
 *  semana vieja: mete una linea `Back Pay` en el payslip de la semana en curso y
 *  explica al pie a que semanas corresponde:
 *
 *    MESSAGES
 *    Back pay is broken down as below:
 *    12th to 18th February 2026 4 hours $131.52
 *    9th to 15th April 2026 1 hour $32.88
 *
 *  Sin leer ese bloque la plata queda imputada a la semana equivocada: la
 *  semana que la cobra aparece pagada de mas y la semana que la reclamaba sigue
 *  apareciendo corta, aunque ya este saldada.
 *
 *  El formato no es del todo regular (`6th to 12 August 2026` viene sin el
 *  ordinal en el dia de cierre) y el bloque puede seguir en la pagina siguiente,
 *  asi que se parsea con tolerancia y se informa lo que no se pudo imputar en
 *  vez de descartarlo en silencio. */

import type { BackPay, BackPayAllocation, IsoDate } from '../../shared/types.js';
import type { TextRow } from './pdf-text.js';

const MESSAGES_HEADER = /^MESSAGES\b/i;
const BREAKDOWN_HEADER = /back\s*pay\s+is\s+broken\s+down/i;

/** `12th to 18th February 2026 4 hours $131.52`, con el mes y el año del inicio
 *  opcionales: si faltan, son los del cierre. */
const ALLOCATION = new RegExp(
  [
    /^(\d{1,2})(?:st|nd|rd|th)?/, // dia de inicio
    /(?:\s+([A-Za-z]+))?/, //        mes de inicio (opcional)
    /(?:\s+(\d{4}))?/, //            año de inicio (opcional)
    /\s+(?:to|-|–|until)\s+/,
    /(\d{1,2})(?:st|nd|rd|th)?/, //  dia de cierre
    /\s+([A-Za-z]+)/, //             mes de cierre
    /\s+(\d{4})/, //                 año de cierre
    /\s+([\d.]+)\s+hours?/,
    /\s+\$([\d,]+\.\d{2})$/,
  ]
    .map((part) => part.source)
    .join(''),
  'i',
);

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

function monthIndex(name: string): number | null {
  const needle = name.toLowerCase();
  const index = MONTHS.findIndex((month) => month.startsWith(needle) && needle.length >= 3);
  return index === -1 ? null : index;
}

function toIso(year: number, month: number, day: number): IsoDate {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toNumber(raw: string): number {
  return Number.parseFloat(raw.replace(/,/g, ''));
}

/** Una linea del desglose, o null si no tiene esa forma. */
export function parseAllocation(text: string): BackPayAllocation | null {
  const match = ALLOCATION.exec(text.trim());
  if (!match) return null;

  const [, startDay, startMonthRaw, startYearRaw, endDay, endMonthRaw, endYearRaw, hours, amount] =
    match;

  const endMonth = monthIndex(endMonthRaw!);
  if (endMonth === null) return null;
  const endYear = Number.parseInt(endYearRaw!, 10);

  const startMonth = startMonthRaw ? monthIndex(startMonthRaw) : endMonth;
  if (startMonth === null) return null;

  // Un rango que arranca en un mes posterior al de cierre cruza el año nuevo:
  // `30th December to 5th January 2026` empieza en 2025.
  const startYear = startYearRaw
    ? Number.parseInt(startYearRaw, 10)
    : startMonth > endMonth
      ? endYear - 1
      : endYear;

  const periodStart = toIso(startYear, startMonth, Number.parseInt(startDay!, 10));
  const periodEnd = toIso(endYear, endMonth, Number.parseInt(endDay!, 10));
  if (periodEnd < periodStart) return null;

  return {
    periodStart,
    periodEnd,
    hours: toNumber(hours!),
    amount: toNumber(amount!),
  };
}

/** Filas del bloque MESSAGES: desde el encabezado hasta el final del payslip,
 *  incluidas las paginas de continuacion que ya no traen encabezado. */
function messageRows(rows: readonly TextRow[]): TextRow[] {
  const start = rows.findIndex((row) => MESSAGES_HEADER.test(row.text));
  return start === -1 ? [] : rows.slice(start + 1);
}

/** Arma el desglose del Back Pay liquidado en este payslip.
 *
 *  `amount` viene de la linea liquidada, no de la suma del desglose: es lo que
 *  efectivamente se cobro. Si el desglose no lo explica entero, la diferencia
 *  queda visible en `unallocated` en vez de repartirse a ojo. */
export function readBackPay(
  amount: number,
  ownRows: readonly TextRow[],
  continuationRows: readonly TextRow[],
): BackPay | null {
  if (amount === 0) return null;

  const candidates = [...messageRows(ownRows), ...continuationRows];
  const allocations: BackPayAllocation[] = [];
  const unreadable: string[] = [];
  let inBreakdown = false;

  for (const row of candidates) {
    const text = row.text.trim();
    if (text.length === 0) continue;
    if (BREAKDOWN_HEADER.test(text)) {
      inBreakdown = true;
      continue;
    }

    const allocation = parseAllocation(text);
    if (allocation) {
      allocations.push(allocation);
      inBreakdown = true;
      continue;
    }
    // Ya dentro del desglose, un renglon que no parsea es plata sin imputar.
    if (inBreakdown) unreadable.push(text);
  }

  const explained = allocations.reduce((sum, entry) => sum + entry.amount, 0);
  return {
    amount,
    allocations: allocations.sort((a, b) => a.periodStart.localeCompare(b.periodStart)),
    unallocated: Math.round((amount - explained) * 100) / 100,
    unreadable,
  };
}
