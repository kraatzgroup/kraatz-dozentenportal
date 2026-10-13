/// <reference path="../deno.d.ts" />
/// <reference path="../npm-imports.d.ts" />
// Edge function: memberspot-kraatzclub-sync
//
// Runs hourly via pg_cron (and right after a new Kraatz-Club-Mitglied is
// saved). Claims all due Memberspot accesses via memberspot_kc_claim_due():
//   - grant:  Vertragsbeginn erreicht (Free Access immer)
//   - revoke: Vertragsende überschritten (nie für Free Access)
// and sends one webhook per access to Zapier. Zapier executes the Memberspot
// action and reports the result to memberspot-kraatzclub-callback.
//
// Secrets:
//   ZAPIER_KC_GRANT_HOOK_URL   Catch Hook of the "Zugang freischalten" Zap
//   ZAPIER_KC_REVOKE_HOOK_URL  Catch Hook of the "Zugang entziehen" Zap
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DueAccess {
  zugang_id: string;
  aktion: 'grant' | 'revoke';
  mitglied_id: string;
  vorname: string;
  nachname: string;
  email: string;
  vertragsbeginn: string;
  vertragsende: string;
  zugang: string;
  offer_id: string;
  order_id: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Bis zu 3 Versuche bei Netzwerkfehlern, 429 und 5xx; 4xx sofort als Fehler
async function postWithRetry(url: string, payload: unknown): Promise<void> {
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return;
      lastError = `Zapier antwortete mit HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
      if (res.status !== 429 && res.status < 500) break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    if (attempt < 3) await sleep(attempt * 2000);
  }
  throw new Error(lastError);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const hooks = {
      grant: (Deno.env.get('ZAPIER_KC_GRANT_HOOK_URL') ?? '').trim(),
      revoke: (Deno.env.get('ZAPIER_KC_REVOKE_HOOK_URL') ?? '').trim(),
    };

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    }
    // Ohne Hook-URLs nichts claimen, sonst bleiben Zugänge auf "gesendet" hängen
    if (!hooks.grant || !hooks.revoke) {
      throw new Error('ZAPIER_KC_GRANT_HOOK_URL or ZAPIER_KC_REVOKE_HOOK_URL not configured');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabaseAdmin.rpc('memberspot_kc_claim_due');
    if (error) throw error;

    const due = (data || []) as DueAccess[];
    const callbackUrl = `${supabaseUrl}/functions/v1/memberspot-kraatzclub-callback`;
    let sent = 0;
    let failed = 0;

    for (const item of due) {
      try {
        await postWithRetry(hooks[item.aktion], { ...item, callback_url: callbackUrl });
        sent++;
      } catch (e) {
        failed++;
        const message = e instanceof Error ? e.message : String(e);
        console.error(`❌ ${item.aktion} ${item.zugang} für ${item.email}: ${message}`);
        await supabaseAdmin
          .from('memberspot_kraatzclub_zugaenge')
          .update({ status: 'fehler', last_error: message })
          .eq('id', item.zugang_id);
      }
    }

    console.log(`✅ memberspot-kraatzclub-sync: ${due.length} fällig, ${sent} gesendet, ${failed} Fehler`);
    return json({ success: true, due: due.length, sent, failed });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('❌ memberspot-kraatzclub-sync failed:', message);
    return json({ success: false, error: message }, 500);
  }
});
