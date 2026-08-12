/**
 * useSessionValidator — App-root hook that keeps the auth store in sync with
 * the server. It sets up multiple re-validation triggers:
 *
 * 1. Initial validation on mount (after session is restored)
 * 2. On auth state changes (SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED)
 * 3. On window focus (catches role changes made in another tab/admin panel)
 * 4. Periodically every REVALIDATE_INTERVAL_MS (catches role changes while
 *    the tab stays open and focused)
 *
 * This works TOGETHER with RoleGuard: the guard validates on every route
 * change, this hook validates on external triggers. Together they ensure the
 * store is NEVER stale enough to show the wrong UI.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

/** Periodic re-validation interval (5 minutes). */
const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;

/** Minimum time between focus-triggered re-validations (10 seconds). */
const FOCUS_THROTTLE_MS = 10_000;

export function useSessionValidator() {
  const lastFocusValidation = useRef<number>(0);
  const { user, validateSession, setUser } = useAuthStore();

  // ─── 1. Initial validation + auth state listener ───────────────────────
  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user, true);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 SessionValidator: Auth event:', event, session?.user?.email);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const currentUser = useAuthStore.getState().user;
        // Only act if the user actually changed, or force re-validation
        if (event === 'SIGNED_IN' && currentUser?.id === session?.user?.id) {
          // Same user re-signed-in (e.g. tab focus) — just re-validate roles
          console.log('🔄 SessionValidator: Same user, re-validating roles');
          validateSession();
          return;
        }
        if (session?.user) {
          setUser(session.user, true);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, validateSession]);

  // ─── 2. Re-validate on window focus ────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusValidation.current < FOCUS_THROTTLE_MS) return;
      lastFocusValidation.current = now;
      console.log('🔄 SessionValidator: Window focus — re-validating');
      validateSession();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, validateSession]);

  // ─── 3. Periodic re-validation ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      console.log('🔄 SessionValidator: Periodic re-validation');
      validateSession();
    }, REVALIDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user, validateSession]);

  // ─── 4. Re-validate on online event (catches reconnection) ─────────────
  useEffect(() => {
    if (!user) return;

    const handleOnline = () => {
      console.log('🔄 SessionValidator: Back online — re-validating');
      validateSession();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, validateSession]);
}
