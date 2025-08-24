import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ParticipantHours {
  id: string;
  teilnehmer_id: string;
  dozent_id: string;
  hours: number;
  date: string;
  description?: string;
  legal_area?: string;
  legal_area?: string;
  created_at: string;
  updated_at: string;
  teilnehmer_name?: string;
  teilnehmer_email?: string;
  dozent_name?: string;
}

export interface MonthlyHoursSummary {
  teilnehmer_id: string;
  teilnehmer_name: string;
  total_hours: number;
  days_worked: number;
}

export interface TeilnehmerDozent {
  dozent_id: string;
  dozent_name: string;
  total_hours: number;
  last_session: string;
}

interface HoursState {
  hours: ParticipantHours[];
  monthlySummary: MonthlyHoursSummary[];
  teilnehmerDozenten: TeilnehmerDozent[];
  isLoading: boolean;
  error: string | null;
  subscription: RealtimeChannel | null;
  fetchHours: (dozentId?: string, startDate?: string, endDate?: string) => Promise<void>;
  fetchMonthlySummary: (dozentId?: string, year?: number, month?: number) => Promise<void>;
  fetchTeilnehmerDozenten: (teilnehmerId: string, startDate?: string, endDate?: string) => Promise<void>;
  createHours: (data: { teilnehmer_id: string; hours: number; date: string; description?: string; dozent_id?: string }) => Promise<void>;
  updateHours: (id: string, data: { hours: number; date: string; description?: string }) => Promise<void>;
  deleteHours: (id: string) => Promise<void>;
  getTotalHours: (teilnehmerId: string, startDate?: string, endDate?: string) => Promise<number>;
  getMonthlyHours: (teilnehmerId: string, year: number, month: number) => number;
  setupRealtimeSubscription: () => void;
  cleanupSubscription: () => void;
}

export const useHoursStore = create<HoursState>((set, get) => ({
  hours: [],
  monthlySummary: [],
  teilnehmerDozenten: [],
  isLoading: false,
  error: null,
  subscription: null,

  setupRealtimeSubscription: () => {
    const { subscription } = get();
    if (subscription) {
      console.log('🔄 Hours subscription already exists, skipping setup');
      return;
    }

    console.log('🔔 Setting up participant hours real-time subscription');
    const newSubscription = supabase
      .channel('participant-hours-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'participant_hours'
      }, (payload) => {
        console.log('🔔 Participant hours change detected:', payload);
        // Refresh the monthly summary when any change occurs
        get().fetchMonthlySummary();
      })
      .subscribe();

    set({ subscription: newSubscription });
  },

  cleanupSubscription: () => {
    const { subscription } = get();
    if (subscription) {
      console.log('🧹 Cleaning up hours subscription');
      subscription.unsubscribe();
      set({ subscription: null });
    }
  },

  fetchHours: async (dozentId?: string, startDate?: string, endDate?: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      let query = supabase
        .from('participant_hours')
        .select(`
          *,
          teilnehmer:teilnehmer(name, email),
          dozent:profiles!participant_hours_dozent_id_fkey(full_name)
        `)
        .order('date', { ascending: false });

      // Filter by dozent if specified
      if (dozentId) {
        query = query.eq('dozent_id', dozentId);
      } else if (user) {
        query = query.eq('dozent_id', user.id);
      } else {
        // No user and no specific dozent - return empty
        set({ monthlySummary: [] });
        return;
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

      // Transform data to match interface
      const transformedData = data?.map(item => ({
        ...item,
        teilnehmer_name: item.teilnehmer?.name,
        teilnehmer_email: item.teilnehmer?.email,
        dozent_name: item.dozent?.full_name
      })) || [];

      set({ hours: transformedData });
    } catch (error: any) {
      console.error('Error fetching hours:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMonthlySummary: async (dozentId?: string, year?: number, month?: number) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user && !dozentId) throw new Error('No authenticated user');
      
      const targetDozentId = dozentId || user.id;
      const targetYear = year || new Date().getFullYear();
      const targetMonth = month || new Date().getMonth() + 1;
      
      console.log('Fetching monthly summary for dozent:', targetDozentId, 'month:', targetMonth, 'year:', targetYear);
      
      // Get all teilnehmer (not filtered by dozent since we removed dozent_id from teilnehmer table)
      const { data: teilnehmerData, error: teilnehmerError } = await supabase
        .from('teilnehmer')
        .select('id, name');
      
      if (teilnehmerError) throw teilnehmerError;
      console.log('Found teilnehmer:', teilnehmerData?.length || 0);
      
      // Get hours for each teilnehmer for the target month
      const summaryPromises = teilnehmerData?.map(async (t) => {
        console.log('Fetching hours for teilnehmer:', t.name, 'dozent:', targetDozentId);
        const { data: hoursData, error: hoursError } = await supabase
          .from('participant_hours')
          .select('hours, date, description')
          .eq('teilnehmer_id', t.id)
          .eq('dozent_id', targetDozentId)
          .gte('date', `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`)
          .lt('date', `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`);
        
        if (hoursError) {
          console.error('Error fetching hours for teilnehmer:', t.id, hoursError);
          return {
            teilnehmer_id: t.id,
            teilnehmer_name: t.name,
            total_hours: 0,
            days_worked: 0,
            legal_areas: {}
          };
        }

        const totalHours = hoursData?.reduce((sum, h) => sum + parseFloat(h.hours.toString()), 0) || 0;
        const daysWorked = new Set(hoursData?.map(h => h.date)).size;
        
        console.log('Hours for', t.name, ':', totalHours, 'from', hoursData?.length || 0, 'entries');
        
        return {
          teilnehmer_id: t.id,
          teilnehmer_name: t.name,
          total_hours: totalHours,
          days_worked: daysWorked
        };
      }) || [];

      const summaryData = await Promise.all(summaryPromises);
      console.log('Final monthly summary:', summaryData);
      set({ monthlySummary: summaryData });
    } catch (error: any) {
      console.error('Error fetching monthly summary:', error);
      set({ error: error.message, monthlySummary: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTeilnehmerDozenten: async (teilnehmerId: string, startDate?: string, endDate?: string) => {
    try {
      let query = supabase
        .from('participant_hours')
        .select(`
          dozent_id,
          hours,
          date,
          dozent:profiles!participant_hours_dozent_id_fkey(full_name)
        `)
        .eq('teilnehmer_id', teilnehmerId);

      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query;
      if (error) throw error;
      
      const dozentenMap: Record<string, { total_hours: number; last_session: string; dozent_name: string }> = {};
      data?.forEach(h => {
        if (!dozentenMap[h.dozent_id]) {
          dozentenMap[h.dozent_id] = { 
            total_hours: 0, 
            last_session: h.date,
            dozent_name: h.dozent?.full_name || 'Unknown'
          };
        }
        dozentenMap[h.dozent_id].total_hours += parseFloat(h.hours.toString());
        if (h.date > dozentenMap[h.dozent_id].last_session) {
          dozentenMap[h.dozent_id].last_session = h.date;
        }
      });
      
      const teilnehmerDozentenData = Object.entries(dozentenMap).map(([dozent_id, stats]) => ({
        dozent_id,
        dozent_name: stats.dozent_name,
        total_hours: stats.total_hours,
        last_session: stats.last_session
      }));
      
      set({ teilnehmerDozenten: teilnehmerDozentenData });
    } catch (error: any) {
      console.error('Error fetching teilnehmer dozenten:', error);
      set({ teilnehmerDozenten: [] });
    }
  },

  createHours: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      const hoursData = {
        teilnehmer_id: data.teilnehmer_id,
        dozent_id: data.dozent_id || user.id,
        hours: data.hours,
        date: data.date,
        description: data.description || '',
        legal_area: data.legal_area || ''
      };
      
      const { data: newHours, error } = await supabase
        .from('participant_hours')
        .upsert(hoursData, { 
          onConflict: 'teilnehmer_id,date',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) throw error;
      
      console.log('Hours created successfully in database:', newHours);
      
      // Update local state immediately for instant feedback
      set(state => ({
        hours: [newHours, ...state.hours]
      }));
    } catch (error: any) {
      console.error('Error creating hours:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateHours: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('participant_hours')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating hours:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteHours: async (id) => {
    try {
      const { error } = await supabase
        .from('participant_hours')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting hours:', error);
      set({ error: error.message });
      throw error;
    }
  },

  getTotalHours: async (teilnehmerId: string, startDate?: string, endDate?: string) => {
    try {
      let query = supabase
        .from('participant_hours')
        .select('hours')
        .eq('teilnehmer_id', teilnehmerId);

      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query;
      if (error) throw error;
      
      return data?.reduce((total, h) => total + parseFloat(h.hours.toString()), 0) || 0;
    } catch (error: any) {
      console.error('Error getting total hours:', error);
      return 0;
    }
  },
  
  getMonthlyHours: (teilnehmerId: string, year: number, month: number) => {
    // This is a synchronous helper function that works with the monthlySummary data
    const { monthlySummary } = get();
    const teilnehmerSummary = monthlySummary.find(s => s.teilnehmer_id === teilnehmerId);
    return teilnehmerSummary?.total_hours || 0;
  },

  // Helper function to get current month hours for a teilnehmer
  getCurrentMonthHours: (teilnehmerId: string) => {
    const now = new Date();
    return get().getMonthlyHours(teilnehmerId, now.getFullYear(), now.getMonth() + 1);
  }
}));