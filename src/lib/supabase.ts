/** Cliente de Supabase del navegador. Usa la clave publica (`anon` en el
 *  formato viejo, `sb_publishable_...` en el nuevo): lo unico que habilita es
 *  intentar un login.
 *
 *  Estas dos variables llegan al bundle porque estan listadas en el `define`
 *  de vite.config.ts. Nada mas del .env cruza esa linea, y la service_role no
 *  debe cruzarla nunca. */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.SUPABASE_URL ?? '';
const anonKey = import.meta.env.SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

export const supabase = createClient(url || 'http://localhost', anonKey || 'sin-clave', {
  auth: { persistSession: true, autoRefreshToken: true },
});

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
