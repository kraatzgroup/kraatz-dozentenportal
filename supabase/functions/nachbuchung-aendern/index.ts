// Edge-Function: Nachbuchungs-Anfrage ändern (Verwaltung/Admin/Vertrieb).
// Aktualisiert Teilnehmer, Rechtsgebiet, Dozent und ggf. die Dozenten-E-Mail
// in den Stammdaten. Versendet dabei KEINE E-Mail (das macht "erneut senden").
console.log('🚀 nachbuchung-aendern edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function isPlaceholderEmail(email: string): boolean {
  return /^dozent\d+@kraatz-group\.de$/i.test(email.trim());
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Supabase environment incomplete' }, 500);

  const authHeader = req.headers.get('Authorization');
  const callerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!callerToken) return json({ error: 'Unauthorized' }, 401);

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: authError } = await authClient.auth.getUser(callerToken);
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, additional_roles')
    .eq('id', user.id)
    .maybeSingle();

  const roles = new Set([callerProfile?.role, ...(callerProfile?.additional_roles || [])]);
  const isStaff = roles.has('admin') || roles.has('verwaltung') || roles.has('vertrieb');
  if (!isStaff) return json({ error: 'Forbidden' }, 403);

  try {
    const body = await req.json();
    const id = body?.id as string | undefined;
    const teilnehmerId = (body?.teilnehmer_id as string | undefined)?.trim();
    const teilnehmerName = (body?.teilnehmer_name as string | undefined)?.trim();
    const teilnehmerTn = (body?.teilnehmer_tn_nummer as string | undefined)?.trim();
    const dozentId = body?.dozent_id as string | undefined;
    const rechtsgebiet = body?.rechtsgebiet as string | undefined;
    const dozentEmail = (body?.dozent_email as string | undefined)?.trim();

    if (!id || !dozentId || !rechtsgebiet) {
      return json({ error: 'id, dozent_id und rechtsgebiet sind erforderlich' }, 400);
    }
    if (!teilnehmerId && !teilnehmerName) {
      return json({ error: 'teilnehmer_id oder teilnehmer_name ist erforderlich' }, 400);
    }

    const { data: existing } = await supabase
      .from('nachbuchungen')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return json({ error: 'Anfrage nicht gefunden' }, 404);

    let finalTeilnehmerId: string | null = null;
    let finalTeilnehmerName = teilnehmerName || '';
    let finalTeilnehmerTn = teilnehmerTn || null;

    if (teilnehmerId) {
      const { data: teilnehmer } = await supabase
        .from('teilnehmer')
        .select('id, name, tn_nummer')
        .eq('id', teilnehmerId)
        .maybeSingle();
      if (!teilnehmer) return json({ error: 'Teilnehmer nicht gefunden' }, 404);
      finalTeilnehmerId = teilnehmer.id;
      finalTeilnehmerName = teilnehmer.name;
      finalTeilnehmerTn = teilnehmer.tn_nummer || null;
    }

    const { data: dozent } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', dozentId)
      .eq('role', 'dozent')
      .maybeSingle();
    if (!dozent || !dozent.email) return json({ error: 'Dozent nicht gefunden oder ohne E-Mail' }, 404);

    // Optional: Dozenten-E-Mail in den Stammdaten korrigieren (keine Welcome-/Reset-Mail)
    if (dozentEmail) {
      if (isPlaceholderEmail(dozentEmail)) {
        return json({ error: 'Bitte korrekte E-Mail-Adresse des Dozenten eingeben' }, 400);
      }
      if (!isValidEmail(dozentEmail)) {
        return json({ error: 'Ungültige E-Mail-Adresse' }, 400);
      }
      if (dozentEmail !== dozent.email) {
        const { error: emailUpdateError } = await supabase
          .from('profiles')
          .update({ email: dozentEmail })
          .eq('id', dozentId);
        if (emailUpdateError) throw emailUpdateError;

        // Auth-E-Mail synchron halten (für Magic-Link-Login), ohne E-Mail zu senden.
        // email_confirm: true → Supabase sendet KEINE Bestätigungs-/Willkommens-Mail
        const { error: authEmailError } = await supabase.auth.admin.updateUserById(dozentId, { email: dozentEmail, email_confirm: true });
        if (authEmailError) console.error('⚠️ auth.users.email konnte nicht aktualisiert werden:', authEmailError);
      }
    }

    const { error: updateError } = await supabase
      .from('nachbuchungen')
      .update({
        teilnehmer_id: finalTeilnehmerId,
        teilnehmer_name: finalTeilnehmerName,
        teilnehmer_tn_nummer: finalTeilnehmerTn,
        dozent_id: dozentId,
        rechtsgebiet,
      })
      .eq('id', id);
    if (updateError) throw updateError;

    return json({ ok: true });
  } catch (error) {
    console.error('❌ Error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});