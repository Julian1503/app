/** Cliente HTTP autenticado contra el install de Deputy.
 *  Renueva el access token solo cuando esta por vencer. */

import { config } from '../config.ts';
import { clearTokens, loadTokens, type TokenSet } from '../store/tokens.ts';
import { normalizeEndpoint } from './endpoint.ts';
import { isExpired, refreshTokens } from './oauth.ts';

export class NotAuthenticatedError extends Error {
  constructor(message = 'No hay sesion de Deputy. Entra desde la app para autorizarla.') {
    super(message);
    this.name = 'NotAuthenticatedError';
  }
}

async function currentTokens(): Promise<TokenSet> {
  const stored = await loadTokens();
  if (!stored) throw new NotAuthenticatedError();
  if (!isExpired(stored)) return stored;

  try {
    return await refreshTokens(stored);
  } catch (error) {
    // Un refresh token invalidado no se recupera: hay que volver a autorizar.
    await clearTokens();
    throw new NotAuthenticatedError(
      `La sesion de Deputy vencio y no se pudo renovar (${(error as Error).message}). Volve a entrar.`,
    );
  }
}

function baseUrl(tokens: TokenSet): string {
  // Los tokens guardados antes de normalizar el endpoint pueden no traer esquema.
  const endpoint = normalizeEndpoint(tokens.endpoint) ?? config.installUrl;
  if (!endpoint) {
    throw new Error(
      'No se conoce la URL del install de Deputy. Configura DEPUTY_INSTALL_URL en el .env.',
    );
  }
  return endpoint;
}

export async function deputyFetch<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  const tokens = await currentTokens();
  const url = `${baseUrl(tokens)}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await response.text();

  if (response.status === 401 || /no authorization given/i.test(text)) {
    throw new NotAuthenticatedError('Deputy rechazo el token. Volve a autorizar la app.');
  }

  // Un 403 con otro mensaje es un permiso que falta sobre ese recurso puntual,
  // no una sesion vencida: reautorizar no lo arregla.
  if (response.status === 403) {
    throw new Error(`Deputy nego el acceso a ${path}: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`Deputy respondio ${response.status} en ${path}: ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Deputy devolvio una respuesta no-JSON en ${path}: ${text.slice(0, 200)}`);
  }
}

export interface DeputyIdentity {
  readonly employeeId: number | null;
  readonly name: string | null;
  readonly company: string | null;
}

/** `/api/v1/me` es el "Who am I" documentado para OAuth; `/api/me/v2` es el que usa
 *  la web de Deputy. Probamos el documentado primero y caemos al otro si no responde. */
const ME_ENDPOINTS = ['/api/v1/me', '/api/me/v2'] as const;

function pickNumber(source: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function pickString(source: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
}

/** Resuelve quien sos dentro del install, para no depender de un id fijo en el .env. */
export async function fetchIdentity(): Promise<DeputyIdentity> {
  let lastError: unknown = null;
  for (const endpoint of ME_ENDPOINTS) {
    try {
      const me = await deputyFetch<Record<string, unknown>>(endpoint);
      return {
        employeeId: pickNumber(me, ['EmployeeId', 'Employee', 'Id']) ?? config.employeeId ?? null,
        name: pickString(me, ['Name', 'DisplayName']),
        company: pickString(me, ['Company', 'CompanyName']),
      };
    } catch (error) {
      // Un token invalido no mejora cambiando de endpoint: cortamos ahi.
      if (error instanceof NotAuthenticatedError) throw error;
      lastError = error;
    }
  }

  throw new Error(
    `Ningun endpoint de identidad de Deputy respondio (${ME_ENDPOINTS.join(', ')}): ${
      (lastError as Error)?.message ?? 'sin detalle'
    }`,
  );
}

export async function isAuthenticated(): Promise<boolean> {
  const stored = await loadTokens();
  return stored !== null;
}
