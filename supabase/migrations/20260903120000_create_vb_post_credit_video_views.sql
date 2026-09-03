-- Tracking table for the post-first-credit upsell video.
--
-- Records whether a user has already seen the video that is shown after
-- they received the test credit (Sonderangebot), opened their first
-- correction, and did not purchase additional credits within 24 hours.
-- One row per profile (shown once, never again).
--
-- Lifecycle:
--   1. Cron edge function detects eligible user → inserts row with
--      email_sent_at = NOW(), shown_at = NULL → sends email with magic link
--   2. User clicks magic link → logs in → PostCreditVideoModal shows video
--   3. User closes video → row updated with shown_at = NOW(),
--      watch_duration_seconds = X
--   4. Future logins: modal sees shown_at IS NOT NULL → never shows again

CREATE TABLE IF NOT EXISTS public.vb_post_credit_video_views (
  profile_id            UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_sent_at         TIMESTAMPTZ,
  shown_at              TIMESTAMPTZ,
  watch_duration_seconds INTEGER NOT NULL DEFAULT 0,
  video_url             TEXT NOT NULL DEFAULT 'https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/nach%20dem%20ersten%20Creditmp4.mp4'
);

COMMENT ON TABLE public.vb_post_credit_video_views IS
  'Tracks the post-first-credit upsell video lifecycle: email_sent_at (email dispatched by cron), shown_at (video modal closed by user), watch_duration_seconds. One row per profile.';

-- RLS: users can only read/insert/update their own row
ALTER TABLE public.vb_post_credit_video_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own video view" ON public.vb_post_credit_video_views;
CREATE POLICY "Users can read own video view"
  ON public.vb_post_credit_video_views
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own video view" ON public.vb_post_credit_video_views;
CREATE POLICY "Users can insert own video view"
  ON public.vb_post_credit_video_views
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own video view" ON public.vb_post_credit_video_views;
CREATE POLICY "Users can update own video view"
  ON public.vb_post_credit_video_views
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Grant service_role full access (for the cron edge function)
GRANT ALL ON public.vb_post_credit_video_views TO service_role;
