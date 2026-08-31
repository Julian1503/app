/** Cliente del API local. Todos los errores se normalizan a `ApiError` para que
 *  la UI pueda distinguir "falta autorizar" de "algo se rompio". */

import { createI18n, type Locale } from '@shared/i18n/index.ts';
import { accessToken } from './supabase.ts';
import type { Behaviour } from '@shared/reports/behaviours.ts';
import type { FieldAnswer, Gap } from '@shared/form/answers.ts';
import type { FormField } from '@shared/form/schema.ts';
import type { PresentationTag } from '@shared/reports/tags.ts';
import type { ReportEntry, ShiftReport } from '@shared/reports/types.ts';
import type { AnalysisReport } from '@shared/types.ts';
import type { TermBreak } from '@shared/visa/fortnights.ts';
import { currentLocale } from './i18n.tsx';

/** Los hallazgos se redactan en el servidor, asi que toda llamada lleva el
 *  idioma elegido. */
function withLocale(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}locale=${currentLocale()}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly needsAuth: boolean;

  constructor(message: string, status: number, needsAuth = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.needsAuth = needsAuth;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // El API no responde nada sin sesion, asi que el token va en todas.
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(createI18n(currentLocale()).t('app.error.offline'), 0);
  }

  const text = await response.text();

  // Un error de la plataforma (un 500 de Vercel, un HTML de proxy) no viene en
  // JSON. Parsear sin red hacia que el SyntaxError tapara el error de verdad y
  // la UI mostrara "error inesperado" en vez de decir que paso.
  let payload: Record<string, unknown> = {};
  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ApiError(text.trim().slice(0, 300), response.status);
    }
  }

  if (!response.ok) {
    throw new ApiError(
      typeof payload.error === 'string'
        ? payload.error
        : createI18n(currentLocale()).t('app.error.status', { status: response.status }),
      response.status,
      payload.needsAuth === true,
    );
  }

  return payload as T;
}

export interface AuthStatus {
  configured: boolean;
  authenticated: boolean;
  redirectUri: string;
  warning?: string;
  identity: { employeeId: number | null; name: string | null; company: string | null } | null;
}

export interface ReportResponse {
  report: AnalysisReport;
  meta: {
    lastSyncAt: string | null;
    shiftCount: number;
    payslipFiles: number;
    payslipFailures: Array<{ file: string; reason: string }>;
    termBreaks: TermBreak[];
    holidays: Array<{ date: string; label: string; confirmed?: boolean }>;
    kmRate: number;
    locale: Locale;
  };
}

export interface SyncResponse {
  lastSyncAt: string;
  counts: { timesheets: number; rosters: number; merged: number };
  warning: string | null;
}

export interface ShiftReportsResponse {
  entries: ReportEntry[];
  behaviours: Behaviour[];
  tags: PresentationTag[];
  fields: FormField[];
  meta: { clientName: string; from: string; model: string; hasApiKey: boolean };
}

/** Lo que la UI manda al guardar o al pedir redaccion. */
export interface ShiftReportInput {
  observations: Array<{ behaviourId: string; value: number | null; note: string }>;
  presentationTags: string[];
  presentation: string;
  support: string;
  formAnswers?: FieldAnswer[];
  gaps?: Gap[];
  status?: ShiftReport['status'];
}

function reportPath(shiftId: string, suffix = ''): string {
  return withLocale(`/api/shift-reports/${encodeURIComponent(shiftId)}${suffix}`);
}

export const api = {
  authStatus: () => request<AuthStatus>('/api/auth/status'),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  report: () => request<ReportResponse>(withLocale('/api/report')),
  sync: () =>
    request<SyncResponse>(withLocale('/api/sync'), { method: 'POST', body: JSON.stringify({}) }),
  saveTermBreaks: (breaks: TermBreak[]) =>
    request<TermBreak[]>(withLocale('/api/term-breaks'), {
      method: 'PUT',
      body: JSON.stringify(breaks),
    }),
  shiftReports: () => request<ShiftReportsResponse>(withLocale('/api/shift-reports')),
  saveShiftReport: (shiftId: string, body: ShiftReportInput) =>
    request<ShiftReport>(reportPath(shiftId), { method: 'PUT', body: JSON.stringify(body) }),
  /** Etapa 1: mapea la nota de Deputy al formulario y devuelve lo que falta. */
  extractForm: (shiftId: string, body: ShiftReportInput) =>
    request<ShiftReport>(reportPath(shiftId, '/extract'), {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Etapa 2: redacta los campos de texto y arma el formulario para pegar. */
  finaliseForm: (shiftId: string, body: ShiftReportInput) =>
    request<ShiftReport>(reportPath(shiftId, '/finalise'), {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** El login de Deputy es una navegacion del navegador, que no lleva headers:
   *  el token viaja en la query y el middleware lo acepta tambien de ahi. */
  loginUrl: async () => {
    const token = await accessToken();
    const base = withLocale('/api/auth/login');
    return token ? `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : base;
  },
};
