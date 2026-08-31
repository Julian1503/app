import {
  isUnavailable,
  UNAVAILABLE_OPTIONS,
  type FieldAnswer,
  type Gap,
} from '@shared/form/answers.ts';
import { useI18n } from '../lib/i18n.tsx';

interface Props {
  readonly gap: Gap;
  readonly answer: FieldAnswer | null;
  readonly onAnswer: (
    fieldId: string,
    values: readonly string[],
    status: 'confirmed' | 'unavailable',
  ) => void;
  /** Avisa que campo se esta tipeando, para que no se mueva mientras tanto. */
  readonly onEditing?: (fieldId: string | null) => void;
}

/** Los controles de un hueco: opciones rapidas o texto corto, mas las salidas
 *  de "no se puede saber".
 *
 *  Vive aparte porque se usa en dos lugares. Una respuesta contestada no deja
 *  de ser editable: sigue mostrando estos mismos controles desde el bloque al
 *  que se movio. Antes se convertia en texto plano al primer caracter, y en un
 *  multiple solo dejaba elegir una opcion. */
export function GapControls({ gap, answer, onAnswer, onEditing }: Props): JSX.Element {
  const { i18n } = useI18n();
  const { t } = i18n;

  const values = answer?.values ?? [];
  const typed = values.find((value) => !isUnavailable(value)) ?? '';

  return (
    <>
      {gap.options.length > 0 ? (
        <div className="picks">
          {gap.options.map((option) => {
            const on = values.includes(option);
            return (
              <button
                key={option}
                type="button"
                lang="en"
                className={`pick${on ? ' pick--on' : ''}`}
                onClick={() => {
                  // En un multiple se acumula; en uno simple se reemplaza. En
                  // ambos, volver a tocar la opcion elegida la saca.
                  const next = gap.multi
                    ? on
                      ? values.filter((value) => value !== option)
                      : [...values.filter((value) => !isUnavailable(value)), option]
                    : on
                      ? []
                      : [option];
                  onAnswer(gap.fieldId, next, 'confirmed');
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          type="text"
          className="behaviour__note"
          lang="en"
          placeholder={t('form.review.shortAnswer')}
          value={typed}
          onFocus={() => onEditing?.(gap.fieldId)}
          onBlur={() => onEditing?.(null)}
          onChange={(event) =>
            onAnswer(gap.fieldId, event.target.value ? [event.target.value] : [], 'confirmed')
          }
        />
      )}

      {/* Salidas legitimas: el formulario exige el campo, pero eso no obliga a
          inventar una respuesta. */}
      <div className="picks picks--out">
        {UNAVAILABLE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            lang="en"
            className={`pick pick--unsure${values.includes(option) ? ' pick--on' : ''}`}
            onClick={() =>
              onAnswer(gap.fieldId, values.includes(option) ? [] : [option], 'unavailable')
            }
          >
            {option}
          </button>
        ))}
      </div>
    </>
  );
}
