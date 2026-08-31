/** Payslips ya parseados, leidos de la base.
 *
 *  Es todo lo que el servidor necesita. El parseo de los PDF vive en
 *  `import.ts`, que arrastra pdfjs-dist y solo usa el importador. */

import { readPayslips } from '../db/payslips.ts';
import type { Payslip } from '../../shared/types.ts';

export interface PayslipLoadResult {
  readonly payslips: Payslip[];
  readonly filesRead: number;
  readonly failures: Array<{ file: string; reason: string }>;
}

export async function loadPayslips(): Promise<PayslipLoadResult> {
  const payslips = await readPayslips();
  const files = new Set(payslips.map((slip) => slip.file));
  return { payslips, filesRead: files.size, failures: [] };
}
