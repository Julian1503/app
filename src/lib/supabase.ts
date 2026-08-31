/** Cliente de Supabase del navegador. Usa la clave **anon**, que es publica por
 *  diseño: lo unico que habilita es intentar un login. La service_role nunca
 *  toca el front (y Vite solo expone lo que empieza con VITE_, asi que ponerle
 *  ese prefijo a la service_role la publicaria). */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

export const supabase = createClient(url || 'http://localhost', anonKey || 'sin-clave', {
  auth: { persistSession: true, autoRefreshToken: true },
});

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
