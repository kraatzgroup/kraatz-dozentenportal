-- Migration: Add Support Tables for Elite-Kleingruppe (FAQ and Videos)
-- Created: March 9, 2026

-- Create table for FAQs
CREATE TABLE IF NOT EXISTS elite_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT 'Allgemein',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for Support Videos
CREATE TABLE IF NOT EXISTS elite_support_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_elite_faqs_is_active ON elite_faqs(is_active);
CREATE INDEX IF NOT EXISTS idx_elite_faqs_order_index ON elite_faqs(order_index);
CREATE INDEX IF NOT EXISTS idx_elite_faqs_category ON elite_faqs(category);

CREATE INDEX IF NOT EXISTS idx_elite_support_videos_is_active ON elite_support_videos(is_active);
CREATE INDEX IF NOT EXISTS idx_elite_support_videos_order_index ON elite_support_videos(order_index);
CREATE INDEX IF NOT EXISTS idx_elite_support_videos_category ON elite_support_videos(category);

-- Enable Row Level Security
ALTER TABLE elite_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE elite_support_videos ENABLE ROW LEVEL SECURITY;

-- Create policies for elite_faqs
CREATE POLICY "Allow select for all authenticated users"
  ON elite_faqs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for admin users"
  ON elite_faqs FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.additional_roles @> ARRAY['admin'])
  ));

CREATE POLICY "Allow update for admin users"
  ON elite_faqs FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.additional_roles @> ARRAY['admin'])
  ));

CREATE POLICY "Allow delete for admin users"
  ON elite_faqs FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.additional_roles @> ARRAY['admin'])
  ));

-- Create policies for elite_support_videos
CREATE POLICY "Allow select for all authenticated users"
  ON elite_support_videos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for admin users"
  ON elite_support_videos FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.additional_roles @> ARRAY['admin'])
  ));

CREATE POLICY "Allow update for admin users"
  ON elite_support_videos FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.additional_roles @> ARRAY['admin'])
  ));

CREATE POLICY "Allow delete for admin users"
  ON elite_support_videos FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.additional_roles @> ARRAY['admin'])
  ));

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_elite_faqs_updated_at ON elite_faqs;
CREATE TRIGGER update_elite_faqs_updated_at
  BEFORE UPDATE ON elite_faqs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_elite_support_videos_updated_at ON elite_support_videos;
CREATE TRIGGER update_elite_support_videos_updated_at
  BEFORE UPDATE ON elite_support_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE elite_faqs IS 'FAQ entries for Elite-Kleingruppe support section';
COMMENT ON TABLE elite_support_videos IS 'Support videos for Elite-Kleingruppe';
