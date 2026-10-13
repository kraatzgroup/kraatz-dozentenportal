#!/usr/bin/env node
/**
 * Repariert Multipart-beschädigte Dateien im Supabase Storage (Bucket "masterclass").
 *
 * Hintergrund:
 * Ein Teil der Dateien wurde beim Upload als kompletter "multipart/form-data"-Body
 * gespeichert (beginnen mit "------WebKitFormBoundary..."), statt nur der echten
 * Datei-Bytes. Der echte Inhalt ist jedoch vollständig im Body enthalten und kann
 * hieraus wiederhergestellt werden.
 *
 * Funktionsweise:
 *  1. Listet alle Objekte unter "materials/" im Bucket "masterclass".
 *  2. Prüft, ob ein Objekt mit einer Multipart-Boundary beginnt (=> beschädigt).
 *  3. Lädt den Multipart-Body, extrahiert die echten Datei-Bytes + Content-Type.
 *  4. Validiert die extrahierten Bytes anhand der Datei-Signatur (PDF/PNG/ZIP/...).
 *  5. Lädt die reparierten Bytes mit dem Service-Role-Key wieder hoch (upsert).
 *  6. Verifiziert, dass das Objekt danach nicht mehr mit einer Boundary beginnt.
 *
 * Nutzung:
 *   node scripts/repair-multipart-files.mjs            # Dry-Run (nur prüfen/extrahieren)
 *   node scripts/repair-multipart-files.mjs --apply    # Wirklich reparieren + hochladen
 *   node scripts/repair-multipart-files.mjs --apply --limit 5   # Nur die ersten 5
 *
 * Benötigte Umgebungsvariablen (mit Defaults):
 *   SUPABASE_URL            https://gkkveloqajxghhflkfru.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gkkveloqajxghhflkfru.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'masterclass';
const PREFIX = 'materials/';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '4', 10);
const APPLY = process.argv.includes('--apply');
const LIMIT_INDEX = process.argv.indexOf('--limit');
const LIMIT = LIMIT_INDEX !== -1 ? parseInt(process.argv[LIMIT_INDEX + 1], 10) : Infinity;
const ONLY_INDEX = process.argv.indexOf('--only');
const ONLY = ONLY_INDEX !== -1 ? process.argv[ONLY_INDEX + 1] : null;

if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY fehlt. Setze die Variable und starte erneut.');
  process.exit(1);
}

const AUTH = { Authorization: `Bearer ${SERVICE_ROLE_KEY}` };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch mit Retry/Backoff bei 429 (Rate-Limit) und 5xx-Fehlern. */
async function fetchWithRetry(url, options = {}, retries = 6) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const resp = await fetch(url, options);
    if (resp.ok || (resp.status < 500 && resp.status !== 429)) return resp;
    if (resp.status === 429 || resp.status >= 500) {
      if (attempt >= retries) return resp;
      const wait = Math.min(30000, 1000 * 2 ** attempt) + Math.random() * 500;
      await sleep(wait);
      attempt++;
      continue;
    }
    return resp;
  }
}

async function listObjects() {
  const objects = [];
  let offset = 0;
  const pageSize = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const resp = await fetchWithRetry(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefix: PREFIX,
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });
    if (!resp.ok) throw new Error(`list failed (${resp.status}): ${await resp.text()}`);
    const page = await resp.json();
    if (!Array.isArray(page) || page.length === 0) break;
    objects.push(...page);
    offset += page.length;
    if (page.length < pageSize) break;
  }
  return objects;
}

function looksMultipart(head) {
  return head.length >= 6 && head.slice(0, 6).toString('latin1') === '------';
}

/** Erwartete Datei-Signatur anhand des MIME-Typs. */
function expectedSignature(mime) {
  if (mime === 'application/pdf') return Buffer.from('%PDF');
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/zip'
  ) {
    return Buffer.from('PK');
  }
  if (mime === 'image/png') return Buffer.from('\x89PNG');
  if (mime === 'image/jpeg') return Buffer.from('\xff\xd8\xff');
  if (mime === 'image/gif') return Buffer.from('GIF8');
  if (mime === 'image/webp') return Buffer.from('RIFF');
  return null; // unbekannt => nur Größe prüfen
}

/**
 * Extrahiert aus einem Multipart-Body die echten Datei-Bytes und den Content-Type.
 */
function extractFileFromMultipart(buf) {
  const CRLF = '\r\n';
  const firstEol = buf.indexOf(CRLF);
  if (firstEol === -1) throw new Error('kein Zeilenumbruch gefunden');
  const boundary = buf.subarray(0, firstEol).toString('latin1');

  const fnIdx = buf.indexOf(Buffer.from('filename="'));
  if (fnIdx === -1) throw new Error('kein filename-Marker gefunden');

  const headerEnd = buf.indexOf(Buffer.from('\r\n\r\n'), fnIdx);
  if (headerEnd === -1) throw new Error('kein Header-Ende gefunden');
  const contentStart = headerEnd + 4;

  // Content-Type aus den Headern der Datei-Part lesen
  const ctMarker = Buffer.from('Content-Type:');
  const ctIdx = buf.indexOf(ctMarker, fnIdx);
  let contentType = 'application/octet-stream';
  if (ctIdx !== -1 && ctIdx < headerEnd) {
    const ctLineEnd = buf.indexOf(CRLF, ctIdx);
    contentType = buf.subarray(ctIdx + ctMarker.length, ctLineEnd).toString('latin1').trim();
  }

  // Ende = schließende Boundary ("boundary--")
  const closing = Buffer.from(boundary + '--', 'latin1');
  const closeIdx = buf.lastIndexOf(closing);
  if (closeIdx === -1) throw new Error('keine schließende Boundary gefunden');

  let end = closeIdx;
  if (buf[end - 1] === 0x0a) end--; // \n
  if (buf[end - 1] === 0x0d) end--; // \r

  const content = buf.subarray(contentStart, end);
  return { content, contentType };
}

function validateExtracted(content, contentType) {
  if (!content || content.length === 0) return 'leer';
  const sig = expectedSignature(contentType);
  if (sig) {
    if (content.length < sig.length) return 'zu klein';
    if (Buffer.compare(content.subarray(0, sig.length), sig) !== 0) return 'falsche Signatur';
  }
  return null; // ok
}

async function downloadFull(name) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}${name}?cb=${Date.now()}-${Math.random()}`;
  const resp = await fetchWithRetry(url);
  if (!resp.ok) throw new Error(`download HTTP ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

async function downloadHead(name, bytes = 32) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}${name}?cb=${Date.now()}-${Math.random()}`;
  const resp = await fetchWithRetry(url, { headers: { Range: `bytes=0-${bytes - 1}` } });
  if (!resp.ok && resp.status !== 206) throw new Error(`head HTTP ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

async function uploadCorrected(name, content, contentType) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${PREFIX}${name}`;
  const resp = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      ...AUTH,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: content,
  });
  if (!resp.ok) throw new Error(`upload HTTP ${resp.status}: ${await resp.text()}`);
}

async function repairOne(name, meta) {
  const head = await downloadHead(name);
  if (!looksMultipart(head)) {
    return { name, status: 'ok' };
  }
  const originalSize = meta?.metadata?.size;
  const full = await downloadFull(name);
  const { content, contentType } = extractFileFromMultipart(full);
  const invalid = validateExtracted(content, contentType);
  if (invalid) {
    return { name, status: 'invalid', reason: invalid, originalSize, extractedSize: content.length };
  }
  if (APPLY) {
    await uploadCorrected(name, content, contentType);
    const verifyHead = await downloadHead(name, 32);
    if (looksMultipart(verifyHead)) {
      return { name, status: 'verify-failed', originalSize, extractedSize: content.length };
    }
    return { name, status: 'repaired', originalSize, extractedSize: content.length, contentType };
  }
  return { name, status: 'would-repair', originalSize, extractedSize: content.length, contentType };
}

async function main() {
  console.log(`Starte Reparatur-Scan (${APPLY ? 'APPLY' : 'DRY-RUN'}) ...`);
  const objects = await listObjects();
  console.log(`Gefundene Objekte unter "${PREFIX}": ${objects.length}`);

  const scoped = ONLY ? objects.filter((o) => o.name === ONLY) : objects;
  const targets = LIMIT === Infinity ? scoped : scoped.slice(0, LIMIT);
  if (ONLY && targets.length === 0) {
    console.error(`Objekt "${ONLY}" nicht gefunden.`);
    process.exit(1);
  }
  let queue = targets;
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < queue.length) {
      const obj = queue[idx++];
      try {
        const r = await repairOne(obj.name, obj);
        results.push(r);
        if (r.status !== 'ok') console.log(`[${r.status}] ${r.name} (${r.originalSize} -> ${r.extractedSize ?? '-'})`);
      } catch (err) {
        results.push({ name: obj.name, status: 'error', reason: String(err.message || err) });
        console.log(`[error] ${obj.name}: ${err.message || err}`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, worker);
  await Promise.all(workers);

  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log('\n=== Zusammenfassung ===');
  for (const [k, v] of Object.entries(counts)) console.log(`${k}: ${v}`);

  const failed = results.filter((r) => ['error', 'invalid', 'verify-failed'].includes(r.status));
  if (failed.length) {
    const fs = await import('fs');
    fs.writeFileSync('repair-multipart-files.failed.log', JSON.stringify(failed, null, 2) + '\n');
    console.log(`Fehlgeschlagene in "repair-multipart-files.failed.log" (${failed.length}).`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});