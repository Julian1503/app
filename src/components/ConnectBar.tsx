import { api, type AuthStatus } from '../lib/api.ts';
import { useI18n } from '../lib/i18n.tsx';

interface Props {
  readonly status: AuthStatus | null;
  readonly lastSyncAt: string | null;
  readonly syncing: boolean;
  readonly onSync: () => void;
  readonly onLogout: () => void;
}

export function ConnectBar({ status, lastSyncAt, syncing, onSync, onLogout }: Props): JSX.Element {
  const { i18n } = useI18n();
  const { t } = i18n;

  if (!status?.configured) {
    return (
      <div className="notice notice--error">
        <p>
          {t('connect.missing.lead')}{' '}
          <code>{status?.redirectUri ?? 'http://localhost:8787/api/auth/callback'}</code>{' '}
          {t('connect.missing.tail')}
        </p>
      </div>
    );
  }

  if (!status.authenticated) {
    return (
      <div className="notice notice--info">
        <p>{t('connect.notAuthorised')}</p>
        {/* La URL de login se arma con el token de sesion, asi que hay que
            resolverla antes de navegar: un href no puede esperar una promesa. */}
        <button
          className="button"
          onClick={() => {
            void api.loginUrl().then((url) => {
              window.location.href = url;
            });
          }}
        >
          {t('connect.login')}
        </button>
      </div>
    );
  }

  return (
    <div className="masthead__meta">
      <span>
        {status.identity?.name ?? t('connect.session')}
        {status.identity?.company ? ` · ${status.identity.company}` : ''}
      </span>
      <span>
        {t('connect.lastSync', {
          when: lastSyncAt ? i18n.dateTime(lastSyncAt) : t('connect.never'),
        })}
      </span>
      <button type="button" className="button" onClick={onSync} disabled={syncing}>
        {syncing ? t('connect.syncing') : t('connect.sync')}
      </button>
      <button type="button" className="button button--ghost" onClick={onLogout}>
        {t('connect.logout')}
      </button>
    </div>
  );
}
