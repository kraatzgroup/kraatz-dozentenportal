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
  contract_start?: string;
  contract_end?: string;
  booked_hours?: number;
  completed_hours?: number;
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
  createHours: (data: { teilnehmer_id: string; hours: number; date: string; description?: string; legal_area?: string; dozent_id?: string }) => Promise<void>;
  updateHours: (id: string, data: { hours: number; date: string; description?: string }) => Promise<void>;
  deleteHours: (id: string) => Promise<void>;
  getTotalHours: (teilnehmerId: string, startDate?: string, endDate?: string) => Promise<number>;
  getMonthlyHours: (teilnehmerId: string, year: number, month: number) => number;
  getCurrentMonthHours: (teilnehmerId: string) => number;
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
      if (!user && !dozentId) {
        console.log('No authenticated user, skipping fetchMonthlySummary');
        set({ monthlySummary: [], isLoading: false });
        return;
      }
      
      const targetDozentId = dozentId || user?.id;
      const targetYear = year || new Date().getFullYear();
      const targetMonth = month || new Date().getMonth() + 1;
      
      // Calculate next month correctly (handle December -> January)
      const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1;
      const nextYear = targetMonth === 12 ? targetYear + 1 : targetYear;
      
      const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      
      console.log('Fetching monthly summary for dozent:', targetDozentId, 'from:', startDate, 'to:', endDate);
      
      // Get all hours entries for this dozent in the target month
      const { data: hoursData, error: hoursError } = await supabase
        .from('participant_hours')
        .select('teilnehmer_id, hours, date, description')
        .eq('dozent_id', targetDozentId)
        .gte('date', startDate)
        .lt('date', endDate);
      
      if (hoursError) {
        console.error('Error fetching hours:', hoursError);
        throw hoursError;
      }
      console.log('Found hours entries:', hoursData?.length || 0, hoursData);
      
      // Get unique teilnehmer IDs from hours data, filtering out null values
      const teilnehmerIds = [...new Set(hoursData?.map(h => h.teilnehmer_id).filter(id => id != null) || [])];
      
      if (teilnehmerIds.length === 0) {
        console.log('No hours found for this month');
        set({ monthlySummary: [], isLoading: false });
        return;
      }
      
      // Fetch teilnehmer names and contract data
      const { data: teilnehmerData, error: teilnehmerError } = await supabase
        .from('teilnehmer')
        .select('id, name, contract_start, contract_end, booked_hours')
        .in('id', teilnehmerIds);
      
      if (teilnehmerError) {
        console.error('Error fetching teilnehmer:', teilnehmerError);
        throw teilnehmerError;
      }

      // Fetch ALL participant_hours for these teilnehmer (from all dozenten) to calculate real completed_hours
      const { data: allHoursForTeilnehmer } = await supabase
        .from('participant_hours')
        .select('teilnehmer_id, hours')
        .in('teilnehmer_id', teilnehmerIds);

      // Sum up total completed hours per teilnehmer
      const completedHoursMap = new Map<string, number>();
      (allHoursForTeilnehmer || []).forEach(h => {
        const current = completedHoursMap.get(h.teilnehmer_id) || 0;
        completedHoursMap.set(h.teilnehmer_id, current + parseFloat(h.hours.toString()));
      });
      
      const teilnehmerMap = new Map<string, { name: string; contract_start?: string; contract_end?: string; booked_hours?: number; completed_hours?: number }>(
        teilnehmerData?.map(t => [t.id, {
          name: t.name,
          contract_start: t.contract_start,
          contract_end: t.contract_end,
          booked_hours: t.booked_hours,
          completed_hours: completedHoursMap.get(t.id) || 0
        }]) || []
      );
      
      // Group hours by teilnehmer (skip entries with null teilnehmer_id)
      const hoursByTeilnehmer = new Map<string, { hours: number; dates: Set<string> }>();
      hoursData?.forEach(h => {
        if (!h.teilnehmer_id) return; // Skip entries without teilnehmer_id
        const existing = hoursByTeilnehmer.get(h.teilnehmer_id) || { hours: 0, dates: new Set() };
        existing.hours += parseFloat(h.hours.toString());
        existing.dates.add(h.date);
        hoursByTeilnehmer.set(h.teilnehmer_id, existing);
      });
      
      // Build summary data
      const summaryData = Array.from(hoursByTeilnehmer.entries()).map(([teilnehmerId, data]) => {
        const teilnehmerInfo = teilnehmerMap.get(teilnehmerId);
        return {
          teilnehmer_id: teilnehmerId,
          teilnehmer_name: teilnehmerInfo?.name || 'Unbekannt',
          total_hours: data.hours,
          days_worked: data.dates.size,
          contract_start: teilnehmerInfo?.contract_start,
          contract_end: teilnehmerInfo?.contract_end,
          booked_hours: teilnehmerInfo?.booked_hours,
          completed_hours: teilnehmerInfo?.completed_hours
        };
      });
      
      console.log('Final monthly summary:', summaryData);
      set({ monthlySummary: summaryData, isLoading: false });
    } catch (error: any) {
      console.error('Error fetching monthly summary:', error);
      set({ error: error.message, monthlySummary: [], isLoading: false });
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
        .insert(hoursData)
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