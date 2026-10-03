import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CalComBooking {
  id: string | number;
  title?: string | null;
  description?: string | null;
  start: string;
  end: string;
  attendees?: Array<{ name?: string | null; email?: string | null; phoneNumber?: string | null }>;
  bookingFieldsResponses?: Record<string, unknown> | null;
  status?: string | null;
  meetingUrl?: string | null;
  metadata?: { videoCallUrl?: string | null } | null;
  location?: string | null;
  eventTypeId?: string | number | null;
  eventType?: { id?: string | number | null } | null;
}

interface CalComBookingsPage {
  status: string;
  data: CalComBooking[];
  pagination: { hasMore: boolean; nextCursor: string | null };
}

const valueToText = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(valueToText).filter((item): item is string => Boolean(item)).join(', ') || null;
  if (value && typeof value === 'object') {
    const nestedValue = value as Record<string, unknown>;
    return valueToText(nestedValue.value) || valueToText(nestedValue.label) || valueToText(nestedValue.optionValue);
  }
  return null;
};

const getBookingFieldText = (responses: Record<string, unknown> | null | undefined, fragments: string[]) => {
  if (!responses) return null;
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const match = Object.entries(responses).find(([key]) => fragments.some(fragment => normalize(key).includes(fragment)));
  return valueToText(match?.[1]);
};

const fetchBookings = async (apiKey: string, status: string, afterUpdatedAt?: string) => {
  const bookings: CalComBooking[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const url = new URL('https://api.cal.com/v2/bookings');
    url.searchParams.set('status', status);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    if (afterUpdatedAt) url.searchParams.set('afterUpdatedAt', afterUpdatedAt);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'cal-api-version': '2026-05-01',
      },
    });

    if (!response.ok) throw new Error(`Cal.com API returned ${response.status}`);

    const page = await response.json() as CalComBookingsPage;
    if (page.status !== 'success') throw new Error('Cal.com API returned an error');
    bookings.push(...page.data);
    hasMore = page.pagination.hasMore;
    cursor = page.pagination.nextCursor;
    if (hasMore && !cursor) throw new Error('Cal.com API omitted the next page cursor');
  }

  return bookings;
};

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

    // Check if integration is enabled (skip check for manual sync requests)
    const body = await req.json().catch(() => ({}))
    const isManualSync = body.manual === true
    
    if (!isManualSync) {
      const { data: settings } = await supabase
        .from('integration_settings')
        .select('enabled')
        .eq('id', 'cal')
        .single()
      
      if (!settings?.enabled) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Cal.com integration is disabled',
            skipped: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const now = new Date()
    const [upcomingBookings, recurringBookings, unconfirmedBookings, pastBookings, cancelledBookings] = await Promise.all([
      fetchBookings(calApiKey, 'upcoming'),
      fetchBookings(calApiKey, 'recurring'),
      fetchBookings(calApiKey, 'unconfirmed'),
      fetchBookings(calApiKey, 'past'),
      fetchBookings(calApiKey, 'cancelled', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ])
    // Keine Bookings mehr löschen: vergangene Calls bleiben als Zeile erhalten
    // (die Pipeline zeigt sie über die zugehörigen Leads weiter an), stornierte
    // Calls bleiben mit Status 'cancelled' erhalten, damit nichts verloren geht.
    const validBookings = [...upcomingBookings, ...recurringBookings, ...unconfirmedBookings, ...pastBookings, ...cancelledBookings]

    // Upsert Cal.com bookings and their associated leads
    let syncedCount = 0
    let syncedLeadCount = 0
    for (const booking of validBookings) {
      const studyLocation = getBookingFieldText(booking.bookingFieldsResponses, ['studienstandort', 'referendariatsstandort'])
      const examGoal = getBookingFieldText(booking.bookingFieldsResponses, ['prufungsziel', 'examgoal', 'studium'])
      const consultationWishes = getBookingFieldText(booking.bookingFieldsResponses, ['wunsch'])
      const attendeeName = booking.attendees?.[0]?.name?.trim() || null
      const attendeeEmail = booking.attendees?.[0]?.email || getBookingFieldText(booking.bookingFieldsResponses, ['email'])
      const attendeePhone = booking.attendees?.[0]?.phoneNumber || getBookingFieldText(booking.bookingFieldsResponses, ['telefonnummer'])
      const bookingData = {
        cal_booking_id: String(booking.id),
        title: booking.title || 'Beratungsgespräch',
        description: booking.description || null,
        start_time: booking.start,
        end_time: booking.end,
        attendee_name: attendeeName,
        attendee_email: attendeeEmail || null,
        attendee_phone: attendeePhone,
        status: booking.status || null,
        meeting_url: booking.meetingUrl || booking.metadata?.videoCallUrl || (booking.location?.startsWith('http') ? booking.location : null),
        location: studyLocation || (booking.location?.startsWith('http') ? null : booking.location || null),
        event_type_id: booking.eventTypeId == null && booking.eventType?.id == null
          ? null
          : String(booking.eventTypeId ?? booking.eventType?.id),
        study_location: studyLocation,
        exam_goal: examGoal,
        consultation_wishes: consultationWishes,
        last_synced_at: now.toISOString()
      }

      const { error } = await supabase
        .from('cal_bookings')
        .upsert(bookingData, { onConflict: 'cal_booking_id' })

      if (error) throw error
      syncedCount++

      if (attendeeEmail && booking.status?.toLowerCase() !== 'cancelled') {
        const nameParts = attendeeName?.split(/\s+/).filter(Boolean) || []
        const leadData = {
          cal_booking_id: String(booking.id),
          name: attendeeName || attendeeEmail.split('@')[0] || 'Unbekannt',
          first_name: nameParts[0] || null,
          last_name: nameParts.slice(1).join(' ') || null,
          email: attendeeEmail,
          phone: attendeePhone,
          source: 'cal.com',
          study_goal: examGoal,
          study_location: studyLocation,
          notes: consultationWishes,
          booking_date: booking.start,
          updated_at: now.toISOString(),
        }
        const { error: leadInsertError } = await supabase
          .from('leads')
          .upsert({ ...leadData, status: 'new' }, { onConflict: 'cal_booking_id', ignoreDuplicates: true })

        if (leadInsertError) throw leadInsertError

        const { error: leadUpdateError } = await supabase
          .from('leads')
          .update(leadData)
          .eq('cal_booking_id', String(booking.id))

        if (leadUpdateError) throw leadUpdateError
        syncedLeadCount++
      }
    }

    console.log(`Synced ${syncedCount} Cal.com bookings and ${syncedLeadCount} associated leads`)

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        leads: syncedLeadCount,
        total: validBookings.length,
        timestamp: now.toISOString()
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
