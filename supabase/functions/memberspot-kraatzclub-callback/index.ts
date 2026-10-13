/// <reference path="../deno.d.ts" />
/// <reference path="../npm-imports.d.ts" />
// Edge function: memberspot-kraatzclub-callback
//
// Called by Zapier (Webhooks by Zapier -> POST) after the Memberspot action
// of the "Zugang freischalten" / "Zugang entziehen" Zap has run.
//
// Accepts JSON as well as form data (Zapier's default payload type).
//
// Auth: header X-Callback-Secret (preferred) or field `secret` / query ?secret=
// Fields:
//   zugang_id       UUID from the webhook payload   (zugang_id OR order_id required)
//   order_id        order id from the webhook payload
//   aktion          'grant' | 'revoke' (optional, defaults to the last sent action)
//   erfolg          true/false (optional, default true)
//   fehler          error text (optional, sets status 'fehler')
//   memberspot_uid  Memberspot user id (optional)
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-callback-secret',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
const isFalse = (v: unknown) => ['false', '0', 'nein', 'no'].includes(str(v).toLowerCase());

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const raw = await req.text();
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    // kein JSON -> als Form-Daten lesen
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const body = await readBody(req);
    const url = new URL(req.url);

    const expectedSecret = str(Deno.env.get('KC_CALLBACK_SECRET'));
    const givenSecret = str(req.headers.get('x-callback-secret')) || str(body.secret) || str(url.searchParams.get('secret'));
    if (!expectedSecret || givenSecret !== expectedSecret) {
      console.warn('⚠️ callback unauthorized', { keys: Object.keys(body) });
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const zugangId = str(body.zugang_id);
    const orderId = str(body.order_id);
    const fehler = str(body.fehler);
    const memberspotUid = str(body.memberspot_uid);
    const erfolg = !isFalse(body.erfolg) && !fehler;

    console.log('📥 callback', { zugang_id: zugangId, order_id: orderId, aktion: str(body.aktion), erfolg, fehler });

    if (zugangId && !UUID_RE.test(zugangId)) {
      return json({ success: false, error: `zugang_id ist keine gültige UUID: ${zugangId}` }, 400);
    }
    if (!zugangId && !orderId) {
      return json({ success: false, error: 'zugang_id oder order_id ist erforderlich' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const query = supabaseAdmin
      .from('memberspot_kraatzclub_zugaenge')
      .select('id, mitglied_id, status, letzte_aktion');
    const { data: zugang, error: findError } = await (zugangId ? query.eq('id', zugangId) : query.eq('order_id', orderId)).maybeSingle();
    if (findError) throw findError;
    if (!zugang) {
      return json({ success: false, error: 'Zugang nicht gefunden' }, 404);
    }

    const aktion = str(body.aktion).toLowerCase() || zugang.letzte_aktion;
    if (aktion !== 'grant' && aktion !== 'revoke') {
      return json({ success: false, error: 'aktion muss grant oder revoke sein' }, 400);
    }
    if (zugang.letzte_aktion && aktion !== zugang.letzte_aktion) {
      // Veraltete Rückmeldung (z. B. Freischaltung, obwohl inzwischen entzogen wird)
      return json({ success: true, ignored: true, status: zugang.status });
    }

    const targetStatus = erfolg ? (aktion === 'grant' ? 'aktiv' : 'entzogen') : 'fehler';
    if (zugang.status === targetStatus && erfolg) {
      return json({ success: true, status: targetStatus, unchanged: true });
    }

    const now = new Date().toISOString();
    const update = erfolg
      ? aktion === 'grant'
        ? { status: 'aktiv', granted_at: now, last_error: null }
        : { status: 'entzogen', revoked_at: now, last_error: null }
      : { status: 'fehler', last_error: (fehler || 'Zapier meldete einen Fehler').slice(0, 1000) };

    const { error: updateError } = await supabaseAdmin
      .from('memberspot_kraatzclub_zugaenge')
      .update({ ...update, letzte_aktion: aktion })
      .eq('id', zugang.id);
    if (updateError) throw updateError;

    if (erfolg && memberspotUid) {
      await supabaseAdmin
        .from('memberspot_kraatzclub_mitglieder')
        .update({ memberspot_uid: memberspotUid })
        .eq('id', zugang.mitglied_id);
    }

    return json({ success: true, status: update.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('❌ memberspot-kraatzclub-callback failed:', message);
    return json({ success: false, error: message }, 500);
  }
});
