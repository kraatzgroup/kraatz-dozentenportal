// Edge function for generating magic link for admin to login as user
console.log('🚀 admin-login-as-user edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LoginAsUserRequest {
  email: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log('🚀 admin-login-as-user function started');
  console.log('📥 Request method:', req.method);
  console.log('🆔 Request ID:', requestId);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight request handled`);
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`📋 [${requestId}] Parsing request body...`);
    const { email } = await req.json() as LoginAsUserRequest;
    console.log(`📋 [${requestId}] Request data:`, { email });

    // Determine redirect URL based on admin's origin (localhost vs production)
    const origin = req.headers.get('origin') || '';
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    const baseUrl = isLocalhost ? origin : 'https://portal.kraatz-group.de';
    const redirectUrl = `${baseUrl}/dashboard?tab=dashboard`;
    console.log(`🌐 [${requestId}] Admin origin: ${origin}, Is localhost: ${isLocalhost}, Redirect URL: ${redirectUrl}`);

    // Validate input
    if (!email) {
      console.error(`❌ [${requestId}] Missing required field: email`);
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
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

    console.log(`🔗 [${requestId}] Generating magic link for: ${email}`);
    
    // Generate magic link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
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

    const endTime = Date.now();
    console.log(`⏱️ [${requestId}] Function completed in ${endTime - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        magicLink: magicLink,
        message: `Magic link generated successfully for ${email}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [${requestId}] Error in admin-login-as-user function after ${endTime - startTime}ms:`, error);

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

console.log('✅ admin-login-as-user edge function setup complete');
