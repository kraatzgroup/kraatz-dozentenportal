// Edge-Function: Antwort des Dozenten auf eine Nachbuchungs-Anfrage speichern
// (öffentlich, Token-geschützt). Informiert anschließend Verwaltung/Admin/
// Vertrieb per E-Mail, dass das Formular ausgefüllt wurde.
console.log('🚀 nachbuchung-antworten edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';
import { logNotification } from '../_shared/notification-log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const MAILGUN_DOMAIN = 'kraatz-group.de';

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
    const bedarf = body?.bedarf as boolean | undefined;

    if (!token) return json({ ok: false, reason: 'invalid' });
    if (typeof bedarf !== 'boolean') return json({ ok: false, reason: 'bedarf_required' });

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

    const stunden = body?.stunden ? Number(body.stunden) : null;
    const erreichbar = typeof body?.erreichbar === 'string' ? body.erreichbar : null;
    const notiz = typeof body?.notiz === 'string' ? body.notiz : null;
    const grundLernziel = typeof body?.grund_lernziel === 'string' ? body.grund_lernziel : null;

    const { error: updateError } = await supabase
      .from('nachbuchungen')
      .update({
        status: 'beantwortet',
        responded_at: new Date().toISOString(),
        antwort_bedarf: bedarf,
        antwort_stunden: bedarf ? stunden : null,
        antwort_erreichbar: bedarf ? erreichbar : null,
        antwort_grund_lernziel: bedarf ? grundLernziel : null,
        antwort_notiz: notiz,
      })
      .eq('id', row.id);

    if (updateError) throw updateError;

    // Kontextdaten für die Benachrichtigung laden
    const [{ data: dozent }, { data: staff }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('id', row.dozent_id).maybeSingle(),
      supabase
        .from('profiles')
        .select('id, full_name, email, role, additional_roles')
        .eq('is_archived', false)
        .not('email', 'is', null),
    ]);

    const relevantStaff = (staff || []).filter((p) => {
      const roles = new Set([p.role, ...(p.additional_roles || [])]);
      return roles.has('admin');
    });

    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    const dozentLabel = dozent?.full_name || 'Ein Dozent';
    const teilnehmerLabel = [row.teilnehmer_name, row.teilnehmer_tn_nummer].filter(Boolean).join(' · ');
    const bedarfText = bedarf ? 'Ja' : 'Nein';

    for (const staffMember of relevantStaff) {
      if (!staffMember.email || !mailgunApiKey) continue;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
            <img src="https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc" alt="Kraatz Group" style="height: 60px; margin: 0 auto; display: block;">
          </div>
          <div style="padding: 30px 20px; background-color: white;">
            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Nachbuchungsformular ausgefüllt</h2>
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              Hallo ${staffMember.full_name || ''},
            </p>
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              <strong>${dozentLabel}</strong> hat das Nachbuchungsformular für
              <strong>${teilnehmerLabel}</strong> ausgefüllt.
            </p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px; width: 45%;"><strong>Dozent</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${dozentLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Teilnehmer</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${teilnehmerLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Rechtsgebiet</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${row.rechtsgebiet}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Nachbuchungsbedarf</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${bedarfText}</td>
                </tr>
                ${bedarf && stunden ? `
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Zusatzstunden</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${stunden}</td>
                </tr>` : ''}
                ${bedarf && erreichbar ? `
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Erreichbarkeit</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${erreichbar}</td>
                </tr>` : ''}
                ${bedarf && grundLernziel ? `
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Grund / Lernziel</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${grundLernziel}</td>
                </tr>` : ''}
                ${notiz ? `
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Notiz</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${notiz}</td>
                </tr>` : ''}
              </table>
            </div>
            <p style="color: #555; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
              Der Status ist im Dashboard unter „Nachbuchungen" einsehbar.
            </p>
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
            <p style="color: #666; font-size: 12px; margin: 5px 0;">Akademie Kraatz GmbH</p>
            <p style="color: #666; font-size: 12px; margin: 5px 0;">Wilmersdorfer Str. 145/146 - 10585 Berlin</p>
            <p style="color: #666; font-size: 12px; margin: 5px 0;">Diese E-Mail wurde automatisch vom Portal gesendet.</p>
          </div>
        </div>`;

      const formData = new FormData();
      formData.append('from', 'Kraatz Group Portal <postmaster@kraatz-group.de>');
      formData.append('to', staffMember.email);
      formData.append('subject', `Nachbuchungsformular ausgefüllt: ${teilnehmerLabel}`);
      formData.append('html', emailHtml);
      formData.append('charset', 'utf-8');

      try {
        const mailgunResponse = await fetch(`https://api.eu.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
          method: 'POST',
          headers: { Authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}` },
          body: formData,
        });
        const mailgunBody = await mailgunResponse.text();
        let providerMessageId: string | undefined;
        if (mailgunResponse.ok) {
          try { providerMessageId = JSON.parse(mailgunBody)?.id; } catch { /* ignore */ }
        } else {
          console.error(`❌ Mailgun error for ${staffMember.email}:`, mailgunBody);
        }
        await logNotification({
          edgeFunction: 'nachbuchung-antworten',
          supabaseAdmin: supabase,
          recipientEmail: staffMember.email,
          recipientName: staffMember.full_name,
          subject: `Nachbuchungsformular ausgefüllt: ${teilnehmerLabel}`,
          sender: 'Kraatz Group Portal <postmaster@kraatz-group.de>',
          status: mailgunResponse.ok ? 'sent' : 'failed',
          providerMessageId,
          errorMessage: mailgunResponse.ok ? undefined : mailgunBody,
          context: { nachbuchungId: row.id, teilnehmerName: row.teilnehmer_name, rechtsgebiet: row.rechtsgebiet, dozentId: row.dozent_id },
        });
      } catch (mailgunError) {
        console.error(`❌ Failed to send email to ${staffMember.email}:`, mailgunError);
        await logNotification({
          edgeFunction: 'nachbuchung-antworten',
          supabaseAdmin: supabase,
          recipientEmail: staffMember.email,
          recipientName: staffMember.full_name,
          subject: `Nachbuchungsformular ausgefüllt: ${teilnehmerLabel}`,
          sender: 'Kraatz Group Portal <postmaster@kraatz-group.de>',
          status: 'failed',
          errorMessage: mailgunError instanceof Error ? mailgunError.message : String(mailgunError),
          context: { nachbuchungId: row.id, teilnehmerName: row.teilnehmer_name, rechtsgebiet: row.rechtsgebiet, dozentId: row.dozent_id },
        });
      }
    }

    return json({ ok: true });
  } catch (error) {
    console.error('❌ Error:', error);
    return json({ ok: false, reason: 'error', error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});