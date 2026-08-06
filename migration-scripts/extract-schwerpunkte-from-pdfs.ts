/**
 * Extract Schwerpunkte tags from solution PDFs and save to admin_focus_tags.
 *
 * For each vb_case_study_requests row with a solution_pdf_url, this script:
 *   1. Downloads the solution PDF from Supabase storage
 *   2. Extracts text from the first few pages
 *   3. Finds the "Schwerpunkte:" line in the header
 *   4. Splits by comma into individual tags
 *   5. Updates admin_focus_tags on the case study row
 *
 * Usage:
 *   npx tsx migration-scripts/extract-schwerpunkte-from-pdfs.ts
 *
 * Environment: uses VITE_SUPABASE_URL + service role key from supabase CLI.
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// pdfjs-dist is ESM; we load it dynamically
let pdfjs: any;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gkkveloqajxghhflkfru.supabase.co';

function getServiceRoleKey(): string {
  try {
    const output = execSync('supabase projects api-keys --project-ref gkkveloqajxghhflkfru -o json', {
      encoding: 'utf-8',
      cwd: '/Users/charlenenowak/github/dozentenportal',
    });
    const keys = JSON.parse(output);
    const serviceKey = keys.find((k: any) => k.name === 'service_role');
    if (!serviceKey) throw new Error('Service role key not found');
    return serviceKey.api_key;
  } catch (error) {
    console.error('❌ Error fetching service role key:', error);
    throw error;
  }
}

const BUCKET = 'case-studies';

function storagePathFromUrl(url: string): string | null {
  let marker = `/object/public/${BUCKET}/`;
  let idx = url.indexOf(marker);
  if (idx >= 0) return url.slice(idx + marker.length);

  marker = `/object/public/masterclass/`;
  idx = url.indexOf(marker);
  if (idx >= 0) return url.slice(idx + marker.length);

  return null;
}

function detectBucket(url: string): string {
  if (url.includes('/object/public/masterclass/')) return 'masterclass';
  return BUCKET;
}

/**
 * Extract "Schwerpunkte: tag1, tag2, tag3" from PDF text.
 * The header line may span multiple lines in the PDF, so we look for
 * "Schwerpunkte" and then collect text until we hit a blank line or
 * a known next-section marker.
 */
function extractSchwerpunkte(fullText: string): string[] | null {
  if (!fullText) return null;

  // The PDF text extraction often joins all text on one line.
  // We search for "Schwerpunkte" followed by ":" and then capture until
  // the next section marker or end of reasonable content.
  const combined = fullText.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  // Find "Schwerpunkte:" (case-insensitive) and capture until next section
  const match = combined.match(/Schwerpunkte\s*:\s*(.+?)(?=(?:Gliederung|Inhaltsverzeichnis|Schlagworte|Schwerpunktgebiet|Bearbeiter|Datum|Note:|Punkte:|Gutachten|Lösung|Loesung|Klausur\s+\d|Frage\s+\d|\|\s*[A-Z]|$))/i);
  if (!match) return null;

  let rest = match[1].trim();

  // Also stop at common section markers
  const stopMarkers = ['Gliederung', 'Inhaltsverzeichnis', 'Schlagworte', 'Schwerpunktgebiet', 'Bearbeiter', 'Datum', 'Gutachten', 'Loesung', 'Lösung'];
  for (const marker of stopMarkers) {
    const markerIdx = rest.toLowerCase().indexOf(marker.toLowerCase());
    if (markerIdx > 0) {
      rest = rest.slice(0, markerIdx).trim();
    }
  }

  // Remove page header artifacts like "| Bürgerliches Recht |" or trailing "| ..."
  rest = rest.replace(/\|[^|]*\|/g, ' ');
  rest = rest.replace(/\|\s.*$/, '').trim();

  // Fix PDF spacing artifacts: "To t schlag" -> "Totschlag", "Recht s scheinvollmacht" -> "Rechtsscheinvollmacht"
  // Pattern: lowercase letter + space + lowercase letter where the combination forms a known word fragment
  // We fix: single letters surrounded by spaces that are clearly part of a word (not articles/prepositions)
  const stopWords = new Set([
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

  // Split by comma OR semicolon
  const tags = rest
    .split(/[,;]/)
    .map(t => t.trim())
    .filter(t => t.length > 0)
    // Remove trailing periods or stray chars
    .map(t => t.replace(/[.\s]+$/, ''))
    .filter(t => t.length > 0)
    // Fix PDF hyphenation artifacts: "Grund- schuld" -> "Grundschuld"
    .map(t => t.replace(/(\w)-\s+(\w)/g, '$1$2'))
    // Fix PDF intra-word spacing: "To t schlag" -> "Totschlag"
    // Only join if the fragment before space is 1-3 chars and NOT a stop word
    .map(t => {
      let prev;
      do {
        prev = t;
        // Fix PDF intra-word spacing: "Ve rständigungen" -> "Verständigungen", "To t schlag" -> "Totschlag"
        t = t.replace(/(\b[A-Za-zäöüÄÖÜ]{1,3})\s+([a-zäöü])/g, (m, a, b) => {
          if (stopWords.has(a.toLowerCase()) || stopWords.has(a.toLowerCase().replace(/\.$/, ''))) return m;
          // Don't join if the first part is a Roman numeral or section sign
          if (/^[ivxIVX]+$/.test(a)) return m;
          return a + b;
        });
      } while (t !== prev);
      return t;
    })
    .filter(t => t.length > 0);

  return tags.length > 0 ? tags : null;
}

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  if (!pdfjs) {
    // Load pdfjs-dist legacy build for Node.js
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    // Disable worker in Node
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  let fullText = '';

  // Only read first 3 pages (Schwerpunkte is in the header)
  const maxPages = Math.min(pdf.numPages, 3);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  await pdf.destroy();
  return fullText;
}

async function main() {
  console.log('🔑 Fetching service role key...');
  const serviceKey = getServiceRoleKey();

  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false },
  });

  console.log('📥 Fetching case studies with solution_pdf_url...');
  const { data: cases, error } = await supabase
    .from('vb_case_study_requests')
    .select('id, case_study_number, legal_area, sub_area, solution_pdf_url, admin_focus_tags')
    .not('solution_pdf_url', 'is', null)
    .order('case_study_number', { ascending: true });

  if (error) {
    console.error('❌ Error fetching cases:', error);
    process.exit(1);
  }

  console.log(`📋 Found ${cases.length} case studies with solution PDFs`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of cases) {
    const url = c.solution_pdf_url as string;
    const storagePath = storagePathFromUrl(url);
    const bucket = detectBucket(url);

    if (!storagePath) {
      console.log(`⚠️  Klausur #${c.case_study_number}: Could not parse storage path from URL`);
      failed++;
      continue;
    }

    console.log(`\n📄 Klausur #${c.case_study_number} (${c.legal_area} - ${c.sub_area})`);
    console.log(`   Bucket: ${bucket}, Path: ${storagePath}`);

    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(storagePath);

      if (downloadError || !fileData) {
        console.log(`   ❌ Download failed: ${downloadError?.message || 'no data'}`);
        failed++;
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      const text = await extractTextFromPdf(pdfBuffer);

      // Debug: show first 500 chars of extracted text
      console.log(`   📝 Text preview: ${text.substring(0, 500).replace(/\n/g, ' ')}`);

      const tags = extractSchwerpunkte(text);

      if (!tags || tags.length === 0) {
        console.log(`   ⏭️  No Schwerpunkte found in PDF`);
        skipped++;
        continue;
      }

      console.log(`   🏷️  Found ${tags.length} tags:`);
      tags.forEach(t => console.log(`      • ${t}`));

      // Merge with existing tags (avoid duplicates)
      const existing = c.admin_focus_tags || [];
      const merged = [...new Set([...existing, ...tags])];

      const { error: updateError } = await supabase
        .from('vb_case_study_requests')
        .update({ admin_focus_tags: merged })
        .eq('id', c.id);

      if (updateError) {
        console.log(`   ❌ Update failed: ${updateError.message}`);
        failed++;
      } else {
        console.log(`   ✅ Saved ${merged.length} tags (was ${existing.length})`);
        updated++;
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (no Schwerpunkte): ${skipped}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${cases.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
