/** Cliente de Supabase. Es el unico lugar del servidor que sabe como se llega
 *  a la base: todo lo demas pide tablas a los modulos de este directorio.
 *
 *  Se usa la service_role key, que salta RLS. Es aceptable porque el servidor
 *  sigue escuchando solo en 127.0.0.1 y no hay usuarios: cuando agreguemos
 *  login, esta key se reemplaza por el JWT del usuario y RLS pasa a decidir. */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    throw new Error(
      'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env. ' +
        'Sin eso la app no tiene donde guardar nada: ver README, seccion Supabase.',
    );
  }
  cached = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Los errores de PostgREST no son `Error`, asi que un throw pelado pierde el
 *  detalle (que columna, que constraint). Esto lo conserva. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: la consulta no devolvio datos`);
  return result.data;
}

export function assertOk(result: { error: { message: string } | null }, what: string): void {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
}
