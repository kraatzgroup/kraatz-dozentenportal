console.log('🚀 send-password-reset edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 send-password-reset function started');
  console.log('📥 Request method:', req.method);
  console.log('🆔 Request ID:', requestId);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight request handled`);
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`📋 [${requestId}] Parsing request body...`);
    const { email } = await req.json();

    // Determine redirect URL based on origin (localhost vs production)
    const origin = req.headers.get('origin') || '';
    const redirectUrl = origin.includes('localhost') ? origin : 'https://portal.kraatz-group.de';
    console.log(`🌐 [${requestId}] Origin: ${origin}, Redirect URL: ${redirectUrl}`);

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'E-Mail-Adresse ist erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔐 [${requestId}] Password reset request for: ${email}`);

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

    // Check if user exists in profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      console.log(`❌ [${requestId}] User not found in database: ${email}`);
      // Don't reveal if user exists or not for security
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Falls ein Account mit dieser E-Mail-Adresse existiert, wurde eine Reset-E-Mail gesendet.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [${requestId}] User found: ${profile.email} (${profile.role})`);

    // Generate magic link
    console.log(`🔐 [${requestId}] Generating magic link for direct login...`);

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
    console.log(`📧 [${requestId}] Sending password reset email via Mailgun...`);

    const mailgunApiKey = (Deno.env.get('MAILGUN_API_KEY') || '').trim();
    const mailgunDomain = 'kraatz-group.de';

    if (!mailgunApiKey) {
      console.error(`❌ [${requestId}] MAILGUN_API_KEY not configured`);
      return new Response(
        JSON.stringify({ error: 'E-Mail-Konfiguration fehlt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine role display name
    const roleMap: Record<string, string> = {
      'admin': 'Administrator',
      'buchhaltung': 'Buchhaltung',
      'verwaltung': 'Verwaltung',
      'vertrieb': 'Vertrieb',
      'dozent': 'Dozent',
      'teilnehmer': 'Teilnehmer'
    };
    const roleDisplayName = roleMap[profile.role] || profile.role;
    const userName = profile.full_name || email;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <h1 style="margin: 0; font-size: 22px; color: #333;">Kraatz Group</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Portal</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px 20px; background-color: white;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Passwort zurücksetzen</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hallo ${userName},
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts für das Kraatz Group Portal gestellt.
          </p>

          <!-- Account Details -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
            <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Ihr Account:</h4>
            <p style="margin: 8px 0; color: #555; font-size: 14px;"><strong>E-Mail:</strong> ${email}</p>
            <p style="margin: 8px 0; color: #555; font-size: 14px;"><strong>Rolle:</strong> ${roleDisplayName}</p>
          </div>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            <strong>Klicken Sie auf den Button unten, um sich direkt anzumelden:</strong><br>
            <em>Sie werden automatisch angemeldet und können Ihr Passwort in den Einstellungen ändern.</em>
          </p>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" 
               style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
              Direkt anmelden
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
            <p style="margin: 8px 0; color: #555; font-size: 14px;">1. Klicken Sie auf den blauen "Direkt anmelden" Button</p>
            <p style="margin: 8px 0; color: #555; font-size: 14px;">2. Sie werden automatisch angemeldet</p>
            <p style="margin: 8px 0; color: #555; font-size: 14px;">3. Ändern Sie Ihr Passwort in den Einstellungen</p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>Sicherheitshinweis:</strong><br>
              Dieser Reset-Link ist nur für Sie bestimmt und läuft nach <strong>1 Stunde</strong> ab. 
              Teilen Sie diesen Link nicht mit anderen Personen.
            </p>
          </div>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.
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
    formData.append('subject', 'Passwort zurücksetzen - Kraatz Group Portal');
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
    console.log(`✅ [${requestId}] Password reset email sent successfully via Mailgun: ${mailgunResult.id}`);

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Eine E-Mail zum Zurücksetzen des Passworts wurde an Ihre E-Mail-Adresse gesendet.',
        emailId: mailgunResult.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [${requestId}] Error in send-password-reset after ${endTime - startTime}ms:`, error);
    return new Response(
      JSON.stringify({
        error: 'Fehler beim Versenden der Reset-E-Mail',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

console.log('✅ send-password-reset edge function setup complete');
