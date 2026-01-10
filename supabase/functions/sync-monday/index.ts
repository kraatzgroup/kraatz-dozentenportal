import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BOARD_ID = '1206019140'

// Group mappings
const GROUP_MAPPINGS: { [key: string]: string } = {
  // Follow-ups (aktive Leads die noch bearbeitet werden)
  'group_mkqp1f01': 'followup',           // 2. Gespräch nach Angebot
  'group_mkqnxp8k': 'followup',           // Finalgespräch nach Probestunde
  'group_mkqn451y': 'followup',           // Nachfassen
  
  // Probestunden
  'group_mkqnxy2y': 'probestunde',        // Probestunde angefragt - Rückmeldung von Dozenten noch ausstehend
  
  // Upsells
  'group_mkvn5kvn': 'upsell',             // Upselling Kraatz Club
  'group_mknk5zyq': 'upsell',             // Interesse an Kleingruppenunterricht
  'group_mkxd4zby': 'upsell',             // Interesse Elite Kleingruppe
  
  // Closed (echte Sales - Kunde geworden)
  'group_mkqnvssq': 'closed',             // Closed - echte Verkäufe
  'group_mkqp87f5': 'closed',             // Vertragsanforderung -> Sales
  
  // After Sales (Teilnehmer)
  'group_mkrhaez3': 'aftersales',         // After Sales
  
  // Not Closed (Kein Kunde geworden)
  'neue_gruppe_mkkfqw5n': 'not_closed',   // Abgeschlossen - Kein Kunde geworden
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mondayApiKey = Deno.env.get('MONDAY_API_KEY')
    
    if (!mondayApiKey) {
      return new Response(
        JSON.stringify({ error: 'MONDAY_API_KEY not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch items from Monday.com board
    const query = `{
      boards(ids: ${BOARD_ID}) {
        items_page(limit: 500) {
          items {
            id
            name
            group { id title }
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }`

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': mondayApiKey,
      },
      body: JSON.stringify({ query }),
    })

    if (!response.ok) {
      throw new Error('Failed to fetch from Monday.com')
    }

    const data = await response.json()
    const items = data.data?.boards?.[0]?.items_page?.items || []

    let followUpsCount = 0
    let probestundenCount = 0
    let upsellsCount = 0
    let closedCount = 0

    for (const item of items) {
      const groupId = item.group?.id
      const category = GROUP_MAPPINGS[groupId]
      
      if (!category) continue

      // Extract column values
      const columnMap: { [key: string]: string } = {}
      for (const col of item.column_values || []) {
        columnMap[col.id] = col.text || ''
      }

      const name = item.name
      const email = columnMap['lead_email'] || ''
      const phone = columnMap['lead_phone'] || ''
      const status = columnMap['color_mknk9q22'] || ''
      const datumPS = columnMap['date_mktc20hd'] || ''
      const uhrzeitPS = columnMap['hour_mktc9n3r'] || ''
      const nachfassenDatum = columnMap['date_mkwgxqr4'] || columnMap['date_mkqqahg2'] || ''
      const studienstandort = columnMap['text_mkkfggar'] || ''
      const bemerkungen = columnMap['text_mkqn7rhj'] || columnMap['text_mknpr5v7'] || ''
      const stundenpaket = columnMap['color_mktct380'] || ''
      const zahlung = columnMap['numeric_mktckka5'] || ''
      const upsellingStatus = columnMap['color_mkvnxgdm'] || ''
      const bearbeiter = columnMap['color_mkx346qa'] || ''
      const studienziel = columnMap['text_mknpa4kq'] || ''

      if (category === 'followup') {
        // Upsert to follow_ups table
        const followUpData = {
          monday_item_id: item.id,
          teilnehmer_name: name,
          teilnehmer_email: email || null,
          teilnehmer_phone: phone || null,
          follow_up_date: nachfassenDatum || new Date().toISOString().split('T')[0],
          reason: item.group?.title || null,
          status: 'pending',
          notes: bemerkungen || null,
          priority: 'medium',
        }

        const { error } = await supabase
          .from('follow_ups')
          .upsert(followUpData, { onConflict: 'monday_item_id', ignoreDuplicates: false })

        if (!error) {
          followUpsCount++
        } else {
          console.error('Follow-up error:', error)
        }
      }

      if (category === 'probestunde') {
        // Upsert to trial_lessons table
        const scheduledDateTime = datumPS 
          ? new Date(datumPS + 'T' + (uhrzeitPS || '09:00') + ':00').toISOString()
          : new Date().toISOString()
        
        const probestundeData = {
          monday_item_id: item.id,
          teilnehmer_name: name || 'Unbekannt',
          teilnehmer_email: email || null,
          teilnehmer_phone: phone || null,
          scheduled_date: scheduledDateTime,
          status: 'scheduled',
          notes: bemerkungen || null,
        }

        const { error } = await supabase
          .from('trial_lessons')
          .upsert(probestundeData, { onConflict: 'monday_item_id', ignoreDuplicates: false })

        if (!error) {
          probestundenCount++
        } else {
          console.error('Probestunde error:', error)
        }
      }

      if (category === 'upsell') {
        // Upsert to upsells table
        const upsellData = {
          monday_item_id: item.id,
          teilnehmer_name: name,
          teilnehmer_email: email || null,
          current_package: stundenpaket || null,
          proposed_package: item.group?.title || null,
          notes: bemerkungen || null,
        }

        const { error } = await supabase
          .from('upsells')
          .upsert(upsellData, { onConflict: 'monday_item_id', ignoreDuplicates: false })

        if (!error) {
          upsellsCount++
        } else {
          console.error('Upsell error:', error)
        }
      }

      if (category === 'closed') {
        // Upsert to sales table
        const saleData = {
          monday_item_id: item.id,
          teilnehmer_name: name,
          teilnehmer_email: email || null,
          package_name: stundenpaket || null,
          amount: zahlung ? parseFloat(zahlung.replace(',', '.')) : 0,
          sale_date: new Date().toISOString().split('T')[0],
          payment_status: 'paid',
          notes: bemerkungen || null,
        }

        const { error } = await supabase
          .from('sales')
          .upsert(saleData, { onConflict: 'monday_item_id', ignoreDuplicates: false })

        if (!error) {
          closedCount++
        } else {
          console.error('Sales error:', error)
        }
      }

      if (category === 'not_closed') {
        // Update lead status to 'lost' in leads table
        const { error } = await supabase
          .from('leads')
          .update({ status: 'lost' })
          .eq('name', name)

        if (error) {
          console.error('Not closed lead update error:', error)
        }
      }
    }

    console.log(`Synced from Monday.com: ${followUpsCount} follow-ups, ${probestundenCount} probestunden, ${upsellsCount} upsells, ${closedCount} closed`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        followUps: followUpsCount,
        probestunden: probestundenCount,
        upsells: upsellsCount,
        closed: closedCount,
        totalItems: items.length,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
