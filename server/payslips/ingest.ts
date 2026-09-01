/** Alta de un payslip subido desde la UI.
 *
 *  A diferencia del importador, no toca el disco: recibe los bytes del PDF, los
 *  parsea y **recalcula sobre el historial completo** ya guardado. Ese recalculo
 *  no es opcional: `inferSleepoverCounts` deduce la tarifa del sleepover del
 *  minimo por era salarial, y con un archivo aislado daria cantidades infladas. */

import { readPayslips, writePayslips } from '../db/payslips.js';
import type { Payslip } from '../../shared/types.js';
import { dedupe, inferSleepoverCounts } from './normalize.js';
import { extractPages } from './pdf-text.js';
import { parsePayslipPages } from './parse.js';

export interface IngestResult {
  /** Periodos reconocidos dentro del PDF. */
  readonly parsed: number;
  /** Periodos que no estaban antes. */
  readonly added: number;
  /** Periodos que ya existian y se pisaron. */
  readonly replaced: number;
  /** Total de payslips en la base despues de la operacion. */
  readonly total: number;
  readonly periods: readonly string[];
}

export class PayslipParseError extends Error {}

export async function ingestPayslipPdf(data: Uint8Array, filename: string): Promise<IngestResult> {
  let parsed: Payslip[];
  try {
    parsed = parsePayslipPages(await extractPages(data), filename);
  } catch (error) {
    throw new PayslipParseError(`No se pudo leer el PDF: ${(error as Error).message}`);
  }

  if (parsed.length === 0) {
    throw new PayslipParseError('No se reconocio ningun periodo de pago en el PDF.');
  }

  const existing = await readPayslips();
  const known = new Set(existing.map((slip) => `${slip.periodStart}:${slip.periodEnd}`));
  const periods = parsed.map((slip) => `${slip.periodStart}:${slip.periodEnd}`);

  // El nuevo va primero para que gane los empates: si resubis un periodo
  // corregido, la version nueva es la que queda.
  const merged = inferSleepoverCounts(dedupe([...parsed, ...existing]));
  await writePayslips(merged);

  return {
    parsed: parsed.length,
    added: periods.filter((key) => !known.has(key)).length,
    replaced: periods.filter((key) => known.has(key)).length,
    total: merged.length,
    periods: parsed.map((slip) => `${slip.periodStart} → ${slip.periodEnd}`),
  };
}
