/** Boton para subir un payslip en PDF y convertirlo en filas de la tabla.
 *
 *  Acepta varios archivos y los manda de a uno: cada alta recalcula el
 *  historial completo en el servidor (los sleepovers se deducen por era
 *  salarial), y hacerlo secuencial evita que dos recalculos se pisen. */

import { useRef, useState } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { useI18n } from '../lib/i18n.tsx';

export function PayslipUpload({ onDone }: { onDone: () => void }): JSX.Element {
  const { i18n } = useI18n();
  const t = i18n.t;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMessage(null);
    setFailed(false);

    let added = 0;
    let replaced = 0;
    const periods: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const result = await api.uploadPayslip(file);
        added += result.added;
        replaced += result.replaced;
        periods.push(...result.periods);
      }
      setMessage(t('section.payslips.uploaded', { added, replaced, periods: periods.join(', ') }));
      onDone();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(false);
      // Sin esto, volver a elegir el mismo archivo no dispara onChange.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="upload">
      <input
        ref={inputRef}
        id="payslip-file"
        className="upload__input"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        disabled={busy}
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <label className="button" htmlFor="payslip-file">
        {busy ? t('section.payslips.uploading') : t('section.payslips.upload')}
      </label>
      {message && (
        <p className={failed ? 'upload__msg upload__msg--error' : 'upload__msg'}>{message}</p>
      )}
    </div>
  );
}
