// Edge function: Stripe Checkout Session erstellen für Videoklausurenkorrektur
// - Validiert Preis-ID serverseitig gegen vb_packages
// - Neukunden-Angebot nur 1x pro Person (per E-Mail)
// - Nutzt bestehenden Stripe Customer / Profil falls vorhanden
// - Erstellt Checkout Session; User + Gutschrift erfolgen im stripe-webhook
console.log('🚀 stripe-checkout edge function loaded');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK_BASE_URL = 'https://portal.kraatz-group.de';

interface CheckoutRequestBody {
  email?: string;
  priceId?: string;
  fullName?: string;
}

interface StripeFetchOptions {
  method?: 'GET' | 'POST';
  body?: URLSearchParams;
}

async function stripeFetch(path: string, options: StripeFetchOptions = {}): Promise<any> {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY ist nicht konfiguriert');

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: options.body?.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message ?? `Stripe Fehler (${response.status})`;
    throw new Error(message);
  }
  return data;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`🆔 [${requestId}] stripe-checkout aufgerufen`);

  try {
    // @ts-ignore – npm:-Import wird erst zur Laufzeit von Deno aufgelöst
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!serviceRoleKey) throw new Error('Service Role Key ist nicht konfiguriert');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json() as CheckoutRequestBody;
    const priceId = (body.priceId ?? '').trim();
    const fullName = (body.fullName ?? '').trim();

    // Eingeloggte User: E-Mail kommt aus dem JWT (nicht aus dem Request-Body)
    const authHeader = req.headers.get('authorization') ?? '';
    let email: string | null = null;
    if (authHeader.startsWith('Bearer ')) {
      const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
      if (userData?.user?.email) {
        email = userData.user.email.toLowerCase();
      }
    }
    if (!email) {
      email = (body.email ?? '').trim().toLowerCase();
    }

    // Validierung
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' }, 400);
    }
    if (!priceId) {
      return jsonResponse({ error: 'Kein Paket ausgewählt.' }, 400);
    }

    // Paket serverseitig validieren (Preis-IDs können nicht vom Client erfunden werden)
    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from('vb_packages')
      .select('*')
      .eq('stripe_price_id', priceId)
      .eq('active', true)
      .maybeSingle();

    if (pkgError) {
      console.error(`❌ [${requestId}] Paket-Query Fehler:`, pkgError);
      throw pkgError;
    }
    if (!pkg) {
      return jsonResponse({ error: 'Ungültiges Paket. Bitte die Seite neu laden.' }, 400);
    }

    console.log(`📦 [${requestId}] Paket: ${pkg.name} (${pkg.case_study_count} Credits, ${pkg.stripe_price_id})`);

    // Bestehendes Profil zur E-Mail suchen
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, stripe_customer_id')
      .eq('email', email)
      .maybeSingle();

    // Neukunden-Angebot: nur 1x pro Person
    if (pkg.package_key === 'neukunden' && profile) {
      const { data: existingIntro } = await supabaseAdmin
        .from('vb_orders')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('package_id', pkg.id)
        .eq('status', 'completed')
        .maybeSingle();

      if (existingIntro) {
        console.warn(`⚠️ [${requestId}] Neukunden-Angebot für ${email} bereits gekauft – abgelehnt`);
        return jsonResponse(
          { error: 'Das Neukunden-Angebot kann nur einmal pro Person gekauft werden.' },
          409
        );
      }
    }

    // Stripe Customer auflösen bzw. anlegen
    let customerId: string | null = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      // Bereits vorhandenen Stripe Customer mit dieser E-Mail suchen
      const customers = await stripeFetch(
        `/v1/customers?limit=10&email=${encodeURIComponent(email)}`
      );
      const match = (customers?.data ?? []).find(
        (c: any) => (c.email ?? '').toLowerCase() === email
      );
      if (match) customerId = match.id;
    }

    if (!customerId) {
      const customerParams = new URLSearchParams();
      customerParams.set('email', email);
      if (fullName) customerParams.set('name', fullName);
      customerParams.set('metadata[source]', 'dozentenportal-vb');
      if (profile) customerParams.set('metadata[profile_id]', profile.id);
      const customer = await stripeFetch('/v1/customers', { method: 'POST', body: customerParams });
      customerId = customer.id;
      console.log(`🆕 [${requestId}] Stripe Customer angelegt: ${customerId} für ${email}`);
    } else {
      console.log(`🔗 [${requestId}] Stripe Customer wiederverwendet: ${customerId} für ${email}`);
    }

    if (!customerId) {
      throw new Error('Stripe Customer konnte nicht aufgelöst oder erstellt werden');
    }

    // Customer-ID am Profil speichern, falls noch nicht vorhanden
    if (profile && !profile.stripe_customer_id && customerId) {
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', profile.id);
      console.log(`💾 [${requestId}] stripe_customer_id ${customerId} am Profil ${profile.id} gespeichert`);
    }

    // Checkout Session erstellen
    const origin = req.headers.get('origin') ?? FALLBACK_BASE_URL;
    const sessionParams = new URLSearchParams();
    sessionParams.set('mode', 'payment');
    sessionParams.set('customer', customerId);
    // Rabattcodes (Promotion Codes) bei allen Checkouts erlauben
    sessionParams.set('allow_promotion_codes', 'true');
    sessionParams.set('success_url', `${origin}/klausurenbesprechung/pakete?status=success&session_id={CHECKOUT_SESSION_ID}`);
    sessionParams.set('cancel_url', `${origin}/klausurenbesprechung/pakete?status=cancelled`);
    // client_reference_id pro Session eindeutig halten (Reconciliation via metadata)
    sessionParams.set('client_reference_id', `${profile?.id ?? email}-${Date.now()}`.slice(0, 200));
    sessionParams.set('line_items[0][price]', priceId);
    sessionParams.set('line_items[0][quantity]', '1');
    sessionParams.set('metadata[price_id]', priceId);
    sessionParams.set('metadata[package_id]', pkg.id);
    sessionParams.set('metadata[package_key]', pkg.package_key ?? '');
    sessionParams.set('metadata[package_name]', pkg.name);
    sessionParams.set('metadata[case_study_count]', String(pkg.case_study_count));
    sessionParams.set('metadata[product_id]', pkg.product_id ?? '');
    sessionParams.set('metadata[email]', email);
    if (fullName) sessionParams.set('metadata[full_name]', fullName);
    sessionParams.set('metadata[source]', 'vb');

    const session = await stripeFetch('/v1/checkout/sessions', { method: 'POST', body: sessionParams });
    console.log(`✅ [${requestId}] Checkout Session erstellt: ${session.id}`);

    return jsonResponse({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error(`❌ [${requestId}] Fehler:`, message);
    return jsonResponse({ error: `Fehler beim Erstellen der Checkout-Session: ${message}` }, 500);
  }
});

// Modul-Marker: verhindert "Cannot redeclare block-scoped variable" in IDEs,
// wenn mehrere Edge Functions (ohne top-level import/export) in einem TS-Programm sind.
export {};
