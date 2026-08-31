/** Retencion PAYG semanal segun el "Statement of formulas" (NAT 1004) de la ATO.
 *
 *  La formula es y = a*x - b, donde `x` son los dolares enteros del bruto
 *  semanal mas 99 centavos, y `a`/`b` salen del tramo en que cae `x`. El
 *  resultado se redondea al dolar.
 *
 *  Se usa la **escala 2**: residente que declaro el umbral libre de impuestos en
 *  la TFN declaration, sin prestamo de estudio. Es la que corresponde a Julian y
 *  la que reproducen los payslips.
 *
 *  El año fiscal se decide por la **fecha de pago**, no por el periodo trabajado:
 *  es lo que dice la ATO y lo que hace Deputy.
 *
 *  Validacion (ver `tests/tax.test.ts` y el chequeo en vivo de `pay/findings.ts`):
 *  - 2025-26: reproduce exacto los 30 payslips de ese año fiscal.
 *  - 2026-27: reproduce exacto los 5 payslips disponibles y la tabla semanal
 *    publicada en $400, $450, $500, $550, $600, $650, $700, $750, $800, $900 y
 *    $1000. Los tramos altos (>$1282/semana) estan derivados por continuidad y
 *    solo uno esta contrastado contra un payslip real. */

import type { IsoDate } from '../types.js';
import { financialYearOf } from './calendar.js';

/** Un tramo: aplica cuando `x` es menor que `limit`. */
interface Band {
  readonly limit: number;
  readonly a: number;
  readonly b: number;
}

/** Escala 2, año fiscal 2025-26 (tasa minima 16%). */
const SCALE_2_2025_26: readonly Band[] = [
  { limit: 361, a: 0, b: 0 },
  { limit: 500, a: 0.16, b: 57.8462 },
  { limit: 625, a: 0.26, b: 107.8462 },
  { limit: 721, a: 0.18, b: 57.8462 },
  { limit: 865, a: 0.189, b: 64.4207 },
  { limit: 1282, a: 0.3227, b: 180.0385 },
  { limit: 2596, a: 0.32, b: 176.5769 },
  { limit: 3653, a: 0.39, b: 358.3077 },
  { limit: Infinity, a: 0.47, b: 650.6154 },
];

/** Escala 2, año fiscal 2026-27 (la tasa minima baja de 16% a 15%). */
const SCALE_2_2026_27: readonly Band[] = [
  { limit: 362, a: 0, b: 0 },
  { limit: 538, a: 0.15, b: 54.3462 },
  { limit: 673, a: 0.25, b: 108.1462 },
  { limit: 721, a: 0.17, b: 54.3062 },
  { limit: 865, a: 0.179, b: 60.8053 },
  { limit: 1282, a: 0.3227, b: 185.1935 },
  { limit: 2596, a: 0.32, b: 181.7307 },
  { limit: 3653, a: 0.39, b: 363.4615 },
  { limit: Infinity, a: 0.47, b: 655.7692 },
];

const TABLES: Readonly<Record<string, readonly Band[]>> = {
  '2025-26': SCALE_2_2025_26,
  '2026-27': SCALE_2_2026_27,
};

/** El año fiscal mas nuevo que tenemos cargado. Si llega una fecha posterior se
 *  usa este y se avisa por `isTaxTableStale`, en vez de devolver cero callado. */
const LATEST_YEAR = '2026-27';

export function hasTaxTable(paymentDate: IsoDate): boolean {
  return financialYearOf(paymentDate) in TABLES;
}

/** true si la fecha cae en un año fiscal para el que todavia no cargamos tabla. */
export function isTaxTableStale(paymentDate: IsoDate): boolean {
  return financialYearOf(paymentDate) > LATEST_YEAR;
}

export function taxTableYearFor(paymentDate: IsoDate): string {
  const year = financialYearOf(paymentDate);
  return year in TABLES ? year : LATEST_YEAR;
}

/** Retencion semanal en dolares enteros.
 *
 *  `gross` es el sueldo bruto imponible de la semana: **no** incluye los
 *  reembolsos de viaticos, que en estos payslips van fuera de Total Earnings y
 *  no se gravan. */
export function weeklyWithholding(gross: number, paymentDate: IsoDate): number {
  if (!Number.isFinite(gross) || gross <= 0) return 0;

  const bands = TABLES[taxTableYearFor(paymentDate)] ?? SCALE_2_2026_27;
  const x = Math.floor(gross) + 0.99;
  const band = bands.find((candidate) => x < candidate.limit);
  if (!band) return 0;

  return Math.max(0, Math.round(band.a * x - band.b));
}
