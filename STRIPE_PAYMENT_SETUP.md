# Stripe Payment – Videoklausurenkorrektur

Betriebsanleitung für die Stripe-Anbindung (Checkout + Webhook + Credit-Gutschrift).

## Übersicht

| Baustein | Ort |
|---|---|
| Checkout-Session erzeugen | Edge Function `stripe-checkout` |
| Webhook (User anlegen + Credits) | Edge Function `stripe-webhook` |
| Pakete/Preise | Tabelle `vb_packages` |
| Bestellungen | Tabelle `vb_orders` |
| Stripe Customer pro User | `profiles.stripe_customer_id` |
| Credit-Guthaben | `profiles.account_credits` (Cache) |
| Schema/RPC/Trigger | `supabase/migrations/20260815000000_stripe_payments.sql` |

## Ablauf

1. Kunde wählt auf `/klausurenbesprechung/pakete` ein Paket (öffentlich, auch ohne Login).
   - Eingeloggte User werden über ihr JWT erkannt; Gäste geben E-Mail (optional Name) ein.
2. `stripe-checkout` validiert die Preis-ID serverseitig gegen `vb_packages`,
   prüft das Neukunden-Angebot (1× pro Person), findet/erstellt den Stripe Customer
   (bei vorhandenem Profil wird `stripe_customer_id` wiederverwendet und gespeichert)
   und erstellt eine Checkout Session.
3. Nach erfolgreicher Zahlung sendet Stripe `checkout.session.completed` an den Webhook.
4. `stripe-webhook` (Signatur geprüft):
   - legt den User an, falls neu: auth user (Rolle `teilnehmer`) + Profile mit
     zusätzlicher Rolle `videobesprechung` und `stripe_customer_id`
   - verbucht die Bestellung atomar via RPC `record_vb_stripe_purchase` in `vb_orders`
     (Status `completed`, 18 Monate Gültigkeit, idempotent per Checkout-Session-ID,
     Neukunden-Guard gegen Doppelkauf)
   - aktualisiert `profiles.account_credits`
   - sendet die Willkommens-E-Mail an neue User

## Pakete / Stripe Preise (Stand 2026-08-15)

| Paket | `vb_packages.package_key` | Stripe Product | Stripe Price | Preis |
|---|---|---|---|---|
| Neukunden-Angebot (1 Klausur, nur 1×) | `neukunden` | `prod_V4nudYBPQteL5P` | `price_1U4eISIeHKQHUuvsxtHrgtWh` | 50,00 € |
| 5er Paket (5 Credits) | `5er` | `prod_V4o2RKDiWgFYra` | `price_1U4eQJIeHKQHUuvs2EO7JPFX` | 675,00 € |
| 10er Paket (10 Credits) | `10er` | `prod_V4o2IyQlqh60Cc` | `price_1U4eQqIeHKQHUuvsVfFnKenF` | 1.250,00 € |
| 15er Paket (15 Credits) | `15er` | `prod_V4o386DlBHiuWK` | `price_1U4eRKIeHKQHUuvsf5R6djIG` | 1.800,00 € |
| 20er Paket (20 Credits) | `20er` | `prod_V4o4Y6fbCtDvTN` | `price_1U4eRvIeHKQHUuvs7tuuZ8Gi` | 2.360,00 € |
| 25er Paket (25 Credits) | `25er` | `prod_V4o4DNV3CpvGM4` | `price_1U4eSNIeHKQHUuvs2dnncS1l` | 2.875,00 € |
| 30er Paket (30 Credits) | `30er` | `prod_V4o4xlulDVJ6mu` | `price_1U4eSoIeHKQHUuvs3enIKtd4` | 3.375,00 € |

> Hinweis: Die früheren 35er/50er-Pakete in `vb_packages` sind deaktiviert
> (`active = false`), da im Stripe-Account keine zugehörigen Produkte existieren.

1 Credit = 1 Klausur (1 Sachverhalt, den der Teilnehmer anfordern kann).
Gekaufte Credits verfallen nach 18 Monaten (`vb_orders.expires_at`).

## Secrets (Supabase Edge Function Secrets)

Bereits gesetzt (Projekt `gkkveloqajxghhflkfru`):

| Secret | Wert |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (in Supabase gesetzt; bei Bedarf neu anzeigen/rotieren) |

Sollte der Webhook-Secret neu erzeugt werden (z. B. nach Endpoint-Neuansage),
aktuell halten:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref gkkveloqajxghhflkfru
```

## Webhook-Endpoint (Stripe)

- Endpoint-ID: `we_1U4fRSIeHKQHUuvsIUBxwqas` (Status: aktiv)
- URL: `https://gkkveloqajxghhflkfru.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`

## Deployment

```bash
supabase functions deploy stripe-checkout --no-verify-jwt --project-ref gkkveloqajxghhflkfru
supabase functions deploy stripe-webhook   --no-verify-jwt --project-ref gkkveloqajxghhflkfru
```

`--no-verify-jwt` ist wichtig: Stripe sendet keine Auth-Header an den Webhook,
und Gäste besitzen kein JWT für `stripe-checkout`.

## Promo-Codes

| Code | Rabatt | Gültigkeit | Stripe-Promo-Code | Coupon |
|---|---|---|---|---|
| `propropro100` | 100 % | 1× pro Kunde (`once`) | `promo_1U4gGnIeHKQHUuvsgStcg9Mi` | `IZh4hHzJ` |

Hinweis: Die Stripe-API unterstützt keine Produkt-Einschränkung für Promo-Codes.
Da `stripe-checkout` ausschließlich Sessions mit den 7 Paket-Preisen oben erstellt,
ist der Code praktisch auf diese Pakete begrenzt. Achtung bei anderen Checkout-
Flows (z. B. Kraatz-Club-Abos): Dort würde der 100-%-Code ebenfalls akzeptiert.
Bei Missbrauch: `max_redemptions` setzen oder Promo-Code deaktivieren.

## Hinweise

- `stripe-checkout` ist ohne JWT aufrufbar, validiert aber jede Preis-ID
  serverseitig gegen aktive `vb_packages` – erfundene Preise sind nicht möglich.
- Die Gutschrift erfolgt ausschließlich über den signierten Webhook
  (Single Source of Truth), nicht über den Checkout-Aufruf selbst.
- Neue User erhalten die Willkommens-E-Mail und können über
  „Passwort vergessen" einen Magic Link anfordern (kein Passwort wird verschickt).
- Fehler/Doppelkäufe werden in den Logs der Edge Function dokumentiert
  (`neukunden_already_purchased`, `duplicate_session`).
