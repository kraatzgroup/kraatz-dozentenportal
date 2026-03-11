// Edge function for creating new users
console.log('🚀 create-user edge function loaded');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string;
  fullName: string;
  role?: 'admin' | 'buchhaltung' | 'verwaltung' | 'vertrieb' | 'dozent' | 'teilnehmer';
  additionalRoles?: string[];
  eliteKleingruppe?: string;
}

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
    const { email, fullName, role = 'dozent', additionalRoles = [], eliteKleingruppe } = await req.json() as CreateUserRequest;
    console.log(`📋 [${requestId}] Request data:`, { email, fullName, role, additionalRoles, eliteKleingruppe });

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
    let isNewUser = false;
    let shouldSendEmail = false;

    if (existingProfiles && existingProfiles.length > 0) {
      // User already exists - just update the profile
      console.log(`ℹ️ [${requestId}] User already exists, updating profile...`);
      userId = existingProfiles[0].id;
      // Send welcome email for existing profile (re-invitation)
      shouldSendEmail = true;
    } else {
      // Create the user without sending default email
      console.log(`👤 [${requestId}] Creating user in Supabase Auth...`);
      const tempPassword = generateSecurePassword();
      const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { 
          full_name: fullName,
          role: role
        }
      });

      if (createUserError) {
        // Check if user exists in auth but not in profiles
        if (createUserError.code === 'email_exists' || createUserError.message?.includes('already registered')) {
          console.log(`ℹ️ [${requestId}] User exists in auth, fetching user...`);
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingAuthUser = authUsers?.users?.find(u => u.email === email);
          if (existingAuthUser) {
            userId = existingAuthUser.id;
            isNewUser = true;
            shouldSendEmail = true;
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
        shouldSendEmail = true;
        console.log(`✅ [${requestId}] User created successfully:`, userId);
      }
    }

    // Generate magic link and send email for new users or re-invitations
    if (shouldSendEmail) {
      // Send welcome email (function generates its own magic link internally)
      console.log(`📧 [${requestId}] Calling send-welcome-email for: ${email}`);
      const welcomeEmailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-welcome-email`;
      
      try {
        const welcomeEmailResponse = await fetch(welcomeEmailUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || ''}`
          },
          body: JSON.stringify({ email, fullName, origin: req.headers.get('origin') || '' })
        });

        console.log(`📧 [${requestId}] Welcome email response status: ${welcomeEmailResponse.status}`);
        
        if (!welcomeEmailResponse.ok) {
          const errorText = await welcomeEmailResponse.text();
          console.error(`❌ [${requestId}] Error sending welcome email (${welcomeEmailResponse.status}):`, errorText);
          console.warn(`⚠️ [${requestId}] User created but welcome email failed to send`);
        } else {
          const emailResult = await welcomeEmailResponse.json();
          console.log(`✅ [${requestId}] Welcome email sent successfully:`, JSON.stringify(emailResult));
        }
      } catch (fetchError) {
        console.error(`❌ [${requestId}] Exception while calling send-welcome-email:`, fetchError);
        console.warn(`⚠️ [${requestId}] User created but email sending threw exception`);
      }
    } else {
      console.log(`ℹ️ [${requestId}] Skipping email send (shouldSendEmail=false)`);
    }

    // Create/update profile for the user
    console.log(`👤 [${requestId}] Creating/updating profile for user...`);
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert([{
        id: userId,
        email: email,
        full_name: fullName,
        role: role,
        additional_roles: additionalRoles.length > 0 ? additionalRoles : null
      }], {
        onConflict: 'id'
      });

    if (profileError) {
      console.error(`❌ [${requestId}] Error creating profile:`, profileError);
      throw profileError;
    }

    console.log(`✅ [${requestId}] Profile created successfully`);

    // If user is a teilnehmer with an elite_kleingruppe, create entry in teilnehmer table
    if (role === 'teilnehmer' && eliteKleingruppe) {
      console.log(`🎓 [${requestId}] Creating teilnehmer entry for Elite-Kleingruppe: ${eliteKleingruppe}`);
      
      // Find the elite_kleingruppe by name
      const { data: kleingruppe, error: kgError } = await supabaseAdmin
        .from('elite_kleingruppen')
        .select('id')
        .eq('name', eliteKleingruppe)
        .single();

      if (kgError || !kleingruppe) {
        console.error(`❌ [${requestId}] Elite-Kleingruppe not found:`, eliteKleingruppe);
        console.warn(`⚠️ [${requestId}] User created but teilnehmer entry not created`);
      } else {
        // Create teilnehmer entry
        const { error: teilnehmerError } = await supabaseAdmin
          .from('teilnehmer')
          .insert([{
            profile_id: userId,
            name: fullName,
            email: email,
            is_elite_kleingruppe: true,
            elite_kleingruppe_id: kleingruppe.id,
            active_since: new Date().toISOString().split('T')[0],
            study_goal: '1. Staatsexamen Erstversuch'
          }]);

        if (teilnehmerError) {
          console.error(`❌ [${requestId}] Error creating teilnehmer entry:`, teilnehmerError);
          console.warn(`⚠️ [${requestId}] User created but teilnehmer entry failed`);
        } else {
          console.log(`✅ [${requestId}] Teilnehmer entry created successfully`);
        }
      }
    }

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`);
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true, 
        message: isNewUser 
          ? `Benutzer wurde erfolgreich erstellt. Eine Einladungs-E-Mail mit Magic Link wurde an ${email} gesendet.`
          : 'Benutzerprofil wurde erfolgreich aktualisiert.',
        userId: userId,
        email: email
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