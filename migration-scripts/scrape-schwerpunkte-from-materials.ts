/**
 * Scrape & Index: Extract Schwerpunkte tags from Lösung-PDFs in teaching_materials
 * and save them to the parent folder's schwerpunkt_tags in material_folders.
 *
 * Pipeline:
 *   1. Find all teaching_materials where title contains "Lösung"
 *   2. Download each PDF from Supabase storage (masterclass bucket)
 *   3. Extract text from first 3 pages
 *   4. Find "Schwerpunkte:" line in header
 *   5. Split by comma AND semicolon into individual tags
 *   6. Clean up PDF artifacts (hyphenation, intra-word spaces, page headers)
 *   7. Save tags to the parent material_folders.schwerpunkt_tags
 *
 * Usage:
 *   npx tsx migration-scripts/scrape-schwerpunkte-from-materials.ts           # full run
 *   npx tsx migration-scripts/scrape-schwerpunkte-from-materials.ts --test 3  # test on 3 PDFs
 *   npx tsx migration-scripts/scrape-schwerpunkte-from-materials.ts --dry     # dry run, no DB writes
 *
 * Environment: uses VITE_SUPABASE_URL + service role key from supabase CLI.
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gkkveloqajxghhflkfru.supabase.co';
const BUCKET = 'masterclass';

function getServiceRoleKey(): string {
  const output = execSync('supabase projects api-keys --project-ref gkkveloqajxghhflkfru -o json', {
    encoding: 'utf-8',
    cwd: '/Users/charlenenowak/github/dozentenportal',
  });
  const keys = JSON.parse(output);
  const serviceKey = keys.find((k: any) => k.name === 'service_role');
  if (!serviceKey) throw new Error('Service role key not found');
  return serviceKey.api_key;
}

// ─── Tag extraction rules ───────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'und', 'der', 'die', 'das', 'von', 'im', 'in', 'an', 'auf', 'aus', 'mit',
  'bei', 'nach', 'zur', 'zum', 'i.r.d', 'i.s.d', 'i.r.d.', 'i.s.d.',
  'abs', 'satz', 'nr', 'ff', 'bgb', 'stgb', 'vwgo', 'grch', 'aeuv',
  'a.e', 'a.e.', 'gg', 'stpo', 'bverfg', 'eugh', 'mrk', 'emrk',
  // Additional stop words to prevent false joins
  'des', 'dem', 'den', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
  'durch', 'über', 'unter', 'vor', 'gegen', 'gem', 'gem.',
  'i.h.v', 'i.h.v.', 'i.s.d', 'i.s.d.',
  'ist', 'wird', 'kann', 'darf', 'sind', 'hat', 'haben',
  'nicht', 'kein', 'keine', 'keiner', 'keines',
  'sog', 'sog.', 'insbes', 'insbes.', 'bzw', 'bzw.', 'etc', 'etc.',
  'teil', 'frage', 'fall', 'fallgruppen',
  'nrw', 'hgb', 'zpo', 'ao', 'ggo', 'vwvg', 'bbg', 'sgb',
  'kfz', 'agb', 'vfg', 'art', 'ehe', 'tat', 'es', 'zu', 'i', 'h',
  'kg', 'tod', 'co', 'gmbh', 'ohg', 'eg', 'e.v',
]);

/**
 * Section markers that terminate the Schwerpunkte block.
 */
const SECTION_MARKERS = [
  'Gliederung', 'Inhaltsverzeichnis', 'Schlagworte', 'Schwerpunktgebiet',
  'Bearbeiter', 'Datum', 'Gutachten', 'Lösung', 'Loesung',
  'Frage 1', 'Frage 2', 'Teil 1', 'Teil 2',
  'Klausur 1', 'Klausur 2', 'Klausur 3',
];

/**
 * Extract the "Schwerpunkte: ..." block from PDF text and split into tags.
 * Tags are separated by commas (,) or semicolons (;).
 */
function extractSchwerpunkte(fullText: string): string[] | null {
  if (!fullText) return null;

  // Join all text into one line (PDF extraction often loses line breaks)
  const combined = fullText.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  // Find "Schwerpunkte:" and capture until next section marker
  const lookahead = SECTION_MARKERS.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`Schwerpunkte\\s*:\\s*(.+?)(?=(?:${lookahead}|\\|\\s*[A-Z]|$))`, 'i');
  const match = combined.match(regex);
  if (!match) return null;

  let rest = match[1].trim();

  // Stop at any section marker
  for (const marker of SECTION_MARKERS) {
    const idx = rest.toLowerCase().indexOf(marker.toLowerCase());
    if (idx > 0) rest = rest.slice(0, idx).trim();
  }

  // Remove page header artifacts: "| Bürgerliches Recht |" or trailing "| ..."
  rest = rest.replace(/\|[^|]*\|/g, ' ');
  rest = rest.replace(/\|\s.*$/, '').trim();

  // Split by comma OR semicolon
  let tags = rest
    .split(/[,;]/)
    .map(t => t.trim())
    .filter(t => t.length > 0)
    // Remove trailing periods
    .map(t => t.replace(/[.\s]+$/, ''))
    .filter(t => t.length > 0);

  // Fix PDF hyphenation patterns:
  // 1. "Grund- schuld" -> "Grundschuld" (hyphen + space)
  // 2. "Öffentlich - rechtlich" -> "Öffentlich-rechtlich" (space-hyphen-space, keep hyphen)
  tags = tags.map(t => t.replace(/(\w)-\s+(\w)/g, '$1$2'));
  tags = tags.map(t => t.replace(/\s+-\s+/g, '-'));

  // Fix slash with space: "Voraussetzungen/ Fehlerhaftigkeit" -> "Voraussetzungen/Fehlerhaftigkeit"
  tags = tags.map(t => t.replace(/\/\s+/g, '/'));

  // Fix PDF intra-word spacing: "To t schlag" -> "Totschlag"
  // CONSERVATIVE: only join very short fragments (1-3 chars) that are clearly not words
  tags = tags.map(t => {
    let prev;
    do {
      prev = t;
      t = t.replace(/(\b[A-Za-zäöüÄÖÜ]{1,3})\s+([a-zäöü])/g, (m, a, b) => {
        if (STOP_WORDS.has(a.toLowerCase()) || STOP_WORDS.has(a.toLowerCase().replace(/\.$/, ''))) return m;
        if (/^[ivxIVX]+$/.test(a)) return m; // Roman numerals
        return a + b;
      });
    } while (t !== prev);
    return t;
  });

  // Fix known compound word splits that the conservative rule misses
  // These are patterns where PDFs split longer compound words
  const KNOWN_COMPOUND_FIXES: [RegExp, string][] = [
    [/Ermessens\s+fehler/gi, 'Ermessensfehler'],
    [/Recht s\s+schein/gi, 'Rechtsschein'],
    [/Gesetz es\b/gi, 'Gesetzes'],
    [/Voraussetzung en/gi, 'Voraussetzungen'],
    [/Wiederholung en/gi, 'Wiederholungen'],
    [/Vertretung smacht/gi, 'Vertretungsmacht'],
    [/Hausfriedensbruch s/gi, 'Hausfriedensbruchs'],
    [/Sicherungsgeber\b/gi, 'Sicherungsgeber'],
    [/Schadenskorrektur\b/gi, 'Schadenskorrektur'],
    [/Vertretung smacht/gi, 'Vertretungsmacht'],
  ];
  tags = tags.map(t => {
    for (const [pattern, replacement] of KNOWN_COMPOUND_FIXES) {
      t = t.replace(pattern, replacement);
    }
    return t;
  });

  // Final cleanup
  tags = tags
    .map(t => t.trim())
    .filter(t => t.length > 0)
    // Skip tags that are just numbers or section references
    .filter(t => !/^\d+$/.test(t))
    .filter(t => !/^§\s*\d+$/.test(t));

  return tags.length > 0 ? tags : null;
}

// ─── PDF text extraction ────────────────────────────────────────────────────

let pdfjs: any;

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
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
    const pageText = content.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  await pdf.destroy();
  return fullText;
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) return url.slice(idx + marker.length);
  return null;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test');
  const testCount = testMode ? parseInt(args[args.indexOf('--test') + 1] || '3', 10) : 0;
  const dryRun = args.includes('--dry');

  console.log('🔑 Fetching service role key...');
  const serviceKey = getServiceRoleKey();
  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  console.log('📥 Fetching Lösung materials from teaching_materials...');
  let query = supabase
    .from('teaching_materials')
    .select(`
      id, title, file_name, file_url, folder_id,
      folder:material_folders!teaching_materials_folder_id_fkey(id, name, schwerpunkt_tags)
    `)
    .or('title.ilike.%lösung%,title.ilike.%loesung%')
    .order('file_name');

  const { data: materials, error } = await query;
  if (error) {
    console.error('❌ Error fetching materials:', error);
    process.exit(1);
  }

  console.log(`📋 Found ${materials.length} Lösung materials`);

  const toProcess = testMode ? materials.slice(0, testCount) : materials;
  if (testMode) console.log(`🧪 Test mode: processing only ${toProcess.length} materials\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const results: { folderName: string; fileName: string; tags: string[] | null }[] = [];

  for (const m of toProcess) {
    const url = m.file_url as string;
    const storagePath = storagePathFromUrl(url);
    const folder = m.folder as any;

    if (!storagePath) {
      console.log(`⚠️  ${m.file_name}: Could not parse storage path`);
      failed++;
      continue;
    }

    if (!folder) {
      console.log(`⚠️  ${m.file_name}: No parent folder found`);
      failed++;
      continue;
    }

    console.log(`\n📄 ${m.file_name}`);
    console.log(`   📁 Folder: ${folder.name} (${folder.id})`);

    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(storagePath);

      if (downloadError || !fileData) {
        console.log(`   ❌ Download failed: ${downloadError?.message || 'no data'}`);
        failed++;
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);
      const text = await extractTextFromPdf(pdfBuffer);

      const tags = extractSchwerpunkte(text);

      if (!tags || tags.length === 0) {
        console.log(`   ⏭️  No Schwerpunkte found`);
        results.push({ folderName: folder.name, fileName: m.file_name, tags: null });
        skipped++;
        continue;
      }

      console.log(`   🏷️  Found ${tags.length} tags:`);
      tags.forEach(t => console.log(`      • ${t}`));

      results.push({ folderName: folder.name, fileName: m.file_name, tags });

      if (!dryRun) {
        // Merge with existing tags (avoid duplicates)
        const existing = folder.schwerpunkt_tags || [];
        const merged = [...new Set([...existing, ...tags])];

        const { error: updateError } = await supabase
          .from('material_folders')
          .update({ schwerpunkt_tags: merged })
          .eq('id', folder.id);

        if (updateError) {
          console.log(`   ❌ Update failed: ${updateError.message}`);
          failed++;
        } else {
          console.log(`   ✅ Saved ${merged.length} tags to folder "${folder.name}" (was ${existing.length})`);
          updated++;
        }
      } else {
        console.log(`   🏜️  Dry run: not saving to DB`);
        updated++;
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (no Schwerpunkte): ${skipped}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${toProcess.length}`);
  if (dryRun) console.log(`   (Dry run - no DB writes)`);

  // Detailed results table
  if (testMode || dryRun) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 Detailed Results:`);
    console.log(`${'─'.repeat(60)}`);
    for (const r of results) {
      console.log(`\n📁 ${r.folderName}`);
      console.log(`   📄 ${r.fileName}`);
      if (r.tags && r.tags.length > 0) {
        console.log(`   🏷️  Tags:`);
        r.tags.forEach(t => console.log(`      • ${t}`));
      } else {
        console.log(`   ⏭️  No Schwerpunkte found`);
      }
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
