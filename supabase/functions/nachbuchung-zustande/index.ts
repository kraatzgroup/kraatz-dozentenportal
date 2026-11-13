// Edge-Function: Nachbuchungs-Ausgang (zustande gekommen ja/nein) eintragen.
// Aufruf nur durch Verwaltung, Admin oder Vertrieb (Auth-Check).
console.log('🚀 nachbuchung-zustande edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

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
    if (!id) return json({ error: 'id ist erforderlich' }, 400);

    // zustande kann true, false oder null (offen) sein
    const zustandeRaw = body?.zustande;
    const zustande = zustandeRaw === true ? true : zustandeRaw === false ? false : null;

    const stundenRaw = body?.stunden;
    const provisionRaw = body?.provision;
    const stunden = stundenRaw !== undefined && stundenRaw !== null && stundenRaw !== '' ? Number(stundenRaw) : null;
    const provision = provisionRaw !== undefined && provisionRaw !== null && provisionRaw !== '' ? Number(provisionRaw) : null;

    const update: Record<string, unknown> = { nachbuchung_zustande: zustande };
    if (zustande === true) {
      update.nachbuchung_stunden = stunden;
      update.nachbuchung_provision = provision;
    } else {
      update.nachbuchung_stunden = null;
      update.nachbuchung_provision = null;
    }

    const { error } = await supabase
      .from('nachbuchungen')
      .update(update)
      .eq('id', id);

    if (error) throw error;

    return json({ ok: true, zustande, stunden, provision });
  } catch (error) {
    console.error('❌ Error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});