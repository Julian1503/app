/** El sobre cifrado de los tokens de Deputy. Una sola fila.
 *
 *  La tabla guarda el mismo envelope AES-GCM que antes iba a data/tokens.json:
 *  la clave se deriva del DEPUTY_CLIENT_SECRET, que vive en el .env y no en la
 *  base. Un dump de Supabase por si solo no descifra nada. */

import { assertOk, db } from './client.ts';

export interface EncryptedEnvelope {
  readonly v: 1;
  readonly iv: string;
  readonly tag: string;
  readonly data: string;
}

export async function readEnvelope(): Promise<EncryptedEnvelope | null> {
  const result = await db().from('deputy_tokens').select('v, iv, tag, data').maybeSingle();
  assertOk(result, 'No se pudo leer la sesion de Deputy');
  return (result.data as EncryptedEnvelope | null) ?? null;
}

export async function writeEnvelope(envelope: EncryptedEnvelope): Promise<void> {
  assertOk(
    await db()
      .from('deputy_tokens')
      .upsert({ id: true, ...envelope, updated_at: new Date().toISOString() }, { onConflict: 'id' }),
    'No se pudo guardar la sesion de Deputy',
  );
}

export async function clearEnvelope(): Promise<void> {
  assertOk(
    await db().from('deputy_tokens').delete().eq('id', true),
    'No se pudo cerrar la sesion de Deputy',
  );
}
