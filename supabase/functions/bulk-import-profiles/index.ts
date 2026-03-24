const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const generateSecurePassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < 16; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

console.log('🚀 bulk-import-profiles edge function loaded');

Deno.serve(async (req) => {
  console.log(`📥 Request: ${req.method}`);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📦 Importing supabase client...');
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    console.log('✅ Supabase client imported');

    const authHeader = req.headers.get('Authorization')
    console.log('🔑 Auth header present:', !!authHeader);
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    console.log('🔧 URL:', supabaseUrl, 'Key present:', !!serviceRoleKey);

    // Create client with caller's token to check their role
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await callerClient.auth.getUser()
    console.log('👤 User:', user?.id, 'Error:', userError?.message);
    if (!user) {
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

    console.log('👤 Caller role:', callerProfile?.role);
    if (!callerProfile || !['admin', 'accounting', 'verwaltung'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { profiles } = await req.json()
    console.log(`📋 Received ${profiles?.length || 0} profiles to import`);
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return new Response(JSON.stringify({ error: 'No profiles provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find the highest existing dozentN@kraatz-group.de number
    const { data: existingEmails } = await adminClient
      .from('profiles')
      .select('email')
      .like('email', 'dozent%@kraatz-group.de')

    let nextNumber = 1
    if (existingEmails && existingEmails.length > 0) {
      const usedNumbers = existingEmails
        .map((p: any) => {
          const match = p.email?.match(/^dozent(\d+)@kraatz-group\.de$/)
          return match ? parseInt(match[1]) : 0
        })
        .filter((n: number) => n > 0)
      
      if (usedNumbers.length > 0) {
        nextNumber = Math.max(...usedNumbers) + 1
      }
    }
    console.log(`📧 Next available dozent email number: ${nextNumber}`)

    let created = 0
    let updated = 0
    let errors = 0
    const failedNames: string[] = []
    const createdUsers: { name: string; email: string }[] = []

    for (const p of profiles) {
      const fullName = p.full_name
      if (!fullName) {
        errors++
        continue
      }

      // Check if exists
      const { data: existing } = await adminClient
        .from('profiles')
        .select('id, email, phone, legal_areas')
        .eq('role', 'dozent')
        .eq('full_name', fullName)
        .maybeSingle()

      if (existing) {
        // Update only missing fields
        const updateData: Record<string, unknown> = {}
        if (p.legal_areas?.length > 0) updateData.legal_areas = p.legal_areas
        if (!existing.phone && p.phone) updateData.phone = p.phone

        if (Object.keys(updateData).length > 0) {
          const { error } = await adminClient
            .from('profiles')
            .update(updateData)
            .eq('id', existing.id)

          if (error) {
            errors++
            failedNames.push(fullName)
          } else {
            updated++
          }
        } else {
          updated++
        }
      } else {
        // Create new dozent with auth user and auto-assigned email
        const assignedEmail = `dozent${nextNumber}@kraatz-group.de`
        nextNumber++

        try {
          // Create auth user
          const tempPassword = generateSecurePassword()
          const { data: userData, error: createUserError } = await adminClient.auth.admin.createUser({
            email: assignedEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              role: 'dozent'
            }
          })

          if (createUserError || !userData?.user) {
            console.error(`❌ Error creating auth user for ${fullName}:`, createUserError)
            errors++
            failedNames.push(fullName)
            continue
          }

          const userId = userData.user.id

          // Create profile
          const { error: profileError } = await adminClient
            .from('profiles')
            .upsert({
              id: userId,
              full_name: fullName,
              title: p.title || null,
              first_name: p.first_name,
              last_name: p.last_name,
              email: assignedEmail,
              phone: p.phone || null,
              legal_areas: p.legal_areas?.length > 0 ? p.legal_areas : null,
              exam_types: ['1. Staatsexamen'],
              role: 'dozent',
            }, { onConflict: 'id' })

          if (profileError) {
            console.error(`❌ Error creating profile for ${fullName}:`, profileError)
            // Clean up auth user
            await adminClient.auth.admin.deleteUser(userId)
            errors++
            failedNames.push(fullName)
          } else {
            created++
            createdUsers.push({ name: fullName, email: assignedEmail })
            console.log(`✅ Created ${fullName} → ${assignedEmail}`)
          }
        } catch (err) {
          console.error(`❌ Exception creating ${fullName}:`, err)
          errors++
          failedNames.push(fullName)
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, created, updated, errors, failedNames, createdUsers }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('Bulk import error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
