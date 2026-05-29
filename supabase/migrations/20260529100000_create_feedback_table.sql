-- Create feedback_responses table for Typeform survey
CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Question 1: Name
  q1_first_name TEXT,
  q1_last_name TEXT,
  
  -- Question 2: How did you hear about us
  q2_source TEXT,
  
  -- Question 3: Quality of exams (rating 1-6)
  q3_exam_quality INTEGER CHECK (q3_exam_quality BETWEEN 1 AND 6),
  
  -- Question 4: Help with understanding
  q4_exam_help TEXT,
  
  -- Question 5: What could be better (conditional)
  q5_exam_improvement TEXT,
  
  -- Question 6: Quality of additional materials (rating 1-6)
  q6_material_quality INTEGER CHECK (q6_material_quality BETWEEN 1 AND 6),
  
  -- Question 7: Help with understanding materials
  q7_material_help TEXT,
  
  -- Question 8: Enjoy individual teaching
  q8_enjoy_individual TEXT,
  
  -- Question 9: Learn more than group course
  q9_more_than_group TEXT,
  
  -- Question 10: Kraatz Club videos (rating 1-6)
  q10_video_quality INTEGER CHECK (q10_video_quality BETWEEN 1 AND 6),
  
  -- Question 11: Video improvement (conditional)
  q11_video_improvement TEXT,
  
  -- Question 12: Appointment and materials timing
  q12_timing_works TEXT,
  
  -- Question 13: Timing improvement (conditional)
  q13_timing_improvement TEXT,
  
  -- Question 14: Zivilrecht - Didaktik (rating 1-6)
  q14_zivil_didaktik INTEGER CHECK (q14_zivil_didaktik BETWEEN 1 AND 6),
  
  -- Question 15: Zivilrecht - Freundlichkeit (rating 1-6)
  q15_zivil_freundlichkeit INTEGER CHECK (q15_zivil_freundlichkeit BETWEEN 1 AND 6),
  
  -- Question 16: Zivilrecht - Souveränität (rating 1-6)
  q16_zivil_souveranitaet INTEGER CHECK (q16_zivil_souveranitaet BETWEEN 1 AND 6),
  
  -- Question 17: Zivilrecht - Other comments
  q17_zivil_comments TEXT,
  
  -- Question 18: Öffentliches Recht - Didaktik (rating 1-6)
  q18_oef_didaktik INTEGER CHECK (q18_oef_didaktik BETWEEN 1 AND 6),
  
  -- Question 19: Öffentliches Recht - Freundlichkeit (rating 1-6)
  q19_oef_freundlichkeit INTEGER CHECK (q19_oef_freundlichkeit BETWEEN 1 AND 6),
  
  -- Question 20: Öffentliches Recht - Souveränität (rating 1-6)
  q20_oef_souveranitaet INTEGER CHECK (q20_oef_souveranitaet BETWEEN 1 AND 6),
  
  -- Question 21: Öffentliches Recht - Other comments
  q21_oef_comments TEXT,
  
  -- Question 22: Strafrecht - Didaktik (rating 1-6)
  q22_straf_didaktik INTEGER CHECK (q22_straf_didaktik BETWEEN 1 AND 6),
  
  -- Question 23: Strafrecht - Freundlichkeit (rating 1-6)
  q23_straf_freundlichkeit INTEGER CHECK (q23_straf_freundlichkeit BETWEEN 1 AND 6),
  
  -- Question 24: Strafrecht - Souveränität (rating 1-6)
  q24_straf_souveranitaet INTEGER CHECK (q24_straf_souveranitaet BETWEEN 1 AND 6),
  
  -- Question 25: Strafrecht - Other comments
  q25_straf_comments TEXT,
  
  -- Question 26: Would recommend
  q26_recommend TEXT,
  
  -- Question 27: Why not recommend (conditional)
  q27_not_recommend_reason TEXT,
  
  -- Question 28: Final comments
  q28_final_comments TEXT
);

-- Enable RLS
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (public survey)
CREATE POLICY "Anyone can insert feedback" ON feedback_responses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow admins to view all feedback
CREATE POLICY "Admins can view all feedback" ON feedback_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'buchhaltung', 'verwaltung')
    )
  );

-- Create index for faster queries
CREATE INDEX idx_feedback_created_at ON feedback_responses(created_at DESC);
