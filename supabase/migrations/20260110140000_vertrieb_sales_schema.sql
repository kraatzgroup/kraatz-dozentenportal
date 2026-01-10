-- Vertrieb Sales Schema
-- Packages (Products with hours that participants can purchase)
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  hours INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales tracking for calls and consultations
CREATE TABLE IF NOT EXISTS sales_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertrieb_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  teilnehmer_name TEXT NOT NULL,
  teilnehmer_email TEXT,
  teilnehmer_phone TEXT,
  call_date TIMESTAMPTZ DEFAULT NOW(),
  call_type TEXT CHECK (call_type IN ('cold_call', 'follow_up', 'consultation', 'closing')),
  status TEXT CHECK (status IN ('scheduled', 'completed', 'no_show', 'cancelled')) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follow-ups tracking
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertrieb_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  teilnehmer_name TEXT NOT NULL,
  teilnehmer_email TEXT,
  teilnehmer_phone TEXT,
  follow_up_date DATE NOT NULL,
  follow_up_time TIME,
  reason TEXT,
  status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
  notes TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trial lessons (Probestunden)
CREATE TABLE IF NOT EXISTS trial_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertrieb_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  teilnehmer_name TEXT NOT NULL,
  teilnehmer_email TEXT,
  teilnehmer_phone TEXT,
  scheduled_date TIMESTAMPTZ NOT NULL,
  dozent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('scheduled', 'completed', 'no_show', 'cancelled', 'converted')) DEFAULT 'scheduled',
  notes TEXT,
  converted_to_package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales/Deals tracking
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertrieb_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  teilnehmer_id UUID REFERENCES teilnehmer(id) ON DELETE SET NULL,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_status TEXT CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')) DEFAULT 'pending',
  is_upsell BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upsells tracking (linked to existing teilnehmer)
CREATE TABLE IF NOT EXISTS upsells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertrieb_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  teilnehmer_id UUID REFERENCES teilnehmer(id) ON DELETE CASCADE,
  original_package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  new_package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  upsell_date DATE NOT NULL DEFAULT CURRENT_DATE,
  additional_amount DECIMAL(10, 2) NOT NULL,
  additional_hours INTEGER NOT NULL,
  status TEXT CHECK (status IN ('proposed', 'accepted', 'declined')) DEFAULT 'proposed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily sales KPIs tracking
CREATE TABLE IF NOT EXISTS sales_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertrieb_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  calls_made INTEGER DEFAULT 0,
  calls_answered INTEGER DEFAULT 0,
  consultations_scheduled INTEGER DEFAULT 0,
  consultations_completed INTEGER DEFAULT 0,
  consultations_no_show INTEGER DEFAULT 0,
  deals_closed INTEGER DEFAULT 0,
  revenue DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vertrieb_user_id, date)
);

-- Cal.com booking cache (to store fetched bookings)
CREATE TABLE IF NOT EXISTS cal_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cal_booking_id TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  attendee_name TEXT,
  attendee_email TEXT,
  attendee_phone TEXT,
  status TEXT,
  meeting_url TEXT,
  location TEXT,
  event_type_id TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add package_id to teilnehmer table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teilnehmer' AND column_name = 'package_id') THEN
    ALTER TABLE teilnehmer ADD COLUMN package_id UUID REFERENCES packages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add source column to teilnehmer for tracking where they came from
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teilnehmer' AND column_name = 'source') THEN
    ALTER TABLE teilnehmer ADD COLUMN source TEXT CHECK (source IN ('website', 'referral', 'cold_call', 'social_media', 'other'));
  END IF;
END $$;

-- RLS Policies
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE cal_bookings ENABLE ROW LEVEL SECURITY;

-- Packages: Everyone can read, only admin can modify
CREATE POLICY "packages_read_all" ON packages FOR SELECT USING (true);
CREATE POLICY "packages_admin_all" ON packages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Sales calls: Vertrieb and admin can access
CREATE POLICY "sales_calls_vertrieb_admin" ON sales_calls FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
);

-- Follow-ups: Vertrieb and admin can access
CREATE POLICY "follow_ups_vertrieb_admin" ON follow_ups FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
);

-- Trial lessons: Vertrieb and admin can access
CREATE POLICY "trial_lessons_vertrieb_admin" ON trial_lessons FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
);

-- Sales: Vertrieb and admin can access
CREATE POLICY "sales_vertrieb_admin" ON sales FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
);

-- Upsells: Vertrieb and admin can access
CREATE POLICY "upsells_vertrieb_admin" ON upsells FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
);

-- Sales KPIs: Vertrieb and admin can access
CREATE POLICY "sales_kpis_vertrieb_admin" ON sales_kpis FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
);

-- Cal bookings: Vertrieb and admin can access
CREATE POLICY "cal_bookings_vertrieb_admin" ON cal_bookings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
);

-- Insert some default packages
INSERT INTO packages (name, description, hours, price) VALUES
  ('Starter Paket', 'Einstiegspaket für neue Teilnehmer', 10, 590.00),
  ('Standard Paket', 'Unser beliebtestes Paket', 25, 1290.00),
  ('Premium Paket', 'Umfangreiches Paket für intensive Betreuung', 50, 2290.00),
  ('Enterprise Paket', 'Maximale Flexibilität und Betreuung', 100, 3990.00)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_calls_date ON sales_calls(call_date);
CREATE INDEX IF NOT EXISTS idx_sales_calls_vertrieb ON sales_calls(vertrieb_user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_trial_lessons_date ON trial_lessons(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_trial_lessons_status ON trial_lessons(status);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_kpis_date ON sales_kpis(date);
CREATE INDEX IF NOT EXISTS idx_cal_bookings_start ON cal_bookings(start_time);
