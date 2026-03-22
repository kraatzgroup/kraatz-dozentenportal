console.log('🚀 reschedule-event-notify edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface RescheduleEventNotifyRequest {
  teilnehmerEmail: string;
  teilnehmerName: string;
  eventTitle: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  legalArea: string;
  rescheduleReason?: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 reschedule-event-notify function started');
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
    const { teilnehmerEmail, teilnehmerName, eventTitle, oldDate, oldTime, newDate, newTime, legalArea, rescheduleReason } = await req.json() as RescheduleEventNotifyRequest;
    console.log(`📋 [${requestId}] Request data:`, { teilnehmerEmail, teilnehmerName, eventTitle, oldDate, oldTime, newDate, newTime, legalArea });

    // Determine redirect URL based on origin (localhost vs production)
    const origin = req.headers.get('origin') || '';
    const baseUrl = origin.includes('localhost') ? origin : 'https://portal.kraatz-group.de';
    const redirectUrl = `${baseUrl}/dashboard?tab=elite-kleingruppe`;
    console.log(`🌐 [${requestId}] Origin: ${origin}, Redirect URL: ${redirectUrl}`);

    // Validate input
    if (!teilnehmerEmail || !teilnehmerName || !eventTitle || !oldDate || !oldTime || !newDate || !newTime || !legalArea) {
      console.error(`❌ [${requestId}] Missing required fields`);
      return new Response(
        JSON.stringify({ error: 'All fields are required' }),
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

    console.log(`� [${requestId}] Preparing reschedule notification for: ${teilnehmerName} (${teilnehmerEmail})`);
    
    // Generate magic link for direct login
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: teilnehmerEmail,
      options: {
        redirectTo: redirectUrl
      }
    });

    if (linkError) {
      console.error(`❌ [${requestId}] Error generating login link:`, linkError);
      throw linkError;
    }

    const magicLink = linkData?.properties?.action_link;
    if (!magicLink) {
      console.error(`❌ [${requestId}] No login link returned`);
      throw new Error('Failed to generate login link');
    }

    // Prepare email content
    const mailgunDomain = 'kraatz-group.de';
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');

    if (!mailgunApiKey) {
      throw new Error('MAILGUN_API_KEY not configured');
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <!-- Header -->
        <div style="background-color: white; padding: 30px; text-align: center; border-bottom: 3px solid #9333ea;">
          <h1 style="color: #9333ea; margin: 0; font-size: 28px;">Kraatz Group Portal</h1>
        </div>
        
        <!-- Main Content -->
        <div style="background-color: #ffffff; padding: 30px;">
          <h2 style="color: #333; margin-top: 0;">Hallo ${teilnehmerName},</h2>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            Die folgende Unterrichtseinheit wurde <strong>verschoben</strong>:
          </p>
          
          <!-- Event Info Box -->
          <div style="background-color: #faf5ff; border-left: 4px solid #9333ea; padding: 20px; margin: 20px 0;">
            <h3 style="color: #9333ea; margin-top: 0; font-size: 18px;">Verschobene Einheit</h3>
            <p style="margin: 10px 0; color: #333;"><strong>Titel:</strong> ${eventTitle}</p>
            <p style="margin: 10px 0; color: #333;"><strong>Rechtsgebiet:</strong> ${legalArea}</p>
            
            <!-- Old Time -->
            <div style="background-color: #fff; border: 1px solid #e9d5ff; padding: 15px; margin-top: 15px; border-radius: 5px;">
              <p style="margin: 0; color: #666; font-size: 14px;"><strong>Alter Termin:</strong></p>
              <p style="margin: 5px 0 0 0; color: #dc2626; text-decoration: line-through;">
                ${oldDate} um ${oldTime}
              </p>
            </div>
            
            <!-- New Time -->
            <div style="background-color: #fff; border: 2px solid #9333ea; padding: 15px; margin-top: 10px; border-radius: 5px;">
              <p style="margin: 0; color: #666; font-size: 14px;"><strong>Neuer Termin:</strong></p>
              <p style="margin: 5px 0 0 0; color: #16a34a; font-size: 18px; font-weight: bold;">
                ${newDate} um ${newTime}
              </p>
            </div>
            
            ${rescheduleReason ? `
            <div style="background-color: #fff; border: 1px solid #e9d5ff; padding: 15px; margin-top: 15px; border-radius: 5px;">
              <p style="margin: 0; color: #333;"><strong>Grund:</strong> ${rescheduleReason}</p>
            </div>
            ` : ''}
          </div>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            Bitte merken Sie sich den neuen Termin vor. Wir freuen uns auf Ihre Teilnahme!
          </p>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" 
               style="display: inline-block; background-color: #2e83c2; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
              Zum Kalender
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
    formData.append('to', teilnehmerEmail);
    formData.append('subject', `Terminänderung: ${eventTitle} - Neuer Termin: ${newDate}`);
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
      console.error(`❌ [${requestId}] Mailgun error:`, errorText);
      throw new Error(`Mailgun API error: ${mailgunResponse.status} - ${errorText}`);
    }

    const emailResult = await mailgunResponse.json();
    
    const endTime = Date.now();
    console.log(`✅ [${requestId}] Reschedule notification sent to ${teilnehmerName} (${teilnehmerEmail}) in ${endTime - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reschedule notification sent successfully to ${teilnehmerEmail}`,
        emailResult
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
