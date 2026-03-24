console.log('🚀 unit-update-notify edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface UnitUpdateNotifyRequest {
  releaseId: string;
  eventTitle: string;
  legalArea: string;
  releaseDate: string;
  eliteKleingruppeId: string;
  updateType: 'document_added' | 'description_changed';
  documentName?: string;
  description?: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 unit-update-notify function started');
  console.log('📥 Request method:', req.method);
  console.log('🆔 Request ID:', requestId);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight request handled`);
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.error(`❌ [${requestId}] Invalid method: ${req.method}, expected POST`);
    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    console.log(`📋 [${requestId}] Parsing request body...`);
    const { releaseId, eventTitle, legalArea, releaseDate, eliteKleingruppeId, updateType, documentName, description } = await req.json() as UnitUpdateNotifyRequest;
    console.log(`📋 [${requestId}] Request data:`, { releaseId, eventTitle, legalArea, releaseDate, eliteKleingruppeId, updateType, documentName });

    // Determine redirect URL based on origin
    const origin = req.headers.get('origin') || '';
    const baseUrl = origin.includes('localhost') ? origin : 'https://portal.kraatz-group.de';
    const redirectUrl = `${baseUrl}/dashboard?tab=elite-kleingruppe`;
    console.log(`🌐 [${requestId}] Origin: ${origin}, Redirect URL: ${redirectUrl}`);

    // Validate input
    if (!releaseId || !eventTitle || !eliteKleingruppeId || !updateType) {
      console.error(`❌ [${requestId}] Missing required fields`);
      return new Response(
        JSON.stringify({ error: 'releaseId, eventTitle, eliteKleingruppeId, and updateType are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch participants for this elite group
    console.log(`👥 [${requestId}] Fetching participants for elite group: ${eliteKleingruppeId}`);
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('teilnehmer')
      .select('email, first_name, name')
      .eq('elite_kleingruppe_id', eliteKleingruppeId);

    if (participantsError) {
      console.error(`❌ [${requestId}] Error fetching participants:`, participantsError);
      throw participantsError;
    }

    if (!participants || participants.length === 0) {
      console.log(`ℹ️ [${requestId}] No participants found for elite group ${eliteKleingruppeId}`);
      return new Response(
        JSON.stringify({ success: true, message: 'No participants to notify', emailsSent: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`👥 [${requestId}] Found ${participants.length} participants`);

    // Mailgun config
    const mailgunDomain = 'kraatz-group.de';
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');

    if (!mailgunApiKey) {
      throw new Error('MAILGUN_API_KEY not configured');
    }

    // Format date for display
    const formattedDate = new Date(releaseDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Build email subject and content based on update type
    let emailSubject: string;
    let updateInfoHtml: string;

    if (updateType === 'document_added') {
      emailSubject = `Neues Dokument: ${eventTitle} (${formattedDate})`;
      updateInfoHtml = `
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <h3 style="color: #065f46; margin-top: 0; font-size: 18px;">📄 Neues Dokument hochgeladen</h3>
          <p style="margin: 10px 0; color: #333;"><strong>Einheit:</strong> ${eventTitle}</p>
          <p style="margin: 10px 0; color: #333;"><strong>Datum:</strong> ${formattedDate}</p>
          ${legalArea ? `<p style="margin: 10px 0; color: #333;"><strong>Rechtsgebiet:</strong> ${legalArea}</p>` : ''}
          ${documentName ? `
          <div style="background-color: #fff; border: 1px solid #a7f3d0; padding: 15px; margin-top: 15px; border-radius: 5px;">
            <p style="margin: 0; color: #333;">
              <strong>Dokument:</strong> ${documentName}
            </p>
          </div>
          ` : ''}
        </div>
      `;
    } else {
      emailSubject = `Aktualisierung: ${eventTitle} (${formattedDate})`;
      updateInfoHtml = `
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <h3 style="color: #1e40af; margin-top: 0; font-size: 18px;">📝 Beschreibung aktualisiert</h3>
          <p style="margin: 10px 0; color: #333;"><strong>Einheit:</strong> ${eventTitle}</p>
          <p style="margin: 10px 0; color: #333;"><strong>Datum:</strong> ${formattedDate}</p>
          ${legalArea ? `<p style="margin: 10px 0; color: #333;"><strong>Rechtsgebiet:</strong> ${legalArea}</p>` : ''}
          ${description ? `
          <div style="background-color: #fff; border: 1px solid #bfdbfe; padding: 15px; margin-top: 15px; border-radius: 5px;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Neue Beschreibung:</strong></p>
            <p style="margin: 10px 0 0 0; color: #333;">${description}</p>
          </div>
          ` : ''}
        </div>
      `;
    }

    // Send emails to all participants
    let emailsSent = 0;
    let emailsFailed = 0;

    const emailPromises = participants.map(async (participant) => {
      const name = participant.name || participant.first_name || 'Teilnehmer';
      const email = participant.email;

      if (!email) {
        console.warn(`⚠️ [${requestId}] Participant has no email, skipping`);
        return;
      }

      try {
        // Generate magic link
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo: redirectUrl }
        });

        if (linkError) {
          console.error(`❌ [${requestId}] Error generating link for ${email}:`, linkError);
          emailsFailed++;
          return;
        }

        const magicLink = linkData?.properties?.action_link;
        if (!magicLink) {
          console.error(`❌ [${requestId}] No link returned for ${email}`);
          emailsFailed++;
          return;
        }

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <!-- Header -->
            <div style="background-color: white; padding: 30px; text-align: center; border-bottom: 3px solid #2e83c2;">
              <h1 style="color: #2e83c2; margin: 0; font-size: 28px;">Kraatz Group Portal</h1>
            </div>
            
            <!-- Main Content -->
            <div style="background-color: #ffffff; padding: 30px;">
              <h2 style="color: #333; margin-top: 0;">Hallo ${name},</h2>
              
              <p style="color: #666; line-height: 1.6; font-size: 16px;">
                Es gibt eine Aktualisierung zu einer Ihrer Unterrichtseinheiten:
              </p>
              
              ${updateInfoHtml}
              
              <p style="color: #666; line-height: 1.6; font-size: 16px;">
                Melden Sie sich im Portal an, um die Änderungen einzusehen.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${magicLink}" 
                   style="display: inline-block; background-color: #2e83c2; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                  Zum Portal
                </a>
              </div>
              
              <!-- Alternative Link -->
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="color: #666; font-size: 14px; margin: 0;">
                  Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:
                </p>
                <p style="color: #2e83c2; font-size: 12px; word-break: break-all; margin: 10px 0;">
                  ${magicLink}
                </p>
              </div>
              
              <!-- Warning -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="color: #856404; font-size: 14px; margin: 0;">
                  <strong>Wichtig:</strong> Dieser Link ist aus Sicherheitsgründen nur für kurze Zeit gültig.
                </p>
              </div>
              
              <p style="color: #666; line-height: 1.6; margin-top: 30px;">
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

        const mailgunUrl = `https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`;
        const formData = new FormData();
        formData.append('from', 'Kraatz Group Portal <postmaster@kraatz-group.de>');
        formData.append('to', email);
        formData.append('subject', emailSubject);
        formData.append('html', emailHtml);

        const mailgunResponse = await fetch(mailgunUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
          },
          body: formData,
        });

        if (!mailgunResponse.ok) {
          const errorText = await mailgunResponse.text();
          console.error(`❌ [${requestId}] Mailgun error for ${email}:`, errorText);
          emailsFailed++;
          return;
        }

        emailsSent++;
        console.log(`✅ [${requestId}] Email sent to ${name} (${email})`);
      } catch (emailError) {
        console.error(`❌ [${requestId}] Error sending to ${email}:`, emailError);
        emailsFailed++;
      }
    });

    await Promise.all(emailPromises);

    const endTime = Date.now();
    console.log(`✅ [${requestId}] Done in ${endTime - startTime}ms. Sent: ${emailsSent}, Failed: ${emailsFailed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notifications sent to ${emailsSent} participants`,
        emailsSent,
        emailsFailed,
        totalParticipants: participants.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error(`❌ [${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
