console.log('🚀 send-welcome-email edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 send-welcome-email function started');
  console.log('📥 Request method:', req.method);
  console.log('🆔 Request ID:', requestId);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight request handled`);
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`📋 [${requestId}] Parsing request body...`);
    const body = await req.json();
    const { email, fullName } = body;
    console.log(`📋 [${requestId}] Request data:`, { email, fullName });

    // Determine redirect URL based on origin (localhost vs production)
    const origin = body.origin || req.headers.get('origin') || '';
    const baseUrl = origin.includes('localhost') ? origin : 'https://portal.kraatz-group.de';
    const redirectUrl = `${baseUrl}/dashboard?tab=dashboard`;
    console.log(`🌐 [${requestId}] Origin: ${origin}, Redirect URL: ${redirectUrl}`);

    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ error: 'E-Mail und Name sind erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🎉 [${requestId}] Sending welcome email to: ${email}`);

    // Initialize Supabase admin client
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Generate magic link for direct login
    console.log(`🔗 [${requestId}] Generating magic login link for: ${email}`);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: redirectUrl
      }
    });

    if (authError) {
      console.error(`❌ [${requestId}] Error generating magic link: ${authError.message}`);
      return new Response(
        JSON.stringify({ error: 'Fehler beim Generieren des Login-Links', details: authError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const magicLink = authData?.properties?.action_link;
    if (!magicLink) {
      console.error(`❌ [${requestId}] No magic link generated`);
      return new Response(
        JSON.stringify({ error: 'Fehler beim Generieren des Login-Links' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [${requestId}] Magic link generated successfully`);

    // Send email via Mailgun
    console.log(`📧 [${requestId}] Sending welcome email via Mailgun...`);

    const mailgunApiKey = (Deno.env.get('MAILGUN_API_KEY') || '').trim();
    const mailgunDomain = 'kraatz-group.de';

    if (!mailgunApiKey) {
      console.error(`❌ [${requestId}] MAILGUN_API_KEY not configured`);
      return new Response(
        JSON.stringify({ error: 'E-Mail-Konfiguration fehlt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
            <strong>Direkt loslegen:</strong> Klicken Sie auf den Button unten, um sich automatisch anzumelden und Ihr Passwort festzulegen:
          </p>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" 
               style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
              Account aktivieren &amp; Passwort festlegen
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
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
            <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Nächste Schritte:</h4>
            <p style="margin: 8px 0; color: #555; font-size: 14px;">1. Klicken Sie auf den blauen Button oben</p>
            <p style="margin: 8px 0; color: #555; font-size: 14px;">2. Sie werden automatisch angemeldet</p>
            <p style="margin: 8px 0; color: #555; font-size: 14px;">3. Legen Sie Ihr persönliches Passwort fest</p>
            <p style="margin: 8px 0; color: #555; font-size: 14px;">4. Erkunden Sie das Portal</p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>Sicherheitshinweis:</strong><br>
              Dieser Login-Link ist nur für Sie bestimmt und läuft nach <strong>24 Stunden</strong> ab. 
              Teilen Sie diesen Link nicht mit anderen Personen.
            </p>
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

    // Send via Mailgun
    const mailgunUrl = `https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`;
    const formData = new FormData();
    formData.append('from', 'Kraatz Group Portal <postmaster@kraatz-group.de>');
    formData.append('to', email);
    formData.append('subject', 'Willkommen beim Kraatz Group Portal - Account aktivieren');
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
      return new Response(
        JSON.stringify({ error: 'Fehler beim E-Mail-Versand', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mailgunResult = await mailgunResponse.json();
    console.log(`✅ [${requestId}] Welcome email sent successfully via Mailgun: ${mailgunResult.id}`);

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Willkommens-E-Mail wurde erfolgreich an ${email} gesendet.`,
        emailId: mailgunResult.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [${requestId}] Error in send-welcome-email after ${endTime - startTime}ms:`, error);
    return new Response(
      JSON.stringify({
        error: 'Fehler beim Versenden der Willkommens-E-Mail',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

console.log('✅ send-welcome-email edge function setup complete');
