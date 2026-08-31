/** Imputacion de los Back Pay a las semanas que los generaron.
 *
 *  Un reclamo aceptado no vuelve como payslip corregido: llega como una linea
 *  `Back Pay` dentro del payslip de la semana en curso. Eso desordena dos
 *  semanas a la vez si se lo toma literal:
 *
 *  - la semana que **cobra** el reintegro aparece pagada de mas, y
 *  - la semana que lo **reclamaba** sigue apareciendo corta, aunque ya se cobro.
 *
 *  Aca se deshace ese cruce: la plata se descuenta de la semana que la cobro y
 *  se acredita a la semana que le correspondia, usando el desglose del payslip.
 *  Lo que el desglose no explica no se reparte a ojo, queda sin imputar. */

import { startOfPayWeek } from './calendar.js';
import type {
  BackPayRollup,
  IsoDate,
  PayForecast,
  Payslip,
  Settlement,
  SettlementStatus,
} from '../types.js';

/** Debajo de esto es redondeo de la nomina, no un faltante. */
export const PAY_TOLERANCE = 1;

/** Reintegro acreditado a una semana. */
export interface BackPayCredit {
  readonly amount: number;
  /** Periodo del payslip que lo pago. */
  readonly periodStart: IsoDate;
  /** Fecha del deposito en que llego. */
  readonly paymentDate: IsoDate;
}

const money = (value: number): number => Math.round(value * 100) / 100;

/** Reintegros cobrados, indexados por la semana de pago a la que corresponden.
 *
 *  El desglose nombra el periodo original (`12th to 18th February 2026`), que ya
 *  es una semana de pago entera; aun asi se normaliza al jueves de esa semana,
 *  para que un desglose que cite un dia suelto caiga igual en su semana. */
export function creditsByWeek(payslips: readonly Payslip[]): Map<IsoDate, BackPayCredit> {
  const credits = new Map<IsoDate, BackPayCredit>();

  for (const payslip of payslips) {
    if (!payslip.backPay) continue;
    const paymentDate = payslip.paymentDate ?? payslip.periodEnd;

    for (const allocation of payslip.backPay.allocations) {
      const week = startOfPayWeek(allocation.periodStart);
      const existing = credits.get(week);
      credits.set(week, {
        amount: money((existing?.amount ?? 0) + allocation.amount),
        // Ante varios reintegros para la misma semana manda el ultimo: es el que
        // cierra la cuenta y el que hay que citar si todavia queda saldo.
        periodStart: payslip.periodStart,
        paymentDate,
      });
    }
  }

  return credits;
}

function statusOf(grossDelta: number, outstanding: number, recovered: number): SettlementStatus {
  if (Math.abs(grossDelta) <= PAY_TOLERANCE) return 'matches';
  if (grossDelta < 0) return 'over';
  if (recovered <= 0) return 'short';
  return outstanding <= PAY_TOLERANCE ? 'settled' : 'partial';
}

/** Como quedo una semana: cuanto falto, cuanto volvio y cuanto sigue abierto. */
export function settle(
  grossDelta: number | null,
  credit: BackPayCredit | null,
  carried: number,
): Settlement {
  if (grossDelta === null) {
    return {
      status: 'pending',
      recovered: 0,
      outstanding: 0,
      recoveredIn: null,
      carried: money(carried),
    };
  }

  // Un reintegro nunca puede dejar la semana en positivo: como mucho cubre lo
  // que falto. Si el desglose imputa de mas, el excedente no es de esta semana.
  const recovered = credit ? money(Math.min(credit.amount, Math.max(grossDelta, 0))) : 0;
  const outstanding = money(grossDelta - recovered);

  return {
    status: statusOf(grossDelta, outstanding, recovered),
    recovered,
    outstanding,
    recoveredIn:
      credit && recovered > 0
        ? { periodStart: credit.periodStart, paymentDate: credit.paymentDate }
        : null,
    carried: money(carried),
  };
}

/** Como va el reclamo entero, para poder decirlo en una linea.
 *
 *  Es la unica cuenta de cuanto falta y cuanto volvio: el total del encabezado de
 *  hallazgos y el resumen de arriba de la tabla salen los dos de aca, para que no
 *  puedan decir numeros distintos.
 *
 *  Lo abierto suma **todas** las semanas cortas, no solo las que recibieron algo:
 *  la pregunta al abrir un payslip nuevo es cuanto falta en total, y una semana
 *  que nunca se reclamo falta igual. Las semanas pagadas de mas no se restan:
 *  casi siempre son un turno que no quedo registrado en Deputy, no un credito. */
export function summariseBackPay(forecasts: readonly PayForecast[]): BackPayRollup {
  let recovered = 0;
  let weeksRecovered = 0;
  let outstanding = 0;
  let weeksOpen = 0;
  let lastPaymentDate: IsoDate | null = null;

  for (const { settlement } of forecasts) {
    if (settlement.recovered > 0) {
      recovered += settlement.recovered;
      weeksRecovered += 1;
      const paid = settlement.recoveredIn?.paymentDate ?? null;
      if (paid !== null && (lastPaymentDate === null || paid > lastPaymentDate)) {
        lastPaymentDate = paid;
      }
    }

    if (settlement.status === 'short' || settlement.status === 'partial') {
      outstanding += settlement.outstanding;
      weeksOpen += 1;
    }
  }

  return {
    recovered: money(recovered),
    weeksRecovered,
    outstanding: money(outstanding),
    weeksOpen,
    lastPaymentDate,
  };
}
