/** Extraccion de texto posicionado desde un PDF.
 *
 *  No alcanza con volcar el texto plano: en los payslips de Deputy los importes
 *  se dibujan a una altura ligeramente distinta que su etiqueta, asi que
 *  cualquier volcado lineal los corre de fila. Guardando la posicion X e Y de
 *  cada fragmento se puede reconstruir la tabla real. */

export interface TextToken {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

export interface TextRow {
  readonly y: number;
  readonly tokens: readonly TextToken[];
  readonly text: string;
}

export interface PdfPage {
  readonly pageNumber: number;
  readonly rows: readonly TextRow[];
}

/** Dos fragmentos separados por menos de esto verticalmente son la misma fila. */
const ROW_TOLERANCE = 3;

interface PdfJsModule {
  getDocument(options: Record<string, unknown>): { promise: Promise<PdfDocument> };
}

interface PdfDocument {
  numPages: number;
  getPage(index: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
}

interface PdfPageProxy {
  getTextContent(): Promise<{ items: unknown[] }>;
}

let cachedModule: PdfJsModule | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  if (cachedModule) return cachedModule;
  // El build legacy es el que funciona en Node sin canvas ni worker, y se
  // distribuye solo como ESM: hay que importarlo de forma dinamica.
  const imported = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as {
    default?: PdfJsModule;
    getDocument?: PdfJsModule['getDocument'];
  };
  const resolved = imported.getDocument ? (imported as PdfJsModule) : imported.default;
  if (!resolved?.getDocument) {
    throw new Error('No se pudo cargar pdfjs-dist: falta getDocument en el modulo.');
  }
  cachedModule = resolved;
  return cachedModule;
}

function groupIntoRows(tokens: TextToken[]): TextRow[] {
  const sorted = [...tokens].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextRow[] = [];
  let bucket: TextToken[] = [];

  const flush = (): void => {
    if (bucket.length === 0) return;
    const ordered = [...bucket].sort((a, b) => a.x - b.x);
    rows.push({
      y: ordered[0]!.y,
      tokens: ordered,
      text: ordered.map((token) => token.text).join(' ').replace(/\s+/g, ' ').trim(),
    });
    bucket = [];
  };

  for (const token of sorted) {
    if (bucket.length > 0 && Math.abs(bucket[0]!.y - token.y) > ROW_TOLERANCE) flush();
    bucket.push(token);
  }
  flush();

  return rows;
}

export async function extractPages(data: Uint8Array): Promise<PdfPage[]> {
  const pdfjs = await loadPdfJs();
  const document = await pdfjs.getDocument({
    data,
    useSystemFonts: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  try {
    const pages: PdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();

      const tokens: TextToken[] = [];
      for (const raw of content.items) {
        const item = raw as { str?: unknown; transform?: unknown };
        const text = typeof item.str === 'string' ? item.str.trim() : '';
        if (!text) continue;
        const transform = item.transform;
        if (!Array.isArray(transform) || transform.length < 6) continue;
        tokens.push({
          text,
          x: Number(transform[4]),
          y: Number(transform[5]),
        });
      }

      pages.push({ pageNumber, rows: groupIntoRows(tokens) });
    }
    return pages;
  } finally {
    await document.destroy();
  }
}
