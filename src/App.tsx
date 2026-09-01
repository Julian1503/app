import { useCallback, useEffect, useRef, useState } from 'react';
import { BackPayNote } from './components/BackPayNote.tsx';
import { ConnectBar } from './components/ConnectBar.tsx';
import { PayslipUpload } from './components/PayslipUpload.tsx';
import { SignOutButton } from './components/SessionGate.tsx';
import { DropPlan } from './components/DropPlan.tsx';
import { FindingsList } from './components/FindingsList.tsx';
import { FortnightGauge } from './components/FortnightGauge.tsx';
import { FortnightLadder } from './components/FortnightLadder.tsx';
import { LanguageToggle } from './components/LanguageToggle.tsx';
import { PayCheque } from './components/PayCheque.tsx';
import { PayslipTable } from './components/PayslipTable.tsx';
import { PayWeeks } from './components/PayWeeks.tsx';
import { ShiftReports } from './components/ShiftReports.tsx';
import { api, ApiError, type AuthStatus, type ReportResponse } from './lib/api.ts';
import { useI18n } from './lib/i18n.tsx';

const TODAY = new Date().toISOString().slice(0, 10);

/** Lee el resultado del callback OAuth y limpia la URL para no repetir el aviso. */
function readAuthFeedback(): string | null {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('auth_error');
  const ok = params.get('auth');
  if (!error && !ok) return null;
  window.history.replaceState({}, '', window.location.pathname);
  return error;
}

export function App(): JSX.Element {
  const { i18n, locale } = useI18n();
  const { t, money } = i18n;
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  /** null = seguir a la quincena vigente; si el usuario navega, queda fijada aca. */
  const [pinnedStart, setPinnedStart] = useState<string | null>(null);
  /** null = seguir al proximo pago; si el usuario elige otra semana, queda aca. */
  const [pinnedPayWeek, setPinnedPayWeek] = useState<string | null>(null);
  const gaugeRef = useRef<HTMLElement>(null);
  const chequeRef = useRef<HTMLElement>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [authStatus, report] = await Promise.all([api.authStatus(), api.report()]);
      setStatus(authStatus);
      setData(report);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('app.error.unexpected'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const feedback = readAuthFeedback();
    if (feedback) setError(t('app.error.auth', { reason: feedback }));
    // Solo al montar: el mensaje del callback OAuth se lee una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Los hallazgos se redactan en el servidor, asi que cambiar de idioma obliga a
  // volver a pedir el reporte.
  useEffect(() => {
    void load();
  }, [load, locale]);

  const handleSync = useCallback(async (): Promise<void> => {
    setSyncing(true);
    setError(null);
    try {
      const result = await api.sync();
      if (result.warning) setError(result.warning);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('app.error.sync'));
    } finally {
      setSyncing(false);
    }
  }, [load, t]);

  const handleLogout = useCallback(async (): Promise<void> => {
    await api.logout();
    await load();
  }, [load]);

  const report = data?.report;
  const overFortnights = (report?.fortnights ?? []).filter(
    (fortnight) => fortnight.status === 'over' && fortnight.end >= TODAY,
  );

  // Si tras un sync la quincena fijada ya no existe, el indice cae en -1 y se
  // vuelve sola a la vigente en vez de quedar en un panel vacio.
  const fortnights = report?.fortnights ?? [];
  const activeStart = pinnedStart ?? report?.current?.start ?? null;
  const activeIndex = fortnights.findIndex((fortnight) => fortnight.start === activeStart);
  const active = activeIndex >= 0 ? fortnights[activeIndex]! : (report?.current ?? null);

  const step = useCallback(
    (delta: number): void => {
      const next = fortnights[activeIndex + delta];
      if (next) setPinnedStart(next.start);
    },
    [fortnights, activeIndex],
  );

  const scrollTo = useCallback((target: HTMLElement | null): void => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  }, []);

  /** Al elegir desde la escalera el panel queda fuera de vista: se lo trae. */
  const selectFromLadder = useCallback(
    (start: string): void => {
      setPinnedStart(start);
      scrollTo(gaugeRef.current);
    },
    [scrollTo],
  );

  const selectPayWeek = useCallback(
    (start: string): void => {
      setPinnedPayWeek(start);
      scrollTo(chequeRef.current);
    },
    [scrollTo],
  );

  const payWeeks = report?.pay.weeks ?? [];
  const activeCheque =
    (pinnedPayWeek ? payWeeks.find((week) => week.weekStart === pinnedPayWeek) : null) ??
    report?.pay.next ??
    null;

  return (
    <div className="shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">{t('app.eyebrow')}</p>
          <h1>{t('app.title')}</h1>
        </div>
        <div className="masthead__meta">
          <LanguageToggle />
          <SignOutButton />
          {status?.configured && status.authenticated && (
            <ConnectBar
              status={status}
              lastSyncAt={data?.meta.lastSyncAt ?? null}
              syncing={syncing}
              onSync={handleSync}
              onLogout={handleLogout}
            />
          )}
        </div>
      </header>

      {/* Sin sesion el panel va debajo del masthead, con el llamado a la accion completo. */}
      {status && !(status.configured && status.authenticated) && (
        <ConnectBar
          status={status}
          lastSyncAt={null}
          syncing={syncing}
          onSync={handleSync}
          onLogout={handleLogout}
        />
      )}

      {error && (
        <div className="notice notice--error">
          <p>{error}</p>
        </div>
      )}

      {loading && <div className="card empty">{t('app.loading')}</div>}

      {report && (
        <>
          <section className="section" ref={gaugeRef}>
            <FortnightGauge
              fortnight={active}
              limit={report.limit}
              today={TODAY}
              canPrev={activeIndex > 0}
              canNext={activeIndex >= 0 && activeIndex < fortnights.length - 1}
              onPrev={() => step(-1)}
              onNext={() => step(1)}
              onCurrent={
                pinnedStart && pinnedStart !== report.current?.start
                  ? () => setPinnedStart(null)
                  : null
              }
            />
          </section>

          <section className="section" ref={chequeRef}>
            <div className="section__head">
              <h2>{t('section.pay.title')}</h2>
              <span className="section__note">
                {t('section.pay.note', { taxYear: report.pay.taxYear })}
                {pinnedPayWeek && pinnedPayWeek !== report.pay.next?.weekStart && (
                  <>
                    {' · '}
                    <button type="button" className="linkish" onClick={() => setPinnedPayWeek(null)}>
                      {t('section.pay.back')}
                    </button>
                  </>
                )}
              </span>
            </div>
            <PayCheque forecast={activeCheque} taxYear={report.pay.taxYear} />
          </section>

          <section className="section">
            <div className="section__head">
              <h2>{t('section.weeks.title')}</h2>
              <span className="section__note">
                {t('section.weeks.note', {
                  year: report.pay.yearToDate.financialYear,
                  gross: money(report.pay.yearToDate.gross),
                  tax: money(report.pay.yearToDate.tax),
                  superannuation: money(report.pay.yearToDate.superannuation),
                  count: report.pay.yearToDate.payslips,
                })}
              </span>
            </div>
            <BackPayNote rollup={report.pay.backPay} />
            <PayWeeks
              weeks={payWeeks}
              today={TODAY}
              selectedStart={activeCheque?.weekStart ?? null}
              onSelect={selectPayWeek}
            />
          </section>

          <section className="section">
            <div className="section__head">
              <h2>{t('section.drop.title')}</h2>
              <span className="section__note">
                {t('section.drop.note', { count: overFortnights.length })}
              </span>
            </div>
            <DropPlan
              plan={report.dropPlan}
              overFortnights={overFortnights}
              limit={report.limit}
            />
          </section>

          <section className="section">
            <div className="section__head">
              <h2>{t('section.findings.title')}</h2>
              <span className="section__note">
                {t('section.findings.note', {
                  count: report.findings.length,
                  shortfall: money(report.totals.payShortfall),
                  km: money(report.totals.moneyOwed),
                  recovered: money(report.totals.payRecovered),
                  hasRecovered: report.totals.payRecovered > 0,
                })}
              </span>
            </div>
            <FindingsList findings={report.findings} />
          </section>

          <section className="section">
            <ShiftReports />
          </section>

          <section className="section">
            <div className="section__head">
              <h2>{t('section.fortnights.title')}</h2>
              <span className="section__note">
                {t('section.fortnights.note', { limit: report.limit })}
              </span>
            </div>
            <FortnightLadder
              fortnights={report.fortnights}
              limit={report.limit}
              today={TODAY}
              selectedStart={active?.start ?? null}
              onSelect={selectFromLadder}
            />
          </section>

          <section className="section">
            <div className="section__head">
              <h2>{t('section.payslips.title')}</h2>
              <span className="section__note">
                {t('section.payslips.note', {
                  files: data.meta.payslipFiles,
                  paid: report.totals.paidHours,
                  roster: report.totals.rosterHours,
                })}
              </span>
              <PayslipUpload onDone={() => void load()} />
            </div>
            <PayslipTable payslips={report.payslips} />
            {data.meta.payslipFailures.length > 0 && (
              <div className="notice notice--error">
                <p>
                  {t('section.payslips.failures', {
                    count: data.meta.payslipFailures.length,
                    files: data.meta.payslipFailures.map((failure) => failure.file).join(', '),
                  })}
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
