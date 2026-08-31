import type { PayForecast } from '@shared/types.ts';
import { useI18n } from '../lib/i18n.tsx';
import {
  basisLabel,
  basisNote,
  chequeHeadline,
  chequeSplit,
  displayedFigures,
} from '../lib/pay-view.ts';

interface Props {
  readonly forecast: PayForecast | null;
  /** Año fiscal de la tabla de retencion aplicada. */
  readonly taxYear: string;
}

export function PayCheque({ forecast, taxYear }: Props): JSX.Element {
  const { i18n } = useI18n();
  const { t, money } = i18n;

  if (!forecast) {
    return <div className="card empty">{t('pay.empty')}</div>;
  }

  const split = chequeSplit(forecast);
  const figures = displayedFigures(forecast);
  const delta = forecast.grossDelta;

  return (
    <section className="card cheque">
      <div className="cheque__figure">
        <p className="eyebrow">
          {forecast.actual
            ? t('pay.depositedOn', { date: i18n.date(forecast.paymentDate) })
            : t('pay.depositsOn', { date: i18n.date(forecast.paymentDate) })}
        </p>
        <span className="cheque__amount">{money(figures.bankPayment)}</span>
        <span className="cheque__unit">{t('pay.toAccount')}</span>

        {/* El bruto se parte en lo que te queda y lo que se lleva la ATO. */}
        <div
          className="cheque__bar"
          role="img"
          aria-label={t('pay.barAria', {
            gross: money(figures.gross),
            net: money(figures.net),
            tax: money(figures.tax),
          })}
        >
          <span className="cheque__bar-net" style={{ width: `${split.net}%` }} />
          <span className="cheque__bar-tax" style={{ width: `${split.tax}%` }} />
        </div>
        <p className="cheque__legend">
          <span>
            <i className="swatch swatch--net" /> {t('pay.legend.net', { money: money(figures.net) })}
          </span>
          <span>
            <i className="swatch swatch--tax" /> {t('pay.legend.tax', { money: money(figures.tax) })}
          </span>
        </p>
      </div>

      <div className="cheque__body">
        <div className="cheque__head">
          <h3>{chequeHeadline(forecast, t)}</h3>
          <span className={`chip chip--${forecast.actual ? 'ok' : 'info'}`}>
            {basisLabel(forecast.basis, t)}
          </span>
        </div>

        <p className="cheque__range">
          {t('pay.range', {
            range: i18n.range(forecast.weekStart, forecast.weekEnd),
            paidHours: figures.paidHours,
            visaHours: forecast.visaHours,
          })}
        </p>

        <div className="cheque__stats">
          <div>
            <span className="stat__label">{t('pay.stat.gross')}</span>
            <span className="stat__value">{money(figures.gross)}</span>
          </div>
          <div>
            <span className="stat__label">{t('pay.stat.tax', { year: taxYear })}</span>
            <span className="stat__value">−{money(figures.tax)}</span>
          </div>
          <div>
            <span className="stat__label">{t('pay.stat.super')}</span>
            <span className="stat__value">{money(figures.superannuation)}</span>
          </div>
          {forecast.reimbursements > 0 && (
            <div>
              <span className="stat__label">{t('pay.stat.reimbursements')}</span>
              <span className="stat__value">+{money(forecast.reimbursements)}</span>
            </div>
          )}
        </div>

        {/* El desglose siempre sale del roster: es lo unico que se puede abrir por
            concepto antes de que llegue el payslip, y despues sirve de contraste.
            Por eso, en una semana ya liquidada, puede no cuadrar con las cifras
            de arriba: la diferencia es justamente el hallazgo.
            Las etiquetas quedan en ingles: son las que imprime el payslip. */}
        <p className="cheque__caption">
          {forecast.actual ? t('pay.caption.actual') : t('pay.caption.forecast')}
        </p>
        <ul className="cheque__lines">
          {forecast.lines.map((line) => (
            <li key={line.label} className={line.kind === 'reimbursement' ? 'is-aside' : undefined}>
              <span className="cheque__line-label">{line.label}</span>
              <span className="cheque__line-qty">
                {line.quantity !== null && line.rate !== null
                  ? `${line.quantity} × ${money(line.rate)}`
                  : ''}
              </span>
              <span className="cheque__line-amount">{money(line.amount)}</span>
            </li>
          ))}
        </ul>

        <p className="cheque__note">
          {basisNote(forecast.basis, t)}
          {delta !== null && Math.abs(delta) > 1 && (
            <>
              {' '}
              <strong className={delta > 0 ? 'is-over' : 'is-warning'}>
                {t('pay.delta', {
                  expected: money(forecast.gross),
                  actual: money(forecast.actual?.gross ?? 0),
                  missing: delta > 0,
                  amount: money(Math.abs(delta)),
                })}
              </strong>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
