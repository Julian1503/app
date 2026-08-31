/** Traducciones y formatos del panel de plata. Aparte del componente para
 *  poder testearlos sin montar React. */

import type { Translate } from '@shared/i18n/index.ts';
import type { ForecastBasis, PayForecast } from '@shared/types.ts';

export function basisLabel(basis: ForecastBasis, t: Translate): string {
  switch (basis) {
    case 'payslip':
      return t('pay.basis.payslip');
    case 'timesheet':
      return t('pay.basis.timesheet');
    case 'roster':
      return t('pay.basis.roster');
    case 'mixed':
      return t('pay.basis.mixed');
    case 'empty':
      return t('pay.basis.empty');
  }
}

export function basisNote(basis: ForecastBasis, t: Translate): string {
  switch (basis) {
    case 'payslip':
      return t('pay.basisNote.payslip');
    case 'timesheet':
      return t('pay.basisNote.timesheet');
    case 'roster':
      return t('pay.basisNote.roster');
    case 'mixed':
      return t('pay.basisNote.mixed');
    case 'empty':
      return t('pay.basisNote.empty');
  }
}

/** Titular del proximo deposito, adaptado a que tan firme es el numero. */
export function chequeHeadline(forecast: PayForecast, t: Translate): string {
  if (forecast.basis === 'empty') return t('pay.headline.empty');
  if (forecast.actual) return t('pay.headline.actual');
  if (forecast.basis === 'roster') return t('pay.headline.roster');
  if (forecast.basis === 'mixed') return t('pay.headline.mixed');
  return t('pay.headline.forecast');
}

/** Cifras a mostrar de una semana.
 *
 *  Cuando el payslip ya llego manda el payslip: la estimacion pasa a ser un
 *  contraste, no el numero. Mostrar el estimado en una fila rotulada "liquidado"
 *  seria decir que cobraste algo que no cobraste. */
export function displayedFigures(forecast: PayForecast): {
  gross: number;
  tax: number;
  net: number;
  superannuation: number;
  bankPayment: number;
  paidHours: number;
} {
  return forecast.actual ?? forecast;
}

/** Proporciones de la barra bruto = neto + impuesto. */
export function chequeSplit(forecast: PayForecast): { net: number; tax: number } {
  const figures = displayedFigures(forecast);
  if (figures.gross <= 0) return { net: 0, tax: 0 };
  return {
    net: (figures.net / figures.gross) * 100,
    tax: (figures.tax / figures.gross) * 100,
  };
}
