import { useCallback, useEffect, useMemo, useState } from 'react';
import { FORM_URL } from '@shared/form/schema.ts';
import type { ReportEntry, ShiftReport } from '@shared/reports/types.ts';
import { api, ApiError, type ShiftReportsResponse } from '../lib/api.ts';
import { useI18n } from '../lib/i18n.tsx';
import { ShiftReportCard } from './ShiftReportCard.tsx';

type Tab = 'pending' | 'archived';

/** Un turno se archiva cuando lo marcaste como cargado en el formulario. Es el
 *  unico estado que significa "esto ya salio de mis manos". */
function isArchived(entry: ReportEntry): boolean {
  return entry.report?.status === 'submitted';
}

export function ShiftReports(): JSX.Element {
  const { i18n, locale } = useI18n();
  const { t } = i18n;
  const [data, setData] = useState<ShiftReportsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [checking, setChecking] = useState(false);
  /** Resultado de la ultima busqueda de turnos nuevos. */
  const [found, setFound] = useState<string | null>(null);

  const load = useCallback(async (): Promise<ShiftReportsResponse | null> => {
    try {
      const fresh = await api.shiftReports();
      setData(fresh);
      setError(null);
      return fresh;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('app.error.unexpected'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load, locale]);

  /** Al guardar una tarjeta se actualiza solo esa entrada: recargar todo
   *  desmontaria las demas y les borraria lo que estan escribiendo. */
  const handleSaved = useCallback((report: ShiftReport): void => {
    setData((current) =>
      current === null
        ? current
        : {
            ...current,
            entries: current.entries.map((entry) =>
              entry.shift.id === report.shiftId ? { ...entry, report } : entry,
            ),
          },
    );
  }, []);

  /** Trae turnos nuevos de Deputy y dice cuantos aparecieron para reportar.
   *
   *  Sincronizar es lo que hace aparecer un turno; sin esto habia que acordarse
   *  de tocar el boton de arriba y despues mirar si la lista habia crecido. */
  const checkNew = useCallback(async (): Promise<void> => {
    setChecking(true);
    setError(null);
    setFound(null);
    try {
      const before = new Set((data?.entries ?? []).map((entry) => entry.shift.id));
      const result = await api.sync();
      if (result.warning) setError(result.warning);
      const fresh = await load();
      const added = (fresh?.entries ?? []).filter((entry) => !before.has(entry.shift.id));
      setFound(
        added.length > 0 ? t('reports.foundNew', { count: added.length }) : t('reports.noNew'),
      );
      if (added.length > 0) setTab('pending');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('app.error.sync'));
    } finally {
      setChecking(false);
    }
  }, [data, load, t]);

  const { pending, archived } = useMemo(() => {
    const entries = data?.entries ?? [];
    return {
      pending: entries.filter((entry) => !isArchived(entry)),
      archived: entries.filter(isArchived),
    };
  }, [data]);

  if (loading) return <div className="card empty">{t('app.loading')}</div>;
  if (error && !data) {
    return (
      <div className="notice notice--error">
        <p>{error}</p>
      </div>
    );
  }
  if (!data) return <div className="card empty">{t('app.loading')}</div>;

  const shown = tab === 'pending' ? pending : archived;

  return (
    <>
      <div className="section__head">
        <h2>{t('section.reports.title')}</h2>
        <span className="section__note">
          {t('section.reports.note', {
            client: data.meta.clientName,
            from: i18n.date(data.meta.from),
            pending: pending.length,
          })}
          {' · '}
          <a className="linkish" href={FORM_URL} target="_blank" rel="noreferrer noopener">
            {t('reports.openForm')}
          </a>
        </span>
      </div>

      <div className="tabs">
        <div className="tabs__list" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pending'}
            className={`tab${tab === 'pending' ? ' tab--on' : ''}`}
            onClick={() => setTab('pending')}
          >
            {t('reports.tab.pending', { count: pending.length })}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'archived'}
            className={`tab${tab === 'archived' ? ' tab--on' : ''}`}
            onClick={() => setTab('archived')}
          >
            {t('reports.tab.archived', { count: archived.length })}
          </button>
        </div>

        <div className="tabs__actions">
          {found && <span className="section__note">{found}</span>}
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void checkNew()}
            disabled={checking}
          >
            {checking ? t('reports.checking') : t('reports.checkNew')}
          </button>
        </div>
      </div>

      {error && (
        <div className="notice notice--error">
          <p>{error}</p>
        </div>
      )}

      {!data.meta.hasApiKey && (
        <div className="notice notice--error">
          <p>{t('reports.noApiKey')}</p>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card empty">
          {tab === 'pending'
            ? t('reports.empty', { client: data.meta.clientName })
            : t('reports.emptyArchived')}
        </div>
      ) : (
        <div className="reports">
          {shown.map((entry) => (
            <ShiftReportCard
              key={entry.shift.id}
              entry={entry}
              behaviours={data.behaviours}
              tags={data.tags}
              formFields={data.fields}
              canDraft={data.meta.hasApiKey}
              collapsed={tab === 'archived'}
              onSaved={handleSaved}
            />
          ))}
        </div>
      )}
    </>
  );
}
