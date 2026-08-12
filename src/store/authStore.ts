import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  fullName: string | null;
  isAdmin: boolean;
  isBuchhaltung: boolean;
  isVerwaltung: boolean;
  isVertrieb: boolean;
  isDozent: boolean;
  isTeilnehmer: boolean;
  isMaterial: boolean;
  userRole: string | null;
  additionalRoles: string[];
  vbLegalAreas: string[];
  isEliteKleingruppe: boolean;
  eliteKleingruppeId: string | null;
  isVbSpringer: boolean;
  isSigningOut: boolean;
  isSettingUser: boolean;
  /** Unix ms timestamp of the last successful server-side session validation. */
  lastValidatedAt: number | null;
  setUser: (user: User | null, force?: boolean) => void;
  setFullName: (fullName: string | null) => void;
  signOut: () => Promise<void>;
  /** Re-fetch session data from server (get_user_session_data RPC) and update store. Returns true on success. */
  validateSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  fullName: null,
  isAdmin: false,
  isBuchhaltung: false,
  isVerwaltung: false,
  isVertrieb: false,
  isDozent: false,
  isTeilnehmer: false,
  isMaterial: false,
  userRole: null,
  additionalRoles: [],
  vbLegalAreas: [],
  isEliteKleingruppe: false,
  eliteKleingruppeId: null,
  isVbSpringer: false,
  isSigningOut: false,
  isSettingUser: false,
  lastValidatedAt: null,
  setFullName: (fullName) => set({ fullName }),
  setUser: (user, force = false) => {
    // Don't set user if we're in the middle of signing out
    const { isSigningOut, isSettingUser, user: currentUser } = get();
    if (isSigningOut && user) {
      console.log('AuthStore: Ignoring user set during sign out process');
      return;
    }

    // Prevent duplicate user setting for the same user.
    // On re-login (force=true) we always re-fetch the profile so that any
    // server-side changes to roles/permissions are picked up fresh.
    if (!force && user && currentUser && user.id === currentUser.id && !isSigningOut) {
      console.log('AuthStore: User already set, skipping duplicate set');
      return;
    }

    // Prevent multiple simultaneous user setting operations
    if (!force && isSettingUser && user) {
      console.log('AuthStore: User setting already in progress, skipping');
      return;
    }

    console.log('AuthStore: Setting user:', user?.email);
    if (user) {
      // Set loading state to prevent duplicate operations
      set({ isSettingUser: true });

      console.log('AuthStore: Fetching profile for user:', user.id);
      (async () => {
        try {
          // Server-side single source of truth: reads profiles + teilnehmer
          // (elite membership) in one SECURITY DEFINER call, bypassing the
          // teilnehmer RLS gap that made the old client-side elite check dead code.
          const { data, error } = await supabase
            .rpc('get_user_session_data')
            .maybeSingle();

          // Check again if we're still not signing out and user hasn't changed
          const currentState = get();
          if (currentState.isSigningOut) {
            console.log('AuthStore: Discarding session data fetch result - sign out in progress');
            set({ isSettingUser: false });
            return;
          }

          console.log('AuthStore: Session data fetch result:', { data, error });
          if (!error && data) {
            const allRoles = [data.role, ...(data.additional_roles || [])];
            console.log('AuthStore: User role:', data.role, 'additional:', data.additional_roles, 'all:', allRoles,
              'elite:', data.is_elite_kleingruppe, 'vbSpringer:', data.vb_springer);

            // Mark user as logged in
            try {
              console.log('AuthStore: Updating last_login timestamp for user:', user.id);
              const { error: loginError } = await supabase.rpc('mark_user_login', {
                user_id: user.id
              });

              if (loginError) {
                console.error('AuthStore: Failed to update login timestamp:', loginError);
              } else {
                console.log('AuthStore: Login timestamp updated successfully');
              }
            } catch (loginError) {
              console.error('AuthStore: Error updating login timestamp:', loginError);
            }

            set({
              user,
              fullName: data.full_name || null,
              isAdmin: allRoles.includes('admin'),
              isBuchhaltung: allRoles.includes('buchhaltung'),
              isVerwaltung: allRoles.includes('verwaltung'),
              isVertrieb: allRoles.includes('vertrieb'),
              isDozent: allRoles.includes('dozent'),
              isTeilnehmer: allRoles.includes('teilnehmer'),
              isMaterial: allRoles.includes('material'),
              userRole: data.role,
              additionalRoles: data.additional_roles || [],
              vbLegalAreas: data.vb_legal_areas || [],
              isEliteKleingruppe: data.is_elite_kleingruppe === true,
              eliteKleingruppeId: data.elite_kleingruppe_id || null,
              isVbSpringer: data.vb_springer === true,
              lastValidatedAt: Date.now(),
              isSettingUser: false
            });
            console.log('AuthStore: User state updated successfully');
          } else {
            console.error('AuthStore: Error fetching session data:', error);
            set({
              user,
              fullName: null,
              isAdmin: false,
              isBuchhaltung: false,
              isVerwaltung: false,
              isVertrieb: false,
              isDozent: false,
              isTeilnehmer: false,
              isMaterial: false,
              userRole: null,
              additionalRoles: [],
              vbLegalAreas: [],
              isEliteKleingruppe: false,
              eliteKleingruppeId: null,
              isVbSpringer: false,
              isSettingUser: false
            });
          }
        } catch (err: unknown) {
          console.error('AuthStore: Unexpected error fetching session data:', err);
          const currentState = get();
          if (!currentState.isSigningOut) {
            set({
              user,
              fullName: null,
              isAdmin: false,
              isBuchhaltung: false,
              isVerwaltung: false,
              isVertrieb: false,
              isDozent: false,
              isTeilnehmer: false,
              isMaterial: false,
              userRole: null,
              additionalRoles: [],
              vbLegalAreas: [],
              isEliteKleingruppe: false,
              eliteKleingruppeId: null,
              isVbSpringer: false,
              isSettingUser: false
            });
          } else {
            set({ isSettingUser: false });
          }
        }
      })();
    } else {
      console.log('AuthStore: Clearing user');
      set({
        user: null,
        isAdmin: false,
        isBuchhaltung: false,
        isVerwaltung: false,
        isVertrieb: false,
        isDozent: false,
        isTeilnehmer: false,
        isMaterial: false,
        userRole: null,
        additionalRoles: [],
        vbLegalAreas: [],
        isEliteKleingruppe: false,
        eliteKleingruppeId: null,
        isVbSpringer: false,
        isSettingUser: false
      });
    }
  },
  signOut: async () => {
    console.log('AuthStore: Starting sign out process');

    // Set signing out flag to prevent re-authentication
    set({ isSigningOut: true });

    try {
      // Clear local state immediately
      set({
        user: null,
        isAdmin: false,
        isBuchhaltung: false,
        isVerwaltung: false,
        isVertrieb: false,
        isDozent: false,
        isTeilnehmer: false,
        isMaterial: false,
        userRole: null,
        additionalRoles: [],
        vbLegalAreas: [],
        isEliteKleingruppe: false,
        eliteKleingruppeId: null,
        isVbSpringer: false,
        isSigningOut: true,
        isSettingUser: false
      });

      // Sign out from Supabase (local scope just clears the local session)
      const { error } = await supabase.auth.signOut({ scope: 'local' });

      // Explicitly remove all Supabase auth storage entries to prevent re-auth on reload
      try {
        const keysToRemove = Object.keys(localStorage).filter(k =>
          k.startsWith('sb-') || k.includes('supabase') || k.includes('auth-token')
        );
        keysToRemove.forEach(k => localStorage.removeItem(k));
        const sessionKeys = Object.keys(sessionStorage).filter(k =>
          k.startsWith('sb-') || k.includes('supabase') || k.includes('auth-token')
        );
        sessionKeys.forEach(k => sessionStorage.removeItem(k));
      } catch (e) {
        console.log('AuthStore: Error clearing storage, continuing', e);
      }
      
      if (error) {
        // Check if this is a session-related error that we can safely ignore
        const isSessionError = error.message?.includes('session_not_found') || 
                              error.message?.includes('Auth session missing') ||
                              (error as any).status === 403 ||
                              (error as any).code === 'session_not_found';
        
        if (isSessionError) {
          console.log('AuthStore: Session already expired, sign out completed locally');
        } else {
          console.error('AuthStore: Sign out error:', error);
          // Don't throw the error, just log it and continue with local cleanup
        }
      } else {
        console.log('AuthStore: Successfully signed out from Supabase');
      }
    } catch (error) {
      // Handle any unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isSessionError = errorMessage.includes('session_not_found') || 
                            errorMessage.includes('Auth session missing') ||
                            (error && typeof error === 'object' && 'status' in error && (error as any).status === 403) ||
                            (error && typeof error === 'object' && 'code' in error && (error as any).code === 'session_not_found');
      
      if (isSessionError) {
        console.log('AuthStore: Session error during sign out, completed locally:', errorMessage);
      } else {
        console.error('AuthStore: Unexpected error during sign out:', error);
      }
    } finally {
      // Always reset to clean state after sign out completes
      set({
        user: null,
        isAdmin: false,
        isBuchhaltung: false,
        isVerwaltung: false,
        isVertrieb: false,
        isDozent: false,
        isTeilnehmer: false,
        isMaterial: false,
        userRole: null,
        additionalRoles: [],
        vbLegalAreas: [],
        isEliteKleingruppe: false,
        eliteKleingruppeId: null,
        isVbSpringer: false,
        isSigningOut: false,
        isSettingUser: false
      });
      console.log('AuthStore: Sign out process completed, redirecting to /login');
      // Hard redirect to login page
      window.location.href = '/login';
    }
  },
  validateSession: async () => {
    const { isSigningOut, user } = get();
    if (isSigningOut || !user) {
      console.log('AuthStore: validateSession skipped (signing out or no user)');
      return false;
    }

    try {
      console.log('AuthStore: validateSession — re-fetching from server');
      const { data, error } = await supabase
        .rpc('get_user_session_data')
        .maybeSingle();

      if (error || !data) {
        console.error('AuthStore: validateSession failed:', error);
        return false;
      }

      const allRoles = [data.role, ...(data.additional_roles || [])];
      console.log('AuthStore: validateSession success:', { role: data.role, additional: data.additional_roles, elite: data.is_elite_kleingruppe });

      set({
        fullName: data.full_name || null,
        isAdmin: allRoles.includes('admin'),
        isBuchhaltung: allRoles.includes('buchhaltung'),
        isVerwaltung: allRoles.includes('verwaltung'),
        isVertrieb: allRoles.includes('vertrieb'),
        isDozent: allRoles.includes('dozent'),
        isTeilnehmer: allRoles.includes('teilnehmer'),
        isMaterial: allRoles.includes('material'),
        userRole: data.role,
        additionalRoles: data.additional_roles || [],
        vbLegalAreas: data.vb_legal_areas || [],
        isEliteKleingruppe: data.is_elite_kleingruppe === true,
        eliteKleingruppeId: data.elite_kleingruppe_id || null,
        isVbSpringer: data.vb_springer === true,
        lastValidatedAt: Date.now(),
      });
      return true;
    } catch (err) {
      console.error('AuthStore: validateSession unexpected error:', err);
      return false;
    }
  },
}));