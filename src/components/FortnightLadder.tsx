import type { Fortnight } from '@shared/types.ts';
import { useI18n } from '../lib/i18n.tsx';

interface Props {
  readonly fortnights: readonly Fortnight[];
  readonly limit: number;
  readonly today: string;
  readonly selectedStart: string | null;
  readonly onSelect: (start: string) => void;
}

/** La escala llega hasta 1.5x el límite para que un exceso se vea como exceso
 *  y no como una barra llena más. */
const SCALE_HEADROOM = 1.5;

export function FortnightLadder({
  fortnights,
  limit,
  today,
  selectedStart,
  onSelect,
}: Props): JSX.Element {
  const { i18n } = useI18n();

  if (fortnights.length === 0) {
    return <div className="card empty">{i18n.t('ladder.empty')}</div>;
  }

  const maxValue = limit * SCALE_HEADROOM;

  return (
    <div className="card ladder">
      {fortnights.map((fortnight) => {
        const width = Math.min(100, (fortnight.inSession / maxValue) * 100);
        const isFuture = fortnight.end >= today;
        const isSelected = fortnight.start === selectedStart;
        return (
          <button
            type="button"
            key={fortnight.start}
            className={`rung${isFuture ? ' rung--future' : ''}${isSelected ? ' rung--selected' : ''}`}
            onClick={() => onSelect(fortnight.start)}
            aria-current={isSelected ? 'true' : undefined}
            title={i18n.t('ladder.tooltip', {
              inSession: fortnight.inSession,
              total: fortnight.total,
              breakDays: fortnight.breakDays,
            })}
          >
            <span className="rung__range">{i18n.range(fortnight.start, fortnight.end)}</span>
            <div className="rung__track">
              <div
                className={`rung__fill is-${fortnight.status}`}
                style={{ width: `${width}%`, background: 'currentColor' }}
              />
              <div className="rung__limit" style={{ left: `${(limit / maxValue) * 100}%` }} />
            </div>
            <span className={`rung__value is-${fortnight.status}`}>{fortnight.inSession} h</span>
          </button>
        );
      })}
    </div>
  );
}
