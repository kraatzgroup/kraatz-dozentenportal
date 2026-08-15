// Edge function: Stripe Webhook für Videoklausurenkorrektur-Käufe
//
// Verarbeitet checkout.session.completed und checkout.session.async_payment_succeeded:
//   1. Verifiziert die Stripe-Signatur (HMAC-SHA256, STRIPE_WEBHOOK_SECRET)
//   2. Holt die komplette Session (inkl. Customer + Line Items) von Stripe
//   3. Legt den User an, falls noch nicht vorhanden:
//      - auth user (Rolle Teilnehmer) + profile mit zusätzlicher Rolle 'videobesprechung'
//   4. Speichert stripe_customer_id am Profil
//   5. Schreibt die Bestellung in vb_orders (atomar + idempotent via RPC)
//   6. Sendet Willkommens-E-Mail an neue User
console.log('🚀 stripe-webhook edge function loaded');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPPORTED_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]);

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

/**
 * Verifiziert den Stripe-Signature-Header (Format: t=...,v1=...) per HMAC-SHA256.
 * Prüft zusätzlich, dass der Timestamp nicht älter als 5 Minuten ist.
 */
async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!signatureHeader) return { ok: false, error: 'Fehlender Stripe-Signature-Header' };

    let timestamp = '';
    let expected = '';
    for (const part of signatureHeader.split(',')) {
      const trimmed = part.trim();
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (key === 't') timestamp = value;
      if (key === 'v1') expected = value;
    }

    if (!timestamp || !expected) return { ok: false, error: 'Ungültiger Signature-Header' };

    const ts = parseInt(timestamp, 10);
    if (Number.isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
      return { ok: false, error: 'Signatur-Zeitstempel außerhalb des Toleranzfensters' };
    }

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signedPayload)
    );
    const actual = [...new Uint8Array(signature)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (actual.length !== expected.length) return { ok: false, error: 'Signatur-Länge stimmt nicht' };

    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
      diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (diff !== 0) return { ok: false, error: 'Signatur stimmt nicht überein' };

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verifikationsfehler' };
  }
}

/** Erzeugt ein sicheres temporäres Passwort (User setzt danach selbst eines). */
function generateSecurePassword(): string {
  const charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  return password;
}

async function findAuthUserIdByEmail(supabaseAdmin: any, email: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = (data?.users ?? []).find((u: any) => (u.email ?? '').toLowerCase() === email);
    if (found) return found.id;
    if (!data || data.users.length < 1000) return null;
  }
  return null;
}

/**
 * Stellt sicher, dass zu der E-Mail ein auth user + profile existiert.
 * Neue User: Rolle 'teilnehmer', zusätzliche Rolle 'videobesprechung'.
 */
async function ensureUser(
  supabaseAdmin: any,
  email: string,
  session: any
): Promise<{ profileId: string; isNewUser: boolean; fullName: string }> {
  // 1. Profil per E-Mail suchen
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, additional_roles, stripe_customer_id')
    .eq('email', email)
    .maybeSingle();

  if (profile) {
    return { profileId: profile.id, isNewUser: false, fullName: profile.full_name };
  }

  const fullName =
    session.customer_details?.name?.trim() ||
    session.metadata?.full_name?.trim() ||
    email.split('@')[0] ||
    'Teilnehmer';

  // 2. Auth-User anlegen (oder bestehenden finden)
  let authUserId: string | null = null;
  const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: generateSecurePassword(),
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'teilnehmer' },
  });

  if (createError) {
    if (createError.code === 'email_exists' || (createError.message ?? '').includes('already registered')) {
      console.log(`ℹ️ Auth-User für ${email} existiert bereits – wird gesucht`);
      authUserId = await findAuthUserIdByEmail(supabaseAdmin, email);
      if (!authUserId) throw new Error(`Auth-User für ${email} nicht gefunden`);
    } else {
      throw createError;
    }
  } else {
    authUserId = createdUser?.user?.id ?? null;
  }

  if (!authUserId) throw new Error('Auth-User-Erstellung fehlgeschlagen');

  // GUARD: Profil mit dieser E-Mail unter anderer ID (doppelte Anlage verhindern)
  const { data: duplicateProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name')
    .eq('email', email)
    .neq('id', authUserId)
    .maybeSingle();

  if (duplicateProfile) {
    console.warn(`⚠️ Profil mit E-Mail ${email} existiert unter anderer ID ${duplicateProfile.id} – bestehendes Profil wird genutzt`);
    return { profileId: duplicateProfile.id, isNewUser: false, fullName: duplicateProfile.full_name };
  }

  // 3. Profil anlegen (Rolle Teilnehmer + Videoklausurenkorrektur)
  const { error: insertError } = await supabaseAdmin.from('profiles').insert({
    id: authUserId,
    email,
    full_name: fullName,
    role: 'teilnehmer',
    additional_roles: ['videobesprechung'],
  });

  if (insertError) {
    // Race: zeitgleiche Verarbeitung derselben E-Mail
    if (insertError.code === '23505') {
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .eq('email', email)
        .maybeSingle();
      if (existing) {
        return { profileId: existing.id, isNewUser: false, fullName: existing.full_name };
      }
    }
    throw insertError;
  }

  console.log(`👤 Neuer User angelegt: ${authUserId} (${email}) mit Rolle teilnehmer + videobesprechung`);
  return { profileId: authUserId, isNewUser: true, fullName };
}

async function sendWelcomeEmail(email: string, fullName: string): Promise<void> {
  try {
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-welcome-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') ?? ''}`,
        },
        body: JSON.stringify({ email, fullName }),
      }
    );
    if (!response.ok) {
      console.warn(`⚠️ send-welcome-email fehlgeschlagen (Status ${response.status})`);
    } else {
      console.log(`📧 Willkommens-E-Mail an ${email} versendet`);
    }
  } catch (error) {
    console.warn('⚠️ send-welcome-email Exception:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET ist nicht konfiguriert');

    const payload = await req.text();
    const signatureHeader = req.headers.get('stripe-signature') ?? '';

    const verification = await verifyStripeSignature(payload, signatureHeader, webhookSecret);
    if (!verification.ok) {
      console.error('❌ Ungültige Stripe-Signatur:', verification.error);
      return new Response(JSON.stringify({ error: 'Ungültige Signatur' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(payload);
    console.log(`⚡ Webhook-Event empfangen: ${event.type} (${event.id})`);

    if (!SUPPORTED_EVENTS.has(event.type)) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sessionId = event.data?.object?.id;
    if (!sessionId) {
      console.warn('⚠️ Event ohne Session-ID empfangen');
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // @ts-ignore – npm:-Import wird erst zur Laufzeit von Deno aufgelöst
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Komplette Session von Stripe holen (Line Items + Customer sind im
    // Webhook-Payload standardmäßig nicht enthalten)
    const session = await stripeFetch(
      `/v1/checkout/sessions/${sessionId}?expand[]=customer&expand[]=line_items.data.price.product`
    );

    if (session.payment_status !== 'paid') {
      console.log(`ℹ️ Session ${sessionId}: payment_status=${session.payment_status} – noch keine Gutschrift`);
      return new Response(JSON.stringify({ received: true, skipped: 'not paid yet' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // E-Mail bestimmen
    const email = (
      session.customer_details?.email ||
      session.customer?.email ||
      session.metadata?.email ||
      ''
    ).toString().trim().toLowerCase();

    if (!email) {
      console.error(`❌ Keine E-Mail für Session ${sessionId} bestimmbar`);
      return new Response(JSON.stringify({ error: 'Keine E-Mail bestimmbar' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Preis-/Produktdaten aus der Session bestimmen
    const lineItem = session.line_items?.data?.[0];
    const priceId = lineItem?.price?.id || session.metadata?.price_id || null;
    const productId =
      typeof lineItem?.price?.product === 'string'
        ? lineItem.price.product
        : lineItem?.price?.product?.id || session.metadata?.product_id || null;

    // Paket in vb_packages suchen (Fallback auf Session-Metadaten)
    let pkg: any = null;
    if (priceId) {
      const { data } = await supabaseAdmin
        .from('vb_packages')
        .select('*')
        .eq('stripe_price_id', priceId)
        .maybeSingle();
      pkg = data ?? null;
    }

    const caseStudyCount = (pkg?.case_study_count ?? parseInt(session.metadata?.case_study_count ?? '0', 10)) || 0;
    const packageId = pkg?.id ?? null;
    const packageKey = pkg?.package_key ?? session.metadata?.package_key ?? null;
    const packageName = pkg?.name ?? session.metadata?.package_name ?? null;
    const totalCents = session.amount_total ?? (lineItem?.price?.unit_amount ?? 0);

    console.log(`📦 Session ${sessionId}: ${packageName ?? 'unbekanntes Paket'} (${caseStudyCount} Credits, ${totalCents} Cent)`);

    if (!caseStudyCount) {
      console.error(`❌ Keine Credits für Session ${sessionId} bestimmbar (Preis ${priceId} nicht in vb_packages)`);
    }

    // User anlegen / finden
    const { profileId, isNewUser, fullName } = await ensureUser(supabaseAdmin, email, session);

    // stripe_customer_id am Profil speichern
    const customerId =
      typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null);
    if (customerId) {
      const { data: freshProfile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_customer_id, role, additional_roles')
        .eq('id', profileId)
        .maybeSingle();

      const updates: Record<string, unknown> = {};
      if (!freshProfile?.stripe_customer_id) updates.stripe_customer_id = customerId;
      // Sicherstellen, dass die Rolle Videoklausurenkorrektur gesetzt ist
      const additionalRoles = freshProfile?.additional_roles ?? [];
      if (!additionalRoles.includes('videobesprechung')) {
        updates.additional_roles = [...additionalRoles, 'videobesprechung'];
      }
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('profiles').update(updates).eq('id', profileId);
        console.log(`💾 [${profileId}] Profil aktualisiert: ${JSON.stringify(Object.keys(updates))}`);
      }
    }

    // Bestellung atomar + idempotent verbuchen
    const { data: purchaseResult, error: purchaseError } = await supabaseAdmin.rpc(
      'record_vb_stripe_purchase',
      {
        p_profile_id: profileId,
        p_package_id: packageId,
        p_package_key: packageKey,
        p_package_name: packageName,
        p_case_study_count: caseStudyCount,
        p_total_cents: totalCents,
        p_stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        p_stripe_checkout_session_id: session.id,
        p_stripe_customer_id: customerId,
        p_product_id: productId,
      }
    );

    if (purchaseError) throw purchaseError;

    if (purchaseResult?.reason === 'neukunden_already_purchased') {
      console.warn(`⚠️ Neukunden-Angebot für ${email} bereits gekauft – keine weiteren Credits gutgeschrieben`);
    } else if (purchaseResult?.inserted) {
      console.log(`✅ ${caseStudyCount} Credits für ${email} (Profil ${profileId}) verbucht, Ablauf ${purchaseResult.expires_at}`);
    } else {
      console.log(`ℹ️ Session ${sessionId} bereits verarbeitet (idempotent übersprungen)`);
    }

    // Willkommens-E-Mail für neue User
    if (isNewUser) {
      await sendWelcomeEmail(email, fullName);
    }

    return new Response(
      JSON.stringify({ received: true, processed: true, result: purchaseResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ stripe-webhook Fehler:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Modul-Marker: verhindert "Cannot redeclare block-scoped variable" in IDEs,
// wenn mehrere Edge Functions (ohne top-level import/export) in einem TS-Programm sind.
export {};
