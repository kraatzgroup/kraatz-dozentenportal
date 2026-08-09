// Edge function: set password by email (admin operation, temporary)
console.log('🚀 set-password-by-email edge function loaded');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const { email, newPassword, action, search } = body;

    // List mode: find users matching search term
    if (action === 'list') {
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      const matching = (authUsers?.users || [])
        .filter(u => !search || u.email?.includes(search))
        .map(u => ({ id: u.id, email: u.email }));
      return new Response(JSON.stringify({ users: matching }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔑 Setting password for ${email}`);

    if (!email || !newPassword) {
      return new Response(JSON.stringify({ error: 'email and newPassword are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find user by email
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const user = authUsers?.users?.find(u => u.email === email);
    if (!user) {
      return new Response(JSON.stringify({ error: `No auth user found with email ${email}` }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found user: ${user.id}`);

    // Set password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: newPassword });
    if (updateError) throw updateError;

    console.log(`✅ Password set for ${email}`);
    return new Response(JSON.stringify({ success: true, message: `Password set for ${email}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
