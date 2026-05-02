import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Teilnehmer {
  id: string;
  name: string;
  email: string;
  active_since: string;
  created_at: string;
  updated_at: string;
  elite_kleingruppe?: boolean;
  contract_start?: string;
  contract_end?: string;
  booked_hours?: number;
  completed_hours?: number;
  legal_areas?: string[];
  first_name?: string;
  last_name?: string;
  study_goal?: string;
  exam_date?: string;
  state_law?: string;
  package_id?: string;
  source?: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
  phone?: string;
  dozent_id?: string;
  dozent_zivilrecht_id?: string;
  dozent_strafrecht_id?: string;
  dozent_oeffentliches_recht_id?: string;
  hours_zivilrecht?: number;
  hours_strafrecht?: number;
  hours_oeffentliches_recht?: number;
  frequency_type?: string;
  frequency_hours_zivilrecht?: number;
  frequency_hours_strafrecht?: number;
  frequency_hours_oeffentliches_recht?: number;
}

interface TeilnehmerState {
  teilnehmer: Teilnehmer[];
  isLoading: boolean;
  error: string | null;
  subscription: RealtimeChannel | null;
  fetchTeilnehmer: () => Promise<void>;
  createTeilnehmer: (data: { name: string; email: string; active_since: string }) => Promise<void>;
  updateTeilnehmer: (id: string, data: { name: string; email: string; active_since: string }) => Promise<void>;
  deleteTeilnehmer: (id: string) => Promise<void>;
  setupRealtimeSubscription: () => void;
  cleanupSubscription: () => void;
}

export const useTeilnehmerStore = create<TeilnehmerState>((set, get) => ({
  teilnehmer: [],
  isLoading: false,
  error: null,
  subscription: null,

  setupRealtimeSubscription: () => {
    const { subscription } = get();
    if (subscription) {
      console.log('🔄 Teilnehmer subscription already exists, skipping setup');
      return;
    }

    console.log('🔔 Setting up teilnehmer real-time subscription');
    const newSubscription = supabase
      .channel('teilnehmer-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teilnehmer'
      }, (payload) => {
        console.log('🔔 Teilnehmer change detected:', payload);
        // Refresh the teilnehmer list when any change occurs
        get().fetchTeilnehmer();
      })
      .subscribe();

    set({ subscription: newSubscription });
  },

  cleanupSubscription: () => {
    const { subscription } = get();
    if (subscription) {
      console.log('🧹 Cleaning up teilnehmer subscription');
      subscription.unsubscribe();
      set({ subscription: null });
    }
  },

  fetchTeilnehmer: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('🔍 Starting fetchTeilnehmer...');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('❌ No authenticated user found, skipping teilnehmer fetch');
        set({ teilnehmer: [], isLoading: false });
        return;
      }
      console.log('✅ User found:', user.id);

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      const isAdmin = profile?.role === 'admin';
      console.log('👤 User role:', profile?.role, 'isAdmin:', isAdmin);
      
      if (isAdmin) {
        // Admins see all teilnehmer
        console.log('🔍 Admin: Fetching all teilnehmer...');
        const { data, error } = await supabase
          .from('teilnehmer')
          .select('*')
          .order('name', { ascending: true });
        
        if (error) throw error;
        console.log('✅ Admin: Found', data?.length || 0, 'teilnehmer');
        set({ teilnehmer: data || [] });
      } else {
        // Dozents see teilnehmer where they are assigned via any field OR where they added hours in last 6 months
        console.log('🔍 Dozent: Fetching own teilnehmer...');
        const [legacyResult, zivilResult, strafResult, oeffResult] = await Promise.all([
          supabase.from('teilnehmer').select('*').eq('dozent_id', user.id),
          supabase.from('teilnehmer').select('*').eq('dozent_zivilrecht_id', user.id),
          supabase.from('teilnehmer').select('*').eq('dozent_strafrecht_id', user.id),
          supabase.from('teilnehmer').select('*').eq('dozent_oeffentliches_recht_id', user.id)
        ]);

        const error = legacyResult.error || zivilResult.error || strafResult.error || oeffResult.error;
        if (error) throw error;

        // Combine and deduplicate by id
        const allData = [
          ...(legacyResult.data || []),
          ...(zivilResult.data || []),
          ...(strafResult.data || []),
          ...(oeffResult.data || [])
        ];
        const uniqueMap = new Map();
        allData.forEach(t => uniqueMap.set(t.id, t));

        // Fetch participants where dozent added hours in last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const { data: hoursTeilnehmer } = await supabase
          .from('participant_hours')
          .select('teilnehmer_id')
          .eq('dozent_id', user.id)
          .gte('date', sixMonthsAgo.toISOString().split('T')[0]);

        if (hoursTeilnehmer && hoursTeilnehmer.length > 0) {
          const teilnehmerIds = hoursTeilnehmer.map(h => h.teilnehmer_id);
          const { data: additionalTeilnehmer } = await supabase
            .from('teilnehmer')
            .select('*')
            .in('id', teilnehmerIds);

          if (additionalTeilnehmer) {
            additionalTeilnehmer.forEach(t => uniqueMap.set(t.id, t));
          }
        }

        const data = Array.from(uniqueMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        console.log('✅ Dozent: Found', data.length, 'teilnehmer');
        set({ teilnehmer: data });
      }
    } catch (error: any) {
      console.error('❌ Error in fetchTeilnehmer:', error);
      set({ error: error.message });
      console.error('Error fetching teilnehmer:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  createTeilnehmer: async (data) => {
    set({ isLoading: true, error: null });
    try {
      console.log('🔍 Creating teilnehmer with data:', data);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      console.log('✅ User authenticated:', user.id);

      const { error } = await supabase
        .from('teilnehmer')
        .insert([{ ...data, dozent_id: user.id }]);

      if (error) {
        console.error('❌ Insert error:', error);
        throw error;
      }
      console.log('✅ Teilnehmer created successfully');
      
      // Refresh the list
      console.log('🔄 Refreshing teilnehmer list...');
      await get().fetchTeilnehmer();
      console.log('✅ List refreshed');
    } catch (error: any) {
      console.error('❌ Error in createTeilnehmer:', error);
      set({ error: error.message });
      console.error('Error creating teilnehmer:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateTeilnehmer: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('teilnehmer')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      
      // Update local state
      set(state => ({
        teilnehmer: state.teilnehmer.map(t => 
          t.id === id ? { ...t, ...data, updated_at: new Date().toISOString() } : t
        )
      }));
    } catch (error: any) {
      set({ error: error.message });
      console.error('Error updating teilnehmer:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteTeilnehmer: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('teilnehmer')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Update local state
      set(state => ({
        teilnehmer: state.teilnehmer.filter(t => t.id !== id)
      }));
    } catch (error: any) {
      set({ error: error.message });
      console.error('Error deleting teilnehmer:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
}));