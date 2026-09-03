import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export const POST_CREDIT_VIDEO_URL =
  'https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/nach%20dem%20ersten%20Creditmp4.mp4';

interface PostCreditVideoState {
  /** Whether the video modal should be shown right now. */
  shouldShow: boolean;
  /** Whether all checks have completed (loading). */
  loading: boolean;
  /** Dismiss the modal and record the watch duration. */
  dismiss: (watchDurationSeconds: number) => Promise<void>;
}

/**
 * Determines whether the post-first-credit upsell video should be shown
 * to the current user after login.
 *
 * Conditions (all must be true):
 *  1. User has a test credit (Sonderangebot) — a vb_order with total_cents = 0
 *  2. User has at least one case study request where the correction was
 *     received (status 'corrected' or 'completed') AND opened by the user
 *     (correction_viewed_at is set)
 *  3. No additional paid credits (total_cents > 0) were purchased within
 *     24 hours after the test credit was granted
 *  4. The video has not been shown to this user before
 *     (no row in vb_post_credit_video_views)
 */
export const usePostCreditVideo = (): PostCreditVideoState => {
  const user = useAuthStore(state => state.user);
  const additionalRoles = useAuthStore(state => state.additionalRoles);
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkConditions = useCallback(async () => {
    if (!user) {
      setShouldShow(false);
      setLoading(false);
      return;
    }

    // Only for VB teilnehmer (videobesprechung role)
    if (!additionalRoles?.includes('videobesprechung')) {
      setShouldShow(false);
      setLoading(false);
      return;
    }

    try {
      // 4. Check if video was already shown (shown_at IS NOT NULL means
      //    the user already closed the video modal → never show again)
      const { data: existingView } = await supabase
        .from('vb_post_credit_video_views')
        .select('profile_id, shown_at')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (existingView?.shown_at) {
        setShouldShow(false);
        setLoading(false);
        return;
      }

      // 1. Check for test credit (total_cents = 0, completed order)
      const { data: testCreditOrders } = await supabase
        .from('vb_orders')
        .select('id, case_study_count, total_cents, created_at')
        .eq('profile_id', user.id)
        .eq('status', 'completed')
        .eq('total_cents', 0)
        .order('created_at', { ascending: true });

      if (!testCreditOrders || testCreditOrders.length === 0) {
        setShouldShow(false);
        setLoading(false);
        return;
      }

      const testCredit = testCreditOrders[0];
      const testCreditCreatedAt = new Date(testCredit.created_at);

      // 3. Check no paid credits purchased within 24h after test credit
      const twentyFourHoursLater = new Date(testCreditCreatedAt);
      twentyFourHoursLater.setHours(twentyFourHoursLater.getHours() + 24);

      const { data: paidOrders } = await supabase
        .from('vb_orders')
        .select('id, total_cents, created_at')
        .eq('profile_id', user.id)
        .eq('status', 'completed')
        .gt('total_cents', 0)
        .gte('created_at', testCredit.created_at)
        .lte('created_at', twentyFourHoursLater.toISOString());

      if (paidOrders && paidOrders.length > 0) {
        setShouldShow(false);
        setLoading(false);
        return;
      }

      // 2. Check if first sachverhalt correction was received AND opened
      const { data: caseStudies } = await supabase
        .from('vb_case_study_requests')
        .select('id, status, correction_viewed_at')
        .eq('profile_id', user.id)
        .in('status', ['corrected', 'completed'])
        .not('correction_viewed_at', 'is', null);

      if (!caseStudies || caseStudies.length === 0) {
        setShouldShow(false);
        setLoading(false);
        return;
      }

      // All conditions met — show the video
      setShouldShow(true);
      setLoading(false);
    } catch (err) {
      console.error('usePostCreditVideo: Error checking conditions:', err);
      setShouldShow(false);
      setLoading(false);
    }
  }, [user, additionalRoles]);

  useEffect(() => {
    checkConditions();
  }, [checkConditions]);

  const dismiss = useCallback(async (watchDurationSeconds: number) => {
    if (!user) return;
    setShouldShow(false);
    try {
      const now = new Date().toISOString();
      const roundedSeconds = Math.round(watchDurationSeconds);

      // Check if a row already exists (e.g. email_sent_at set by cron)
      const { data: existing } = await supabase
        .from('vb_post_credit_video_views')
        .select('profile_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update only shown_at + watch_duration, preserve email_sent_at
        await supabase
          .from('vb_post_credit_video_views')
          .update({
            shown_at: now,
            watch_duration_seconds: roundedSeconds,
          })
          .eq('profile_id', user.id);
      } else {
        // Insert new row
        await supabase
          .from('vb_post_credit_video_views')
          .insert({
            profile_id: user.id,
            shown_at: now,
            watch_duration_seconds: roundedSeconds,
          });
      }
    } catch (err) {
      console.error('usePostCreditVideo: Error recording video view:', err);
    }
  }, [user]);

  return { shouldShow, loading, dismiss };
};
