// probestunde-antwort-notify — informiert Admins per E-Mail, wenn ein Dozent
// eine Probestunde angenommen oder abgelehnt hat.
//
// Erwartet: { trialLessonId, accepted }
// Versendet über Mailgun an alle Admins (role = 'admin') und loggt in
// notification_logs. Dozenten dürfen nur auf ihre eigenen Probestunden antworten.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { logNotification } from '../_shared/notification-log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const MAILGUN_DOMAIN = 'kraatz-group.de';
const SENDER = 'Kraatz Group Portal <postmaster@kraatz-group.de>';
const TEMPLATE_ID = 'probestunde-dozent-antwort';

const replaceTokens = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce((acc, [token, value]) => acc.split(token).join(value), text);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let isServiceCall = false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      isServiceCall = payload.role === 'service_role' || token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    } catch { /* kein JWT (z.B. sb_secret-Key) */ }

    let callerRole: string | null = null;
    let callerId: string | null = null;
    if (!isServiceCall) {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      callerId = user.id;
      const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
      callerRole = profile?.role ?? null;
      if (!callerRole || !['dozent', 'admin', 'vertrieb', 'verwaltung', 'buchhaltung'].includes(callerRole)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { trialLessonId, accepted } = await req.json() as { trialLessonId?: string; accepted?: boolean };
    if (!trialLessonId || typeof accepted !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'trialLessonId and accepted are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('trial_lessons')
      .select('*')
      .eq('id', trialLessonId)
      .single();
    if (lessonError || !lesson) {
      return new Response(JSON.stringify({ error: 'Trial lesson not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Dozent darf nur auf eigene Probestunden antworten
    if (callerRole === 'dozent' && lesson.dozent_id !== callerId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Status serverseitig setzen (Service-Role umgeht RLS, damit auch Dozenten antworten können)
    const { error: updateError } = await supabaseAdmin
      .from('trial_lessons')
      .update(accepted ? { status: 'confirmed', dozent_confirmed: true } : { status: 'cancelled' })
      .eq('id', trialLessonId);
    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let dozentName = 'Dozent';
    if (lesson.dozent_id) {
      const { data: dozent } = await supabaseAdmin.from('profiles').select('full_name').eq('id', lesson.dozent_id).single();
      if (dozent?.full_name) dozentName = dozent.full_name;
    }

    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('role', 'admin')
      .not('email', 'is', null);
    const adminList = (admins || []).filter((a: any) => a.email);
    if (adminList.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No admins to notify', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: template } = await supabaseAdmin
      .from('email_templates')
      .select('subject, body')
      .eq('id', TEMPLATE_ID)
      .single();

    const scheduled = lesson.scheduled_date ? new Date(lesson.scheduled_date) : null;
    const validDate = scheduled && !Number.isNaN(scheduled.getTime());
    const termin = validDate
      ? `${scheduled.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} · ${scheduled.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
      : '–';
    const kontakt = [lesson.teilnehmer_email, lesson.teilnehmer_phone].filter(Boolean).join(' · ') || '–';

    const values: Record<string, string> = {
      '[Dozent_Name]': dozentName,
      '[Entscheidung]': accepted ? 'angenommen' : 'abgelehnt',
      '[Teilnehmer]': lesson.teilnehmer_name || '–',
      '[Termin]': termin,
      '[Rechtsgebiet]': lesson.rechtsgebiet || '–',
      '[Dauer]': lesson.duration ? `${lesson.duration} Minuten` : '–',
      '[Kontakt]': kontakt,
    };

    const subject = replaceTokens(template?.subject || 'Probestunde [Entscheidung]: [Teilnehmer] ([Dozent_Name])', values);
    const html = replaceTokens(
      template?.body || '<p>Dozent [Dozent_Name] hat die Probestunde für [Teilnehmer] ([Termin]) [Entscheidung].</p>',
      values
    );

    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    if (!mailgunApiKey) {
      return new Response(JSON.stringify({ error: 'MAILGUN_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let sent = 0;
    const logContext = { trialLessonId, accepted, dozentId: lesson.dozent_id ?? null };
    for (const admin of adminList) {
      try {
        const formData = new FormData();
        formData.append('from', SENDER);
        formData.append('to', admin.email);
        formData.append('subject', subject);
        formData.append('html', html);
        formData.append('h:Reply-To', 'postmaster@kraatz-group.de');
        formData.append('o:tracking', 'false');

        const mailgunResponse = await fetch(`https://api.eu.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}` },
          body: formData,
        });

        if (!mailgunResponse.ok) {
          const errorText = await mailgunResponse.text();
          console.error(`Mailgun error for ${admin.email}:`, errorText);
          await logNotification({
            edgeFunction: 'probestunde-antwort-notify',
            supabaseAdmin,
            recipientEmail: admin.email,
            recipientName: admin.full_name,
            subject,
            sender: SENDER,
            status: 'failed',
            errorMessage: errorText,
            context: logContext,
            payload: { dozentName, accepted, teilnehmer: lesson.teilnehmer_name },
          });
          continue;
        }

        const emailResult = await mailgunResponse.json();
        await logNotification({
          edgeFunction: 'probestunde-antwort-notify',
          supabaseAdmin,
          recipientEmail: admin.email,
          recipientName: admin.full_name,
          subject,
          sender: SENDER,
          status: 'sent',
          providerMessageId: emailResult?.id,
          context: logContext,
          payload: { dozentName, accepted, teilnehmer: lesson.teilnehmer_name },
        });
        sent++;
      } catch (err) {
        console.error(`Error sending to ${admin.email}:`, err);
        await logNotification({
          edgeFunction: 'probestunde-antwort-notify',
          supabaseAdmin,
          recipientEmail: admin.email,
          recipientName: admin.full_name,
          subject,
          sender: SENDER,
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
          context: logContext,
          payload: { dozentName, accepted, teilnehmer: lesson.teilnehmer_name },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in probestunde-antwort-notify:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});