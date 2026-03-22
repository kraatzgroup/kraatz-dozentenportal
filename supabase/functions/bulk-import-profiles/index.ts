import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the caller is admin/accounting/verwaltung
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create client with caller's token to check their role
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await callerClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check caller role
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !['admin', 'accounting', 'verwaltung'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { profiles } = await req.json()
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return new Response(JSON.stringify({ error: 'No profiles provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let created = 0
    let updated = 0
    let errors = 0
    const failedNames: string[] = []

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
        if (!existing.email && p.email) updateData.email = p.email
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
          updated++ // Already up to date
        }
      } else {
        // Create new profile without user account
        const newId = crypto.randomUUID()
        const { error } = await adminClient
          .from('profiles')
          .insert({
            id: newId,
            full_name: fullName,
            title: p.title || null,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email || null,
            phone: p.phone || null,
            legal_areas: p.legal_areas?.length > 0 ? p.legal_areas : null,
            exam_types: ['1. Staatsexamen'],
            role: 'dozent',
          })

        if (error) {
          console.error(`Error creating ${fullName}:`, error)
          errors++
          failedNames.push(fullName)
        } else {
          created++
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, created, updated, errors, failedNames }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Bulk import error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
