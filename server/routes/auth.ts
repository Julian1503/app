/** Rutas del flujo OAuth con Deputy. */

import { Router } from 'express';
import { config, hasOAuthCredentials } from '../config.ts';
import { createAuthorizeUrl, exchangeCode } from '../deputy/oauth.ts';
import { consumeState } from '../db/oauth-states.ts';
import { fetchIdentity, isAuthenticated } from '../deputy/client.ts';
import { clearTokens } from '../store/tokens.ts';
import { createI18n, resolveLocale } from '../../shared/i18n/index.ts';

export const authRouter = Router();

authRouter.get('/status', async (_req, res) => {
  const configured = hasOAuthCredentials();
  const authenticated = configured && (await isAuthenticated());

  if (!authenticated) {
    res.json({ configured, authenticated: false, identity: null, redirectUri: config.redirectUri });
    return;
  }

  try {
    const identity = await fetchIdentity();
    res.json({ configured, authenticated: true, identity, redirectUri: config.redirectUri });
  } catch (error) {
    // Hay tokens guardados pero Deputy no responde: se informa sin romper la UI.
    res.json({
      configured,
      authenticated: true,
      identity: null,
      redirectUri: config.redirectUri,
      warning: (error as Error).message,
    });
  }
});

authRouter.get('/login', async (req, res, next) => {
  try {
    if (!hasOAuthCredentials()) {
      const { t } = createI18n(resolveLocale(req.query.locale));
      res.status(400).json({ error: t('server.auth.missingCredentials') });
      return;
    }
    res.redirect(await createAuthorizeUrl());
  } catch (error) {
    next(error);
  }
});

authRouter.get('/callback', async (req, res) => {
  const { code, state, error, error_description: description } = req.query;

  if (typeof error === 'string') {
    const reason = typeof description === 'string' ? description : error;
    res.redirect(`${config.webOrigin}/?auth_error=${encodeURIComponent(reason)}`);
    return;
  }

  if (typeof code !== 'string' || code.length === 0) {
    res.redirect(`${config.webOrigin}/?auth_error=${encodeURIComponent('Deputy no devolvio ningun codigo')}`);
    return;
  }

  if (!(await consumeState(typeof state === 'string' ? state : undefined))) {
    res.redirect(
      `${config.webOrigin}/?auth_error=${encodeURIComponent('El estado del login no coincide. Volve a intentar desde la app.')}`,
    );
    return;
  }

  try {
    await exchangeCode(code);
    res.redirect(`${config.webOrigin}/?auth=ok`);
  } catch (err) {
    res.redirect(`${config.webOrigin}/?auth_error=${encodeURIComponent((err as Error).message)}`);
  }
});

authRouter.post('/logout', async (_req, res) => {
  await clearTokens();
  res.json({ ok: true });
});
