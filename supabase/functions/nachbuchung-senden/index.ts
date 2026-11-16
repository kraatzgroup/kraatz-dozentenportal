// Edge-Function: Nachbuchungs-Anfrage anlegen und E-Mail an den Dozenten senden.
// Aufruf nur durch Verwaltung, Admin oder Vertrieb (Auth-Check).
console.log('🚀 nachbuchung-senden edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const PORTAL_URL = 'https://portal.kraatz-group.de';
const TOKEN_TTL_DAYS = 14;
const MAILGUN_DOMAIN = 'kraatz-group.de';

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Supabase environment incomplete' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  const callerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!callerToken) return json({ error: 'Unauthorized' }, 401);

  const authClient = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(callerToken);
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
    const teilnehmerId = (body?.teilnehmer_id as string | undefined)?.trim();
    const teilnehmerName = (body?.teilnehmer_name as string | undefined)?.trim();
    const teilnehmerTn = (body?.teilnehmer_tn_nummer as string | undefined)?.trim();
    const dozentId = body?.dozent_id as string | undefined;
    const rechtsgebiet = body?.rechtsgebiet as string | undefined;
    const dozentEmail = (body?.dozent_email as string | undefined)?.trim();

    if (!dozentId || !rechtsgebiet) {
      return json({ error: 'dozent_id und rechtsgebiet sind erforderlich' }, 400);
    }
    if (!teilnehmerId && !teilnehmerName) {
      return json({ error: 'teilnehmer_id oder teilnehmer_name ist erforderlich' }, 400);
    }

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

    let finalDozentEmail = dozent.email;
    if (dozentEmail) {
      if (isPlaceholderEmail(dozentEmail)) {
        return json({ error: 'Bitte korrekte E-Mail-Adresse des Dozenten eingeben' }, 400);
      }
      if (!isValidEmail(dozentEmail)) {
        return json({ error: 'Ungültige E-Mail-Adresse' }, 400);
      }
      if (dozentEmail !== dozent.email) {
        // Stammdaten (profiles) und Auth-E-Mail synchron halten. Bewusst KEINE
        // Welcome-/Passwort-Reset-E-Mail für diesen Nutzer auslösen.
        const { error: emailUpdateError } = await supabase
          .from('profiles')
          .update({ email: dozentEmail })
          .eq('id', dozentId);
        if (emailUpdateError) throw emailUpdateError;

        const { error: authEmailError } = await supabase.auth.admin.updateUserById(dozentId, { email: dozentEmail });
        if (authEmailError) console.error('⚠️ auth.users.email konnte nicht aktualisiert werden:', authEmailError);

        finalDozentEmail = dozentEmail;
      }
    }

    if (isPlaceholderEmail(finalDozentEmail)) {
      return json({ error: 'Bitte korrekte E-Mail-Adresse des Dozenten eingeben' }, 400);
    }

    const rawToken = crypto.randomUUID();
    const tokenHash = await sha256(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: inserted, error: insertError } = await supabase
      .from('nachbuchungen')
      .insert({
        teilnehmer_id: finalTeilnehmerId,
        teilnehmer_name: finalTeilnehmerName,
        teilnehmer_tn_nummer: finalTeilnehmerTn,
        dozent_id: dozentId,
        rechtsgebiet,
        status: 'ausstehend',
        token_hash: tokenHash,
        expires_at: expiresAt,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const link = await generateMagicLink(supabase, finalDozentEmail, rawToken) || `${PORTAL_URL}/nachbuchung/${rawToken}`;
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    let emailSent = false;

    if (mailgunApiKey) {
      const teilnehmerLabel = [finalTeilnehmerName, finalTeilnehmerTn]
        .filter(Boolean)
        .join(' · ');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
            <img src="https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc" alt="Kraatz Group" style="height: 60px; margin: 0 auto; display: block;">
          </div>
          <div style="padding: 30px 20px; background-color: white;">
            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Nachbuchungsbedarf</h2>
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              Guten Tag ${dozent.full_name || 'sehr geehrter Dozent, sehr geehrte Dozentin'},
            </p>
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              bei Ihrer Teilnehmerin bzw. Ihrem Teilnehmer <strong>${teilnehmerLabel}</strong>
              besteht möglicherweise Nachbuchungsbedarf im Fachgebiet
              <strong>${rechtsgebiet}</strong>. Bitte geben Sie uns über den folgenden Link eine kurze Rückmeldung.
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
      formData.append('to', finalDozentEmail);
      formData.append('subject', `Nachbuchungsbedarf: ${finalTeilnehmerName}`);
      formData.append('html', emailHtml);
      formData.append('charset', 'utf-8');

      try {
        const mailgunResponse = await fetch(`https://api.eu.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
          method: 'POST',
          headers: { Authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}` },
          body: formData,
        });
        emailSent = mailgunResponse.ok;
        if (!mailgunResponse.ok) {
          console.error('❌ Mailgun error:', await mailgunResponse.text());
        }
      } catch (mailgunError) {
        console.error('❌ Failed to send email:', mailgunError);
      }
    }

    return json({ success: true, id: inserted.id, emailSent });
  } catch (error) {
    console.error('❌ Error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});