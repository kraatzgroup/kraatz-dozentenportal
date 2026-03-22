console.log('🚀 cancel-event-notify edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface CancelEventNotifyRequest {
  teilnehmerEmail: string;
  teilnehmerName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  legalArea: string;
  cancelReason?: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 cancel-event-notify function started');
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
    const { teilnehmerEmail, teilnehmerName, eventTitle, eventDate, eventTime, legalArea, cancelReason } = await req.json() as CancelEventNotifyRequest;
    console.log(`📋 [${requestId}] Request data:`, { teilnehmerEmail, teilnehmerName, eventTitle, eventDate, eventTime, legalArea });

    // Determine redirect URL based on origin (localhost vs production)
    const origin = req.headers.get('origin') || '';
    const baseUrl = origin.includes('localhost') ? origin : 'https://portal.kraatz-group.de';
    const redirectUrl = `${baseUrl}/dashboard?tab=elite-kleingruppe`;
    console.log(`🌐 [${requestId}] Origin: ${origin}, Redirect URL: ${redirectUrl}`);

    // Validate input
    if (!teilnehmerEmail || !teilnehmerName || !eventTitle || !eventDate || !eventTime || !legalArea) {
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

    console.log(`� [${requestId}] Preparing cancellation notification for: ${teilnehmerName} (${teilnehmerEmail})`);
    
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
        <div style="background-color: white; padding: 30px; text-align: center; border-bottom: 3px solid #dc2626;">
          <h1 style="color: #dc2626; margin: 0; font-size: 28px;">Kraatz Group Portal</h1>
        </div>
        
        <!-- Main Content -->
        <div style="background-color: #ffffff; padding: 30px;">
          <h2 style="color: #333; margin-top: 0;">Hallo ${teilnehmerName},</h2>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            Leider müssen wir Ihnen mitteilen, dass die folgende Unterrichtseinheit <strong>abgesagt</strong> wurde:
          </p>
          
          <!-- Event Info Box -->
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
            <h3 style="color: #dc2626; margin-top: 0; font-size: 18px;">Abgesagte Einheit</h3>
            <p style="margin: 10px 0; color: #333;"><strong>Titel:</strong> ${eventTitle}</p>
            <p style="margin: 10px 0; color: #333;"><strong>Datum:</strong> ${eventDate}</p>
            <p style="margin: 10px 0; color: #333;"><strong>Uhrzeit:</strong> ${eventTime}</p>
            <p style="margin: 10px 0; color: #333;"><strong>Rechtsgebiet:</strong> ${legalArea}</p>
            ${cancelReason ? `
            <div style="background-color: #fff; border: 1px solid #fecaca; padding: 15px; margin-top: 15px; border-radius: 5px;">
              <p style="margin: 0; color: #333;"><strong>Grund:</strong> ${cancelReason}</p>
            </div>
            ` : ''}
          </div>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            Wir entschuldigen uns für die Unannehmlichkeiten. Bitte prüfen Sie Ihren Kalender für alternative Termine.
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
    formData.append('subject', `Absage: ${eventTitle} am ${eventDate}`);
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
    console.log(`✅ [${requestId}] Cancellation notification sent to ${teilnehmerName} (${teilnehmerEmail}) in ${endTime - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cancellation notification sent successfully to ${teilnehmerEmail}`,
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
