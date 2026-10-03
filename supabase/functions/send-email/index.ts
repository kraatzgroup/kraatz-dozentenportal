// send-email — generischer Mailgun-Versand für die Sales-Pipeline (Angebot etc.)
//
// Erwartet: { to, toName?, subject, html, context?, edgeFunction? }
// Versendet über Mailgun (kraatz-group.de) und loggt den Versand in
// notification_logs (shared helper), damit er im Portal nachvollziehbar ist.
console.log('🚀 send-email edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';
import { logNotification } from '../_shared/notification-log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface SendEmailRequest {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  /** Freie Kontext-Daten (z.B. leadId, packageId) für notification_logs. */
  context?: Record<string, unknown>;
  /** Name, unter dem der Versand im Log erscheinen soll (Default: 'send-email'). */
  edgeFunction?: string;
  /** Optionaler Absender (nur Adressen @kraatz-group.de erlaubt). */
  fromName?: string;
  fromEmail?: string;
  /** Optionale Antwortadresse (Reply-To). */
  replyTo?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Nur eingeloggte Mitarbeiter (admin / vertrieb / verwaltung) dürfen versenden
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const authAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    // Server-zu-Server-Aufrufe (z.B. Admin-Skripte) mit dem Service-Role-Key sind erlaubt
    // (die JWT-Signatur wurde bereits vom Supabase-Gateway geprüft, daher genügt der Claim)
    let tokenRole: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      tokenRole = payload.role ?? null;
    } catch { /* kein JWT (z.B. sb_secret-Key) */ }
    const isServiceCall = tokenRole === 'service_role' || token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!isServiceCall) {
      const { data: { user }, error: authError } = await authAdmin.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: profile } = await authAdmin.from('profiles').select('role').eq('id', user.id).single();
      if (!profile || !['admin', 'vertrieb', 'verwaltung'].includes(profile.role)) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { to, toName, subject, html, context, edgeFunction, fromName, fromEmail, replyTo } = await req.json() as SendEmailRequest;

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'to, subject and html are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const mailgunDomain = 'kraatz-group.de';
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    const isOwnDomain = (email?: string) => Boolean(email && /^[^\s@<>]+@kraatz-group\.de$/i.test(email));
    if ((fromEmail && !isOwnDomain(fromEmail)) || (replyTo && !isOwnDomain(replyTo))) {
      return new Response(
        JSON.stringify({ error: 'fromEmail/replyTo must be an @kraatz-group.de address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const safeFromName = fromName?.replace(/["<>\r\n]/g, '').trim();
    const sender = fromEmail
      ? (safeFromName ? `${safeFromName} <${fromEmail}>` : fromEmail)
      : 'Kraatz Group Portal <postmaster@kraatz-group.de>';

    if (!mailgunApiKey) {
      return new Response(
        JSON.stringify({ error: 'MAILGUN_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = new FormData();
    formData.append('from', sender);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', html);
    if (replyTo) formData.append('h:Reply-To', replyTo);
    formData.append('charset', 'utf-8');

    const mailgunResponse = await fetch(`https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}` },
      body: formData,
    });

    const functionName = edgeFunction || 'send-email';

    if (mailgunResponse.ok) {
      const emailResult = await mailgunResponse.json();
      console.log('✅ Email sent successfully via Mailgun:', emailResult);
      await logNotification({
        edgeFunction: functionName,
        supabaseAdmin,
        recipientEmail: to,
        recipientName: toName ?? undefined,
        subject,
        sender,
        status: 'sent',
        providerMessageId: emailResult?.id,
        context,
        payload: { to, toName, subject },
      });
      return new Response(
        JSON.stringify({ success: true, message: 'Email sent', id: emailResult?.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const errorText = await mailgunResponse.text();
    console.error('❌ Mailgun error:', errorText);
    await logNotification({
      edgeFunction: functionName,
      supabaseAdmin,
      recipientEmail: to,
      recipientName: toName ?? undefined,
      subject,
      sender,
      status: 'failed',
      errorMessage: `Mailgun API error: ${mailgunResponse.status} - ${errorText}`,
      context,
      payload: { to, toName, subject },
    });
    return new Response(
      JSON.stringify({ error: 'Mailgun error', details: errorText }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in send-email:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
