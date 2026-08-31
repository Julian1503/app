/** Normaliza la URL del install de Deputy.
 *
 *  Deputy devuelve el `endpoint` del token como host pelado
 *  (`47924c10020044.au.deputy.com`), sin esquema. `fetch()` no parsea eso,
 *  asi que le ponemos https:// nosotros. El .env tambien puede venir asi. */

export function normalizeEndpoint(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
