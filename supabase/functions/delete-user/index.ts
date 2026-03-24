console.log('🚀 delete-user edge function loaded');

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
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { userId } = await req.json();
    console.log(`🗑️ Deleting user: ${userId}`);

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete related data first (in order to avoid FK constraint violations)
    const tables = [
      { table: 'elite_kleingruppe_dozenten', column: 'dozent_id' },
      { table: 'elite_kleingruppe_dozent_assignments', column: 'dozent_id' },
      { table: 'elite_kleingruppe_releases', column: 'dozent_id' },
      { table: 'dozent_hours', column: 'dozent_id' },
      { table: 'participant_hours', column: 'dozent_id' },
      { table: 'pending_dozent_hours', column: 'dozent_id' },
      { table: 'invoices', column: 'dozent_id' },
      { table: 'chat_group_members', column: 'user_id' },
      { table: 'messages', column: 'sender_id' },
      { table: 'messages', column: 'receiver_id' },
      { table: 'files', column: 'uploaded_by' },
      { table: 'folders', column: 'owner_id' },
    ];

    for (const { table, column } of tables) {
      const { error } = await supabaseAdmin.from(table).delete().eq(column, userId);
      if (error) {
        console.warn(`⚠️ Error deleting from ${table}.${column}:`, error.message);
      }
    }

    // Clear dozent references in teilnehmer (set to null, don't delete teilnehmer)
    const teilnehmerColumns = ['dozent_zivilrecht_id', 'dozent_strafrecht_id', 'dozent_oeffentliches_recht_id'];
    for (const col of teilnehmerColumns) {
      await supabaseAdmin.from('teilnehmer').update({ [col]: null }).eq(col, userId);
    }

    // Delete profile
    const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', userId);
    if (profileError) {
      console.error('❌ Error deleting profile:', profileError);
      throw profileError;
    }
    console.log('✅ Profile deleted');

    // Delete auth user (if exists)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.warn('⚠️ Auth user deletion failed (may not exist):', authError.message);
    } else {
      console.log('✅ Auth user deleted');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
