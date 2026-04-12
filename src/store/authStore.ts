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
  isSigningOut: boolean;
  isSettingUser: boolean;
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
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
  isSigningOut: false,
  isSettingUser: false,
  setUser: (user) => {
    // Don't set user if we're in the middle of signing out
    const { isSigningOut, isSettingUser, user: currentUser } = get();
    if (isSigningOut && user) {
      console.log('AuthStore: Ignoring user set during sign out process');
      return;
    }

    // Prevent duplicate user setting for the same user
    if (user && currentUser && user.id === currentUser.id && !isSigningOut) {
      console.log('AuthStore: User already set, skipping duplicate set');
      return;
    }

    // Prevent multiple simultaneous user setting operations
    if (isSettingUser && user) {
      console.log('AuthStore: User setting already in progress, skipping');
      return;
    }

    console.log('AuthStore: Setting user:', user?.email);
    if (user) {
      // Set loading state to prevent duplicate operations
      set({ isSettingUser: true });

      console.log('AuthStore: Fetching profile for user:', user.id);
      supabase
        .from('profiles')
        .select('role, additional_roles, full_name')
        .eq('id', user.id)
        .single()
        .then(async ({ data, error }) => {
          // Check again if we're still not signing out and user hasn't changed
          const currentState = get();
          if (currentState.isSigningOut) {
            console.log('AuthStore: Discarding profile fetch result - sign out in progress');
            set({ isSettingUser: false });
            return;
          }

          console.log('AuthStore: Profile fetch result:', { data, error });
          if (!error && data) {
            const allRoles = [data.role, ...(data.additional_roles || [])];
            console.log('AuthStore: User role:', data.role, 'additional:', data.additional_roles, 'all:', allRoles);
            
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
              isSettingUser: false
            });
            console.log('AuthStore: User state updated successfully');
          } else {
            console.error('AuthStore: Error fetching user profile:', error);
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
              isSettingUser: false
            });
          }
        })
        .catch((err) => {
          console.error('AuthStore: Unexpected error fetching profile:', err);
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
              isSettingUser: false
            });
          } else {
            set({ isSettingUser: false });
          }
        });
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
        isSigningOut: true,
        isSettingUser: false
      });
      
      // Clear any stored session data
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      
      // Try to sign out from Supabase
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      
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
        isSigningOut: false,
        isSettingUser: false
      });
      console.log('AuthStore: Sign out process completed');
    }
  },
}));