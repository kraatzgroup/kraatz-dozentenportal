import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const { apiKey } = await req.json()
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch bookings from Cal.com API
    const response = await fetch(`https://api.cal.com/v1/bookings?apiKey=${apiKey}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      return new Response(
        JSON.stringify({ error: 'Failed to fetch from Cal.com', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const bookings = data.bookings || []

    // Filter all non-cancelled bookings (both upcoming and past)
    const allBookings = bookings
      .filter((b: any) => b.status !== 'CANCELLED')
      .map((booking: any) => ({
        id: String(booking.id),
        cal_booking_id: String(booking.id),
        title: booking.title || 'Beratungsgespräch',
        description: booking.description || null,
        start_time: booking.startTime,
        end_time: booking.endTime,
        attendee_name: booking.attendees?.[0]?.name || null,
        attendee_email: booking.attendees?.[0]?.email || null,
        attendee_phone: booking.responses?.Telefonnummer || null,
        status: booking.status || null,
        meeting_url: booking.metadata?.videoCallUrl || null,
        location: booking.location || null,
        event_type_id: String(booking.eventTypeId) || null,
        responses: booking.responses || null,
      }))
      .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    return new Response(
      JSON.stringify({ bookings: allBookings }),
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
