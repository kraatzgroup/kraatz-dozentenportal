import * as pdfjsLib from 'pdfjs-dist';
// Vite-friendly worker import
// eslint-disable-next-line import/no-unresolved
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

export interface RenderedPage {
  pageNumber: number;
  dataUrl: string;
  width: number; // rendered pixel width
  height: number; // rendered pixel height
  pointWidth: number; // page width in PDF points (scale 1)
  pointHeight: number; // page height in PDF points (scale 1)
  // Converts a point in the rendered (top-left origin, y-down) viewport space
  // to PDF user-space coordinates (as used by pdf-lib). Inverts exactly the
  // transform pdf.js used for rendering (handles CropBox/MediaBox/rotation).
  toPdfPoint: (x: number, y: number) => [number, number];
}

/**
 * Renders all pages of a PDF to PNG data URLs.
 * `scale` controls the raster resolution used for display.
 */
export async function renderPdfPages(
  data: Uint8Array | ArrayBuffer,
  scale = 1.5
): Promise<RenderedPage[]> {
  // IMPORTANT: pdf.js transfers the underlying ArrayBuffer to its worker, which
  // detaches (empties) the passed array. We clone the data so the caller's
  // bytes remain usable afterwards (e.g. for pdf-lib embedding/saving).
  const source = data instanceof Uint8Array ? data : new Uint8Array(data);
  const bytes = source.slice();
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const pages: RenderedPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const baseViewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({
      pageNumber: i,
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
      pointWidth: baseViewport.width,
      pointHeight: baseViewport.height,
      toPdfPoint: (x: number, y: number) => {
        const [px, py] = baseViewport.convertToPdfPoint(x, y);
        return [px, py];
      },
    });
  }

  await pdf.cleanup();
  return pages;
}

/**
 * Renders the first page of a PDF to a PNG data URL (used for stamp previews).
 */
export async function renderFirstPageToDataUrl(
  data: Uint8Array | ArrayBuffer,
  scale = 3
): Promise<{ dataUrl: string; width: number; height: number }> {
  const pages = await renderPdfPages(data, scale);
  const first = pages[0];
  return { dataUrl: first.dataUrl, width: first.width, height: first.height };
}
