import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'buchhaltung' | 'verwaltung' | 'vertrieb' | 'dozent' | 'teilnehmer';
  additional_roles?: string[];
  profile_picture_url?: string | null;
  last_login?: string | null;
  created_at?: string;
}

interface UserState {
  users: User[];
  isLoading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  createUser: (userData: { email: string; password: string; fullName: string; role?: string }) => Promise<void>;
  updateUser: (id: string, data: { fullName: string; role?: string; additional_roles?: string[] }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  isLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('UserStore: Fetching users with all fields');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, additional_roles, profile_picture_url, last_login, created_at, title, first_name, last_name, phone, legal_areas, street, house_number, postal_code, city, iban, bic, bank_name, tax_id, hourly_rate_unterricht, hourly_rate_elite, hourly_rate_elite_korrektur, hourly_rate_sonstige')
        .eq('is_archived', false)
        .order('role', { ascending: false })
        .order('full_name', { ascending: true });

      if (error) {
        console.error('UserStore: Error fetching users:', error);
        throw error;
      }
      
      console.log('UserStore: Users fetched successfully:', data?.length || 0);
      set({ users: data || [] });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createUser: async ({ email, password, fullName, role = 'dozent' }) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Creating user with:', { email, fullName, role, passwordProvided: !!password });
      
      // Try edge function first for user creation with random password
      try {
        console.log('Attempting to call create-user edge function...');
        const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
        
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: email,
            fullName: fullName,
            role: role
          }),
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          console.log('User created successfully via edge function:', result);
          await get().fetchUsers();
          return;
        } else {
          console.warn('Edge function failed, falling back to direct creation');
          throw new Error(result.error || 'Edge function failed');
        }
      } catch (edgeError) {
        console.warn('Edge function failed, using fallback method:', edgeError);
        
        // Edge function is required for user creation - no fallback available without service key
        throw new Error('Benutzererstellung erfordert Edge Function. Bitte kontaktieren Sie den Administrator.');
      }

      await get().fetchUsers();
    } catch (error: any) {
      console.error('User invitation error:', error);
      
      if (error.message?.includes('User already registered') || error.code === '23505') {
        set({ error: 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits' });
      } else {
        set({ error: `Fehler beim Erstellen des Benutzers: ${error.message}` });
      }
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateUser: async (id: string, data: { fullName: string; role?: string; additional_roles?: string[] }) => {
    set({ isLoading: true, error: null });
    try {
      const updateData: any = { full_name: data.fullName };
      if (data.role) {
        updateData.role = data.role;
      }
      if (data.additional_roles !== undefined) {
        updateData.additional_roles = data.additional_roles;
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      await get().fetchUsers();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteUser: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      // First delete the profile to trigger cascading deletes
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (profileError) throw profileError;

      // Auth user deletion requires Edge Function
      // For now, just delete the profile - the auth user will be orphaned but harmless
      console.warn('Auth user deletion requires Edge Function - only profile deleted');

      // Refresh the users list
      await get().fetchUsers();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  resetPassword: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Sending password reset email to:', email);

      // Try edge function first for password reset with generated password
      try {
        console.log('Attempting to call send-password-reset edge function...');
        const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-password-reset`;
        
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: email
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
          console.log('Password reset email sent successfully via edge function');
          return;
        } else {
          throw new Error(result.error || 'Edge function failed');
        }
      } catch (edgeError) {
        console.warn('Edge function failed, falling back to Supabase reset:', edgeError);
        
        // Fallback to Supabase's built-in password reset
        const redirectUrl = window.location.origin;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl
        });
        
        if (error) throw error;
        console.log('Password reset email sent successfully via Supabase');
      }
    } catch (error: any) {
      console.error('Password reset error details:', error);
      
      // Handle different types of email service errors with more specific messaging
      if (error.message?.includes('rate limit') || error.message?.includes('over_email_send_rate_limit')) {
        set({ error: 'E-Mail-Versandlimit erreicht. Bitte warten Sie einige Minuten und versuchen Sie es erneut.' });
      } else if (error.message?.includes('User not found') || error.message?.includes('Benutzer nicht gefunden') || error.message?.includes('Invalid login credentials') || error.message?.includes('not found')) {
        set({ error: 'Benutzer mit dieser E-Mail-Adresse wurde nicht gefunden.' });
      } else if (error.message?.includes('Email service') || error.status === 500) {
        set({ error: 'E-Mail-Service ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.' });
      } else {
        set({ error: error.message || 'Fehler beim Zurücksetzen des Passworts' });
      }
      throw error;
    } finally {
      set({ isLoading: false });
    }
  }
}));