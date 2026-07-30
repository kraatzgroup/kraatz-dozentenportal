console.log('🚀 vb-notify-case-returned edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface CaseReturnedRequest {
  caseId: string;
  targetDozentId: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 vb-notify-case-returned function started');
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
    const { caseId, targetDozentId } = await req.json() as CaseReturnedRequest;
    console.log(`📋 [${requestId}] Request data:`, { caseId, targetDozentId });

    if (!caseId || !targetDozentId) {
      return new Response(
        JSON.stringify({ error: 'caseId and targetDozentId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Security: only a springer dozent (or admin) may trigger this.
    // Recipient address is NEVER taken from the request – it is loaded
    // from the profiles table via targetDozentId.
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
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, additional_roles, vb_springer, full_name')
      .eq('id', authData.user.id)
      .single();
    const callerRoles = [callerProfile?.role, ...(callerProfile?.additional_roles || [])];
    if (callerProfile?.vb_springer !== true && !callerRoles.includes('admin')) {
      console.error(`❌ [${requestId}] Forbidden: caller ${authData.user.id} is neither springer nor admin`);
      return new Response(
        JSON.stringify({ error: 'Forbidden: only a springer dozent or an admin can trigger this' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`✅ [${requestId}] Caller authorized: ${authData.user.id}`);

    // Load the case (and verify it is actually assigned to the target dozent)
    const { data: caseData, error: caseError } = await supabaseAdmin
      .from('vb_case_study_requests')
      .select('id, case_study_number, legal_area, sub_area, focus_area, status, profile_id, assigned_dozent_id')
      .eq('id', caseId)
      .single();
    if (caseError || !caseData) {
      console.error(`❌ [${requestId}] Case not found:`, caseError);
      throw new Error('Case not found');
    }
    if (caseData.assigned_dozent_id !== targetDozentId) {
      console.error(`❌ [${requestId}] Case is not assigned to target dozent`);
      return new Response(
        JSON.stringify({ error: 'Case is not assigned to the target dozent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load the receiving dozent (recipient from DB only)
    const { data: dozent, error: dozentError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', targetDozentId)
      .single();
    if (dozentError || !dozent?.email) {
      console.error(`❌ [${requestId}] Target dozent not found:`, dozentError);
      throw new Error('Target dozent not found');
    }

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

    const springerName = callerProfile?.full_name || 'Der Springer-Dozent';
    const redirectUrl = 'https://portal.kraatz-group.de/klausurenbesprechung/korrektur';

    // In-app notification for the receiving dozent (service role bypasses RLS)
    const areaParts = [caseData.legal_area, caseData.sub_area].filter(Boolean).join(' / ');
    const { error: notifError } = await supabaseAdmin
      .from('vb_notifications')
      .insert({
        profile_id: targetDozentId,
        title: 'Fall an Sie zurückgegeben',
        message: `Der Springer-Dozent hat Klausur #${caseData.case_study_number ?? '?'} (${areaParts || 'Unbekannt'}) an Sie zurückgegeben.`,
        type: 'info',
        related_case_study_id: caseData.id,
        read: false,
      });
    if (notifError) {
      console.error(`❌ [${requestId}] Error creating in-app notification:`, notifError);
    } else {
      console.log(`✅ [${requestId}] In-app notification created for dozent ${dozent.email}`);
    }

    // Generate magic link for direct login
    let magicLink = redirectUrl;
    try {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: dozent.email,
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

    const areaParts = [caseData.legal_area, caseData.sub_area].filter(Boolean).join(' / ');

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <h1 style="margin: 0; font-size: 22px; color: #333;">Kraatz Group</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Portal</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px 20px; background-color: white;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Fall an Sie zurückgegeben (Videoklausurenkorrektur)</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hallo ${dozent.full_name || ''},
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            ${springerName} hat den folgenden Fall an Sie zurückgegeben. Alle Zuständigkeiten liegen wieder bei Ihnen.
          </p>

          <!-- Case Details -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
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
            </table>
          </div>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            <strong>Klicken Sie auf den Button unten, um sich direkt anzumelden und den Fall zu prüfen:</strong>
          </p>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" 
               style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
              Zum Fall
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

    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    let emailSent = false;
    if (mailgunApiKey) {
      const mailgunUrl = `https://api.eu.mailgun.net/v3/kraatz-group.de/messages`;
      const formData = new FormData();
      formData.append('from', 'Kraatz Group Portal <postmaster@kraatz-group.de>');
      formData.append('to', dozent.email);
      formData.append('subject', `Fall an Sie zurückgegeben: Klausur #${caseData.case_study_number ?? '?'} (${caseData.legal_area})`);
      formData.append('html', emailHtml);
      formData.append('charset', 'utf-8');

      try {
        const mailgunResponse = await fetch(mailgunUrl, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}` },
          body: formData,
        });
        if (mailgunResponse.ok) {
          console.log(`✅ [${requestId}] Case-returned email sent to ${dozent.email}`);
          emailSent = true;
        } else {
          const errorText = await mailgunResponse.text();
          console.error(`❌ [${requestId}] Mailgun error:`, errorText);
        }
      } catch (mailgunError) {
        console.error(`❌ [${requestId}] Failed to send email:`, mailgunError);
      }
    } else {
      console.log(`⚠️ [${requestId}] MAILGUN_API_KEY not configured, skipping email`);
    }

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`);

    return new Response(
      JSON.stringify({ success: true, emailSent, requestId, duration: endTime - startTime }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`❌ [${requestId}] Error in vb-notify-case-returned:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
