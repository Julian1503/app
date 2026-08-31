/** Configuracion leida del entorno. Se valida al arrancar y falla fuerte:
 *  es preferible no levantar a levantar a medias y descubrirlo en el callback. */

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DEFAULT_FORTNIGHT_LIMIT, DEFAULT_KM_RATE } from '../shared/visa/rules.ts';
import { normalizeEndpoint } from './deputy/endpoint.ts';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_MODEL = 'claude-opus-5';
const DEFAULT_CLIENT_NAME = 'Joshua Jones';
/** Domingo 16 de agosto: el primer turno que hay que reportar. */
const DEFAULT_REPORTS_START = '2026-08-16';

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} tiene que ser un numero positivo, llego "${raw}"`);
  }
  return value;
}

function readIsoDate(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`${name} tiene que ser una fecha YYYY-MM-DD, llego "${raw}"`);
  }
  return raw;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** El employeeId de Deputy es un entero. Un hash pegado por error aca lo parsea
 *  como su primer digito y apunta al empleado equivocado sin avisar. */
function readEmployeeId(raw: string | undefined): number | null {
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `DEPUTY_EMPLOYEE_ID tiene que ser un entero (o quedar vacio para resolverlo solo), llego "${raw}"`,
    );
  }
  return Number.parseInt(raw, 10);
}

export interface AppConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly installUrl: string;
  readonly employeeId: number | null;
  readonly port: number;
  readonly webOrigin: string;
  readonly redirectUri: string;
  readonly limit: number;
  readonly kmRate: number;
  /** Carpeta con los PDF. Solo la usa el importador, no el servidor. */
  readonly payslipsDir: string;
  readonly appRoot: string;
  readonly supabaseUrl: string;
  readonly supabaseServiceKey: string;
  readonly anthropicApiKey: string;
  readonly anthropicModel: string;
  /** Nombre del cliente tal como aparece en el location del turno en Deputy. */
  readonly reportsClientName: string;
  /** Primer dia que lleva reporte de turno. */
  readonly reportsStartDate: string;
  /** Quien completa el formulario: Q1. Vacio = se pregunta. */
  readonly reportsWorkerName: string;
}

function build(): AppConfig {
  const port = readNumber('SERVER_PORT', 8787);
  const webOrigin = stripTrailingSlash(process.env.WEB_ORIGIN ?? 'http://localhost:5173');
  const payslipsDirRaw = process.env.PAYSLIPS_DIR ?? '../payslips';
  const employeeIdRaw = process.env.DEPUTY_EMPLOYEE_ID?.trim();

  return {
    clientId: process.env.DEPUTY_CLIENT_ID?.trim() ?? '',
    clientSecret: process.env.DEPUTY_CLIENT_SECRET?.trim() ?? '',
    installUrl: normalizeEndpoint(process.env.DEPUTY_INSTALL_URL) ?? '',
    employeeId: readEmployeeId(employeeIdRaw),
    port,
    webOrigin,
    redirectUri: `http://localhost:${port}/api/auth/callback`,
    limit: readNumber('VISA_FORTNIGHT_LIMIT', DEFAULT_FORTNIGHT_LIMIT),
    kmRate: readNumber('KM_RATE', DEFAULT_KM_RATE),
    payslipsDir: path.resolve(APP_ROOT, payslipsDirRaw),
    appRoot: APP_ROOT,
    supabaseUrl: stripTrailingSlash(process.env.SUPABASE_URL?.trim() ?? ''),
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() ?? '',
    anthropicModel: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
    reportsClientName: process.env.REPORTS_CLIENT_NAME?.trim() || DEFAULT_CLIENT_NAME,
    reportsStartDate: readIsoDate('REPORTS_START_DATE', DEFAULT_REPORTS_START),
    reportsWorkerName: process.env.REPORTS_WORKER_NAME?.trim() ?? '',
  };
}

export const config = build();

/** true si hay credenciales OAuth cargadas. Sin esto la app corre igual,
 *  pero solo con los datos ya sincronizados en la base. */
export function hasOAuthCredentials(): boolean {
  return config.clientId.length > 0 && config.clientSecret.length > 0;
}

/** true si hay a donde guardar. Sin esto no arranca nada: se avisa al levantar
 *  en vez de dejar que falle el primer request. */
export function hasDatabase(): boolean {
  return config.supabaseUrl.length > 0 && config.supabaseServiceKey.length > 0;
}
