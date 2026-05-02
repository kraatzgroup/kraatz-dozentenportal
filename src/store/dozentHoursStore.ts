import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface DozentHours {
  id: string;
  dozent_id: string;
  hours: number;
  date: string;
  description: string;
  category?: string;
  status?: string;
  created_at: string;
  updated_at: string;
}

interface DozentHoursState {
  dozentHours: DozentHours[];
  isLoading: boolean;
  error: string | null;
  subscription: RealtimeChannel | null;
  fetchDozentHours: (dozentId?: string, startDate?: string, endDate?: string) => Promise<void>;
  createDozentHours: (data: { hours: number; date: string; description: string; dozent_id?: string; category?: string; exam_type?: string }) => Promise<void>;
  updateDozentHours: (id: string, data: { hours: number; date: string; description: string }) => Promise<void>;
  deleteDozentHours: (id: string) => Promise<void>;
  setupRealtimeSubscription: () => void;
  cleanupSubscription: () => void;
}

export const useDozentHoursStore = create<DozentHoursState>((set, get) => ({
  dozentHours: [],
  isLoading: false,
  error: null,
  subscription: null,

  setupRealtimeSubscription: () => {
    const { subscription } = get();
    if (subscription) {
      console.log('🔄 Dozent hours subscription already exists, skipping setup');
      return;
    }

    console.log('🔔 Setting up dozent hours real-time subscription');
    const newSubscription = supabase
      .channel('dozent-hours-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dozent_hours'
      }, (payload) => {
        console.log('🔔 Dozent hours change detected:', payload);
        // Refresh the dozent hours when any change occurs
        get().fetchDozentHours();
      })
      .subscribe();

    set({ subscription: newSubscription });
  },

  cleanupSubscription: () => {
    const { subscription } = get();
    if (subscription) {
      console.log('🧹 Cleaning up dozent hours subscription');
      subscription.unsubscribe();
      set({ subscription: null });
    }
  },

  fetchDozentHours: async (dozentId?: string, startDate?: string, endDate?: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      let query = supabase
        .from('dozent_hours')
        .select('*')
        .order('date', { ascending: false });

      // Filter by dozent if specified
      if (dozentId) {
        query = query.eq('dozent_id', dozentId);
      } else {
        query = query.eq('dozent_id', user.id);
      }

      // Filter by date range if specified
      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      set({ dozentHours: data || [] });
    } catch (error: any) {
      console.error('Error fetching dozent hours:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createDozentHours: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      const dozentHoursData = {
        dozent_id: data.dozent_id || user.id,
        hours: data.hours,
        date: data.date,
        description: data.description,
        category: data.category,
        exam_type: data.exam_type
      };
      
      const { data: newDozentHours, error } = await supabase
        .from('dozent_hours')
        .insert(dozentHoursData)
        .select()
        .single();

      if (error) throw error;
      
      console.log('Dozent hours created successfully:', newDozentHours);
      
      // Update local state immediately for instant feedback
      set(state => ({
        dozentHours: [newDozentHours, ...state.dozentHours]
      }));
    } catch (error: any) {
      console.error('Error creating dozent hours:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateDozentHours: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('dozent_hours')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating dozent hours:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteDozentHours: async (id) => {
    try {
      const { error } = await supabase
        .from('dozent_hours')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting dozent hours:', error);
      set({ error: error.message });
      throw error;
    }
  },
}));