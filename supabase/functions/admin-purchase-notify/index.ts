/// <reference path="../deno.d.ts" />
// Edge function: admin-purchase-notify
//
// Sends a notification email to all admins when a Stripe purchase is completed.
// Includes: buyer info (new vs existing user), product/package details, value,
// timestamps, Stripe session ID, and credit count.
//
// Called by stripe-webhook after a successful purchase is recorded.
console.log('🚀 admin-purchase-notify edge function loaded');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://portal.kraatz-group.de';
const LOGO_URL = 'https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEuro(cents: number): string {
  const euros = cents / 100;
  return euros.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Berlin',
    }) + ' Uhr';
  } catch {
    return isoString;
  }
}

interface PurchaseNotifyRequest {
  email: string;
  fullName: string;
  isNewUser: boolean;
  packageName: string;
  caseStudyCount: number;
  totalCents: number;
  checkoutSessionId: string;
  stripeCustomerId?: string | null;
  stripePaymentIntentId?: string | null;
  expiresAt?: string | null;
  purchaseTimestamp?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`🆔 [${requestId}] admin-purchase-notify started`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    const mailgunApiKey = (Deno.env.get('MAILGUN_API_KEY') || '').trim();
    const mailgunDomain = 'kraatz-group.de';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    }
    if (!mailgunApiKey) {
      throw new Error('MAILGUN_API_KEY not configured');
    }

    const body: PurchaseNotifyRequest = await req.json();
    const {
      email,
      fullName,
      isNewUser,
      packageName,
      caseStudyCount,
      totalCents,
      checkoutSessionId,
      stripeCustomerId,
      stripePaymentIntentId,
      expiresAt,
      purchaseTimestamp,
    } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 [${requestId}] Purchase: ${email} - ${packageName} - ${formatEuro(totalCents)} - ${isNewUser ? 'NEW' : 'EXISTING'} user`);

    // ─── Load all admins ──────────────────────────────────────────────
    // Fetch profiles with role=admin (service role bypasses RLS)
    const adminsResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id,full_name,email,role,additional_roles&role=eq.admin`,
      {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      }
    );
    const adminProfiles = await adminsResponse.json();
    const admins = Array.isArray(adminProfiles)
      ? adminProfiles.filter((p: any) => p.email)
      : [];

    if (!Array.isArray(admins) || admins.length === 0) {
      console.log(`ℹ️ [${requestId}] No admins found — skipping notification`);
      return new Response(
        JSON.stringify({ success: true, message: 'No admins to notify', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 [${requestId}] Found ${admins.length} admin(s)`);

    const now = purchaseTimestamp || new Date().toISOString();
    const amountDisplay = totalCents === 0
      ? '0,00 € <span style="color: #16a34a;">(Test-Kredit / Rabattcode)</span>'
      : formatEuro(totalCents);

    const emailHtml = buildAdminEmailHtml({
      email,
      fullName,
      isNewUser,
      packageName,
      caseStudyCount,
      totalCents,
      amountDisplay,
      checkoutSessionId,
      stripeCustomerId,
      stripePaymentIntentId,
      expiresAt,
      now,
    });

    let sentCount = 0;
    for (const admin of admins) {
      try {
        const formData = new FormData();
        formData.append('from', 'Kraatz Group Portal <postmaster@kraatz-group.de>');
        formData.append('to', admin.email);
        formData.append('subject', `[Kauf] ${isNewUser ? 'Neukunde' : 'Bestandskunde'}: ${fullName} – ${packageName} (${formatEuro(totalCents)})`);
        formData.append('h:Reply-To', 'postmaster@kraatz-group.de');
        formData.append('o:tracking', 'false');
        formData.append('html', emailHtml);

        const mailgunResponse = await fetch(`https://api.eu.mailgun.net/v3/${mailgunDomain}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
          },
          body: formData,
        });

        if (!mailgunResponse.ok) {
          const errorText = await mailgunResponse.text();
          console.error(`❌ [${requestId}] Mailgun error for ${admin.email}:`, errorText);
          continue;
        }

        sentCount++;
        console.log(`✅ [${requestId}] Admin notification sent to ${admin.email}`);
      } catch (adminErr) {
        console.error(`❌ [${requestId}] Error sending to admin ${admin.email}:`, adminErr);
      }
    }

    console.log(`✅ [${requestId}] Done. ${sentCount}/${admins.length} admin(s) notified`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, admins: admins.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error(`❌ [${requestId}] Fehler:`, message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface EmailData {
  email: string;
  fullName: string;
  isNewUser: boolean;
  packageName: string;
  caseStudyCount: number;
  totalCents: number;
  amountDisplay: string;
  checkoutSessionId: string;
  stripeCustomerId?: string | null;
  stripePaymentIntentId?: string | null;
  expiresAt?: string | null;
  now: string;
}

function buildAdminEmailHtml(data: EmailData): string {
  const {
    email, fullName, isNewUser, packageName, caseStudyCount,
    totalCents, amountDisplay, checkoutSessionId,
    stripeCustomerId, stripePaymentIntentId, expiresAt, now,
  } = data;

  const userBadge = isNewUser
    ? '<span style="display: inline-block; background-color: #16a34a; color: white; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-left: 8px;">NEUKUNDE</span>'
    : '<span style="display: inline-block; background-color: #2e83c2; color: white; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-left: 8px;">BESTANDSKUNDE</span>';

  const expiresRow = expiresAt
    ? `<tr>
        <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Credits gültig bis:</strong></td>
        <td style="padding: 8px 0; color: #333; font-size: 14px;">${escapeHtml(formatDateTime(expiresAt))}</td>
       </tr>`
    : '';

  const stripeCustomerRow = stripeCustomerId
    ? `<tr>
        <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Stripe Customer ID:</strong></td>
        <td style="padding: 8px 0; color: #333; font-size: 14px; font-family: monospace;">${escapeHtml(stripeCustomerId)}</td>
       </tr>`
    : '';

  const stripePaymentRow = stripePaymentIntentId
    ? `<tr>
        <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Stripe Payment Intent:</strong></td>
        <td style="padding: 8px 0; color: #333; font-size: 14px; font-family: monospace;">${escapeHtml(stripePaymentIntentId)}</td>
       </tr>`
    : '';

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neuer Kauf im Portal</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">

  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">

    <!-- Header -->
    <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
      <img src="${LOGO_URL}" alt="Kraatz Group" style="height: 60px; margin: 0 auto; display: block;">
    </div>

    <!-- Main Content -->
    <div style="padding: 30px 20px; background-color: white;">
      <h2 style="color: #333; margin: 0 0 10px 0; font-size: 20px;">
        Neuer Kauf im Portal ${userBadge}
      </h2>

      <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
        Ein ${isNewUser ? 'neuer' : 'bestehender'} Teilnehmer hat soeben ein Paket im Portal erworben.
      </p>

      <!-- Purchase Details -->
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
        <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Kaufdetails:</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px; width: 40%;"><strong>Käufer:</strong></td>
            <td style="padding: 8px 0; color: #333; font-size: 14px;">${escapeHtml(fullName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>E-Mail:</strong></td>
            <td style="padding: 8px 0; color: #333; font-size: 14px;">${escapeHtml(email)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Kundenstatus:</strong></td>
            <td style="padding: 8px 0; color: #333; font-size: 14px;">${isNewUser ? 'Neukunde' : 'Bestandskunde'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Paket:</strong></td>
            <td style="padding: 8px 0; color: #333; font-size: 14px;">${escapeHtml(packageName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Klausur-Kredite:</strong></td>
            <td style="padding: 8px 0; color: #333; font-size: 14px;">${caseStudyCount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Betrag:</strong></td>
            <td style="padding: 8px 0; color: #333; font-size: 14px;">${amountDisplay}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Kaufzeitpunkt:</strong></td>
            <td style="padding: 8px 0; color: #333; font-size: 14px;">${escapeHtml(formatDateTime(now))}</td>
          </tr>
          ${expiresRow}
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Checkout Session:</strong></td>
            <td style="padding: 8px 0; color: #333; font-size: 14px; font-family: monospace; word-break: break-all;">${escapeHtml(checkoutSessionId)}</td>
          </tr>
          ${stripeCustomerRow}
          ${stripePaymentRow}
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin: 25px 0;">
        <a href="${BASE_URL}/admin"
           style="display: inline-block; background-color: #2e83c2; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
          Zum Admin-Dashboard
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="color: #666; font-size: 12px; margin: 5px 0;">Akademie Kraatz GmbH</p>
      <p style="color: #666; font-size: 12px; margin: 5px 0;">Wilmersdorfer Str. 145/146 - 10585 Berlin</p>
      <p style="color: #666; font-size: 12px; margin: 5px 0;">Diese E-Mail wurde automatisch vom Portal gesendet.</p>
    </div>
  </div>
</body>
</html>`;
}

export {};
