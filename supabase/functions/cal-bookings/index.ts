import '../deno.d.ts';

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('CAL_API_KEY')
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const now = new Date();
    const bookings = (await Promise.all([
      fetchBookings(apiKey, 'upcoming'),
      fetchBookings(apiKey, 'recurring'),
      fetchBookings(apiKey, 'unconfirmed'),
    ])).flat();

    const allBookings = bookings
      .filter(booking => booking.status?.toLowerCase() !== 'cancelled' && new Date(booking.end).getTime() >= now.getTime())
      .map(booking => ({
          id: String(booking.id),
          cal_booking_id: String(booking.id),
          title: booking.title || 'Beratungsgespräch',
          description: booking.description || null,
          start_time: booking.start,
          end_time: booking.end,
          attendee_name: booking.attendees?.[0]?.name || null,
          attendee_email: booking.attendees?.[0]?.email || null,
          attendee_phone: booking.attendees?.[0]?.phoneNumber || getBookingFieldText(booking.bookingFieldsResponses, ['telefonnummer']),
          status: booking.status || null,
          meeting_url: booking.meetingUrl || booking.metadata?.videoCallUrl || (booking.location?.startsWith('http') ? booking.location : null),
          location: getBookingFieldText(booking.bookingFieldsResponses, ['studienstandort', 'referendariatsstandort']) || (booking.location?.startsWith('http') ? null : booking.location || null),
          event_type_id: booking.eventTypeId == null && booking.eventType?.id == null
            ? null
            : String(booking.eventTypeId ?? booking.eventType?.id),
          study_location: getBookingFieldText(booking.bookingFieldsResponses, ['studienstandort', 'referendariatsstandort']),
          exam_goal: getBookingFieldText(booking.bookingFieldsResponses, ['prufungsziel', 'examgoal', 'studium']),
          consultation_wishes: getBookingFieldText(booking.bookingFieldsResponses, ['wunsch']),
        responses: booking.bookingFieldsResponses || null,
      }))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

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
