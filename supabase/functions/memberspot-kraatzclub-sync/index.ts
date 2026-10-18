/// <reference path="../deno.d.ts" />
/// <reference path="../npm-imports.d.ts" />
// Edge function: memberspot-kraatzclub-sync
//
// Runs daily at 00:15 (Europe/Berlin) via pg_cron and right after a new
// Kraatz-Club-Mitglied is saved. Claims all due Memberspot accesses via
// memberspot_kc_claim_due():
//   - grant:  Vertragsbeginn erreicht (Free Access immer)
//   - revoke: Vertragsende überschritten (nie für Free Access)
// and sends one webhook per access to Zapier. Zapier executes the Memberspot
// action and reports the result to memberspot-kraatzclub-callback.
//
// Aktivierungs-E-Mail: Sobald für ein Mitglied die Freischaltung fällig ist
// (Vertragsbeginn erreicht) und an Zapier übergeben wurde, geht einmalig die
// E-Mail "Ihr Zugang zum Kraatz Club ist freigeschaltet" raus. Liegt der
// Vertragsbeginn in der Zukunft, wird sie erst am Tag des Beginns versendet.
//
// Secrets:
//   ZAPIER_KC_GRANT_HOOK_URL   Catch Hook of the "Zugang freischalten" Zap
//   ZAPIER_KC_REVOKE_HOOK_URL  Catch Hook of the "Zugang entziehen" Zap
//   MAILGUN_API_KEY            Versand der Aktivierungs-E-Mail
import { createClient } from 'npm:@supabase/supabase-js@2';
import { logNotification } from '../_shared/notification-log.ts';

const KRAATZ_CLUB_LOGIN_URL = 'https://member.kraatz-club.de/auth/login';
const KRAATZ_CLUB_LOGO_URL =
  'https://files.mspotcdn.de/schools%2FwgExlBUwDc02VQa5IKie%2Flogo-1682680505711.png?alt=media&token=0ef3ffa7-d1c4-427e-a8a3-5f4c1d21529e';
const EMAIL_SUBJECT = 'Ihr Zugang zum Kraatz Club ist freigeschaltet';
const EMAIL_SENDER = 'Kraatz Club <postmaster@kraatz-group.de>';
const MAILGUN_DOMAIN = 'kraatz-group.de';

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildActivationEmailHtml(vorname: string, nachname: string, zugang: string[]): string {
  const zugaengeHtml = (zugang || [])
    .filter((z) => z !== 'Gratis Monat')
    .map((z) => `<li style="margin:0 0 6px;">${escapeHtml(z)}</li>`)
    .join('');
  return `<div style="margin:0;padding:24px 12px;background-color:#F3F4FA;font-family:'Montserrat','Avenir','Avenir Next',Arial,sans-serif;color:#4E5D78;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;margin:0 auto;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">

<tr><td align="center" style="padding:28px 24px 20px;background-color:#FFFFFF;border-bottom:1px solid #E9ECEF;">
<img src="${KRAATZ_CLUB_LOGO_URL}" alt="Kraatz Club" style="height:64px;display:block;margin:0 auto;">
</td></tr>

<tr><td style="padding:36px 32px 8px;font-size:16px;line-height:1.7;color:#4E5D78;">
<p style="margin:0 0 16px;">Guten Tag ${escapeHtml(vorname)} ${escapeHtml(nachname)},</p>
<p style="margin:0 0 16px;">wir freuen uns, Ihnen mitteilen zu können, dass Ihr Zugang zum Kraatz Club freigeschaltet wurde.</p>
<p style="margin:0 0 8px;">Folgende Zugänge stehen Ihnen ab sofort zur Verfügung:</p>
<ul style="margin:0 0 16px;padding-left:20px;">${zugaengeHtml}</ul>
</td></tr>

<tr><td style="padding:8px 32px 16px;">
<a href="${KRAATZ_CLUB_LOGIN_URL}" style="display:inline-block;background-color:#2D84C1;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:13px 26px;border-radius:8px;">Jetzt im Kraatz Club anmelden</a>
</td></tr>

<tr><td style="padding:16px 32px 32px;font-size:15px;line-height:1.7;color:#4E5D78;">
<p style="margin:0 0 12px;"><strong>Sie haben eine separate E-Mail mit dem Betreff „Willkommen zum Mitgliederbereich von Kraatz-Club" vom Absender Kraatz-Club &lt;antwort@memberspot.de&gt; erhalten. Über diese E-Mail können Sie Ihr Passwort festlegen.</strong></p>
<p style="margin:0 0 12px;">Falls Sie diese E-Mail nicht erhalten haben, prüfen Sie bitte Ihren Spam-Ordner. Sollte sie auch dort nicht sein, nutzen Sie bitte über <a href="${KRAATZ_CLUB_LOGIN_URL}" style="color:#2D84C1;font-weight:600;">${KRAATZ_CLUB_LOGIN_URL}</a> die Funktion „Passwort vergessen", um die E-Mail erneut anzufordern.</p>
<p style="margin:0 0 12px;">Hinweis: <strong>Falls Sie bereits mit dieser E-Mail-Adresse Mitglied im Kraatz Club sind oder waren, erhalten Sie keine gesonderte E-Mail für die Vergabe eines Passwortes. Ihr regulärer Login behält seine Gültigkeit. Falls Sie sich an das Passwort nicht mehr erinnern können, setzen Sie es bitte über die Funktion „Passwort vergessen" zurück.</strong></p>
<p style="margin:0;">Wir wünschen Ihnen viel Erfolg bei Ihrer Vorbereitung.<br><br><strong style="color:#000000;">Ihr Team der Akademie Kraatz</strong></p>
</td></tr>

<tr><td align="center" style="padding:20px 24px;background-color:#F8F9FA;border-top:1px solid #E9ECEF;font-size:12px;line-height:1.7;color:#666666;">
Akademie Kraatz GmbH &middot; Wilmersdorfer Str. 145/146 &middot; 10585 Berlin<br>
<a href="https://kraatz-group.de/impressum/" style="color:#666666;">Impressum</a> &middot;
<a href="https://kraatz-group.de/datenschutzerklaerung/" style="color:#666666;">Datenschutz</a>
</td></tr>

</table>
</div>`;
}

async function sendActivationEmail(
  supabaseAdmin: any,
  member: { id: string; vorname: string; nachname: string; email: string; zugang: string[] },
): Promise<void> {
  const mailgunApiKey = (Deno.env.get('MAILGUN_API_KEY') ?? '').trim();
  if (!mailgunApiKey) throw new Error('MAILGUN_API_KEY not configured');

  const toName = `${member.vorname} ${member.nachname}`.trim();
  const formData = new FormData();
  formData.append('from', EMAIL_SENDER);
  formData.append('to', member.email);
  formData.append('subject', EMAIL_SUBJECT);
  formData.append('html', buildActivationEmailHtml(member.vorname, member.nachname, member.zugang));
  formData.append('h:Reply-To', 'postmaster@kraatz-group.de');
  formData.append('charset', 'utf-8');

  const res = await fetch(`https://api.eu.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}` },
    body: formData,
  });

  if (res.ok) {
    const result = await res.json().catch(() => ({}));
    await logNotification({
      edgeFunction: 'send-kraatz-club-zugang-email',
      supabaseAdmin,
      recipientEmail: member.email,
      recipientName: toName,
      subject: EMAIL_SUBJECT,
      sender: EMAIL_SENDER,
      status: 'sent',
      providerMessageId: result?.id,
      context: { mitgliedId: member.id },
    });
    return;
  }

  const errorText = await res.text();
  await logNotification({
    edgeFunction: 'send-kraatz-club-zugang-email',
    supabaseAdmin,
    recipientEmail: member.email,
    recipientName: toName,
    subject: EMAIL_SUBJECT,
    sender: EMAIL_SENDER,
    status: 'failed',
    errorMessage: `Mailgun error: ${res.status} - ${errorText}`.slice(0, 1000),
    context: { mitgliedId: member.id },
  });
  throw new Error(`Mailgun error ${res.status}: ${errorText.slice(0, 200)}`);
}

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
    const grantedMembers = new Set<string>();

    for (const item of due) {
      try {
        await postWithRetry(hooks[item.aktion], { ...item, callback_url: callbackUrl });
        sent++;
        // Free Access allein löst keine Mail aus (z. B. wenn der Vertrag schon beendet ist)
        if (item.aktion === 'grant' && item.zugang !== 'Free Access') grantedMembers.add(item.mitglied_id);
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

    // Aktivierungs-E-Mail einmalig pro Mitglied, sobald dessen Freischaltung fällig ist.
    // Das Flag wird vor dem Versand atomar gesetzt (kein Doppelversand bei parallelen Läufen)
    // und bei einem Mailgun-Fehler zurückgesetzt, damit der nächste Lauf es erneut versucht.
    let mails = 0;
    let mailsFailed = 0;
    for (const mitgliedId of grantedMembers) {
      const { data: member } = await supabaseAdmin
        .from('memberspot_kraatzclub_mitglieder')
        .update({ activation_email_sent_at: new Date().toISOString() })
        .eq('id', mitgliedId)
        .is('activation_email_sent_at', null)
        .select('id, vorname, nachname, email, zugang')
        .maybeSingle();
      if (!member) continue;
      try {
        await sendActivationEmail(supabaseAdmin, member);
        mails++;
      } catch (e) {
        mailsFailed++;
        console.error(`❌ Aktivierungs-E-Mail an ${member.email}:`, e instanceof Error ? e.message : String(e));
        await supabaseAdmin
          .from('memberspot_kraatzclub_mitglieder')
          .update({ activation_email_sent_at: null })
          .eq('id', mitgliedId);
      }
    }

    console.log(
      `✅ memberspot-kraatzclub-sync: ${due.length} fällig, ${sent} gesendet, ${failed} Fehler, ${mails} E-Mails, ${mailsFailed} E-Mail-Fehler`,
    );
    return json({ success: true, due: due.length, sent, failed, mails, mailsFailed });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('❌ memberspot-kraatzclub-sync failed:', message);
    return json({ success: false, error: message }, 500);
  }
});
