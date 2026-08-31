import { useCallback, useMemo, useState } from 'react';
import { formatMinute } from '@shared/dates.ts';
import type { FieldAnswer, Gap } from '@shared/form/answers.ts';
import { buildBookmarklet } from '@shared/form/bookmarklet.ts';
import { FORM_URL, type FormField } from '@shared/form/schema.ts';
import type { Behaviour } from '@shared/reports/behaviours.ts';
import { TAG_GROUPS, type PresentationTag, type TagGroup } from '@shared/reports/tags.ts';
import type { ReportEntry, ShiftReport } from '@shared/reports/types.ts';
import { api, ApiError, type ShiftReportInput } from '../lib/api.ts';
import { useI18n } from '../lib/i18n.tsx';
import { FormReview } from './FormReview.tsx';

interface Props {
  readonly entry: ReportEntry;
  readonly behaviours: readonly Behaviour[];
  readonly tags: readonly PresentationTag[];
  readonly formFields: readonly FormField[];
  readonly canDraft: boolean;
  /** Arranca plegada. Las archivadas se pliegan para no tapar el trabajo vivo. */
  readonly collapsed?: boolean;
  readonly onSaved: (report: ShiftReport) => void;
}

/** Estado de una conducta en la carga manual. `value` viaja como texto porque el
 *  input vacio no es 0: es "no lo contabilice". */
interface FieldState {
  readonly ticked: boolean;
  readonly value: string;
  readonly note: string;
}

const EMPTY_FIELD: FieldState = { ticked: false, value: '', note: '' };

function initialFields(
  report: ShiftReport | null,
  behaviours: readonly Behaviour[],
): Record<string, FieldState> {
  const fields: Record<string, FieldState> = {};
  for (const behaviour of behaviours) {
    const saved = report?.observations.find((entry) => entry.behaviourId === behaviour.id);
    fields[behaviour.id] = saved
      ? { ticked: true, value: saved.value === null ? '' : String(saved.value), note: saved.note }
      : EMPTY_FIELD;
  }
  return fields;
}

/** Un numero mal tipeado viaja como "sin contabilizar" en vez de como NaN, que
 *  el servidor descartaria en silencio. */
function readValue(raw: string): number | null {
  if (raw.trim() === '') return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function ShiftReportCard({
  entry,
  behaviours,
  tags,
  formFields,
  canDraft,
  collapsed = false,
  onSaved,
}: Props): JSX.Element {
  const { i18n, locale } = useI18n();
  const { t } = i18n;
  const { shift, report } = entry;

  const [fields, setFields] = useState(() => initialFields(report, behaviours));
  const [picked, setPicked] = useState<readonly string[]>(report?.presentationTags ?? []);
  const [presentation, setPresentation] = useState(report?.presentation ?? '');
  const [support, setSupport] = useState(report?.support ?? '');
  const [formAnswers, setFormAnswers] = useState<readonly FieldAnswer[]>(report?.formAnswers ?? []);
  const [gaps, setGaps] = useState<readonly Gap[]>(report?.gaps ?? []);
  const [status, setStatus] = useState<ShiftReport['status']>(report?.status ?? 'pending');
  const [draft, setDraft] = useState(report?.draft ?? null);
  const [draftedAt, setDraftedAt] = useState(report?.draftedAt ?? null);
  const [busy, setBusy] = useState<'save' | 'extract' | 'finalise' | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  /** Detalle abierto: la nota y el conteo solo estorban hasta que hacen falta. */
  const [expanded, setExpanded] = useState<readonly string[]>([]);
  const [open, setOpen] = useState(!collapsed);

  const ticked = useMemo(
    () => Object.values(fields).filter((field) => field.ticked).length,
    [fields],
  );
  const comment = shift.employeeComment?.trim();
  /** Hay de donde mapear: la nota de Deputy, o algo cargado a mano. */
  const hasMaterial =
    ticked > 0 || picked.length > 0 || presentation.trim().length > 0 || Boolean(comment);
  const mapped = formAnswers.length > 0;

  const toInput = useCallback(
    (nextStatus: ShiftReport['status'] = status): ShiftReportInput => ({
      observations: Object.entries(fields)
        .filter(([, field]) => field.ticked)
        .map(([behaviourId, field]) => ({
          behaviourId,
          value: readValue(field.value),
          note: field.note,
        })),
      presentationTags: [...picked],
      presentation,
      support,
      formAnswers: [...formAnswers],
      gaps: [...gaps],
      status: nextStatus,
    }),
    [fields, picked, presentation, support, formAnswers, gaps, status],
  );

  const update = useCallback((id: string, patch: Partial<FieldState>): void => {
    setFields((current) => ({ ...current, [id]: { ...(current[id] ?? EMPTY_FIELD), ...patch } }));
  }, []);

  const toggleTag = useCallback((id: string): void => {
    setPicked((current) =>
      current.includes(id) ? current.filter((tag) => tag !== id) : [...current, id],
    );
  }, []);

  const toggleExpanded = useCallback((id: string): void => {
    setExpanded((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }, []);

  const save = useCallback(
    async (nextStatus: ShiftReport['status'] = status): Promise<void> => {
      setBusy('save');
      setError(null);
      try {
        const result = await api.saveShiftReport(shift.id, toInput(nextStatus));
        setStatus(result.status);
        onSaved(result);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('app.error.unexpected'));
      } finally {
        setBusy(null);
      }
    },
    [shift.id, toInput, status, onSaved, t],
  );

  /** Etapa 1: mapea la nota de Deputy a los campos del formulario. */
  const extract = useCallback(async (): Promise<void> => {
    setBusy('extract');
    setError(null);
    try {
      const result = await api.extractForm(shift.id, toInput());
      setFormAnswers(result.formAnswers);
      setGaps(result.gaps);
      onSaved(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('app.error.unexpected'));
    } finally {
      setBusy(null);
    }
  }, [shift.id, toInput, onSaved, t]);

  /** Etapa 2: redacta los campos de texto y arma el formulario para pegar. */
  const finalise = useCallback(async (): Promise<void> => {
    setBusy('finalise');
    setError(null);
    try {
      const result = await api.finaliseForm(shift.id, toInput());
      setFormAnswers(result.formAnswers);
      setDraft(result.draft);
      setDraftedAt(result.draftedAt);
      setStatus(result.status);
      onSaved(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('app.error.unexpected'));
    } finally {
      setBusy(null);
    }
  }, [shift.id, toInput, onSaved, t]);

  /** Una respuesta del panel de revision. Vacia borra la anterior. */
  const answerField = useCallback(
    (
      fieldId: string,
      values: readonly string[],
      answerStatus: 'confirmed' | 'unavailable',
    ): void => {
      setFormAnswers((current) => {
        const next: FieldAnswer = {
          fieldId,
          values: [...values],
          status: answerStatus,
          evidence: answerStatus === 'confirmed' ? 'Confirmed by the worker' : '',
        };

        // Se reemplaza en su lugar, incluso al vaciarla. Sacarla y volver a
        // agregarla al final reordenaba la lista en cada tecla: el DOM movia el
        // input y Chrome le sacaba el foco, asi que solo entraba una letra.
        // Una entrada con `values` vacio no cuenta como respuesta: `usableAnswers`
        // la descarta, y no llega ni al formulario ni al marcador.
        const index = current.findIndex((answer) => answer.fieldId === fieldId);
        if (index === -1) return values.length === 0 ? current : [...current, next];
        const copy = [...current];
        copy[index] = next;
        return copy;
      });
    },
    [],
  );

  /** El marcador lleva las respuestas de este turno adentro, asi que se copia de
   *  nuevo cada vez que regeneras el formulario. */
  const copyBookmarklet = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(buildBookmarklet(formAnswers, shift.date));
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 4000);
    } catch {
      setCopiedLink(false);
    }
  }, [formAnswers, shift.date]);

  const copy = useCallback(async (): Promise<void> => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }, [draft]);

  return (
    <article className={`card report report--${status}`}>
      <header className="report__head">
        <div>
          <p className="eyebrow">{i18n.date(shift.date)}</p>
          <h3>
            {formatMinute(shift.startMinute)}&ndash;{formatMinute(shift.endMinute)}
            {shift.area ? <span className="report__area"> · {shift.area}</span> : null}
          </h3>
        </div>
        <div className="report__headActions">
          <span className={`pill pill--${status}`}>{t(`reports.status.${status}`)}</span>
          {collapsed && (
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
            >
              {open ? t('reports.collapse') : t('reports.expand')}
            </button>
          )}
          {canDraft && (
            <button
              type="button"
              className="button button--ghost"
              onClick={() => void extract()}
              disabled={busy !== null || !hasMaterial}
              title={t('form.mapHint')}
            >
              {busy === 'extract' ? t('form.mapping') : t('form.map')}
            </button>
          )}
        </div>
      </header>

      {!open && (
        <p className="report__folded">
          {t('reports.foldedSummary', {
            answers: formAnswers.length,
            when: draftedAt ? i18n.dateTime(draftedAt) : '—',
          })}
        </p>
      )}

      {open && (
        <p className="report__deputy">
          <span className="report__deputyLabel">{t('reports.deputyComment')}: </span>
          {comment ? comment : <em>{t('reports.noDeputyComment')}</em>}
        </p>
      )}

      {open && mapped && (
        <FormReview fields={formFields} answers={formAnswers} gaps={gaps} onAnswer={answerField} />
      )}

      {/* La carga manual queda abierta hasta que hay mapeo, y despues se pliega:
          una vez que el formulario esta armado, lo que importa es revisarlo. */}
      {open && (
      <details className="report__extra" open={!mapped}>
        <summary>{t('form.manualEntry')}</summary>

        <fieldset className="report__behaviours">
          <legend>{t('reports.behaviours')}</legend>
          <p className="section__note">{t('reports.behavioursNote')}</p>
          {behaviours.map((behaviour) => {
            const field = fields[behaviour.id] ?? EMPTY_FIELD;
            const open = expanded.includes(behaviour.id);
            return (
              <div key={behaviour.id} className="behaviour">
                <div className="behaviour__line">
                  <label className="behaviour__tick">
                    <input
                      type="checkbox"
                      checked={field.ticked}
                      onChange={(event) => update(behaviour.id, { ticked: event.target.checked })}
                    />
                    <span lang="en">{behaviour.label}</span>
                    <span className="behaviour__where">Q{behaviour.formField.slice(1)}</span>
                  </label>
                  {field.ticked && (
                    <div className="behaviour__quick">
                      <label className="behaviour__count">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={field.value}
                          onChange={(event) => update(behaviour.id, { value: event.target.value })}
                        />
                        <span>{t(`reports.unit.${behaviour.unit}`)}</span>
                      </label>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => toggleExpanded(behaviour.id)}
                      >
                        {open ? t('reports.lessDetail') : t('reports.moreDetail')}
                      </button>
                    </div>
                  )}
                </div>

                {field.ticked && open && (
                  <div className="behaviour__detail">
                    <div className="picks">
                      {behaviour.contexts.map((context) => (
                        <button
                          key={context}
                          type="button"
                          className={`pick${field.note === context ? ' pick--on' : ''}`}
                          lang="en"
                          onClick={() =>
                            update(behaviour.id, { note: field.note === context ? '' : context })
                          }
                        >
                          {context}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      className="behaviour__note"
                      placeholder={t('reports.notePlaceholder')}
                      value={field.note}
                      onChange={(event) => update(behaviour.id, { note: event.target.value })}
                    />
                    <p className="behaviour__hint">{behaviour.hint}</p>
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>

        <fieldset className="report__behaviours">
          <legend>{t('reports.presentation.label')}</legend>
          <p className="section__note">{t('reports.presentationNote')}</p>
          {TAG_GROUPS.map((group: TagGroup) => (
            <div key={group} className="taggroup">
              <span className="taggroup__label">{t(`reports.group.${group}`)}</span>
              <div className="picks">
                {tags
                  .filter((tag) => tag.group === group)
                  .map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={`pick${picked.includes(tag.id) ? ' pick--on' : ''}`}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {locale === 'es' ? tag.labelEs : tag.label}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </fieldset>

        <label className="report__field">
          <span>{t('reports.support.label')}</span>
          <textarea
            rows={2}
            value={support}
            placeholder={t('reports.support.placeholder')}
            onChange={(event) => setSupport(event.target.value)}
          />
        </label>

        <label className="report__field">
          <span>{t('reports.presentation.freeText')}</span>
          <textarea
            rows={2}
            value={presentation}
            placeholder={t('reports.presentation.placeholder')}
            onChange={(event) => setPresentation(event.target.value)}
          />
        </label>
      </details>
      )}

      {error && <p className="report__error">{error}</p>}
      {open && !hasMaterial && <p className="report__hint">{t('reports.needMaterial')}</p>}

      {open && (
      <div className="report__actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => void save()}
          disabled={busy !== null}
        >
          {busy === 'save' ? t('reports.saving') : saved ? t('reports.saved') : t('reports.save')}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => void finalise()}
          disabled={busy !== null || !mapped || !canDraft}
        >
          {busy === 'finalise' ? t('form.generating') : t('form.generate')}
        </button>
      </div>
      )}

      {open && draft && (
        <div className="report__draft">
          <div className="section__head">
            <h2>{t('form.output')}</h2>
            {draftedAt && (
              <span className="section__note">
                {t('reports.draftedAt', { when: i18n.dateTime(draftedAt) })}
              </span>
            )}
          </div>
          {/* El orden de la pantalla es el orden de los pasos: copiar el
              marcador, abrir el formulario, y ahi tocarlo. */}
          <ol className="steps">
            <li>{t('form.step.copy')}</li>
            <li>{t('form.step.open')}</li>
            <li>{t('form.step.click')}</li>
          </ol>
          {/* `key` fuerza el remontaje: sin eso el textarea, que no es controlado,
              se queda con la version anterior al volver a generar. */}
          <textarea
            key={draft}
            className="draft draft--form"
            defaultValue={draft}
            spellCheck={false}
            lang="en"
          />
          <div className="report__actions">
            <button type="button" className="button" onClick={() => void copyBookmarklet()}>
              {copiedLink ? t('form.bookmarkletCopied') : t('form.bookmarklet')}
            </button>
            <a
              className="button button--ghost"
              href={FORM_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('form.openForm')}
            </a>
            <button type="button" className="button button--ghost" onClick={() => void copy()}>
              {copied ? t('reports.copied') : t('reports.copy')}
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => void save(status === 'submitted' ? 'drafted' : 'submitted')}
              disabled={busy !== null}
            >
              {status === 'submitted' ? t('reports.unmarkSubmitted') : t('reports.markSubmitted')}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
