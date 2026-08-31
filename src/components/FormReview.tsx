import { useCallback, useMemo, useState } from 'react';
import {
  answerFor,
  isApplicable,
  missingFields,
  usableAnswers,
  type FieldAnswer,
  type Gap,
} from '@shared/form/answers.ts';
import { findField, type FormField } from '@shared/form/schema.ts';
import { useI18n } from '../lib/i18n.tsx';
import { GapControls } from './GapControls.tsx';

interface Props {
  readonly fields: readonly FormField[];
  readonly answers: readonly FieldAnswer[];
  readonly gaps: readonly Gap[];
  readonly onAnswer: (
    fieldId: string,
    values: readonly string[],
    status: 'confirmed' | 'unavailable',
  ) => void;
}

/** Donde vive una fila en la pantalla. */
type Block = 'gaps' | 'documented' | 'confirmed' | 'unavailable';

function label(field: FormField): string {
  return `Q${field.number} · ${field.label}`;
}

/** Revision del formulario en tres bloques: lo que ya esta, lo que falta
 *  confirmar y lo que no se puede saber.
 *
 *  La separacion es el punto de la pantalla. Un campo documentado trae su cita;
 *  uno pendiente es una pregunta; y "no se puede determinar" es una salida
 *  legitima y no un casillero que haya que rellenar con algo.
 *
 *  Contestar mueve el campo de bloque pero no lo congela: si tiene hueco, sigue
 *  mostrando sus controles y se puede corregir donde quedo. */
export function FormReview({ fields, answers, gaps, onAnswer }: Props): JSX.Element {
  const { i18n } = useI18n();
  const { t } = i18n;

  /** El campo que estas tipeando y en que bloque estaba al empezar.
   *
   *  Mientras tipeas se queda en el bloque donde arranco, pase lo que pase:
   *  contestarlo, vaciarlo, o que cambie de `documented` a `confirmed`. Cualquiera
   *  de esos saltos mueve el input en el DOM y Chrome le saca el foco, que es lo
   *  que dejaba entrar una sola letra. */
  const [editing, setEditing] = useState<{ fieldId: string; block: Block } | null>(null);

  /** Todos los campos que se contestan con controles: los que trajo la
   *  extraccion mas los que pasaron a aplicar despues.
   *
   *  Incluye los ya contestados a proposito. Contestar mueve el campo de bloque
   *  pero no lo congela: si no estuviera aca, la fila se dibujaria como texto
   *  plano y no habria forma de corregirla. */
  const editable = useMemo(() => {
    const map = new Map<string, Gap>();

    for (const gap of gaps) {
      const field = findField(gap.fieldId);
      if (field && isApplicable(field, answers)) map.set(gap.fieldId, gap);
    }

    // La extraccion corre antes que tus respuestas: Q16 depende de Q15, y cuando
    // se extrajo Q15 estaba vacia. Al contestarla, Q16 pasa a corresponder.
    for (const field of fields) {
      if (map.has(field.id)) continue;
      if (!field.required && field.showIf === null) continue;
      if (!isApplicable(field, answers)) continue;
      map.set(field.id, {
        fieldId: field.id,
        question: field.label,
        options: field.options,
        multi: field.kind === 'multi',
      });
    }

    return map;
  }, [gaps, fields, answers]);

  const usable = useMemo(() => usableAnswers(answers), [answers]);
  const unavailable = answers.filter(
    (answer) => answer.status === 'unavailable' && answer.values.length > 0,
  );

  /** Las filas de un bloque. El campo que estas editando pertenece al bloque
   *  donde arranco, sin importar su estado ni si quedo vacio: si la fila se
   *  moviera o desapareciera, el input se desmonta y no podrias seguir. */
  const rowsOf = useCallback(
    (block: Block): FieldAnswer[] =>
      answers.filter((answer) => {
        if (editing && editing.fieldId === answer.fieldId) return editing.block === block;
        return answer.status === block && answer.values.length > 0;
      }),
    [answers, editing],
  );

  const documented = rowsOf('documented');
  const confirmed = rowsOf('confirmed');

  /** Un campo sale de "requiere confirmacion" cuando tiene respuesta, salvo que
   *  lo estes tipeando: ese se queda en el bloque donde arranco. */
  const settled = useMemo(() => {
    const ids = new Set([
      ...usable.map((answer) => answer.fieldId),
      ...unavailable.map((answer) => answer.fieldId),
    ]);
    if (editing) {
      if (editing.block === 'gaps') ids.delete(editing.fieldId);
      else ids.add(editing.fieldId);
    }
    return ids;
  }, [usable, unavailable, editing]);

  const openGaps = useMemo(
    () =>
      [...editable.values()]
        .filter((gap) => !settled.has(gap.fieldId))
        .sort((a, b) => (findField(a.fieldId)?.number ?? 0) - (findField(b.fieldId)?.number ?? 0)),
    [editable, settled],
  );

  const stillMissing = useMemo(
    () => missingFields(fields.filter((field) => field.required), answers).length,
    [fields, answers],
  );

  /** Una fila del resumen. Si el campo tiene hueco, se muestra editable. */
  const row = (answer: FieldAnswer, block: Block, dimmed = false): JSX.Element | null => {
    const field = findField(answer.fieldId);
    if (!field) return null;
    const gap = editable.get(answer.fieldId);

    return (
      <li key={answer.fieldId} className={`frow${dimmed ? ' frow--out' : ''}`}>
        <span className="frow__q">{label(field)}</span>
        {gap ? (
          <div className="frow__edit">
            <GapControls
              gap={gap}
              answer={answer}
              onAnswer={onAnswer}
              onEditing={(id) => setEditing(id ? { fieldId: id, block } : null)}
            />
          </div>
        ) : (
          <span className="frow__v" lang="en">
            {answer.values.join('; ')}
          </span>
        )}
        {answer.evidence && answer.status === 'documented' && !gap && (
          <span className="frow__ev" lang="en">
            {answer.evidence}
          </span>
        )}
      </li>
    );
  };

  return (
    <section className="review">
      <div className="review__head">
        <h4>{t('form.review.title')}</h4>
        <span className="review__count">
          {t('form.review.count', { open: openGaps.length, required: stillMissing })}
        </span>
      </div>

      {documented.length > 0 && (
        <div className="review__block">
          <p className="review__label">{t('form.review.documented')}</p>
          <ul className="frows">{documented.map((answer) => row(answer, 'documented'))}</ul>
        </div>
      )}

      {confirmed.length > 0 && (
        <div className="review__block">
          <p className="review__label review__label--ok">{t('form.review.confirmed')}</p>
          <ul className="frows">{confirmed.map((answer) => row(answer, 'confirmed'))}</ul>
        </div>
      )}

      {openGaps.length > 0 && (
        <div className="review__block review__block--gaps">
          <p className="review__label review__label--warn">{t('form.review.needed')}</p>
          <ol className="gaps">
            {openGaps.map((gap) => {
              const field = findField(gap.fieldId);
              return (
                <li key={gap.fieldId} className="gap">
                  <p className="gap__q">
                    {field && <span className="gap__field">{label(field)}</span>}
                    <span lang="en">{gap.question}</span>
                  </p>
                  <GapControls
                    gap={gap}
                    answer={answerFor(answers, gap.fieldId)}
                    onAnswer={onAnswer}
                    onEditing={(id) => setEditing(id ? { fieldId: id, block: 'gaps' } : null)}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {unavailable.length > 0 && (
        <div className="review__block">
          <p className="review__label">{t('form.review.unavailable')}</p>
          <ul className="frows">{unavailable.map((answer) => row(answer, 'unavailable', true))}</ul>
        </div>
      )}

      <p className="review__foot">{t('form.review.foot')}</p>
    </section>
  );
}
