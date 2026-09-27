ALTER TABLE public.cal_bookings
  ADD COLUMN IF NOT EXISTS study_location TEXT,
  ADD COLUMN IF NOT EXISTS exam_goal TEXT,
  ADD COLUMN IF NOT EXISTS consultation_wishes TEXT;
