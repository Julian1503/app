import type { PayForecast } from '@shared/types.ts';
import { useI18n } from '../lib/i18n.tsx';
import { basisLabel, displayedFigures } from '../lib/pay-view.ts';

interface Props {
  readonly weeks: readonly PayForecast[];
  readonly today: string;
  readonly selectedStart: string | null;
  readonly onSelect: (weekStart: string) => void;
}

export function PayWeeks({ weeks, today, selectedStart, onSelect }: Props): JSX.Element {
  const { i18n } = useI18n();
  const { t, money } = i18n;

  if (weeks.length === 0) {
    return <div className="card empty">{t('pay.weeks.empty')}</div>;
  }

  /** Como quedo la semana frente al payslip.
   *
   *  Un faltante que despues volvio como Back Pay no se muestra en rojo: ya se
   *  cobro. Se muestra saldado, con la fecha del reintegro al pasar el mouse,
   *  porque sigue siendo la unica pista de que ahi hubo un reclamo. */
  const deltaCell = (forecast: PayForecast): JSX.Element => {
    const { settlement, grossDelta } = forecast;

    switch (settlement.status) {
      case 'pending':
        return <span className="is-faint">—</span>;
      case 'matches':
        return <span className="is-ok">{t('pay.closes')}</span>;
      case 'settled':
        return (
          <span
            className="is-ok"
            title={t('pay.settledTitle', {
              money: money(settlement.recovered),
              date: i18n.date(settlement.recoveredIn?.paymentDate ?? forecast.paymentDate),
            })}
          >
            {t('pay.settled')}
          </span>
        );
      case 'partial':
        return (
          <span
            className="is-over"
            title={t('pay.partialTitle', {
              money: money(settlement.recovered),
              date: i18n.date(settlement.recoveredIn?.paymentDate ?? forecast.paymentDate),
            })}
          >
            −{money(settlement.outstanding)}
          </span>
        );
      default:
        return (
          <span className={settlement.status === 'short' ? 'is-over' : 'is-warning'}>
            {settlement.status === 'short' ? '−' : '+'}
            {money(Math.abs(grossDelta ?? 0))}
          </span>
        );
    }
  };

  // Las semanas ya liquidadas suman lo que realmente entro; las que faltan, lo
  // estimado. Mezclarlas es justamente lo que se quiere ver: cuanto llevas mas
  // cuanto viene.
  const totals = weeks.reduce(
    (acc, week) => {
      const figures = displayedFigures(week);
      return {
        gross: acc.gross + figures.gross,
        tax: acc.tax + figures.tax,
        superannuation: acc.superannuation + figures.superannuation,
        bank: acc.bank + figures.bankPayment,
      };
    },
    { gross: 0, tax: 0, superannuation: 0, bank: 0 },
  );

  return (
    <div className="card scroll-x">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">{t('pay.col.week')}</th>
            <th scope="col">{t('pay.col.payment')}</th>
            <th scope="col">{t('pay.col.basis')}</th>
            <th scope="col" className="num">{t('pay.col.hours')}</th>
            <th scope="col" className="num">{t('pay.col.gross')}</th>
            <th scope="col" className="num">{t('pay.col.tax')}</th>
            <th scope="col" className="num">{t('pay.col.super')}</th>
            <th scope="col" className="num">{t('pay.col.bank')}</th>
            <th scope="col" className="num" title={t('pay.col.deltaTitle')}>
              {t('pay.col.delta')}
            </th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => {
            const figures = displayedFigures(week);
            return (
              <tr
                key={week.weekStart}
                className={[
                  week.weekStart === selectedStart ? 'is-selected' : '',
                  week.paymentDate > today ? 'is-future' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelect(week.weekStart)}
              >
                <td>
                  <button type="button" className="linkish" onClick={() => onSelect(week.weekStart)}>
                    {i18n.range(week.weekStart, week.weekEnd)}
                  </button>
                </td>
                <td>{i18n.date(week.paymentDate)}</td>
                <td>
                  <span className={`chip chip--${week.actual ? 'ok' : 'info'}`}>
                    {basisLabel(week.basis, t)}
                  </span>
                </td>
                <td className="num">{figures.paidHours}</td>
                <td className="num">{money(figures.gross)}</td>
                <td className="num">{money(figures.tax)}</td>
                <td className="num">{money(figures.superannuation)}</td>
                <td className="num">{money(figures.bankPayment)}</td>
                <td className="num">{deltaCell(week)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={4}>
              {t('pay.total', { count: weeks.length })}
            </th>
            <td className="num">{money(totals.gross)}</td>
            <td className="num">{money(totals.tax)}</td>
            <td className="num">{money(totals.superannuation)}</td>
            <td className="num">{money(totals.bank)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
