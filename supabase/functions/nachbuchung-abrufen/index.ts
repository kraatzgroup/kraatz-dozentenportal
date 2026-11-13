// Edge-Function: Nachbuchungs-Anfrage per Token abrufen (öffentlich).
// Gibt nur nach erfolgreicher Token-Prüfung minimale Daten zurück, damit
// Teilnehmerdaten niemals ohne gültigen Link öffentlich abrufbar sind.
console.log('🚀 nachbuchung-abrufen edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Supabase environment incomplete' }, 500);

  try {
    const body = await req.json();
    const token = (body?.token as string | undefined)?.trim();
    if (!token) return json({ ok: false, reason: 'invalid' });

    const tokenHash = await sha256(token);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: row } = await supabase
      .from('nachbuchungen')
      .select('id, teilnehmer_name, teilnehmer_tn_nummer, dozent_id, rechtsgebiet, status, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!row) return json({ ok: false, reason: 'invalid' });

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json({ ok: false, reason: 'expired' });
    }

    if (row.status === 'beantwortet') {
      return json({ ok: false, reason: 'already_answered' });
    }

    const { data: dozent } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', row.dozent_id)
      .maybeSingle();

    return json({
      ok: true,
      teilnehmer_name: row.teilnehmer_name || 'Ihre Teilnehmerin / Ihr Teilnehmer',
      teilnehmer_tn_nummer: row.teilnehmer_tn_nummer || null,
      rechtsgebiet: row.rechtsgebiet,
      dozent_name: dozent?.full_name || '',
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return json({ ok: false, reason: 'error', error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});