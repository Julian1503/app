/** OAuth 2.0 contra Deputy.
 *
 *  Autorizacion:  https://once.deputy.com/my/oauth/login
 *  Canje/refresh: https://once.deputy.com/my/oauth/access_token
 *
 *  El access token dura 24 h. Con el scope `longlife_refresh_token` Deputy
 *  devuelve un refresh token que se puede canjear indefinidamente, pero rota:
 *  cada canje invalida el anterior, asi que hay que guardar siempre el nuevo. */

import crypto from 'node:crypto';
import { config } from '../config.ts';
import { saveTokens, type TokenSet } from '../store/tokens.ts';
import { normalizeEndpoint } from './endpoint.ts';

const AUTHORIZE_URL = 'https://once.deputy.com/my/oauth/login';
const TOKEN_URL = 'https://once.deputy.com/my/oauth/access_token';
const SCOPE = 'longlife_refresh_token';

/** Margen antes del vencimiento para renovar y no quedar cortado a mitad de un sync. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface DeputyTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  endpoint?: string;
  error?: string;
  error_description?: string;
}

/** Estados pendientes del flujo, en memoria: si reinicias el server se pierden y hay que loguear de nuevo. */
const pendingStates = new Set<string>();

export function createAuthorizeUrl(): string {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.add(state);
  // Un login que quedo a medias no deberia bloquear el proximo intento.
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000).unref?.();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export function consumeState(state: string | undefined): boolean {
  if (!state || !pendingStates.has(state)) return false;
  pendingStates.delete(state);
  return true;
}

async function requestToken(body: Record<string, string>): Promise<TokenSet> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  const text = await response.text();
  let payload: DeputyTokenResponse;
  try {
    payload = JSON.parse(text) as DeputyTokenResponse;
  } catch {
    throw new Error(`Deputy respondio algo que no es JSON (${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok || payload.error || !payload.access_token || !payload.refresh_token) {
    const reason = payload.error_description ?? payload.error ?? `HTTP ${response.status}`;
    throw new Error(`Deputy rechazo la peticion de token: ${reason}`);
  }

  const expiresIn = payload.expires_in ?? 24 * 60 * 60;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
    endpoint: normalizeEndpoint(payload.endpoint),
    obtainedAt: Date.now(),
  };
}

export async function exchangeCode(code: string): Promise<TokenSet> {
  const tokens = await requestToken({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    scope: SCOPE,
    code,
  });
  await saveTokens(tokens);
  return tokens;
}

export async function refreshTokens(current: TokenSet): Promise<TokenSet> {
  const tokens = await requestToken({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    scope: SCOPE,
    refresh_token: current.refreshToken,
  });
  // Deputy no siempre repite el endpoint al refrescar: conservamos el que ya teniamos.
  const merged: TokenSet = { ...tokens, endpoint: tokens.endpoint ?? current.endpoint };
  await saveTokens(merged);
  return merged;
}

export function isExpired(tokens: TokenSet): boolean {
  return Date.now() >= tokens.expiresAt - REFRESH_MARGIN_MS;
}
