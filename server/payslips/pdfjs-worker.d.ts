/** pdfjs-dist no publica tipos para el bundle del worker; solo lo importamos
 *  para que el bundler lo incluya y para dejarlo en `globalThis.pdfjsWorker`. */
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  const workerModule: unknown;
  export default workerModule;
}
