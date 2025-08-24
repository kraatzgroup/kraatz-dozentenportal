const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface PasswordResetEmailData {
  recipientEmail: string;
  recipientName: string;
  temporaryPassword: string; 
  portalUrl: string;
}

// Function to generate a custom email template with the new password
const getPasswordResetWithCredentialsTemplate = (data: PasswordResetEmailData): string => {
  return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Passwort zurückgesetzt - Kraatz Group Dozentenportal</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            background-color: #f2f5fa;
            color: #051920;
            padding: 20px;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(5, 25, 32, 0.1);
            overflow: hidden;
        }
        
        .header {
            background-color: #2a83bf;
            padding: 40px 30px;
            text-align: center;
            position: relative;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
            opacity: 0.3;
        }
        
        .logo {
            position: relative;
            z-index: 2;
        }
        
        .logo h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }
        
        .logo p {
            color: #d3e5f3;
            font-size: 16px;
            font-weight: 400;
        }
        
        .content {
            padding: 50px 40px;
        }
        
        .notification-header {
            font-size: 24px;
            color: #051920;
            margin-bottom: 20px;
            font-weight: 600;
            text-align: center;
        }
        
        .message {
            font-size: 16px;
            color: #051920;
            margin-bottom: 25px;
            line-height: 1.7;
        }
        
        .credentials-box {
            background-color: #f8fbff;
            border: 2px solid #2a83bf;
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            text-align: center;
        }
        
        .credentials-box h3 {
            color: #2a83bf;
            font-size: 18px;
            margin-bottom: 20px;
            font-weight: 600;
        }
        
        .credential-item {
            background-color: #ffffff;
            border: 1px solid #d3e5f3;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .credential-label {
            font-weight: 600;
            color: #051920;
            font-size: 14px;
        }
        
        .credential-value {
            font-family: 'Courier New', monospace;
            background-color: #f8f9fa;
            padding: 8px 12px;
            border-radius: 4px;
            border: 1px solid #e9ecef;
            color: #051920;
            font-size: 14px;
            font-weight: 600;
            word-break: break-all;
        }
        
        .security-notice {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .security-notice h4 {
            color: #856404;
            font-size: 16px;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .security-notice p {
            color: #856404;
            font-size: 14px;
            margin: 0;
        }
        
        .action-button {
            display: inline-block;
            background-color: #2a83bf;
            color: #ffffff;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            margin: 20px 0 35px 0;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            box-shadow: 0 4px 15px rgba(42, 131, 191, 0.3);
        }
        
        .action-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(42, 131, 191, 0.4);
        }
        
        .button-center {
            text-align: center;
        }
        
        .footer {
            background-color: #f2f5fa;
            padding: 30px 40px;
            text-align: center;
            border-top: 1px solid #d3e5f3;
        }
        
        .footer p {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .contact-info {
            color: #2a83bf;
            font-size: 14px;
        }
        
        .security-note {
            font-size: 12px;
            color: #666;
            margin-top: 20px;
            font-style: italic;
        }
        
        @media (max-width: 600px) {
            .email-container {
                margin: 10px;
                border-radius: 8px;
            }
            
            .header {
                padding: 30px 20px;
            }
            
            .logo h1 {
                font-size: 24px;
            }
            
            .content {
                padding: 30px 25px;
            }
            
            .notification-header {
                font-size: 20px;
            }
            
            .footer {
                padding: 25px 20px;
            }
            
            .credential-item {
                flex-direction: column;
                align-items: stretch;
                gap: 10px;
            }
            
            .credential-value {
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">
                <h1>Kraatz Group</h1>
                <p>Dozentenportal</p>
            </div>
        </div>
        
        <div class="content">
            <h2 class="notification-header">🔐 Ihr Passwort wurde zurückgesetzt</h2>
            
            <p class="message">
                Hallo ${data.recipientName},
            </p>
            
            <p class="message">
                Ihr Passwort für das Kraatz Group Dozentenportal wurde erfolgreich zurückgesetzt. 
                Unten finden Sie Ihre neuen Anmeldedaten.
            </p>
            
            <div class="credentials-box">
                <h3>🔐 Ihre neuen Anmeldedaten</h3>
                <div class="credential-item">
                    <span class="credential-label">E-Mail:</span>
                    <span class="credential-value">${data.recipientEmail}</span>
                </div>
                <div class="credential-item">
                    <span class="credential-label">Neues Passwort:</span>
                    <span class="credential-value">${data.temporaryPassword}</span>
                </div>
            </div>
            
            <div class="security-notice">
                <h4>🔒 Wichtiger Sicherheitshinweis</h4>
                <p>
                    Bitte ändern Sie dieses Passwort nach der ersten Anmeldung in den Einstellungen. 
                    Bewahren Sie diese E-Mail sicher auf und teilen Sie Ihre Anmeldedaten niemals mit anderen Personen.
                </p>
            </div>
            
            <div class="button-center">
                <a href="${data.portalUrl}" class="action-button">
                    Jetzt anmelden
                </a>
            </div>
            
            <p class="message">
                Falls Sie diese Passwort-Zurücksetzung nicht angefordert haben, wenden Sie sich bitte 
                umgehend an unser Support-Team.
            </p>
            
            <p class="message">
                Mit freundlichen Grüßen,<br>
                Das Kraatz Group Team
            </p>
        </div>
        
        <div class="footer">
            <p><strong>Akademie Kraatz GmbH</strong></p>
            <p>Wilmersdorfer Str. 145/146 – 10585 Berlin</p>
            <div class="contact-info">
                <p>📞 030 756 573 97</p>
                <p>📧 info@kraatz-group.de</p>
                <p>🌐 www.kraatz-group.de</p>
            </div>
            
            <p class="security-note">
                Diese E-Mail wurde automatisch generiert. 
                Bitte antworten Sie nicht auf diese E-Mail und bewahren Sie Ihre Anmeldedaten sicher auf.
            </p>
        </div>
    </div>
</body>
</html>`;
};

// Generate a secure random password
const generateSecurePassword = (): string => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
  let password = '';
  
  // Ensure at least one character from each category
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // digit
  password += '!@#$%^&*()'[Math.floor(Math.random() * 10)]; // special
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

// Function to send email using Resend API
const sendEmailViaResend = async (to: string, subject: string, html: string) => {
  console.log('📧 sendEmailViaResend called with:', { to, subject: subject.substring(0, 50) + '...' });
  
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!resendApiKey) {
    console.error('❌ RESEND_API_KEY environment variable is not set');
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  console.log('✅ Resend API key found');
  
  const emailPayload = {
    from: 'Dozentenportal | Kraatz Group <dozentenportal@kraatz-group.de>',
    to: [to],
    subject: subject,
    html: html,
  };
  console.log('📧 Email payload prepared:', { ...emailPayload, html: 'HTML_CONTENT_TRUNCATED' });
  
  console.log('🌐 Making request to Resend API...');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  console.log('📡 Resend API response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Resend API error response:', errorText);
    throw new Error(`Resend API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('✅ Resend API success response:', result);
  return result;
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
    console.log(`📦 [${requestId}] Importing Supabase client...`);
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    
    console.log(`🔗 [${requestId}] Creating Supabase client...`);
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log(`📋 [${requestId}] Parsing request body...`);
    const { email } = await req.json();
    console.log(`📋 [${requestId}] Request data:`, { email });

    // Validate input
    if (!email) {
      console.error(`❌ [${requestId}] Missing email field`);
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get user information
    console.log(`🔍 [${requestId}] Looking up user...`);
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserByEmail(email);

    if (userError || !userData.user) {
      console.error(`❌ [${requestId}] User not found:`, userError);
      return new Response(
        JSON.stringify({ error: 'Benutzer nicht gefunden' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get user profile for full name
    console.log(`🔍 [${requestId}] Getting user profile...`);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles') 
      .select('full_name')
      .eq('id', userData.user.id)
      .single();

    if (profileError) {
      console.error(`❌ [${requestId}] Profile not found:`, profileError);
      return new Response(
        JSON.stringify({ error: 'Benutzerprofil nicht gefunden' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate new random password
    const newPassword = generateSecurePassword();
    console.log(`🔑 [${requestId}] Generated new password for user`);

    // Update user password
    console.log(`🔄 [${requestId}] Updating user password...`);
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error(`❌ [${requestId}] Error updating password:`, updateError);
      throw updateError;
    }

    console.log(`✅ [${requestId}] Password updated successfully`);

    // Send password reset email with new credentials
    console.log(`📧 [${requestId}] Sending password reset email...`);
    const portalUrl = Deno.env.get('SITE_URL') || 'http://portal.kraatz-group.de';
    
    const emailData: PasswordResetEmailData = { 
      recipientEmail: email,
      recipientName: profile.full_name || 'Benutzer',
      temporaryPassword: newPassword,
      portalUrl: portalUrl
    };

    const emailHtml = getPasswordResetWithCredentialsTemplate(emailData);
    const emailSubject = 'Ihr neues Passwort - Kraatz Group Dozentenportal';

    const emailResult = await sendEmailViaResend(email, emailSubject, emailHtml);
    console.log(`✅ [${requestId}] Password reset email sent:`, emailResult);

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`);
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset successfully and email sent',
        email: email,
        emailId: emailResult.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [${requestId}] Error in send-password-reset function after ${endTime - startTime}ms:`, error);
    
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