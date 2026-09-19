console.log('🚀 vb-notify-admin-unassigned-submission edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';
import { logNotification } from '../_shared/notification-log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface UnassignedSubmissionRequest {
  caseId: string;
  unavailableDozentId?: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 vb-notify-admin-unassigned-submission function started');
  console.log('🆔 Request ID:', requestId);

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
    const { caseId, unavailableDozentId } = await req.json() as UnassignedSubmissionRequest;
    console.log(`📋 [${requestId}] Request data:`, { caseId, unavailableDozentId });

    if (!caseId) {
      return new Response(
        JSON.stringify({ error: 'caseId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Security: caller must be authenticated and either the student who owns
    // the case or a staff member (admin/dozent). Recipient addresses are NEVER
    // taken from the request – admins are loaded from the profiles table.
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !authData?.user) {
      console.error(`❌ [${requestId}] Unauthorized: invalid or missing user JWT`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load the case
    const { data: caseData, error: caseError } = await supabaseAdmin
      .from('vb_case_study_requests')
      .select('id, case_study_number, legal_area, sub_area, focus_area, status, profile_id, assigned_dozent_id')
      .eq('id', caseId)
      .single();
    if (caseError || !caseData) {
      console.error(`❌ [${requestId}] Case not found:`, caseError);
      throw new Error('Case not found');
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, additional_roles')
      .eq('id', authData.user.id)
      .single();
    const callerRoles = [callerProfile?.role, ...(callerProfile?.additional_roles || [])];
    const isStaff = callerRoles.includes('admin') || callerRoles.includes('dozent');
    if (authData.user.id !== caseData.profile_id && !isStaff) {
      console.error(`❌ [${requestId}] Forbidden: caller ${authData.user.id} is neither the case owner nor staff`);
      return new Response(
        JSON.stringify({ error: 'Forbidden: only the case owner or staff can trigger this' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`✅ [${requestId}] Caller authorized: ${authData.user.id}`);

    // Load student name
    let studentName = 'Unbekannt';
    if (caseData.profile_id) {
      const { data: student } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', caseData.profile_id)
        .single();
      studentName = student?.full_name || student?.email || 'Unbekannt';
    }

    // Load the name of the dozent who was unavailable (if provided)
    let unavailableName: string | null = null;
    if (unavailableDozentId) {
      const { data: d } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', unavailableDozentId)
        .maybeSingle();
      unavailableName = d?.full_name || d?.email || null;
    }

    // Load admins to notify (role = admin or additional_roles contains 'admin')
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .eq('is_archived', false)
      .not('email', 'is', null)
      .or('role.eq.admin,additional_roles.cs.{admin}');

    const relevantAdmins = (admins || []).filter((a: any) => a.email);
    console.log(`📋 [${requestId}] Admins to notify: ${relevantAdmins.length}`);

    if (relevantAdmins.length === 0) {
      console.warn(`⚠️ [${requestId}] No admin found to notify!`);
      return new Response(
        JSON.stringify({ success: true, message: 'No admin found to notify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mailgunDomain = 'kraatz-group.de';
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    // Admins land on the VB admin overview via VbLandingRedirect
    const redirectUrl = 'https://portal.kraatz-group.de/klausurenbesprechung';

    const areaParts = [caseData.legal_area, caseData.sub_area].filter(Boolean).join(' / ');
    const stillAssigned = !!caseData.assigned_dozent_id;
    const unavailableInfo = unavailableName
      ? ` Der ursprünglich zuständige Dozent (${unavailableName}) ist aktuell nicht verfügbar.`
      : '';

    const results: any[] = [];

    for (const admin of relevantAdmins) {
      // In-app notification
      const { error: notifError } = await supabaseAdmin
        .from('vb_notifications')
        .insert({
          profile_id: admin.id,
          title: 'Eingereichte Bearbeitung ohne verfügbaren Dozenten',
          message: `${studentName} hat Klausur #${caseData.case_study_number ?? '?'} (${areaParts || 'Unbekannt'}) eingereicht, aber es ist kein Dozent verfügbar.${unavailableInfo}${stillAssigned ? ' Der Fall ist noch zugewiesen.' : ' Der Fall wurde freigegeben.'} Bitte manuell zuweisen.`,
          type: 'info',
          related_case_study_id: caseData.id,
          read: false,
        });
      if (notifError) {
        console.error(`❌ [${requestId}] Error creating in-app notification for admin ${admin.email}:`, notifError);
      } else {
        console.log(`✅ [${requestId}] In-app notification created for admin ${admin.email}`);
      }

      // Generate magic link for direct login
      let magicLink = redirectUrl;
      try {
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: admin.email,
          options: { redirectTo: redirectUrl }
        });
        if (!linkError && linkData?.properties?.action_link) {
          magicLink = linkData.properties.action_link;
        } else {
          console.error(`⚠️ [${requestId}] Magic link generation failed, using plain URL:`, linkError);
        }
      } catch (e) {
        console.error(`⚠️ [${requestId}] Magic link exception, using plain URL:`, e);
      }

      const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <img src="https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc" alt="Kraatz Group" style="height: 60px; margin: 0 auto; display: block;">
        </div>

        <!-- Main Content -->
        <div style="padding: 30px 20px; background-color: white;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Eingereichte Bearbeitung ohne verfügbaren Dozenten</h2>

          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hallo ${admin.full_name || ''},
          </p>

          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            ${studentName} hat eine Bearbeitung eingereicht, aber für das Rechtsgebiet ist aktuell
            <strong>kein Dozent verfügbar</strong> – weder ein regulärer Dozent noch ein Springer.${unavailableInfo}
          </p>

          <!-- Case Details -->
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
            <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Fall-Details:</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px; width: 40%;"><strong>Klausur:</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">#${caseData.case_study_number ?? '?'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Rechtsgebiet:</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${areaParts}</td>
              </tr>
              ${caseData.focus_area ? `
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Schwerpunkt:</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${caseData.focus_area}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Teilnehmer:</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${studentName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Zuständigkeit:</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${stillAssigned ? 'Noch zugewiesen (Freigabe fehlgeschlagen)' : 'Niemand – wurde freigegeben'}</td>
              </tr>
            </table>
          </div>

          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            <strong>Bitte weisen Sie den Fall manuell einem Dozenten zu oder kümmern Sie sich um eine Vertretung.</strong>
          </p>

          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}"
               style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
              Zur Admin-Übersicht
            </a>
          </div>

          <!-- Alternative Link -->
          <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #6c757d;">
            <p style="margin: 0 0 10px 0; color: #495057; font-size: 14px;">
              <strong>Alternative:</strong> Falls der Button nicht funktioniert, können Sie diesen Link kopieren:
            </p>
            <div style="background-color: #ffffff; padding: 10px; border-radius: 4px; border: 1px solid #ced4da; word-break: break-all; font-family: monospace; font-size: 12px; color: #495057;">
              ${magicLink}
            </div>
          </div>

          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 0;">
            Mit freundlichen Grüßen<br>
            <strong>Ihr Kraatz Group Team</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Akademie Kraatz GmbH</p>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Wilmersdorfer Str. 145/146 - 10585 Berlin</p>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Diese E-Mail wurde automatisch vom Portal gesendet.</p>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Bei Fragen wenden Sie sich bitte an <a href="mailto:charlenenowak@kraatz-group.de" style="color: #2e83c2; text-decoration: none;">charlenenowak@kraatz-group.de</a></p>
        </div>
      </div>`;

      // Email
      let emailSent = false;
      const emailSubject = `Kein Dozent verfügbar: eingereichte Bearbeitung ${caseData.legal_area} (Videoklausurenkorrektur)`;
      const emailSender = 'Kraatz Group Portal <postmaster@kraatz-group.de>';
      if (mailgunApiKey) {
        const formData = new FormData();
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
            console.log(`✅ [${requestId}] Admin notification email sent to ${admin.email}`);
            await logNotification({
              edgeFunction: 'vb-notify-admin-unassigned-submission',
              supabaseAdmin,
              recipientEmail: admin.email,
              recipientName: admin.full_name || undefined,
              subject: emailSubject,
              sender: emailSender,
              status: 'sent',
              providerMessageId: emailResult?.id,
              context: { caseId, caseStudyNumber: caseData.case_study_number, legalArea: caseData.legal_area, unavailableDozentId, stillAssigned, adminId: admin.id },
              payload: { caseId, unavailableDozentId },
            });
            emailSent = true;
          } else {
            const errorText = await mailgunResponse.text();
            console.error(`❌ [${requestId}] Mailgun error for ${admin.email}:`, errorText);
            await logNotification({
              edgeFunction: 'vb-notify-admin-unassigned-submission',
              supabaseAdmin,
              recipientEmail: admin.email,
              recipientName: admin.full_name || undefined,
              subject: emailSubject,
              sender: emailSender,
              status: 'failed',
              errorMessage: `Mailgun API error: ${mailgunResponse.status} - ${errorText}`,
              context: { caseId, caseStudyNumber: caseData.case_study_number, legalArea: caseData.legal_area, unavailableDozentId, stillAssigned, adminId: admin.id },
              payload: { caseId, unavailableDozentId },
            });
          }
        } catch (mailgunError) {
          console.error(`❌ [${requestId}] Failed to send email to ${admin.email}:`, mailgunError);
        }
      } else {
        console.log(`⚠️ [${requestId}] MAILGUN_API_KEY not configured, skipping email`);
      }

      results.push({ admin: admin.email, emailSent });
    }

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`, results);

    return new Response(
      JSON.stringify({ success: true, notifiedAdmins: results.length, results, requestId, duration: endTime - startTime }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`❌ [${requestId}] Error in vb-notify-admin-unassigned-submission:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
