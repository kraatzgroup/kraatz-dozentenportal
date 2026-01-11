// Edge function for creating new users
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

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`);
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true, 
        message: isNewUser ? 'User created successfully' : 'User profile updated successfully',
        userId: userId,
        email: email,
        temporaryPassword: tempPassword
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