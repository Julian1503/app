/** Interpretacion de un payslip de Deputy a partir del texto posicionado.
 *
 *  Las filas ya vienen reconstruidas por altura, asi que cada renglon trae su
 *  etiqueta y sus numeros juntos. Para saber que es cada numero se usa la
 *  cantidad de decimales, que en estos payslips es inequivoca:
 *
 *    1.0000     -> cantidad (sin simbolo, 4 decimales)
 *    $21.8100   -> tarifa   (con simbolo, 4 decimales)
 *    $21.81     -> importe  (con simbolo, 2 decimales)
 *
 *  Para los importes hace falta ademas la posicion horizontal, porque hay filas
 *  que solo traen el acumulado YTD y ningun importe del periodo (por ejemplo
 *  "Other Previous Earnings"). Tomar el primer numero de esas filas seria contar
 *  un acumulado historico como si fuera un pago de la semana. El corte entre
 *  columnas sale del punto medio entre los encabezados THIS PAY e YTD.
 *
 *  Al final se valida con dos invariantes: `cantidad x tarifa = importe` en cada
 *  linea y `suma de importes = Total Earnings`. Si alguna no cierra, el payslip
 *  queda marcado y aparece como hallazgo. */

import type { Payslip, PayslipLine, PayslipLineKind } from '../../shared/types.js';
import { readBackPay } from './back-pay.js';
import type { PdfPage, TextRow } from './pdf-text.js';

const MONEY_TOLERANCE = 0.02;

const EARNINGS_HEADER = /SALARY\s*&?\s*WAGES/i;
const REIMBURSEMENT_HEADER = /^REIMBURSEMENTS?\b/i;
const TAX_HEADER = /^TAX$/i;
const SUPER_HEADER = /^SUPERANNUATION$/i;
const SECTION_END = /^(PAYMENT DETAILS|LEAVE|YOUR LEAVE)\b/i;
const TOTAL_ROW = /^TOTALS?$/i;

/** Fila de encabezado que abre un payslip. Su ausencia marca una continuacion. */
const PERIOD_ROW = /Pay Period:\s*(\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4})/i;

const ALLOWANCE_LABEL = /\ballowance\b/i;
const TRAVEL_LABEL = /travel/i;
const SLEEPOVER_LABEL = /sleepover/i;
const NIGHT_LABEL = /\bnight\s+hours?\b/i;

/** Reintegro de semanas anteriores liquidado en este payslip. Se cobra ahora,
 *  pero la plata es de otras semanas. */
const BACK_PAY_LABEL = /^back\s*pay\b/i;

/** Licencias: se pagan por hora pero no son horas trabajadas, asi que no cuentan
 *  ni para el limite de la visa ni para comparar contra el roster. */
const LEAVE_LABEL = /\b(leave|annual|personal|sick|compassionate|bereavement)\b/i;

type Section = 'earnings' | 'reimbursement' | 'tax' | 'super' | null;

interface RowNumbers {
  readonly quantity: number | null;
  readonly rate: number | null;
  readonly amounts: number[];
  readonly label: string;
}

function toNumber(raw: string): number | null {
  const value = Number.parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

/** Corte por defecto entre la columna del periodo y la del acumulado, en puntos
 *  del PDF. Solo se usa si no aparece la fila de encabezados. */
const DEFAULT_YTD_CUTOFF = 500;

/** Punto medio entre los encabezados THIS PAY e YTD. */
function findYtdCutoff(rows: readonly TextRow[]): number {
  for (const row of rows) {
    const thisPay = row.tokens.find((token) => /^THIS\s*PAY$/i.test(token.text));
    const ytd = row.tokens.find((token) => /^YTD$/i.test(token.text));
    if (thisPay && ytd) return (thisPay.x + ytd.x) / 2;
  }
  return DEFAULT_YTD_CUTOFF;
}

/** Separa los tokens de una fila en etiqueta, cantidad, tarifa e importes. */
function readRow(row: TextRow, ytdCutoff: number): RowNumbers {
  let quantity: number | null = null;
  let rate: number | null = null;
  const amounts: number[] = [];
  const labelParts: string[] = [];

  for (const token of row.tokens) {
    const text = token.text.trim();

    const quantityMatch = /^(-?[\d,]+\.\d{4})$/.exec(text);
    if (quantityMatch) {
      quantity ??= toNumber(quantityMatch[1]!);
      continue;
    }

    const rateMatch = /^\$(-?[\d,]+\.\d{4})$/.exec(text);
    if (rateMatch) {
      rate ??= toNumber(rateMatch[1]!);
      continue;
    }

    const amountMatch = /^\$(-?[\d,]+\.\d{2})$/.exec(text);
    if (amountMatch) {
      // Lo que cae a la derecha del corte es el acumulado YTD y se descarta.
      if (token.x >= ytdCutoff) continue;
      const value = toNumber(amountMatch[1]!);
      if (value !== null) amounts.push(value);
      continue;
    }

    labelParts.push(text);
  }

  return { quantity, rate, amounts, label: labelParts.join(' ').replace(/\s+/g, ' ').trim() };
}

/** Decide que representa una linea.
 *
 *  No alcanza con buscar la palabra "Hours" en la etiqueta: los feriados se
 *  liquidan como "Public Holiday", sin esa palabra, y son horas efectivamente
 *  trabajadas. La senal confiable es estructural: si la linea tiene cantidad y
 *  tarifa, y no es un adicional ni una licencia, son horas de trabajo. */
function classify(label: string, section: Section, hasQuantityAndRate: boolean): PayslipLineKind {
  if (section === 'reimbursement' || TRAVEL_LABEL.test(label)) return 'reimbursement';
  if (BACK_PAY_LABEL.test(label)) return 'backpay';
  if (ALLOWANCE_LABEL.test(label)) return 'allowance';
  if (LEAVE_LABEL.test(label)) return 'other';
  if (hasQuantityAndRate) return 'hours';
  return 'other';
}

function toIsoDate(ddmmyyyy: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function findHeaderValue(rows: readonly TextRow[], pattern: RegExp): string | null {
  for (const row of rows) {
    const match = pattern.exec(row.text);
    if (match) return match[1] ?? null;
  }
  return null;
}

interface CollectedSections {
  readonly lines: PayslipLine[];
  readonly earningsTotal: number | null;
  /** Retencion PAYG del periodo, del TOTAL de la seccion TAX. */
  readonly taxWithheld: number;
  /** Aporte SGC del periodo, del TOTAL de la seccion SUPERANNUATION. */
  readonly superannuation: number;
}

/** Recorre las filas manteniendo en que seccion estamos.
 *
 *  Las secciones TAX y SUPERANNUATION no generan lineas liquidadas: el impuesto
 *  se descuenta del bruto y la jubilacion ni siquiera pasa por el neto, va
 *  directo al fondo. De cada una alcanza con su TOTAL del periodo. */
function collectSections(rows: readonly TextRow[]): CollectedSections {
  const lines: PayslipLine[] = [];
  const ytdCutoff = findYtdCutoff(rows);
  let section: Section = null;
  let earningsTotal: number | null = null;
  let taxWithheld = 0;
  let superannuation = 0;

  for (const row of rows) {
    const parsed = readRow(row, ytdCutoff);
    const { label } = parsed;

    if (SECTION_END.test(label)) {
      section = null;
      continue;
    }
    if (EARNINGS_HEADER.test(label)) {
      section = 'earnings';
      continue;
    }
    if (REIMBURSEMENT_HEADER.test(label)) {
      section = 'reimbursement';
      continue;
    }
    if (TAX_HEADER.test(label)) {
      section = 'tax';
      continue;
    }
    if (SUPER_HEADER.test(label)) {
      section = 'super';
      continue;
    }
    if (section === null) continue;

    if (TOTAL_ROW.test(label)) {
      const total = parsed.amounts[0];
      if (total !== undefined) {
        if (section === 'earnings') earningsTotal = total;
        if (section === 'tax') taxWithheld = total;
        if (section === 'super') superannuation = total;
      }
      continue;
    }

    if (section === 'tax' || section === 'super') continue;

    // Filas sin etiqueta o sin importe no aportan un concepto liquidado.
    if (label.length === 0 || parsed.amounts.length === 0) continue;

    lines.push({
      label,
      kind: classify(label, section, parsed.quantity !== null && parsed.rate !== null),
      quantity: parsed.quantity,
      rate: parsed.rate,
      amount: parsed.amounts[0]!,
    });
  }

  return { lines, earningsTotal, taxWithheld, superannuation };
}

/** Chequea `cantidad x tarifa = importe` en las lineas que tienen los tres datos. */
function hasLineArithmeticError(lines: readonly PayslipLine[]): boolean {
  return lines.some((line) => {
    if (line.quantity === null || line.rate === null) return false;
    return Math.abs(line.quantity * line.rate - line.amount) > MONEY_TOLERANCE;
  });
}

function parsePage(page: PdfPage, continuation: readonly TextRow[], file: string): Payslip | null {
  const rows = page.rows;

  const period = findHeaderValue(rows, PERIOD_ROW);
  if (!period) return null;

  const [rawStart, rawEnd] = period.split('-').map((part) => part.trim());
  const periodStart = rawStart ? toIsoDate(rawStart) : null;
  const periodEnd = rawEnd ? toIsoDate(rawEnd) : null;
  if (!periodStart || !periodEnd) return null;

  const { lines, earningsTotal, taxWithheld, superannuation } = collectSections(rows);
  if (lines.length === 0) return null;

  const paymentRaw = findHeaderValue(rows, /Payment Date:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const totalRaw = findHeaderValue(rows, /Total Earnings:\s*\$?([\d,]+\.\d{2})/i);
  const netRaw = findHeaderValue(rows, /Net Pay:\s*\$?([\d,]+\.\d{2})/i);

  const totalEarnings = totalRaw ? (toNumber(totalRaw) ?? 0) : 0;
  const netPay = netRaw ? (toNumber(netRaw) ?? 0) : 0;

  // Los viaticos son un reembolso, no una ganancia: no entran en Total Earnings
  // ni en el Net Pay impreso, pero si en lo que llega al banco.
  const earningsSum = lines
    .filter((line) => line.kind !== 'reimbursement')
    .reduce((sum, line) => sum + line.amount, 0);

  const reimbursements = lines
    .filter((line) => line.kind === 'reimbursement')
    .reduce((sum, line) => sum + line.amount, 0);

  const reference = totalEarnings || earningsTotal || 0;
  const sumMismatch =
    reference > 0 && Math.abs(earningsSum - reference) > Math.max(MONEY_TOLERANCE, reference * 0.001);

  const paidHours = lines
    .filter((line) => line.kind === 'hours')
    .reduce((sum, line) => sum + (line.quantity ?? 0), 0);

  const nightHours = lines
    .filter((line) => NIGHT_LABEL.test(line.label))
    .reduce((sum, line) => sum + (line.quantity ?? 0), 0);

  const sleepoverLines = lines.filter((line) => SLEEPOVER_LABEL.test(line.label));
  const sleepoverAmount = sleepoverLines.reduce((sum, line) => sum + line.amount, 0);
  const sleepoverQuantity = sleepoverLines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);

  const travelCostsPaid = lines
    .filter((line) => TRAVEL_LABEL.test(line.label))
    .reduce((sum, line) => sum + line.amount, 0);

  const backPayAmount = lines
    .filter((line) => line.kind === 'backpay')
    .reduce((sum, line) => sum + line.amount, 0);

  return {
    file,
    periodStart,
    periodEnd,
    paymentDate: paymentRaw ? toIsoDate(paymentRaw) : null,
    totalEarnings,
    netPay,
    lines,
    paidHours: Math.round(paidHours * 100) / 100,
    sleepoverCount: sleepoverQuantity,
    sleepoverAmount: Math.round(sleepoverAmount * 100) / 100,
    travelCostsPaid: Math.round(travelCostsPaid * 100) / 100,
    nightHours: Math.round(nightHours * 100) / 100,
    taxWithheld: Math.round(taxWithheld * 100) / 100,
    superannuation: Math.round(superannuation * 100) / 100,
    bankPayment: Math.round((netPay + reimbursements) * 100) / 100,
    backPay: readBackPay(Math.round(backPayAmount * 100) / 100, rows, continuation),
    arithmeticMismatch: sumMismatch || hasLineArithmeticError(lines),
  };
}

/** Un PDF puede traer varios payslips (los meses agrupados), uno por pagina.
 *
 *  Una pagina sin `Pay Period:` no es un payslip nuevo: es la continuacion del
 *  anterior. Pasa cuando el bloque MESSAGES no entra en la hoja, que es
 *  justamente donde viene el desglose del Back Pay, asi que esas filas se le
 *  entregan al payslip que las empezo en vez de tirarlas. */
export function parsePayslipPages(pages: readonly PdfPage[], file: string): Payslip[] {
  const hasPeriod = (page: PdfPage): boolean => page.rows.some((row) => PERIOD_ROW.test(row.text));

  const payslips: Payslip[] = [];
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]!;
    if (!hasPeriod(page)) continue;

    const continuation: TextRow[] = [];
    for (let next = index + 1; next < pages.length && !hasPeriod(pages[next]!); next += 1) {
      continuation.push(...pages[next]!.rows);
    }

    const payslip = parsePage(page, continuation, file);
    if (payslip) payslips.push(payslip);
  }
  return payslips;
}
