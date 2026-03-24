// Edge function for resending welcome emails with new magic links
console.log('🚀 resend-welcome-email edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResendEmailRequest {
  email: string;
  fullName: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 resend-welcome-email function started');
  console.log('📥 Request method:', req.method);
  console.log('🆔 Request ID:', requestId);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight request handled`);
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`📋 [${requestId}] Parsing request body...`);
    const { email, fullName } = await req.json() as ResendEmailRequest;
    console.log(`📋 [${requestId}] Request data:`, { email, fullName });

    // Determine base URL based on origin (localhost vs production)
    const origin = req.headers.get('origin') || '';
    const baseUrl = origin.includes('localhost') ? origin : 'https://portal.kraatz-group.de';
    console.log(`🌐 [${requestId}] Origin: ${origin}, Base URL: ${baseUrl}`);

    // Validate input
    if (!email || !fullName) {
      console.error(`❌ [${requestId}] Missing required fields`);
      return new Response(
        JSON.stringify({ error: 'Email and fullName are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create password reset link with email pre-filled
    const resetLink = `${baseUrl}/?tab=reset&email=${encodeURIComponent(email)}`;
    console.log(`🔗 [${requestId}] Password reset link created: ${resetLink}`);

    // Send email directly via Mailgun
    console.log(`📧 [${requestId}] Sending email via Mailgun...`);
    
    const mailgunApiKey = (Deno.env.get('MAILGUN_API_KEY') || '').trim();
    const mailgunDomain = 'kraatz-group.de';

    if (!mailgunApiKey) {
      console.error(`❌ [${requestId}] MAILGUN_API_KEY not configured`);
      throw new Error('Mailgun API key not configured');
    }
    console.log(`🔑 [${requestId}] Mailgun API key loaded (length: ${mailgunApiKey.length}, starts with: ${mailgunApiKey.substring(0, 8)}...)`);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <h1 style="margin: 0; font-size: 22px; color: #333;">Kraatz Group</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Portal</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px 20px; background-color: white;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Ihr Account wurde erfolgreich erstellt</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hallo ${fullName},
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            herzlich willkommen! Ihr Account für das <strong>Kraatz Group Portal</strong> wurde erfolgreich erstellt und Sie können jetzt auf das System zugreifen.
          </p>

          <!-- Account Details -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
            <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Ihre Account-Details:</h4>
            <p style="margin: 8px 0; color: #555; font-size: 14px;"><strong>E-Mail:</strong> ${email}</p>
            <p style="margin: 8px 0; color: #555; font-size: 14px;"><strong>Name:</strong> ${fullName}</p>
          </div>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            <strong>Direkt loslegen:</strong> Klicken Sie auf den Button & fordern Sie über die "Passwort vergessen" einen sog. Magic Link an.
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            Sie erhalten dann einen Link per E-Mail, über den Sie automatisch eingeloggt werden. Im Anschluss müssen Sie in den Einstellungen ein Passwort festlegen.
          </p>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
              Zum Portal &amp; Passwort anfordern
            </a>
          </div>
          
          <!-- Alternative Link -->
          <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #6c757d;">
            <p style="margin: 0 0 10px 0; color: #495057; font-size: 14px;">
              <strong>Alternative:</strong> Falls der Button nicht funktioniert, können Sie diesen Link kopieren:
            </p>
            <div style="background-color: #ffffff; padding: 10px; border-radius: 4px; border: 1px solid #ced4da; word-break: break-all; font-family: monospace; font-size: 12px; color: #495057;">
              ${resetLink}
            </div>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
            <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Nächste Schritte:</h4>
            <p style="margin: 8px 0; color: #555; font-size: 14px;">1. Klicken Sie auf den blauen Button oben</p>
            <p style="margin: 8px 0; color: #555; font-size: 14px;">2. Fordern Sie über "Passwort vergessen" einen Magic Link an</p>
            <p style="margin: 8px 0; color: #555; font-size: 14px;">3. Klicken Sie auf den Link in der E-Mail</p>
            <p style="margin: 8px 0; color: #555; font-size: 14px;">4. Legen Sie in den Einstellungen Ihr Passwort fest</p>
          </div>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Falls Sie Fragen haben oder Hilfe benötigen, wenden Sie sich bitte an das Team.
          </p>
          
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
    console.log(`📧 [${requestId}] Mailgun URL: ${mailgunUrl}`);
    const authHeader = `Basic ${btoa(`api:${mailgunApiKey}`)}`;
    console.log(`🔑 [${requestId}] Auth header length: ${authHeader.length}`);
    const formData = new FormData();
    formData.append('from', 'Kraatz Group Portal <postmaster@kraatz-group.de>');
    formData.append('to', email);
    formData.append('subject', 'Willkommen beim Kraatz Group Portal - Account aktivieren');
    formData.append('html', emailHtml);

    const mailgunResponse = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
      body: formData,
    });

    if (!mailgunResponse.ok) {
      const errorText = await mailgunResponse.text();
      console.error(`❌ [${requestId}] Mailgun error:`, errorText);
      throw new Error(`Mailgun API error: ${mailgunResponse.status} - ${errorText}`);
    }

    const emailResult = await mailgunResponse.json();
    console.log(`✅ [${requestId}] Email sent successfully via Mailgun:`, emailResult);

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Welcome email resent successfully to ${email}`,
        emailResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [${requestId}] Error in resend-welcome-email function after ${endTime - startTime}ms:`, error);

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

console.log('✅ resend-welcome-email edge function setup complete');
