// Edge-Function: Erinnerung an Dozenten bei seit 72h ausstehender Nachbuchungs-Antwort.
// Wird von pg_cron (jede Nacht 06:00) aufgerufen, ohne JWT (verify_jwt = false).
console.log('🚀 nachbuchung-erinnerung edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const PORTAL_URL = 'https://portal.kraatz-group.de';
const MAILGUN_DOMAIN = 'kraatz-group.de';
const TOKEN_TTL_DAYS = 14;
const REMINDER_AFTER_HOURS = 72;

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function isPlaceholderEmail(email: string): boolean {
  return /^dozent\d+@kraatz-group\.de$/i.test(email.trim());
}

async function generateMagicLink(
  supabase: any,
  email: string,
  rawToken: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${PORTAL_URL}/nachbuchung/${rawToken}` },
    });
    if (error || !data?.properties?.action_link) {
      console.error('❌ Magic-Link-Erzeugung fehlgeschlagen:', error);
      return null;
    }
    return data.properties.action_link as string;
  } catch (err) {
    console.error('❌ Magic-Link-Fehler:', err);
    return null;
  }
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

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');

  try {
    const cutoff = new Date(Date.now() - REMINDER_AFTER_HOURS * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from('nachbuchungen')
      .select('id, teilnehmer_name, teilnehmer_tn_nummer, dozent_id, rechtsgebiet, status')
      .eq('status', 'ausstehend')
      .lt('sent_at', cutoff)
      .is('reminder_sent_at', null);

    if (error) throw error;

    let sentCount = 0;
    let skipped = 0;

    for (const row of rows || []) {
      const { data: dozent } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', row.dozent_id)
        .maybeSingle();

      if (!dozent || !dozent.email || isPlaceholderEmail(dozent.email)) {
        skipped++;
        continue;
      }

      const rawToken = crypto.randomUUID();
      const tokenHash = await sha256(rawToken);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('nachbuchungen')
        .update({
          token_hash: tokenHash,
          expires_at: expiresAt,
          reminder_sent_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (updateError) {
        console.error(`❌ Update fehlgeschlagen für ${row.id}:`, updateError);
        skipped++;
        continue;
      }

      const link = (await generateMagicLink(supabase, dozent.email, rawToken)) || `${PORTAL_URL}/nachbuchung/${rawToken}`;
      const teilnehmerLabel = [row.teilnehmer_name, row.teilnehmer_tn_nummer].filter(Boolean).join(' · ');

      if (mailgunApiKey) {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
              <img src="https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc" alt="Kraatz Group" style="height: 60px; margin: 0 auto; display: block;">
            </div>
            <div style="padding: 30px 20px; background-color: white;">
              <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Erinnerung: Ihre Rückmeldung steht aus</h2>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Guten Tag ${dozent.full_name || 'sehr geehrter Dozent, sehr geehrte Dozentin'},
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                unsere Nachbuchungs-Anfrage für <strong>${teilnehmerLabel}</strong> im Fachgebiet
                <strong>${row.rechtsgebiet}</strong> ist noch offen. Wir warten auf Ihre Rückmeldung.
                Bitte geben Sie uns über den folgenden Link kurz Bescheid.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${link}" style="display: inline-block; text-decoration: none;">
                  <img src="https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/ansprache-video-preview.png" alt="Video-Ansprache ansehen" style="width: 100%; max-width: 480px; height: auto; border-radius: 12px; display: block; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
                </a>
              </div>
              <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #6c757d;">
                <p style="margin: 0 0 10px 0; color: #495057; font-size: 14px;">
                  <strong>Alternative:</strong> Falls der Button nicht funktioniert, kopieren Sie diesen Link:
                </p>
                <div style="background-color: #ffffff; padding: 10px; border-radius: 4px; border: 1px solid #ced4da; word-break: break-all; font-family: monospace; font-size: 12px; color: #495057;">
                  ${link}
                </div>
              </div>
              <p style="color: #555; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
                Der Link ist 14 Tage gültig und kann einmalig verwendet werden.
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
        formData.append('to', dozent.email);
        formData.append('subject', `Erinnerung: Rückmeldung zur Nachbuchung (${teilnehmerLabel})`);
        formData.append('html', emailHtml);
        formData.append('charset', 'utf-8');

        try {
          const mailgunResponse = await fetch(`https://api.eu.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
            method: 'POST',
            headers: { Authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}` },
            body: formData,
          });
          if (mailgunResponse.ok) {
            sentCount++;
          } else {
            console.error('❌ Mailgun error:', await mailgunResponse.text());
            skipped++;
          }
        } catch (mailgunError) {
          console.error('❌ Failed to send email:', mailgunError);
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    return json({ ok: true, sentCount, skipped });
  } catch (error) {
    console.error('❌ Error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});