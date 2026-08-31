import type { BackPayRollup } from '@shared/types.ts';
import { useI18n } from '../lib/i18n.tsx';

interface Props {
  readonly rollup: BackPayRollup;
}

/** Resumen del reclamo, arriba de la tabla semana a semana.
 *
 *  La tabla ya dice, fila por fila, cuales quedaron saldadas; esto contesta la
 *  pregunta que uno se hace al abrir un payslip nuevo y ver una linea de Back
 *  Pay: de todo lo que reclamaba, cuanto me pagaron y cuanto falta.
 *
 *  Cuando no hubo ningun reintegro no se muestra nada: las semanas cortas ya se
 *  reclaman una por una en los hallazgos, y un cartel que dijera "recuperaste $0"
 *  solo las taparia. */
export function BackPayNote({ rollup }: Props): JSX.Element | null {
  const { i18n } = useI18n();
  const { t, money } = i18n;

  if (rollup.lastPaymentDate === null) return null;

  const settled = rollup.weeksOpen === 0;

  return (
    <section className="card backpay">
      <div>
        <p className="eyebrow">{t('backPay.eyebrow')}</p>
        <h3>
          {t('backPay.recovered', {
            money: money(rollup.recovered),
            date: i18n.date(rollup.lastPaymentDate),
          })}
        </h3>
        <p className="section__note">{t('backPay.weeks', { count: rollup.weeksRecovered })}</p>
      </div>

      <span className={`chip chip--${settled ? 'ok' : 'over'}`}>
        {settled
          ? t('backPay.clear')
          : t('backPay.open', { money: money(rollup.outstanding), count: rollup.weeksOpen })}
      </span>
    </section>
  );
}
