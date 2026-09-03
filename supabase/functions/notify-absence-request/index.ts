console.log('🚀 notify-absence-request edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';
import { logNotification } from '../_shared/notification-log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface RequestBody {
  requestId: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const logId = Math.random().toString(36).substring(7);
  console.log('🚀 notify-absence-request function started');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { requestId } = await req.json() as RequestBody;
    if (!requestId) {
      return new Response(
        JSON.stringify({ error: 'requestId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Load the absence request
    const { data: absRequest, error: reqError } = await supabaseAdmin
      .from('dozent_absence_requests')
      .select('id, dozent_id, start_date, end_date, reason, status')
      .eq('id', requestId)
      .single();

    if (reqError || !absRequest) {
      console.error(`❌ [${logId}] Absence request not found:`, reqError);
      return new Response(
        JSON.stringify({ error: 'Absence request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load the dozent
    const { data: dozent } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', absRequest.dozent_id)
      .single();

    if (!dozent) {
      console.error(`❌ [${logId}] Dozent not found`);
      return new Response(
        JSON.stringify({ error: 'Dozent not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load admins
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .eq('is_archived', false)
      .not('email', 'is', null)
      .or('role.eq.admin,additional_roles.cs.{admin}');

    const relevantAdmins = (admins || []).filter((a: any) => a.email);
    console.log(`📋 [${logId}] Admins to notify: ${relevantAdmins.length}`);

    if (relevantAdmins.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No admin found to notify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mailgunDomain = 'kraatz-group.de';
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    const redirectUrl = 'https://portal.kraatz-group.de/klausurenbesprechung/korrektur?tab=absence-requests';

    const dozentLabel = dozent.full_name || dozent.email || 'Ein Dozent';
    const fmtDate = (d: string) => {
      const [y, m, day] = d.split('-');
      return `${day}.${m}.${y}`;
    };
    const dateRange = absRequest.start_date === absRequest.end_date
      ? fmtDate(absRequest.start_date)
      : `${fmtDate(absRequest.start_date)} – ${fmtDate(absRequest.end_date)}`;

    const results: any[] = [];

    for (const admin of relevantAdmins) {
      // In-app notification
      await supabaseAdmin
        .from('vb_notifications')
        .insert({
          profile_id: admin.id,
          title: 'Neue Abwesenheitsanfrage (kurzfristig)',
          message: `${dozentLabel} hat eine Abwesenheit für ${dateRange} beantragt.${absRequest.reason ? ` Grund: ${absRequest.reason}` : ''}`,
          type: 'info',
          read: false,
        });

      // Email
      let emailSent = false;
      if (mailgunApiKey) {
        const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
            <img src="https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc" alt="Kraatz Group" style="height: 60px; margin: 0 auto; display: block;">
          </div>

          <div style="padding: 30px 20px; background-color: white;">
            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Neue Abwesenheitsanfrage (kurzfristig)</h2>

            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              Hallo ${admin.full_name || ''},
            </p>

            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              <strong>${dozentLabel}</strong> hat eine Abwesenheit innerhalb der 14-Tage-Frist beantragt und benötigt Ihre Bestätigung.
            </p>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px; width: 40%;"><strong>Dozent</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${dozentLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Zeitraum</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${dateRange}</td>
                </tr>
                ${absRequest.reason ? `
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Grund</strong></td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${absRequest.reason}</td>
                </tr>` : ''}
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${redirectUrl}"
                 style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                Anfrage prüfen
              </a>
            </div>

            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 0;">
              Mit freundlichen Grüßen<br>
              <strong>Ihr Kraatz Group Team</strong>
            </p>
          </div>

          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
            <p style="color: #666; font-size: 12px; margin: 5px 0;">Akademie Kraatz GmbH</p>
            <p style="color: #666; font-size: 12px; margin: 5px 0;">Wilmersdorfer Str. 145/146 - 10585 Berlin</p>
            <p style="color: #666; font-size: 12px; margin: 5px 0;">Diese E-Mail wurde automatisch vom Portal gesendet.</p>
          </div>
        </div>`;

        const formData = new FormData();
        const emailSubject = `Neue Abwesenheitsanfrage: ${dozentLabel} (${dateRange})`;
        const emailSender = 'Kraatz Group Portal <postmaster@kraatz-group.de>';
        formData.append('from', emailSender);
        formData.append('to', admin.email);
        formData.append('subject', emailSubject);
        formData.append('html', emailHtml);
        formData.append('charset', 'utf-8');

        try {
          const mailgunResponse = await fetch(`https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}` },
            body: formData,
          });
          if (mailgunResponse.ok) {
            const emailResult = await mailgunResponse.json();
            console.log(`✅ [${logId}] Email sent to ${admin.email}`);
            await logNotification({
              edgeFunction: 'notify-absence-request',
              supabaseAdmin,
              recipientEmail: admin.email,
              recipientName: admin.full_name,
              subject: emailSubject,
              sender: emailSender,
              status: 'sent',
              providerMessageId: emailResult?.id,
              context: { requestId, dozentId: absRequest.dozent_id, dozentLabel, dateRange },
              payload: { requestId },
            });
            emailSent = true;
          } else {
            const errorText = await mailgunResponse.text();
            console.error(`❌ [${logId}] Mailgun error for ${admin.email}:`, errorText);
            await logNotification({
              edgeFunction: 'notify-absence-request',
              supabaseAdmin,
              recipientEmail: admin.email,
              recipientName: admin.full_name,
              subject: emailSubject,
              sender: emailSender,
              status: 'failed',
              errorMessage: `Mailgun API error: ${mailgunResponse.status} - ${errorText}`,
              context: { requestId, dozentId: absRequest.dozent_id, dozentLabel, dateRange },
              payload: { requestId },
            });
          }
        } catch (mailgunError) {
          console.error(`❌ [${logId}] Failed to send email to ${admin.email}:`, mailgunError);
        }
      }

      results.push({ admin: admin.email, emailSent });
    }

    const endTime = Date.now();
    console.log(`⏱️ [${logId}] Function completed in ${endTime - startTime}ms`, results);

    return new Response(
      JSON.stringify({ success: true, results, duration: endTime - startTime }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`❌ [${logId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
