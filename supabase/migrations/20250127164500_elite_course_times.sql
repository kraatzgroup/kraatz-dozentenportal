-- Create table for Elite-Kleingruppe course times (regular schedule)
CREATE TABLE IF NOT EXISTS elite_course_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6), -- 0 = Monday, 6 = Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  legal_area TEXT NOT NULL CHECK (legal_area IN ('Zivilrecht', 'Strafrecht', 'Öffentliches Recht')),
  description TEXT,
  meeting_link TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE elite_course_times ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything
CREATE POLICY "Admins can manage course times"
  ON elite_course_times
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Everyone can read active course times
CREATE POLICY "Everyone can read active course times"
  ON elite_course_times
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Add index for faster queries
CREATE INDEX idx_elite_course_times_weekday ON elite_course_times(weekday);
CREATE INDEX idx_elite_course_times_legal_area ON elite_course_times(legal_area);
