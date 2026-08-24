console.log('🚀 vb-notify-admin-uncovered edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface UncoveredRequest {
  dozentId: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 vb-notify-admin-uncovered function started');
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
    const { dozentId } = await req.json() as UncoveredRequest;
    console.log(`📋 [${requestId}] Request data:`, { dozentId });

    if (!dozentId) {
      return new Response(
        JSON.stringify({ error: 'dozentId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Security: verify the caller is the affected dozent themselves (or an admin).
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
    if (authData.user.id !== dozentId) {
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('role, additional_roles')
        .eq('id', authData.user.id)
        .single();
      const callerRoles = [callerProfile?.role, ...(callerProfile?.additional_roles || [])];
      if (!callerRoles.includes('admin')) {
        console.error(`❌ [${requestId}] Forbidden: caller ${authData.user.id} is neither the dozent nor admin`);
        return new Response(
          JSON.stringify({ error: 'Forbidden: only the affected dozent or an admin can trigger this' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    console.log(`✅ [${requestId}] Caller authorized: ${authData.user.id}`);

    // Load the dozent who became unavailable
    const { data: dozent, error: dozentError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, vb_legal_areas, vb_springer')
      .eq('id', dozentId)
      .single();
    if (dozentError || !dozent) {
      console.error(`❌ [${requestId}] Dozent not found:`, dozentError);
      throw new Error('Dozent not found');
    }
    const dozentAreas: string[] = dozent.vb_legal_areas || [];
    const isSpringer = dozent.vb_springer === true;
    console.log(`📋 [${requestId}] Dozent ${dozent.email} (springer: ${isSpringer}) areas:`, dozentAreas);

    if (dozentAreas.length === 0) {
      console.log(`✅ [${requestId}] Dozent has no VB legal areas, nothing to check`);
      return new Response(
        JSON.stringify({ success: true, uncovered: [], message: 'Dozent has no VB legal areas' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine which of the dozent's areas are now completely uncovered:
    // no other available (vb_available, not on vacation) regular dozent OR
    // springer covers them.
    const { data: dozenten } = await supabaseAdmin
      .from('profiles')
      .select('id, vb_legal_areas, vb_available, vacation_start_date, vacation_end_date')
      .eq('role', 'dozent')
      .not('vb_legal_areas', 'is', null)
      .neq('id', dozentId);

    const today = new Date();
    const covered = new Set<string>();
    for (const d of (dozenten || [])) {
      if (d.vb_available === false) continue;
      const vs = d.vacation_start_date ? new Date(d.vacation_start_date) : null;
      const ve = d.vacation_end_date ? new Date(d.vacation_end_date) : null;
      if (vs && ve && today >= vs && today <= ve) continue;
      (d.vb_legal_areas || []).forEach((a: string) => covered.add(a));
    }
    const uncoveredAreas = dozentAreas.filter(a => !covered.has(a));
    console.log(`📋 [${requestId}] Uncovered areas:`, uncoveredAreas);

    if (uncoveredAreas.length === 0) {
      console.log(`✅ [${requestId}] All areas still covered, no admin notification needed`);
      return new Response(
        JSON.stringify({ success: true, uncovered: [], message: 'All areas still covered' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load open (unclaimed) cases in the uncovered areas
    const { data: openCases } = await supabaseAdmin
      .from('vb_case_study_requests')
      .select('id, case_study_number, legal_area, sub_area, focus_area')
      .eq('status', 'requested')
      .in('legal_area', uncoveredAreas)
      .order('created_at', { ascending: true });

    console.log(`📋 [${requestId}] Open cases in uncovered areas: ${openCases?.length || 0}`);

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
        JSON.stringify({ success: true, uncovered: uncoveredAreas, message: 'No admin found to notify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mailgunDomain = 'kraatz-group.de';
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    const redirectUrl = 'https://portal.kraatz-group.de/klausurenbesprechung/korrektur?tab=requests';

    const dozentLabel = dozent.full_name || dozent.email || 'Ein Dozent';
    const roleLabel = isSpringer ? 'Springer-Dozent' : 'Dozent';
    const areaList = uncoveredAreas.map(a => `<li>${a}</li>`).join('');
    const caseRows = (openCases || []).map((c: any) => {
      const areaParts = [c.legal_area, c.sub_area].filter(Boolean).join(' / ');
      return `
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px; width: 40%; vertical-align: top;"><strong>Klausur #${c.case_study_number ?? '?'}</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${areaParts}${c.focus_area ? `, ${c.focus_area}` : ''}</td>
              </tr>`;
    }).join('');

    const results: any[] = [];

    for (const admin of relevantAdmins) {
      // In-app notification
      const { error: notifError } = await supabaseAdmin
        .from('vb_notifications')
        .insert({
          profile_id: admin.id,
          title: 'Kein Dozent für Videoklausurenkorrektur verfügbar',
          message: `${dozentLabel} (${roleLabel}) ist nicht verfügbar. Für folgende Rechtsgebiete ist kein Dozent verfügbar: ${uncoveredAreas.join(', ')}.${openCases && openCases.length > 0 ? ` ${openCases.length === 1 ? '1 offene Anfrage wartet' : `${openCases.length} offene Anfragen warten`} auf Bearbeitung.` : ''}`,
          type: 'info',
          read: false
        });
      if (notifError) {
        console.error(`❌ [${requestId}] Error creating in-app notification for admin ${admin.email}:`, notifError);
      } else {
        console.log(`✅ [${requestId}] In-app notification created for admin ${admin.email}`);
      }

      // Email
      let emailSent = false;
      if (mailgunApiKey) {
        const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
            <h1 style="margin: 0; font-size: 22px; color: #333;">Kraatz Group</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Portal</p>
          </div>

          <!-- Main Content -->
          <div style="padding: 30px 20px; background-color: white;">
            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Kein Dozent verfügbar (Videoklausurenkorrektur)</h2>

            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              Hallo ${admin.full_name || ''},
            </p>

            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              ${dozentLabel} (${roleLabel}) hat sich auf „Nicht verfügbar" gestellt. Für die folgenden Rechtsgebiete ist
              <strong>kein Dozent verfügbar</strong> – weder ein regulärer Dozent noch ein Springer-Dozent:
            </p>

            <!-- Uncovered Areas -->
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
              <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Nicht abgedeckte Rechtsgebiete:</h4>
              <ul style="margin: 0; padding-left: 20px; color: #333; font-size: 14px;">${areaList}</ul>
            </div>

            ${openCases && openCases.length > 0 ? `
            <!-- Open Cases -->
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
              <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">${openCases.length === 1 ? '1 offene Anfrage wartet auf Bearbeitung:' : `${openCases.length} offene Anfragen warten auf Bearbeitung:`}</h4>
              <table style="width: 100%; border-collapse: collapse;">${caseRows}
              </table>
            </div>` : ''}

            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              Bitte kümmern Sie sich um eine Vertretung für diese Rechtsgebiete.
            </p>

            <!-- Action Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${redirectUrl}"
                 style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                Zu den Anfragen
              </a>
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

        const formData = new FormData();
        formData.append('from', 'Kraatz Group Portal <postmaster@kraatz-group.de>');
        formData.append('to', admin.email);
        formData.append('subject', `Kein Dozent verfügbar: ${uncoveredAreas.join(', ')} (Videoklausurenkorrektur)`);
        formData.append('html', emailHtml);
        formData.append('charset', 'utf-8');

        try {
          const mailgunResponse = await fetch(`https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}` },
            body: formData,
          });
          if (mailgunResponse.ok) {
            console.log(`✅ [${requestId}] Admin notification email sent to ${admin.email}`);
            emailSent = true;
          } else {
            const errorText = await mailgunResponse.text();
            console.error(`❌ [${requestId}] Mailgun error for ${admin.email}:`, errorText);
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
      JSON.stringify({ success: true, uncovered: uncoveredAreas, openCases: openCases?.length || 0, results, requestId, duration: endTime - startTime }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`❌ [${requestId}] Error in vb-notify-admin-uncovered:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
