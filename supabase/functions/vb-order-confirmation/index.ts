// Edge function: Bestellbestätigung für Videoklausurenkorrektur-Käufe (Mailgun)
// Wird vom stripe-webhook nach erfolgreicher Gutschrift aufgerufen.
console.log('🚀 vb-order-confirmation edge function loaded');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderConfirmationRequest {
  email: string;
  fullName?: string;
  packageName: string;
  caseStudyCount: number;
  totalCents: number;
  checkoutSessionId?: string;
  expiresAt?: string;
  isNewUser?: boolean;
}

const BASE_URL = 'https://portal.kraatz-group.de';

function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`🆔 [${requestId}] vb-order-confirmation aufgerufen`);

  try {
    const body = await req.json() as OrderConfirmationRequest;
    const email = (body.email ?? '').trim().toLowerCase();
    const packageName = (body.packageName ?? '').trim();
    const caseStudyCount = Number(body.caseStudyCount) || 0;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'E-Mail ist erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!packageName || caseStudyCount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Paketdaten sind erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fullName = (body.fullName ?? '').trim() || email.split('@')[0] || 'Teilnehmer';
    const totalCents = Number(body.totalCents) || 0;
    const checkoutSessionId = (body.checkoutSessionId ?? '').trim();
    const expiresAt = (body.expiresAt ?? '').trim();
    const isNewUser = body.isNewUser === true;

    const amountDisplay =
      totalCents === 0
        ? '0,00 € <span style="color: #16a34a;">(Rabattcode angewendet)</span>'
        : formatEuro(totalCents);

    const dashboardLink = `${BASE_URL}/klausurenbesprechung/dashboard`;

    const accessHint = isNewUser
      ? `<p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
           Dein Zugang wurde soeben für Dich erstellt. Du hast in Kürze eine weitere E-Mail mit
           Deinen Zugangsdaten erhalten – dort kannst Du über „Passwort vergessen" ganz einfach
           einen Login-Link anfordern und Dein Passwort festlegen.
         </p>`
      : `<p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
           Die Credits wurden Deinem bestehenden Konto gutgeschrieben – Du kannst direkt weiterarbeiten.
         </p>`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <h1 style="margin: 0; font-size: 22px; color: #333;">Kraatz Group</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Portal</p>
        </div>

        <!-- Main Content -->
        <div style="padding: 30px 20px; background-color: white;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Bestellbestätigung – Video-Klausurenkorrektur</h2>

          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hallo ${escapeHtml(fullName)},
          </p>

          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            vielen Dank für Deine Bestellung! Dein Paket ist freigeschaltet und Deine Klausur-Kredite
            stehen Dir sofort zur Verfügung.
          </p>

          <!-- Order Details -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2e83c2;">
            <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Deine Bestellung:</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px; width: 40%;"><strong>Paket:</strong></td>
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
              ${
                expiresAt
                  ? `<tr>
                       <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Gültig bis:</strong></td>
                       <td style="padding: 8px 0; color: #333; font-size: 14px;">${formatDate(expiresAt)}</td>
                     </tr>`
                  : ''
              }
              ${
                checkoutSessionId
                  ? `<tr>
                       <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Bestellreferenz:</strong></td>
                       <td style="padding: 8px 0; color: #333; font-size: 14px; word-break: break-all;">${escapeHtml(checkoutSessionId)}</td>
                     </tr>`
                  : ''
              }
            </table>
          </div>

          ${accessHint}

          <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #6c757d;">
            <p style="margin: 0 0 10px 0; color: #495057; font-size: 14px;">
              <strong>So geht es weiter:</strong> Fordere Deinen ersten Sachverhalt an – wähle einfach
              Rechtsgebiet, Teilgebiet und Problemschwerpunkt. Ein Fach-Dozent der Akademie Kraatz
              stellt Dir die Klausur zur Verfügung, Du löst sie und erhältst innerhalb von 48 Stunden
              Dein persönliches Videofeedback.
            </p>
          </div>

          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardLink}"
               style="display: inline-block; background-color: #2e83c2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
              Zum Portal &amp; Sachverhalt anfordern
            </a>
          </div>

          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 0;">
            Falls Du Fragen hast oder Hilfe benötigst, wende Dich gerne an unser Team.
          </p>
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 0;">
            Mit freundlichen Grüßen<br>
            <strong>Ihr Kraatz Group Team</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Akademie Kraatz GmbH</p>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Wilmersdorfer Str. 145/146 - 10585 Berlin</p>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Diese E-Mail wurde automatisch vom Portal gesendet.</p>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Bei Fragen wenden Sie sich bitte an <a href="mailto:charlenenowak@kraatz-group.de" style="color: #2e83c2; text-decoration: none;">charlenenowak@kraatz-group.de</a></p>
        </div>
      </div>`;

    // Send via Mailgun
    const mailgunApiKey = (Deno.env.get('MAILGUN_API_KEY') || '').trim();
    const mailgunDomain = 'kraatz-group.de';

    if (!mailgunApiKey) {
      console.error(`❌ [${requestId}] MAILGUN_API_KEY nicht konfiguriert`);
      return new Response(
        JSON.stringify({ error: 'E-Mail-Konfiguration fehlt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = new FormData();
    formData.append('from', 'Kraatz Group Portal <postmaster@kraatz-group.de>');
    formData.append('to', email);
    formData.append('subject', `Bestellbestätigung: ${packageName}`);
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
      console.error(`❌ [${requestId}] Mailgun-Fehler:`, errorText);
      return new Response(
        JSON.stringify({ error: 'Fehler beim E-Mail-Versand', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mailgunResult = await mailgunResponse.json();
    console.log(`✅ [${requestId}] Bestellbestätigung an ${email} versendet (${mailgunResult.id})`);

    return new Response(
      JSON.stringify({ success: true, message: `Bestellbestätigung an ${email} versendet.` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error(`❌ [${requestId}] Fehler:`, message);
    return new Response(
      JSON.stringify({ error: 'Fehler beim Versenden der Bestellbestätigung', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Modul-Marker: verhindert "Cannot redeclare block-scoped variable" in IDEs,
// wenn mehrere Edge Functions (ohne top-level import/export) in einem TS-Programm sind.
export {};
