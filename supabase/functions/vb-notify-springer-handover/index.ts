console.log('🚀 vb-notify-springer-handover edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';
import { logNotification } from '../_shared/notification-log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface HandoverRequest {
  dozentId: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 vb-notify-springer-handover function started');
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
    const { dozentId } = await req.json() as HandoverRequest;
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
    // Recipient addresses are NEVER taken from the request – they are always
    // loaded from the profiles table (vb_springer = true).
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
      .select('id, full_name, email, vb_legal_areas')
      .eq('id', dozentId)
      .single();
    if (dozentError || !dozent) {
      console.error(`❌ [${requestId}] Dozent not found:`, dozentError);
      throw new Error('Dozent not found');
    }
    const dozentAreas: string[] = dozent.vb_legal_areas || [];
    console.log(`📋 [${requestId}] Dozent ${dozent.email} areas:`, dozentAreas);

    // Determine which of the dozent's areas are now uncovered
    // (no other regular, available, non-vacation dozent covers them)
    const { data: regulars } = await supabaseAdmin
      .from('profiles')
      .select('id, vb_legal_areas, vb_available, vacation_start_date, vacation_end_date')
      .eq('role', 'dozent')
      .or('vb_springer.is.null,vb_springer.eq.false')
      .not('vb_legal_areas', 'is', null)
      .neq('id', dozentId);

    const today = new Date();
    const covered = new Set<string>();
    for (const r of (regulars || [])) {
      if (r.vb_available === false) continue;
      const vs = r.vacation_start_date ? new Date(r.vacation_start_date) : null;
      const ve = r.vacation_end_date ? new Date(r.vacation_end_date) : null;
      if (vs && ve && today >= vs && today <= ve) continue;
      (r.vb_legal_areas || []).forEach((a: string) => covered.add(a));
    }
    const uncoveredAreas = dozentAreas.filter(a => !covered.has(a));
    console.log(`📋 [${requestId}] Uncovered areas:`, uncoveredAreas);

    if (uncoveredAreas.length === 0) {
      console.log(`✅ [${requestId}] All areas still covered by other dozenten, no handover needed`);
      return new Response(
        JSON.stringify({ success: true, transferred: 0, message: 'All areas still covered' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load open (unclaimed) cases in the uncovered areas
    const { data: openCases } = await supabaseAdmin
      .from('vb_case_study_requests')
      .select('id, case_study_number, legal_area, sub_area, focus_area, profile_id, created_at')
      .eq('status', 'requested')
      .in('legal_area', uncoveredAreas)
      .order('created_at', { ascending: true });

    console.log(`📋 [${requestId}] Open cases in uncovered areas: ${openCases?.length || 0}`);

    if (!openCases || openCases.length === 0) {
      console.log(`✅ [${requestId}] No open cases to hand over, skipping notification`);
      return new Response(
        JSON.stringify({ success: true, transferred: 0, message: 'No open cases to hand over' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve student names
    const studentIds = [...new Set(openCases.map(c => c.profile_id).filter(Boolean))];
    const nameMap = new Map<string, string>();
    if (studentIds.length > 0) {
      const { data: students } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', studentIds);
      (students || []).forEach((s: any) => nameMap.set(s.id, s.full_name || s.email));
    }

    // Find springer dozenten covering the uncovered areas
    const { data: springers } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, vb_legal_areas')
      .eq('role', 'dozent')
      .eq('vb_springer', true)
      .not('vb_legal_areas', 'is', null);

    const relevantSpringers = (springers || []).filter((s: any) =>
      (s.vb_legal_areas || []).some((a: string) => uncoveredAreas.includes(a))
    );
    console.log(`📋 [${requestId}] Relevant springers: ${relevantSpringers.length}`);

    if (relevantSpringers.length === 0) {
      console.warn(`⚠️ [${requestId}] No springer covers the uncovered areas!`);
      return new Response(
        JSON.stringify({ success: true, transferred: 0, message: 'No springer available for uncovered areas' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mailgunDomain = 'kraatz-group.de';
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    const redirectUrl = 'https://portal.kraatz-group.de/klausurenbesprechung/korrektur?tab=requests';

    const results: any[] = [];

    for (const springer of relevantSpringers) {
      // Cases relevant for this springer's areas
      const springerCases = openCases.filter(c => (springer.vb_legal_areas || []).includes(c.legal_area));
      if (springerCases.length === 0) continue;

      // In-app notification
      const { error: notifError } = await supabaseAdmin
        .from('vb_notifications')
        .insert({
          profile_id: springer.id,
          title: 'Fälle an Sie übertragen',
          message: `${springerCases.length === 1 ? 'Ein offener Fall wurde' : `${springerCases.length} offene Fälle wurden`} an Sie übertragen, da ${dozent.full_name || 'ein Dozent'} nicht verfügbar ist.`,
          type: 'info',
          read: false
        });
      if (notifError) {
        console.error(`❌ [${requestId}] Error creating in-app notification:`, notifError);
      } else {
        console.log(`✅ [${requestId}] In-app notification created for springer ${springer.email}`);
      }

      // Generate magic link for direct login
      let magicLink = redirectUrl;
      try {
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: springer.email,
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

      const caseRows = springerCases.map(c => {
        const student = nameMap.get(c.profile_id) || 'Unbekannt';
        const areaParts = [c.legal_area, c.sub_area].filter(Boolean).join(' / ');
        return `
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px; width: 40%; vertical-align: top;"><strong>Klausur #${c.case_study_number ?? '?'}</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${areaParts}${c.focus_area ? `, ${c.focus_area}` : ''}<br><span style="color: #666;">Teilnehmer: ${student}</span></td>
              </tr>`;
      }).join('');

      const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <h1 style="margin: 0; font-size: 22px; color: #333;">Kraatz Group</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Portal</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px 20px; background-color: white;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Fälle an Sie übertragen (Videoklausurenkorrektur)</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hallo ${springer.full_name || ''},
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            ${dozent.full_name || 'Ein Dozent'} hat sich auf „Nicht verfügbar" gestellt. Als Springer-Dozent ${springerCases.length === 1 ? 'wurde der folgende offene Fall' : `wurden die folgenden ${springerCases.length} offenen Fälle`} an Sie übertragen. Bitte prüfen Sie die Anfragen und weisen Sie das entsprechende Material zu.
          </p>

          <!-- Case Details -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
            <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Übertragene Fälle:</h4>
            <table style="width: 100%; border-collapse: collapse;">${caseRows}
            </table>
          </div>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            <strong>Klicken Sie auf den Button unten, um sich direkt anzumelden und die Anfragen zu prüfen:</strong>
          </p>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" 
               style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
              Zu den Anfragen
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

      if (mailgunApiKey) {
        const mailgunUrl = `https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`;
        const emailSender = 'Kraatz Group Portal <postmaster@kraatz-group.de>';
        const emailSubject = `Fälle an Sie übertragen: ${springerCases.length === 1 ? '1 offener Fall' : `${springerCases.length} offene Fälle`} (Videoklausurenkorrektur)`;
        const formData = new FormData();
        formData.append('from', emailSender);
        formData.append('to', springer.email);
        formData.append('subject', emailSubject);
        formData.append('html', emailHtml);
        formData.append('charset', 'utf-8');

        try {
          const mailgunResponse = await fetch(mailgunUrl, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}` },
            body: formData,
          });
          if (mailgunResponse.ok) {
            const emailResult = await mailgunResponse.json();
            console.log(`✅ [${requestId}] Handover email sent to springer ${springer.email}`);
            await logNotification({
              edgeFunction: 'vb-notify-springer-handover',
              supabaseAdmin,
              recipientEmail: springer.email,
              recipientName: springer.full_name,
              subject: emailSubject,
              sender: emailSender,
              status: 'sent',
              providerMessageId: emailResult?.id,
              context: { dozentId, springerId: springer.id, caseCount: springerCases.length, uncoveredAreas },
              payload: { dozentId },
            });
            results.push({ springer: springer.email, cases: springerCases.length, emailSent: true });
          } else {
            const errorText = await mailgunResponse.text();
            console.error(`❌ [${requestId}] Mailgun error for ${springer.email}:`, errorText);
            await logNotification({
              edgeFunction: 'vb-notify-springer-handover',
              supabaseAdmin,
              recipientEmail: springer.email,
              recipientName: springer.full_name,
              subject: emailSubject,
              sender: emailSender,
              status: 'failed',
              errorMessage: `Mailgun API error: ${mailgunResponse.status} - ${errorText}`,
              context: { dozentId, springerId: springer.id, caseCount: springerCases.length, uncoveredAreas },
              payload: { dozentId },
            });
            results.push({ springer: springer.email, cases: springerCases.length, emailSent: false });
          }
        } catch (mailgunError) {
          console.error(`❌ [${requestId}] Failed to send email to ${springer.email}:`, mailgunError);
          results.push({ springer: springer.email, cases: springerCases.length, emailSent: false });
        }
      } else {
        console.log(`⚠️ [${requestId}] MAILGUN_API_KEY not configured, skipping email`);
        results.push({ springer: springer.email, cases: springerCases.length, emailSent: false });
      }
    }

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`, results);

    return new Response(
      JSON.stringify({ success: true, transferred: openCases.length, results, requestId, duration: endTime - startTime }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`❌ [${requestId}] Error in vb-notify-springer-handover:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
