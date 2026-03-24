// Edge function for updating user email
console.log('🚀 update-user-email edge function loaded');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateEmailRequest {
  userId: string;
  newEmail: string;
}

Deno.serve(async (req) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`🆔 [${requestId}] Request received`);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    
    // Use service role key for admin operations
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

    const { userId, newEmail } = await req.json() as UpdateEmailRequest;
    console.log(`📧 [${requestId}] Updating email for user ${userId} to ${newEmail}`);

    // Validate input
    if (!userId || !newEmail) {
      return new Response(
        JSON.stringify({ error: 'userId and newEmail are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if new email is already in use by another user
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = authUsers?.users?.find(u => u.email === newEmail && u.id !== userId);
    
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Email already in use by another user' }),
        { 
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Update profile email FIRST to prevent race conditions
    // (auth email change can trigger side effects that check profiles)
    console.log(`📝 [${requestId}] Updating profile email first...`);
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ email: newEmail })
      .eq('id', userId);

    if (profileError) {
      console.error(`❌ [${requestId}] Error updating profile:`, profileError);
      throw profileError;
    }
    console.log(`✅ [${requestId}] Profile email updated`);

    // Then update auth user email
    console.log(`🔑 [${requestId}] Updating auth user email...`);
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email: newEmail }
    );

    if (updateError) {
      console.error(`❌ [${requestId}] Error updating auth user:`, updateError);
      // Rollback profile email
      await supabaseAdmin.from('profiles').update({ email: userId }).eq('id', userId);
      throw updateError;
    }
    console.log(`✅ [${requestId}] Auth user email updated`);

    console.log(`✅ [${requestId}] Email updated successfully`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email updated successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error(`❌ [${requestId}] Error:`, error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

console.log('✅ update-user-email edge function setup complete');
