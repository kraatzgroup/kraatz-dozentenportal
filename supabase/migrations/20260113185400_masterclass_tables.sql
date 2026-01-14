-- Masterclass Chapters (Kapitel)
CREATE TABLE IF NOT EXISTS masterclass_chapters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Masterclass Lessons (Lektionen)
CREATE TABLE IF NOT EXISTS masterclass_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID NOT NULL REFERENCES masterclass_chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  video_duration INTEGER, -- in seconds
  position INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Masterclass Attachments (Anhänge - PDFs, Links, etc.)
CREATE TABLE IF NOT EXISTS masterclass_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES masterclass_lessons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'link', 'video', 'file')),
  url TEXT NOT NULL,
  file_path TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dozent Progress Tracking (welche Lektionen hat ein Dozent gesehen)
CREATE TABLE IF NOT EXISTS masterclass_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES masterclass_lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_position INTEGER DEFAULT 0, -- video position in seconds
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_masterclass_lessons_chapter ON masterclass_lessons(chapter_id);
CREATE INDEX IF NOT EXISTS idx_masterclass_attachments_lesson ON masterclass_attachments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_masterclass_progress_user ON masterclass_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_masterclass_progress_lesson ON masterclass_progress(lesson_id);

-- RLS Policies
ALTER TABLE masterclass_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE masterclass_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE masterclass_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE masterclass_progress ENABLE ROW LEVEL SECURITY;

-- Chapters: Admins can manage, all authenticated users can view published
CREATE POLICY "Admins can manage chapters" ON masterclass_chapters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'buchhaltung'))
  );

CREATE POLICY "Users can view published chapters" ON masterclass_chapters
  FOR SELECT USING (is_published = true OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'buchhaltung')));

-- Lessons: Admins can manage, all authenticated users can view published
CREATE POLICY "Admins can manage lessons" ON masterclass_lessons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'buchhaltung'))
  );

CREATE POLICY "Users can view published lessons" ON masterclass_lessons
  FOR SELECT USING (
    is_published = true 
    AND EXISTS (SELECT 1 FROM masterclass_chapters WHERE id = chapter_id AND is_published = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'buchhaltung'))
  );

-- Attachments: Admins can manage, users can view if lesson is published
CREATE POLICY "Admins can manage attachments" ON masterclass_attachments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'buchhaltung'))
  );

CREATE POLICY "Users can view attachments of published lessons" ON masterclass_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM masterclass_lessons l 
      JOIN masterclass_chapters c ON l.chapter_id = c.id 
      WHERE l.id = lesson_id AND l.is_published = true AND c.is_published = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'buchhaltung'))
  );

-- Progress: Users can manage their own progress
CREATE POLICY "Users can manage own progress" ON masterclass_progress
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins can view all progress" ON masterclass_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'buchhaltung'))
  );
