-- ============================================================================
-- Stripe Payment Integration für Videoklausurenkorrektur
-- Date: 2026-08-15
--
-- Inhalt:
--   1. profiles.stripe_customer_id (Stripe Customer pro User)
--   2. vb_orders: Stripe Checkout-/Customer-/Product-Spalten + Idempotenz-Index
--   3. vb_packages: aktuelle Stripe Price IDs + Neukunden-Angebot (1x pro Person)
--   4. RPC record_vb_stripe_purchase (atomar, idempotent, Neukunden-Guard)
--   5. RLS: vb_packages öffentlich lesbar (aktive Pakete) für Gast-Checkout
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Stripe Customer ID auf profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_id_key
  ON public.profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.stripe_customer_id IS
  'Stripe Customer ID (cus_...) die diesem User zugeordnet ist';

-- ---------------------------------------------------------------------------
-- 2. vb_orders: Stripe-Spalten + Idempotenz-Index
-- ---------------------------------------------------------------------------
ALTER TABLE public.vb_orders ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE public.vb_orders ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.vb_orders ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.vb_orders ADD COLUMN IF NOT EXISTS package_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS vb_orders_stripe_checkout_session_id_key
  ON public.vb_orders(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

COMMENT ON COLUMN public.vb_orders.stripe_checkout_session_id IS
  'Stripe Checkout Session ID (cs_...) – Idempotenz-Schlüssel für Webhook-Verarbeitung';
COMMENT ON COLUMN public.vb_orders.stripe_customer_id IS
  'Stripe Customer (cus_...) zum Zeitpunkt des Kaufs';
COMMENT ON COLUMN public.vb_orders.product_id IS
  'Stripe Product ID (prod_...)';
COMMENT ON COLUMN public.vb_orders.package_name IS
  'Denormalisierter Paketname für Auswertungen';

-- ---------------------------------------------------------------------------
-- 3. vb_packages: auf aktuelle Stripe Price IDs aktualisieren
--    (vom Stripe-Account verifiziert am 2026-08-15)
-- ---------------------------------------------------------------------------
ALTER TABLE public.vb_packages ADD COLUMN IF NOT EXISTS package_key TEXT;
ALTER TABLE public.vb_packages ADD COLUMN IF NOT EXISTS product_id TEXT;

COMMENT ON COLUMN public.vb_packages.package_key IS
  'Interner Paketschlüssel (5er, 10er, ..., neukunden)';
COMMENT ON COLUMN public.vb_packages.product_id IS
  'Stripe Product ID (prod_...) des zugehörigen Stripe-Produkts';

UPDATE public.vb_packages SET
  package_key = '5er',
  product_id = 'prod_V4o2RKDiWgFYra',
  stripe_price_id = 'price_1U4eQJIeHKQHUuvs2EO7JPFX'
WHERE name = '5er Paket';

UPDATE public.vb_packages SET
  package_key = '10er',
  product_id = 'prod_V4o2IyQlqh60Cc',
  stripe_price_id = 'price_1U4eQqIeHKQHUuvsVfFnKenF'
WHERE name = '10er Paket';

UPDATE public.vb_packages SET
  package_key = '15er',
  product_id = 'prod_V4o386DlBHiuWK',
  stripe_price_id = 'price_1U4eRKIeHKQHUuvsf5R6djIG'
WHERE name = '15er Paket';

UPDATE public.vb_packages SET
  package_key = '20er',
  product_id = 'prod_V4o4Y6fbCtDvTN',
  stripe_price_id = 'price_1U4eRvIeHKQHUuvs7tuuZ8Gi'
WHERE name = '20er Paket';

UPDATE public.vb_packages SET
  package_key = '25er',
  product_id = 'prod_V4o4DNV3CpvGM4',
  stripe_price_id = 'price_1U4eSNIeHKQHUuvs2dnncS1l'
WHERE name = '25er Paket';

UPDATE public.vb_packages SET
  package_key = '30er',
  product_id = 'prod_V4o4xlulDVJ6mu',
  stripe_price_id = 'price_1U4eSoIeHKQHUuvs3enIKtd4'
WHERE name = '30er Paket';

-- Neukunden-Angebot: 1 Klausur = 1 Credit, nur 1x pro Person kaufbar
INSERT INTO public.vb_packages (name, description, case_study_count, price_cents, stripe_price_id, product_id, package_key, active)
SELECT
  'Neukunden-Angebot: Video-Klausurenkorrektur',
  'Endlich eine digitale Klausurenkorrektur, die Dich wirklich weiterbringt. Du bist noch skeptisch, ob die digitale Klausuren-Korrektur zu Dir passt? Kein Risiko, kein Abo: Schnapp Dir Deine erste Korrektur für gerade mal 50 € und hol Dir exklusiven Zugang zu unserem Portal. Erst testen, dann entscheiden – ganz ohne Druck!',
  1,
  5000,
  'price_1U4eISIeHKQHUuvsxtHrgtWh',
  'prod_V4nudYBPQteL5P',
  'neukunden',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.vb_packages
  WHERE stripe_price_id = 'price_1U4eISIeHKQHUuvsxtHrgtWh'
);

-- Pakete ohne zugehöriges Stripe-Produkt deaktivieren (35er/50er haben keine
-- echte Stripe-Preis-ID und sind im Stripe-Account nicht angelegt)
UPDATE public.vb_packages SET active = false
WHERE name IN ('35er Paket', '50er Paket')
  AND active = true;

-- ---------------------------------------------------------------------------
-- 4. RPC: record_vb_stripe_purchase – atomare Gutschrift nach Stripe-Zahlung
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_vb_stripe_purchase(
  p_profile_id UUID,
  p_package_id UUID,
  p_package_key TEXT,
  p_package_name TEXT,
  p_case_study_count INTEGER,
  p_total_cents INTEGER,
  p_stripe_payment_intent_id TEXT,
  p_stripe_checkout_session_id TEXT,
  p_stripe_customer_id TEXT,
  p_product_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits INTEGER;
  v_used INTEGER;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Serialisiert parallele Webhook-Deliveries pro Profil, damit das
  -- Neukunden-Angebot nicht doppelt gutgeschrieben werden kann.
  PERFORM pg_advisory_xact_lock(hashtext('vb_stripe_' || p_profile_id::text)::bigint);

  -- Idempotenz: Checkout-Session wurde bereits verarbeitet
  IF p_stripe_checkout_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.vb_orders
    WHERE stripe_checkout_session_id = p_stripe_checkout_session_id
  ) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'inserted', false,
      'reason', 'duplicate_session'
    );
  END IF;

  -- Neukunden-Angebot: nur 1x pro Person
  IF p_package_key = 'neukunden' THEN
    IF EXISTS (
      SELECT 1 FROM public.vb_orders o
      JOIN public.vb_packages pk ON pk.id = o.package_id
      WHERE o.profile_id = p_profile_id
        AND o.status = 'completed'
        AND pk.package_key = 'neukunden'
    ) THEN
      RETURN jsonb_build_object(
        'ok', true,
        'inserted', false,
        'credited', false,
        'reason', 'neukunden_already_purchased'
      );
    END IF;
  END IF;

  v_expires_at := NOW() + INTERVAL '18 months';

  INSERT INTO public.vb_orders (
    profile_id,
    package_id,
    stripe_payment_intent_id,
    stripe_checkout_session_id,
    stripe_customer_id,
    product_id,
    package_name,
    status,
    total_cents,
    case_study_count,
    expires_at
  ) VALUES (
    p_profile_id,
    p_package_id,
    p_stripe_payment_intent_id,
    p_stripe_checkout_session_id,
    p_stripe_customer_id,
    p_product_id,
    p_package_name,
    'completed',
    p_total_cents,
    p_case_study_count,
    v_expires_at
  );

  -- Gecachtes Credit-Guthaben neu berechnen (Konsistenz mit Frontend-Logik)
  SELECT COALESCE(SUM(o.case_study_count), 0)
  INTO v_credits
  FROM public.vb_orders o
  WHERE o.profile_id = p_profile_id
    AND o.status = 'completed'
    AND (o.expires_at IS NULL OR o.expires_at > NOW());

  SELECT COUNT(*) INTO v_used
  FROM public.vb_case_study_requests
  WHERE profile_id = p_profile_id;

  UPDATE public.profiles
  SET account_credits = GREATEST(v_credits - v_used, 0)
  WHERE id = p_profile_id;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', true,
    'credited', true,
    'credits', p_case_study_count,
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_vb_stripe_purchase(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_vb_stripe_purchase(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.record_vb_stripe_purchase IS
  'Atomare Gutschrift von Klausur-Credits nach erfolgreicher Stripe-Zahlung. Idempotent per Checkout-Session, verhindert doppelten Neukunden-Kauf.';

-- ---------------------------------------------------------------------------
-- 4b. Trigger: account_credits nach Sachverhalt-Anfragen aktuell halten
--      (Guthaben = gekaufte Credits aus completed vb_orders – angeforderte
--      Sachverhalte). Hält profiles.account_credits als Cache konsistent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_account_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target UUID;
  v_credits INTEGER;
  v_used INTEGER;
BEGIN
  v_target := COALESCE(NEW.profile_id, OLD.profile_id);
  IF v_target IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(o.case_study_count), 0)
  INTO v_credits
  FROM public.vb_orders o
  WHERE o.profile_id = v_target
    AND o.status = 'completed'
    AND (o.expires_at IS NULL OR o.expires_at > NOW());

  SELECT COUNT(*) INTO v_used
  FROM public.vb_case_study_requests
  WHERE profile_id = v_target;

  UPDATE public.profiles
  SET account_credits = GREATEST(v_credits - v_used, 0)
  WHERE id = v_target;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS recalc_account_credits_on_request ON public.vb_case_study_requests;
CREATE TRIGGER recalc_account_credits_on_request
  AFTER INSERT OR DELETE ON public.vb_case_study_requests
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_account_credits();

COMMENT ON FUNCTION public.recalculate_account_credits IS
  'Aktualisiert profiles.account_credits (Cache) bei neuen/gelöschten Sachverhalt-Anfragen.';

-- ---------------------------------------------------------------------------
-- 5. RLS: Aktive Pakete öffentlich lesbar (Gast-Checkout auf Paketseite)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated read" ON public.vb_packages;

CREATE POLICY "Allow public read of active packages" ON public.vb_packages
  FOR SELECT
  USING (active = true);

COMMENT ON POLICY "Allow public read of active packages" ON public.vb_packages IS
  'Aktive Pakete sind öffentlich sichtbar (Preise sind Verkaufsdaten). Paket-IDs und Preis-IDs werden serverseitig validiert.';
