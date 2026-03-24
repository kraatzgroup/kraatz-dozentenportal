-- Dozenten Portal Tutorial FAQs
CREATE TABLE IF NOT EXISTS dozenten_portal_tutorial_faqs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT 'Allgemein',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dozenten_portal_tutorial_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active portal tutorial FAQs"
  ON dozenten_portal_tutorial_faqs FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage portal tutorial FAQs"
  ON dozenten_portal_tutorial_faqs FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_portal_tutorial_faqs_active ON dozenten_portal_tutorial_faqs(is_active, order_index);

-- Dozenten Portal Tutorial Videos
CREATE TABLE IF NOT EXISTS dozenten_portal_tutorial_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT DEFAULT 'Allgemein',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dozenten_portal_tutorial_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active portal tutorial videos"
  ON dozenten_portal_tutorial_videos FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage portal tutorial videos"
  ON dozenten_portal_tutorial_videos FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_portal_tutorial_videos_active ON dozenten_portal_tutorial_videos(is_active, order_index);
