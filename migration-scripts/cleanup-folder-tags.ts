/**
 * One-shot cleanup: fix PDF spacing artifacts in existing schwerpunkt_tags
 * in material_folders (e.g. "Ve rständigungen" -> "Verständigungen").
 *
 * Does NOT re-extract from PDFs — only cleans the tags already stored in the DB.
 *
 * Usage:
 *   npx tsx migration-scripts/cleanup-folder-tags.ts           # full run
 *   npx tsx migration-scripts/cleanup-folder-tags.ts --dry     # dry run, no DB writes
 *
 * Environment: uses VITE_SUPABASE_URL + service role key from supabase CLI.
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gkkveloqajxghhflkfru.supabase.co';

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

const STOP_WORDS = new Set([
  'und', 'der', 'die', 'das', 'von', 'im', 'in', 'an', 'auf', 'aus', 'mit',
  'bei', 'nach', 'zur', 'zum', 'i.r.d', 'i.s.d', 'i.r.d.', 'i.s.d.',
  'abs', 'satz', 'nr', 'ff', 'bgb', 'stgb', 'vwgo', 'grch', 'aeuv',
  'a.e', 'a.e.', 'gg', 'stpo', 'bverfg', 'eugh', 'mrk', 'emrk',
  'des', 'dem', 'den', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
  'durch', 'über', 'unter', 'vor', 'gegen', 'gem', 'gem.',
  'i.h.v', 'i.h.v.', 'ist', 'wird', 'kann', 'darf', 'sind', 'hat', 'haben',
  'nicht', 'kein', 'keine', 'keiner', 'keines',
  'sog', 'sog.', 'insbes', 'insbes.', 'bzw', 'bzw.', 'etc', 'etc.',
  'teil', 'frage', 'fall', 'fallgruppen',
  // Common abbreviations that should not be joined with following word
  'nrw', 'hgb', 'zpo', 'ao', 'ggo', 'vwvg', 'bbg', 'sgb',
  'kfz', 'agb', 'vfg', 'art', 'ehe', 'tat', 'es', 'zu', 'i', 'h',
  'kg', 'tod', 'co', 'gmbh', 'ohg', 'eg', 'e.v',
]);

/**
 * Fix PDF intra-word spacing artifacts in a single tag string.
 * "Ve rständigungen" -> "Verständigungen"
 * "To t schlag" -> "Totschlag"
 */
function fixTagSpacing(tag: string): string {
  let t = tag;
  let prev;
  do {
    prev = t;
    t = t.replace(/(\b[A-Za-zäöüÄÖÜ]{1,3})\s+([a-zäöü])/g, (m, a, b) => {
      if (STOP_WORDS.has(a.toLowerCase()) || STOP_WORDS.has(a.toLowerCase().replace(/\.$/, ''))) return m;
      if (/^[ivxIVX]+$/.test(a)) return m;
      return a + b;
    });
  } while (t !== prev);
  return t;
}

async function main() {
  const isDryRun = process.argv.includes('--dry');
  console.log('🔑 Fetching service role key...');
  const serviceKey = getServiceRoleKey();
  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  console.log('📥 Fetching all material_folders with schwerpunkt_tags...');
  const { data: folders, error } = await supabase
    .from('material_folders')
    .select('id, name, schwerpunkt_tags')
    .not('schwerpunkt_tags', 'is', null);

  if (error) {
    console.error('❌ Error fetching folders:', error);
    process.exit(1);
  }

  console.log(`📋 Found ${folders.length} folders with tags`);

  let updated = 0;
  let unchanged = 0;
  const changes: { folder: string; oldTag: string; newTag: string }[] = [];

  for (const folder of folders) {
    const tags: string[] = Array.isArray(folder.schwerpunkt_tags) ? folder.schwerpunkt_tags : [];
    if (tags.length === 0) continue;

    const fixedTags = tags.map(fixTagSpacing);
    // Deduplicate after fixing (e.g. "Ve rständigungen" and "Verständigungen" might both exist)
    const deduped = Array.from(new Set(fixedTags));

    const changed = JSON.stringify(deduped) !== JSON.stringify(tags);
    if (changed) {
      updated++;
      tags.forEach((oldTag, i) => {
        if (oldTag !== fixedTags[i]) {
          changes.push({ folder: folder.name, oldTag, newTag: fixedTags[i] });
        }
      });

      if (!isDryRun) {
        const { error: updateError } = await supabase
          .from('material_folders')
          .update({ schwerpunkt_tags: deduped })
          .eq('id', folder.id);
        if (updateError) {
          console.error(`❌ Error updating folder ${folder.name}:`, updateError);
        }
      }
    } else {
      unchanged++;
    }
  }

  console.log('\n=== RESULTS ===');
  console.log(`✅ Updated: ${updated} folders`);
  console.log(`⏭️  Unchanged: ${unchanged} folders`);
  if (isDryRun) console.log('🔍 DRY RUN — no DB writes');

  if (changes.length > 0) {
    console.log('\n=== CHANGES ===');
    for (const c of changes) {
      console.log(`  [${c.folder}] "${c.oldTag}" -> "${c.newTag}"`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
