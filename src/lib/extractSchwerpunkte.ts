/**
 * Frontend utilities for extracting Schwerpunkte tags from Lösung-PDFs.
 *
 * Used by the DozentenDashboard to auto-tag folders when a Lösung PDF
 * is uploaded. Mirrors the logic from migration-scripts/extract-schwerpunkte-from-pdfs.ts.
 */
import * as pdfjsLib from 'pdfjs-dist';
// Vite-friendly worker import
// eslint-disable-next-line import/no-unresolved
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

const STOP_WORDS = new Set([
  'und', 'der', 'die', 'das', 'von', 'im', 'in', 'an', 'auf', 'aus', 'mit',
  'bei', 'nach', 'zur', 'zum', 'i.r.d', 'i.s.d', 'i.r.d.', 'i.s.d.',
  'abs', 'satz', 'nr', 'ff', 'bgb', 'stgb', 'vwgo', 'grch', 'aeuv', 'a.e', 'a.e.',
  'gg', 'stpo', 'bverfg', 'eugh', 'mrk', 'emrk',
  'des', 'dem', 'den', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
  'durch', 'über', 'unter', 'vor', 'gegen', 'gem', 'gem.',
  'i.h.v', 'i.h.v.', 'ist', 'wird', 'kann', 'darf', 'sind', 'hat', 'haben',
  'nicht', 'kein', 'keine', 'keiner', 'keines',
  'sog', 'sog.', 'insbes', 'insbes.', 'bzw', 'bzw.', 'etc', 'etc.',
  'teil', 'frage', 'fall', 'fallgruppen',
  'nrw', 'hgb', 'zpo', 'ao', 'ggo', 'vwvg', 'bbg', 'sgb',
  'kfz', 'agb', 'vfg', 'art', 'ehe', 'tat', 'es', 'zu', 'i', 'h',
  'kg', 'tod', 'co', 'gmbh', 'ohg', 'eg', 'e.v',
]);

/**
 * Extracts text from the first `maxPages` pages of a PDF File.
 */
export async function extractTextFromPdfFile(file: File, maxPages = 3): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  let fullText = '';
  const pages = Math.min(pdf.numPages, maxPages);
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  await pdf.destroy();
  return fullText;
}

/**
 * Extract "Schwerpunkte: tag1, tag2, tag3" from PDF text.
 * Returns null if no Schwerpunkte section is found.
 */
export function extractSchwerpunkte(fullText: string): string[] | null {
  if (!fullText) return null;

  const combined = fullText.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  const match = combined.match(
    /Schwerpunkte\s*:\s*(.+?)(?=(?:Gliederung|Inhaltsverzeichnis|Schlagworte|Schwerpunktgebiet|Bearbeiter|Datum|Note:|Punkte:|Gutachten|Lösung|Loesung|Klausur\s+\d|Frage\s+\d|\|\s*[A-Z]|$))/i
  );
  if (!match) return null;

  let rest = match[1].trim();

  const stopMarkers = ['Gliederung', 'Inhaltsverzeichnis', 'Schlagworte', 'Schwerpunktgebiet', 'Bearbeiter', 'Datum', 'Gutachten', 'Loesung', 'Lösung'];
  for (const marker of stopMarkers) {
    const markerIdx = rest.toLowerCase().indexOf(marker.toLowerCase());
    if (markerIdx > 0) {
      rest = rest.slice(0, markerIdx).trim();
    }
  }

  rest = rest.replace(/\|[^|]*\|/g, ' ');
  rest = rest.replace(/\|\s.*$/, '').trim();

  const tags = rest
    .split(/[,;]/)
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .map(t => t.replace(/[.\s]+$/, ''))
    .filter(t => t.length > 0)
    .map(t => t.replace(/(\w)-\s+(\w)/g, '$1$2'))
    .map(t => {
      let prev;
      do {
        prev = t;
        // Fix PDF intra-word spacing: "Ve rständigungen" -> "Verständigungen", "To t schlag" -> "Totschlag"
        // Match word fragments of 1-3 chars (any case) followed by space + lowercase letter
        t = t.replace(/(\b[A-Za-zäöüÄÖÜ]{1,3})\s+([a-zäöü])/g, (m, a, b) => {
          if (STOP_WORDS.has(a.toLowerCase()) || STOP_WORDS.has(a.toLowerCase().replace(/\.$/, ''))) return m;
          // Don't join if the first part is a Roman numeral
          if (/^[ivxIVX]+$/.test(a)) return m;
          return a + b;
        });
      } while (t !== prev);
      return t;
    })
    .filter(t => t.length > 0);

  return tags.length > 0 ? tags : null;
}

/**
 * Convenience: extract Schwerpunkte tags directly from a PDF File.
 * Returns [] if the file is not a PDF or no tags are found.
 */
export async function extractTagsFromPdfFile(file: File): Promise<string[]> {
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) return [];
  try {
    const text = await extractTextFromPdfFile(file);
    const tags = extractSchwerpunkte(text);
    return tags || [];
  } catch (err) {
    console.error('Fehler beim Extrahieren der Schwerpunkte aus PDF:', err);
    return [];
  }
}
