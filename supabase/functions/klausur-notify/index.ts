console.log('🚀 klausur-notify edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface KlausurNotifyRequest {
  dozentEmail: string;
  dozentName: string;
  teilnehmerName: string;
  klausurTitle: string;
  legalArea: string;
  dozentId: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 klausur-notify function started');
  console.log('📥 Request method:', req.method);
  console.log('🆔 Request ID:', requestId);
  console.log('🌐 Request URL:', req.url);

  // Log all headers for debugging
  console.log('📋 Request headers:');
  req.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });

  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight request handled`);
    return new Response('ok', { headers: corsHeaders });
  }

  // Check if this is a POST request
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
    const { dozentEmail, dozentName, teilnehmerName, klausurTitle, legalArea, dozentId } = await req.json() as KlausurNotifyRequest;
    console.log(`📋 [${requestId}] Request data:`, { dozentEmail, dozentName, teilnehmerName, klausurTitle, legalArea, dozentId });

    // Determine redirect URL based on origin (localhost vs production)
    const origin = req.headers.get('origin') || '';
    const redirectUrl = origin.includes('localhost') ? `${origin}/elite-kleingruppe` : 'https://portal.kraatz-group.de/elite-kleingruppe';
    console.log(`🌐 [${requestId}] Origin: ${origin}, Redirect URL: ${redirectUrl}`);

    // Validate input
    if (!dozentEmail || !dozentName || !teilnehmerName || !klausurTitle || !legalArea || !dozentId) {
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

    console.log(`🔗 [${requestId}] Generating magic link for: ${dozentEmail}`);
    
    // Generate magic link for direct login
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: dozentEmail,
      options: {
        redirectTo: redirectUrl
      }
    });

    if (linkError) {
      console.error(`❌ [${requestId}] Error generating magic link:`, linkError);
      throw linkError;
    }

    const magicLink = linkData?.properties?.action_link;
    if (!magicLink) {
      console.error(`❌ [${requestId}] No magic link returned`);
      throw new Error('Failed to generate magic link');
    }

    console.log(`✅ [${requestId}] Magic link generated successfully`);

    // Send email via Mailgun
    console.log(`📧 [${requestId}] Sending notification email via Mailgun...`);
    
    const mailgunApiKey = (Deno.env.get('MAILGUN_API_KEY') || '').trim();
    const mailgunDomain = 'kraatz-group.de';

    if (!mailgunApiKey) {
      console.error(`❌ [${requestId}] MAILGUN_API_KEY not configured`);
      throw new Error('Mailgun API key not configured');
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <h1 style="margin: 0; font-size: 22px; color: #333;">Kraatz Group</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Portal</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px 20px; background-color: white;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Neue Klausur zur Korrektur eingereicht</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hallo ${dozentName},
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            <strong>${teilnehmerName}</strong> hat eine neue Klausur zur Korrektur eingereicht.
          </p>

          <!-- Klausur Details -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
            <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Klausur-Details:</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px; width: 40%;"><strong>Titel:</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${klausurTitle}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Rechtsgebiet:</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${legalArea}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Teilnehmer:</strong></td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${teilnehmerName}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            <strong>Klicken Sie auf den Button unten, um sich direkt anzumelden und die Klausur zu korrigieren:</strong>
          </p>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" 
               style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
              Zur Klausur-Korrektur
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
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>Hinweis:</strong><br>
              Dieser Link ist nur für Sie bestimmt und läuft nach <strong>1 Stunde</strong> ab. 
              Sie werden automatisch zum Elite-Kleingruppe Dashboard weitergeleitet.
            </p>
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

    const mailgunUrl = `https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`;
    const formData = new FormData();
    formData.append('from', 'Kraatz Group Portal <postmaster@kraatz-group.de>');
    formData.append('to', dozentEmail);
    formData.append('subject', `Neue Klausur zur Korrektur: ${klausurTitle} (${legalArea})`);
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
    console.log(`✅ [${requestId}] Notification email sent successfully via Mailgun:`, emailResult);

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notification email sent successfully to ${dozentEmail}`,
        emailResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [${requestId}] Error in klausur-notify function after ${endTime - startTime}ms:`, error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        details: error
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

console.log('✅ klausur-notify edge function setup complete');
