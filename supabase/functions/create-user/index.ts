// Edge function for creating new users and sending invite emails with Resend API
console.log('🚀 create-user edge function loaded');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string;
  fullName: string;
  role?: 'admin' | 'buchhaltung' | 'verwaltung' | 'vertrieb' | 'dozent';
}

interface EmailData {
  recipientEmail: string;
  recipientName: string;
  temporaryPassword: string;
  portalUrl: string;
  portalName: string;
}

// Function to generate invite email HTML
const getInviteEmailTemplate = (data: EmailData): string => {
  return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Einladung zum Kraatz Group Dozentenportal</title>
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
        
        .instructions {
            background-color: #f8fbff;
            border: 1px solid #d3e5f3;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .instructions h3 {
            color: #2a83bf;
            font-size: 18px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        
        .instructions ol {
            padding-left: 20px;
        }
        
        .instructions li {
            margin-bottom: 10px;
            color: #051920;
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
                <p>${data.portalName}</p>
            </div>
        </div>
        
        <div class="content">
            <h2 class="notification-header">Willkommen im Dozentenportal</h2>
            
            <p class="message">
                Hallo ${data.recipientName},
            </p>
            
            <p class="message">
                Sie wurden zum Kraatz Group Dozentenportal eingeladen. Über dieses Portal können Sie Ihre Dokumente hochladen, 
                mit dem Administratoren-Team kommunizieren und Ihre Teilnehmer verwalten.
            </p>
            
            <div class="credentials-box">
                <h3>🔐 Ihre Anmeldedaten</h3>
                <div class="credential-item">
                    <span class="credential-label">E-Mail:</span>
                    <span class="credential-value">${data.recipientEmail}</span>
                </div>
                <div class="credential-item">
                    <span class="credential-label">Passwort:</span>
                    <span class="credential-value">${data.temporaryPassword}</span>
                </div>
            </div>
            
            <div class="security-notice">
                <h4>🔒 Wichtiger Sicherheitshinweis</h4>
                <p>
                    Bitte ändern Sie Ihr Passwort nach der ersten Anmeldung. Bewahren Sie diese E-Mail sicher auf 
                    und teilen Sie Ihre Anmeldedaten niemals mit anderen Personen.
                </p>
            </div>
            
            <div class="button-center">
                <a href="${data.portalUrl}" class="action-button">
                    Jetzt anmelden
                </a>
            </div>
            
            <div class="instructions">
                <h3>So melden Sie sich an:</h3>
                <ol>
                    <li>Klicken Sie auf den Button "Jetzt anmelden" oben</li>
                    <li>Geben Sie Ihre E-Mail-Adresse und das oben angegebene Passwort ein</li>
                    <li>Ändern Sie Ihr Passwort nach der ersten Anmeldung in den Einstellungen</li>
                    <li>Laden Sie Ihre Dokumente hoch und verwalten Sie Ihre Teilnehmer</li>
                </ol>
            </div>
            
            <p class="message">
                Falls Sie Fragen haben oder Unterstützung benötigen, können Sie uns jederzeit über das Portal kontaktieren.
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

// Function to send email using Mailgun API
const sendEmailViaMailgun = async (to: string, subject: string, html: string) => {
  console.log('📧 sendEmailViaMailgun called with:', { to, subject: subject.substring(0, 50) + '...' });
  
  const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
  const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN') || 'kraatz-group.de';
  
  if (!mailgunApiKey) {
    console.error('❌ MAILGUN_API_KEY environment variable is not set');
    throw new Error('MAILGUN_API_KEY environment variable is not set');
  }
  console.log('✅ Mailgun API key found, domain:', mailgunDomain);
  
  const formData = new FormData();
  // Use sandbox-compatible from address or custom domain
  const fromAddress = 'Dozentenportal | Kraatz Group <no-reply@kraatz-group.de>';
  formData.append('from', fromAddress);
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('html', html);
  
  console.log('📧 Email FormData prepared for:', to);
  
  console.log('🌐 Making request to Mailgun API (EU endpoint)...');
  const response = await fetch(`https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
    },
    body: formData,
  });

  console.log('📡 Mailgun API response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Mailgun API error response:', errorText);
    throw new Error(`Mailgun API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('✅ Mailgun API success response:', result);
  return result;
};

// Generate a secure random password
const generateSecurePassword = (): string => {
  const length = 12;
  // Use only alphanumeric characters to avoid encoding issues
  const charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  
  // Ensure at least one character from each category
  password += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]; // uppercase (no I, O)
  password += 'abcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 25)]; // lowercase (no l)
  password += '23456789'[Math.floor(Math.random() * 8)]; // digit (no 0, 1)
  
  // Fill the rest randomly
  for (let i = 3; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 create-user function started');
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
    // Use SERVICE_ROLE_KEY (custom secret) or fall back to SUPABASE_SERVICE_ROLE_KEY (auto-injected)
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

    console.log(`📋 [${requestId}] Parsing request body...`);
    const { email, fullName, role = 'dozent' } = await req.json() as CreateUserRequest;
    console.log(`📋 [${requestId}] Request data:`, { email, fullName, role });

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

    // Check if user already exists in profiles
    console.log(`🔍 [${requestId}] Checking if user already exists...`);
    const { data: existingProfiles, error: existingUserError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email);

    if (existingUserError) {
      console.error(`❌ [${requestId}] Error checking existing user:`, existingUserError);
      throw existingUserError;
    }

    let userId: string;
    let tempPassword: string | null = null;
    let isNewUser = false;

    if (existingProfiles && existingProfiles.length > 0) {
      // User already exists - just update the profile
      console.log(`ℹ️ [${requestId}] User already exists, updating profile...`);
      userId = existingProfiles[0].id;
    } else {
      // Generate a secure temporary password for new user
      tempPassword = generateSecurePassword();
      console.log(`🔑 [${requestId}] Generated temporary password`);

      // Create the user in Supabase Auth
      console.log(`👤 [${requestId}] Creating user in Supabase Auth...`);
      const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });

      if (createUserError) {
        // Check if user exists in auth but not in profiles
        if (createUserError.code === 'email_exists') {
          console.log(`ℹ️ [${requestId}] User exists in auth, fetching user...`);
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingAuthUser = authUsers?.users?.find(u => u.email === email);
          if (existingAuthUser) {
            userId = existingAuthUser.id;
            // User exists in auth but not in profiles - treat as new for email purposes
            isNewUser = true;
            console.log(`ℹ️ [${requestId}] Found existing auth user, will create profile: ${userId}`);
          } else {
            throw createUserError;
          }
        } else {
          console.error(`❌ [${requestId}] Error creating user:`, createUserError);
          throw createUserError;
        }
      } else if (!userData?.user) {
        console.error(`❌ [${requestId}] User creation failed - no user returned`);
        throw new Error('User creation failed');
      } else {
        userId = userData.user.id;
        isNewUser = true;
        console.log(`✅ [${requestId}] User created successfully:`, userId);
      }
    }

    // Create/update profile for the user
    console.log(`👤 [${requestId}] Creating/updating profile for user...`);
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert([{
        id: userId,
        email: email,
        full_name: fullName,
        role: role
      }], {
        onConflict: 'id'
      });

    if (profileError) {
      console.error(`❌ [${requestId}] Error creating profile:`, profileError);
      throw profileError;
    }

    console.log(`✅ [${requestId}] Profile created successfully`);

    // Send invitation email with credentials (optional - skip if MAILGUN_API_KEY not configured)
    console.log(`📧 [${requestId}] Checking if email sending is configured...`);
    const portalUrl = Deno.env.get('SITE_URL') || 'https://portal.kraatz-group.de';
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    
    let emailResult = null;
    let emailSent = false;
    
    if (mailgunApiKey && isNewUser && tempPassword) {
      console.log(`📧 [${requestId}] Sending invitation email with credentials via Mailgun...`);
      const emailData: EmailData = {
        recipientEmail: email,
        recipientName: fullName,
        temporaryPassword: tempPassword as string,
        portalUrl: portalUrl,
        portalName: 'Dozentenportal'
      };

      const emailHtml = getInviteEmailTemplate(emailData);
      const emailSubject = 'Willkommen im Kraatz Group Dozentenportal - Ihre Anmeldedaten';

      emailResult = await sendEmailViaMailgun(email, emailSubject, emailHtml);
      emailSent = true;
      console.log(`✅ [${requestId}] Invitation email sent via Mailgun:`, emailResult);
    } else {
      console.log(`⚠️ [${requestId}] MAILGUN_API_KEY not configured - skipping email. Temporary password: ${tempPassword}`);
    }

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`);
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true, 
        message: emailSent 
          ? 'User created and invitation with credentials sent successfully'
          : isNewUser ? 'User created successfully' : 'User profile updated successfully',
        userId: userId,
        email: email,
        temporaryPassword: emailSent ? undefined : tempPassword,
        emailId: emailResult?.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [${requestId}] Error in create-user function after ${endTime - startTime}ms:`, error);
    
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

console.log('✅ create-user edge function setup complete');