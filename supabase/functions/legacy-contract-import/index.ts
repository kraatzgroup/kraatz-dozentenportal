const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

console.log('🚀 legacy-contract-import edge function loaded');

Deno.serve(async (req) => {
  console.log(`📥 Request: ${req.method}`);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { createClient } = await import('npm:@supabase/supabase-js@2');

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create client with caller's token to check their role
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await callerClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check caller role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use adminClient for data operations
    const serviceClient = adminClient

    // Get teilnehmer_id from request body
    const { teilnehmer_id } = await req.json()
    if (!teilnehmer_id) {
      return new Response(JSON.stringify({ error: 'teilnehmer_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch participant legacy data
    const { data: teilnehmer, error: teilnehmerError } = await serviceClient
      .from('teilnehmer')
      .select('*')
      .eq('id', teilnehmer_id)
      .single()

    if (teilnehmerError || !teilnehmer) {
      return new Response(JSON.stringify({ error: 'Teilnehmer not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if participant already has contracts
    const { data: existingContracts } = await serviceClient
      .from('contracts')
      .select('id')
      .eq('teilnehmer_id', teilnehmer_id)

    if (existingContracts && existingContracts.length > 0) {
      return new Response(JSON.stringify({ error: 'Teilnehmer already has contracts' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if has legacy data
    const hasLegacyData = !!(
      teilnehmer.contract_start &&
      teilnehmer.contract_end &&
      (teilnehmer.booked_hours || teilnehmer.hours_zivilrecht || teilnehmer.hours_strafrecht || teilnehmer.hours_oeffentliches_recht)
    )

    if (!hasLegacyData) {
      return new Response(JSON.stringify({ error: 'No legacy data found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Calculate total hours from legacy data
    const totalHours = 
      (teilnehmer.hours_zivilrecht || 0) +
      (teilnehmer.hours_strafrecht || 0) +
      (teilnehmer.hours_oeffentliches_recht || 0)

    // Get actual used hours from participant_hours
    const { data: participantHours } = await serviceClient
      .from('participant_hours')
      .select('legal_area, hours')
      .eq('teilnehmer_id', teilnehmer_id)

    const usedHours = participantHours?.reduce((sum, ph) => sum + (ph.hours || 0), 0) || 0

    // Create contract
    const { data: contract, error: contractError } = await serviceClient
      .from('contracts')
      .insert({
        contract_number: teilnehmer.tn_nummer || 'LEGACY',
        teilnehmer_id: teilnehmer.id,
        start_date: teilnehmer.contract_start,
        end_date: teilnehmer.contract_end,
        status: 'active',
        frequency_type: teilnehmer.frequency_type || 'monthly',
        frequency_hours_zivilrecht: teilnehmer.frequency_hours_zivilrecht || null,
        frequency_hours_strafrecht: teilnehmer.frequency_hours_strafrecht || null,
        frequency_hours_oeffentliches_recht: teilnehmer.frequency_hours_oeffentliches_recht || null,
      })
      .select()
      .single()

    if (contractError) throw contractError

    // Create Paket 1
    const { data: contractPackage, error: packageError } = await serviceClient
      .from('contract_packages')
      .insert({
        contract_id: contract.id,
        teilnehmer_id: teilnehmer.id,
        hours_total: totalHours || teilnehmer.booked_hours || 0,
        hours_used: usedHours,
        status: 'active',
        start_date: teilnehmer.contract_start,
        end_date: teilnehmer.contract_end,
        custom_name: 'Paket 1',
      })
      .select()
      .single()

    if (packageError) throw packageError

    // Create legal areas
    const legalAreas = []
    if (teilnehmer.hours_zivilrecht) {
      legalAreas.push({ contract_package_id: contractPackage.id, legal_area: 'zivilrecht', hours: teilnehmer.hours_zivilrecht })
    }
    if (teilnehmer.hours_strafrecht) {
      legalAreas.push({ contract_package_id: contractPackage.id, legal_area: 'strafrecht', hours: teilnehmer.hours_strafrecht })
    }
    if (teilnehmer.hours_oeffentliches_recht) {
      legalAreas.push({ contract_package_id: contractPackage.id, legal_area: 'oeffentliches_recht', hours: teilnehmer.hours_oeffentliches_recht })
    }

    if (legalAreas.length > 0) {
      const { error: laError } = await serviceClient
        .from('contract_package_legal_areas')
        .insert(legalAreas)
      if (laError) throw laError
    }

    // Link teilnehmer to current contract
    await serviceClient
      .from('teilnehmer')
      .update({ current_contract_id: contract.id })
      .eq('id', teilnehmer_id)

    return new Response(JSON.stringify({ 
      success: true,
      contract_id: contract.id,
      package_id: contractPackage.id,
      message: 'Legacy contract imported successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
