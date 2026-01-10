import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const calApiKey = Deno.env.get('CAL_API_KEY')
    
    if (!calApiKey) {
      return new Response(
        JSON.stringify({ error: 'CAL_API_KEY not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch bookings from Cal.com API
    const response = await fetch(`https://api.cal.com/v1/bookings?apiKey=${calApiKey}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Cal.com API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch from Cal.com', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const bookings = data.bookings || []

    // Filter bookings (include all non-cancelled, both upcoming and past)
    const now = new Date()
    const validBookings = bookings.filter((b: any) => 
      b.status !== 'CANCELLED'
    )

    // Upsert bookings to database and extract leads
    let syncedCount = 0
    let leadsCount = 0
    for (const booking of validBookings) {
      const attendeeName = booking.attendees?.[0]?.name || null
      const attendeeEmail = booking.attendees?.[0]?.email || null
      const attendeePhone = booking.responses?.Telefonnummer || null
      const firstName = booking.responses?.name?.firstName || null
      const lastName = booking.responses?.name?.lastName || null
      const studyGoal = booking.responses?.Studium?.[0] || null
      const studyLocation = booking.responses?.['Studienstandort--Referendariatsstandort'] || null
      const beratungswunsch = booking.responses?.Beratungswunsch || null

      const bookingData = {
        cal_booking_id: String(booking.id),
        title: booking.title || 'Beratungsgespräch',
        description: booking.description || null,
        start_time: booking.startTime,
        end_time: booking.endTime,
        attendee_name: attendeeName,
        attendee_email: attendeeEmail,
        attendee_phone: attendeePhone,
        status: booking.status || null,
        meeting_url: booking.metadata?.videoCallUrl || null,
        location: booking.location || null,
        event_type_id: String(booking.eventTypeId) || null,
        last_synced_at: new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('cal_bookings')
        .upsert(bookingData, { onConflict: 'cal_booking_id' })
      
      if (!error) {
        syncedCount++
      } else {
        console.error('Error upserting booking:', error)
      }

      // Extract and store lead from booking
      if (attendeeEmail) {
        const leadData = {
          cal_booking_id: String(booking.id),
          name: attendeeName || `${firstName || ''} ${lastName || ''}`.trim() || 'Unbekannt',
          first_name: firstName,
          last_name: lastName,
          email: attendeeEmail,
          phone: attendeePhone,
          source: 'cal.com',
          study_goal: studyGoal,
          study_location: studyLocation,
          notes: beratungswunsch,
          booking_date: booking.startTime,
        }

        const { error: leadError } = await supabase
          .from('leads')
          .upsert(leadData, { onConflict: 'cal_booking_id' })

        if (!leadError) {
          leadsCount++
        } else {
          console.error('Error upserting lead:', leadError)
        }
      }
    }

    // Keep all bookings - no cleanup needed for historical data

    console.log(`Synced ${syncedCount} Cal.com bookings`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: syncedCount,
        leads: leadsCount,
        total: validBookings.length,
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
