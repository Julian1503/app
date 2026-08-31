import type { I18n } from '@shared/i18n/index.ts';
import type { BackPay, Payslip } from '@shared/types.ts';
import { useI18n } from '../lib/i18n.tsx';

/** Semanas que cubre un Back Pay, para el tooltip: son las que hay que mirar
 *  para confirmar que el reintegro volvio entero. */
function backPayWeeks(backPay: BackPay, i18n: I18n): string {
  return backPay.allocations
    .map((entry) => `${i18n.range(entry.periodStart, entry.periodEnd)} (${i18n.money(entry.amount)})`)
    .join(', ');
}

interface Props {
  readonly payslips: readonly Payslip[];
}

export function PayslipTable({ payslips }: Props): JSX.Element {
  const { i18n } = useI18n();
  const { t, money } = i18n;

  if (payslips.length === 0) {
    return <div className="card empty">{t('payslips.empty')}</div>;
  }

  const totals = payslips.reduce(
    (acc, slip) => ({
      hours: acc.hours + slip.paidHours,
      gross: acc.gross + slip.totalEarnings,
      net: acc.net + slip.netPay,
      travel: acc.travel + slip.travelCostsPaid,
    }),
    { hours: 0, gross: 0, net: 0, travel: 0 },
  );

  return (
    <div className="card scroll-x">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">{t('payslips.col.period')}</th>
            <th scope="col" className="num">{t('payslips.col.hours')}</th>
            <th scope="col" className="num">{t('payslips.col.sleepovers')}</th>
            <th scope="col" className="num">{t('payslips.col.nightHours')}</th>
            <th scope="col" className="num">{t('payslips.col.travel')}</th>
            <th scope="col" className="num">{t('payslips.col.gross')}</th>
            <th scope="col" className="num">{t('payslips.col.net')}</th>
            <th scope="col">{t('payslips.col.status')}</th>
          </tr>
        </thead>
        <tbody>
          {payslips.map((slip) => (
            <tr key={`${slip.periodStart}-${slip.file}`}>
              <td title={slip.file}>{i18n.range(slip.periodStart, slip.periodEnd)}</td>
              <td className="num">{slip.paidHours}</td>
              <td className="num">{slip.sleepoverCount}</td>
              <td className="num">
                {slip.nightHours > 0 ? <span className="is-over">{slip.nightHours}</span> : '—'}
              </td>
              <td className="num">
                {slip.travelCostsPaid > 0 ? money(slip.travelCostsPaid) : '—'}
              </td>
              <td className="num">{money(slip.totalEarnings)}</td>
              <td className="num">{money(slip.netPay)}</td>
              <td className="chip-row">
                {slip.arithmeticMismatch ? (
                  <span className="chip chip--warning">{t('payslips.mismatch')}</span>
                ) : (
                  <span className="chip chip--ok">{t('payslips.ok')}</span>
                )}
                {slip.backPay ? (
                  <span
                    className="chip chip--info"
                    title={t('payslips.backPayTitle', {
                      count: slip.backPay.allocations.length,
                      weeks: backPayWeeks(slip.backPay, i18n),
                    })}
                  >
                    {t('payslips.backPay', { money: money(slip.backPay.amount) })}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t('payslips.total', { count: payslips.length })}</th>
            <td className="num">{Math.round(totals.hours * 100) / 100}</td>
            <td className="num">—</td>
            <td className="num">—</td>
            <td className="num">{money(totals.travel)}</td>
            <td className="num">{money(totals.gross)}</td>
            <td className="num">{money(totals.net)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
