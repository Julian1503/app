import type { Fortnight } from '@shared/types.ts';
import { useI18n } from '../lib/i18n.tsx';
import { headlineFor, labelFor, positionOf, verdictFor } from '../lib/fortnight-view.ts';

interface Props {
  readonly fortnight: Fortnight | null;
  readonly limit: number;
  readonly today: string;
  readonly canPrev: boolean;
  readonly canNext: boolean;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  /** Solo cuando el usuario se movio de la vigente, para poder volver de un clic. */
  readonly onCurrent: (() => void) | null;
}

const SIZE = 220;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** El arco abarca 270 grados y deja abajo un hueco, como un instrumento real. */
const SWEEP = 0.75;

export function FortnightGauge({
  fortnight,
  limit,
  today,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onCurrent,
}: Props): JSX.Element {
  const { i18n } = useI18n();
  const { t } = i18n;

  if (!fortnight) {
    return <div className="card empty">{t('gauge.empty')}</div>;
  }

  const position = positionOf(fortnight, today);
  const label = labelFor(position, t);
  const ratio = Math.min(1, fortnight.inSession / limit);
  const arc = CIRCUMFERENCE * SWEEP;
  const range = i18n.range(fortnight.start, fortnight.end);

  return (
    <section className="card gauge">
      <div className="gauge__dial">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img"
          aria-label={t('gauge.aria', { hours: fortnight.inSession, limit, range })}>
          <g transform={`rotate(135 ${SIZE / 2} ${SIZE / 2})`}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--paper-sunk)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${arc} ${CIRCUMFERENCE}`}
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              className={`is-${fortnight.status}`}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${arc * ratio} ${CIRCUMFERENCE}`}
              style={{ transition: 'stroke-dasharray var(--duration) var(--ease)' }}
            />
          </g>
        </svg>
        <div className="gauge__readout">
          <span className={`gauge__figure is-${fortnight.status}`}>{fortnight.inSession}</span>
          <span className="gauge__unit">{t('gauge.of', { limit })}</span>
        </div>
      </div>

      <div className="gauge__body">
        <div className="gauge__nav">
          <p className={`eyebrow is-${position}`}>{label}</p>
          <div className="gauge__steps">
            <button
              type="button"
              className="stepper"
              onClick={onPrev}
              disabled={!canPrev}
              aria-label={t('gauge.prev')}
            >
              ‹
            </button>
            <button
              type="button"
              className="stepper"
              onClick={onNext}
              disabled={!canNext}
              aria-label={t('gauge.next')}
            >
              ›
            </button>
          </div>
        </div>

        <h3>{headlineFor(fortnight, limit, position, t)}</h3>
        <p className="gauge__range">
          {range}
          {onCurrent && (
            <button type="button" className="linkish" onClick={onCurrent}>
              {t('gauge.backToCurrent')}
            </button>
          )}
        </p>

        <p className={`gauge__verdict is-${fortnight.status}`}>
          {verdictFor(position, fortnight.status, t)}
        </p>

        <div className="gauge__stats">
          <div>
            <span className="stat__label">{t('gauge.stat.total')}</span>
            <span className="stat__value">{fortnight.total} h</span>
          </div>
          <div>
            <span className="stat__label">{t('gauge.stat.conservative')}</span>
            <span className="stat__value">{fortnight.conservative} h</span>
          </div>
          <div>
            <span className="stat__label">{t('gauge.stat.breakDays')}</span>
            <span className="stat__value">{fortnight.breakDays}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
