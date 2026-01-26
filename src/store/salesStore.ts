import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Package {
  id: string;
  name: string;
  description: string | null;
  hours: number;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalesCall {
  id: string;
  vertrieb_user_id: string | null;
  teilnehmer_name: string;
  teilnehmer_email: string | null;
  teilnehmer_phone: string | null;
  call_date: string;
  call_type: 'cold_call' | 'follow_up' | 'consultation' | 'closing';
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  vertrieb_user_id: string | null;
  teilnehmer_name: string;
  teilnehmer_email: string | null;
  teilnehmer_phone: string | null;
  follow_up_date: string;
  follow_up_time: string | null;
  reason: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  notes: string | null;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export interface TrialLesson {
  id: string;
  vertrieb_user_id: string | null;
  teilnehmer_name: string;
  teilnehmer_email: string | null;
  teilnehmer_phone: string | null;
  scheduled_date: string;
  dozent_id: string | null;
  dozent_name?: string;
  rechtsgebiet: string | null;
  uni_standort: string | null;
  landesrecht: string | null;
  duration: number | null;
  status: 'requested' | 'dozent_assigned' | 'confirmed' | 'scheduled' | 'completed' | 'no_show' | 'cancelled' | 'converted';
  dozent_confirmed: boolean;
  lead_id: string | null;
  notes: string | null;
  converted_to_package_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  vertrieb_user_id: string | null;
  teilnehmer_id: string | null;
  teilnehmer_name?: string;
  package_id: string | null;
  package_name?: string;
  sale_date: string;
  amount: number;
  payment_status: 'pending' | 'partial' | 'paid' | 'refunded';
  is_upsell: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Upsell {
  id: string;
  vertrieb_user_id: string | null;
  teilnehmer_id: string;
  teilnehmer_name?: string;
  original_package_id: string | null;
  new_package_id: string | null;
  upsell_date: string;
  additional_amount: number;
  additional_hours: number;
  status: 'proposed' | 'accepted' | 'declined';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesKPI {
  id: string;
  vertrieb_user_id: string | null;
  date: string;
  calls_made: number;
  calls_answered: number;
  consultations_scheduled: number;
  consultations_completed: number;
  consultations_no_show: number;
  deals_closed: number;
  revenue: number;
}

export interface CalBooking {
  id: string;
  cal_booking_id: string;
  title: string | null;
  description: string | null;
  start_time: string;
  end_time: string;
  attendee_name: string | null;
  attendee_email: string | null;
  attendee_phone: string | null;
  status: string | null;
  meeting_url: string | null;
  location: string | null;
  event_type_id: string | null;
  last_synced_at: string;
  created_at: string;
}

export interface Lead {
  id: string;
  cal_booking_id: string | null;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  source: string;
  status: 'new' | 'offer_sent' | 'post_offer_call' | 'trial_pending' | 'post_trial_call' | 'finalgespraech' | 'vertragsanforderung' | 'vertrag_versendet' | 'downsell' | 'unqualified' | 'contract_closed' | 'closed';
  study_goal: string | null;
  study_location: string | null;
  notes: string | null;
  booking_date: string | null;
  contract_requested_at: string | null;
  final_call_date: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  state_law: string | null;
  exam_date: string | null;
  legal_areas: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
}

export interface ContractRequest {
  id: string;
  lead_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  study_goal: string | null;
  exam_date: string | null;
  state_law: string | null;
  legal_areas: string[];
  booked_hours: number | null;
  notes: string | null;
  status: 'requested' | 'sent' | 'signed' | 'cancelled';
  requested_at: string;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SalesState {
  packages: Package[];
  salesCalls: SalesCall[];
  followUps: FollowUp[];
  trialLessons: TrialLesson[];
  sales: Sale[];
  upsells: Upsell[];
  kpis: SalesKPI[];
  calBookings: CalBooking[];
  leads: Lead[];
  leadNotes: LeadNote[];
  contractRequests: ContractRequest[];
  activeTeilnehmer: any[];
  isLoading: boolean;
  error: string | null;

  // Fetch methods
  fetchPackages: () => Promise<void>;
  fetchSalesCalls: () => Promise<void>;
  fetchFollowUps: () => Promise<void>;
  fetchTrialLessons: () => Promise<void>;
  fetchSales: () => Promise<void>;
  fetchUpsells: () => Promise<void>;
  fetchKPIs: (startDate?: string, endDate?: string) => Promise<void>;
  fetchCalBookings: () => Promise<void>;
  refreshCalBookings: () => Promise<void>;
  fetchLeads: () => Promise<void>;
  fetchLeadNotes: (leadId?: string) => Promise<void>;
  addLeadNote: (leadId: string, note: string) => Promise<void>;
  fetchContractRequests: () => Promise<void>;
  fetchActiveTeilnehmer: () => Promise<void>;

  // Create methods
  createPackage: (data: Partial<Package>) => Promise<void>;
  createFollowUp: (data: Partial<FollowUp>) => Promise<void>;
  createTrialLesson: (data: Partial<TrialLesson>) => Promise<void>;
  createSale: (data: Partial<Sale>) => Promise<void>;
  createUpsell: (data: Partial<Upsell>) => Promise<void>;
  createLead: (data: Partial<Lead>) => Promise<void>;
  updateLead: (id: string, data: Partial<Lead>) => Promise<void>;
  updateContractRequest: (id: string, data: Partial<ContractRequest>) => Promise<void>;

  // Update methods
  updatePackage: (id: string, data: Partial<Package>) => Promise<void>;
  updateFollowUp: (id: string, data: Partial<FollowUp>) => Promise<void>;
  updateTrialLesson: (id: string, data: Partial<TrialLesson>) => Promise<void>;
  updateSale: (id: string, data: Partial<Sale>) => Promise<void>;
  updateUpsell: (id: string, data: Partial<Upsell>) => Promise<void>;

  // Delete methods
  deletePackage: (id: string) => Promise<void>;
  deleteFollowUp: (id: string) => Promise<void>;
  deleteTrialLesson: (id: string) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  deleteUpsell: (id: string) => Promise<void>;

  // KPI calculations
  getKPISummary: () => {
    totalCalls: number;
    closedTotal: number;
    closeRate: number;
    totalRevenue: number;
    avgDealSize: number;
  };

  // Real-time subscriptions
  subscribeToChanges: () => () => void;
}

export const useSalesStore = create<SalesState>((set, get) => ({
  packages: [],
  salesCalls: [],
  followUps: [],
  trialLessons: [],
  sales: [],
  upsells: [],
  kpis: [],
  calBookings: [],
  leads: [],
  leadNotes: [],
  contractRequests: [],
  activeTeilnehmer: [],
  isLoading: false,
  error: null,

  fetchPackages: async () => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('is_active', true)
        .order('price');

      if (error) throw error;
      set({ packages: data || [] });
    } catch (error: any) {
      console.error('Error fetching packages:', error);
      set({ error: error.message });
    }
  },

  fetchSalesCalls: async () => {
    try {
      const { data, error } = await supabase
        .from('sales_calls')
        .select('*')
        .order('call_date', { ascending: false });

      if (error) throw error;
      set({ salesCalls: data || [] });
    } catch (error: any) {
      console.error('Error fetching sales calls:', error);
      set({ error: error.message });
    }
  },

  fetchFollowUps: async () => {
    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .select('*')
        .order('follow_up_date', { ascending: true });

      if (error) throw error;
      set({ followUps: data || [] });
    } catch (error: any) {
      console.error('Error fetching follow-ups:', error);
      set({ error: error.message });
    }
  },

  fetchTrialLessons: async () => {
    try {
      const { data, error } = await supabase
        .from('trial_lessons')
        .select(`
          *,
          dozent:dozent_id(id, full_name)
        `)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      
      // Map dozent name from joined data if not already set
      const lessonsWithDozentName = (data || []).map(lesson => ({
        ...lesson,
        dozent_name: lesson.dozent_name || lesson.dozent?.full_name || null
      }));
      
      set({ trialLessons: lessonsWithDozentName });
    } catch (error: any) {
      console.error('Error fetching trial lessons:', error);
      set({ error: error.message });
    }
  },

  fetchSales: async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('sale_date', { ascending: false });

      if (error) throw error;
      set({ sales: data || [] });
    } catch (error: any) {
      console.error('Error fetching sales:', error);
      set({ error: error.message });
    }
  },

  fetchUpsells: async () => {
    try {
      const { data, error } = await supabase
        .from('upsells')
        .select(`
          *,
          teilnehmer:teilnehmer(name)
        `)
        .order('upsell_date', { ascending: false });

      if (error) throw error;
      
      const upsellsWithNames = (data || []).map(upsell => ({
        ...upsell,
        teilnehmer_name: upsell.teilnehmer?.name || null
      }));
      
      set({ upsells: upsellsWithNames });
    } catch (error: any) {
      console.error('Error fetching upsells:', error);
      set({ error: error.message });
    }
  },

  fetchKPIs: async (startDate?: string, endDate?: string) => {
    try {
      let query = supabase.from('sales_kpis').select('*');
      
      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }
      
      const { data, error } = await query.order('date', { ascending: false });

      if (error) throw error;
      set({ kpis: data || [] });
    } catch (error: any) {
      console.error('Error fetching KPIs:', error);
      set({ error: error.message });
    }
  },

  fetchCalBookings: async () => {
    try {
      // Fetch all bookings from database (synced hourly by cron job)
      const { data, error } = await supabase
        .from('cal_bookings')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      // If we have data in DB, use it
      if (data && data.length > 0) {
        set({ calBookings: data });
        return;
      }
      
      // If no data in DB, fetch fresh from Cal.com API via Edge Function
      const calApiKey = import.meta.env.VITE_CAL_API_KEY;
      if (calApiKey) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cal-bookings`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ apiKey: calApiKey }),
          }
        );
        
        if (response.ok) {
          const result = await response.json();
          const bookings = (result.bookings || []).map((booking: any) => ({
            ...booking,
            last_synced_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          set({ calBookings: bookings });
          return;
        }
      }
      
      set({ calBookings: [] });
    } catch (error: any) {
      console.error('Error fetching cal bookings:', error);
      set({ error: error.message });
    }
  },

  refreshCalBookings: async () => {
    set({ isLoading: true });
    try {
      // Force refresh from Cal.com API via Edge Function
      const calApiKey = import.meta.env.VITE_CAL_API_KEY;
      if (!calApiKey) {
        throw new Error('Cal.com API key not configured');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cal-bookings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ apiKey: calApiKey }),
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        const bookings = (result.bookings || []).map((booking: any) => ({
          ...booking,
          last_synced_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }));
        
        set({ calBookings: bookings });
      } else {
        throw new Error('Failed to refresh Cal.com bookings');
      }
    } catch (error: any) {
      console.error('Error refreshing cal bookings:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchActiveTeilnehmer: async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: teilnehmerData, error: teilnehmerError } = await supabase
        .from('teilnehmer')
        .select(`
          *,
          package:packages(name, hours, price)
        `)
        .lte('contract_start', today)
        .gte('contract_end', today)
        .order('name');

      if (teilnehmerError) throw teilnehmerError;

      // Fetch completed hours
      const { data: hoursData, error: hoursError } = await supabase
        .from('participant_hours')
        .select('teilnehmer_id, hours');

      if (hoursError) throw hoursError;

      const hoursMap: { [key: string]: number } = {};
      (hoursData || []).forEach((entry: { teilnehmer_id: string; hours: number }) => {
        if (!hoursMap[entry.teilnehmer_id]) {
          hoursMap[entry.teilnehmer_id] = 0;
        }
        hoursMap[entry.teilnehmer_id] += Number(entry.hours);
      });

      const teilnehmerWithHours = (teilnehmerData || []).map(t => ({
        ...t,
        completed_hours: hoursMap[t.id] || 0,
        remaining_hours: (t.booked_hours || 0) - (hoursMap[t.id] || 0)
      }));

      set({ activeTeilnehmer: teilnehmerWithHours });
    } catch (error: any) {
      console.error('Error fetching active teilnehmer:', error);
      set({ error: error.message });
    }
  },

  fetchLeads: async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('booking_date', { ascending: false });

      if (error) throw error;
      set({ leads: data || [] });
    } catch (error: any) {
      console.error('Error fetching leads:', error);
      set({ error: error.message });
    }
  },

  updateLead: async (id: string, data: Partial<Lead>) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      const { leads } = get();
      set({
        leads: leads.map(l => l.id === id ? { ...l, ...data } : l)
      });
    } catch (error: any) {
      console.error('Error updating lead:', error);
      set({ error: error.message });
    }
  },

  fetchContractRequests: async () => {
    try {
      const { data, error } = await supabase
        .from('contract_requests')
        .select('*')
        .order('requested_at', { ascending: false });

      if (error) throw error;
      set({ contractRequests: data || [] });
    } catch (error: any) {
      console.error('Error fetching contract requests:', error);
      set({ error: error.message });
    }
  },

  updateContractRequest: async (id: string, data: Partial<ContractRequest>) => {
    try {
      const { error } = await supabase
        .from('contract_requests')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      const { contractRequests } = get();
      set({
        contractRequests: contractRequests.map(cr => cr.id === id ? { ...cr, ...data } : cr)
      });
    } catch (error: any) {
      console.error('Error updating contract request:', error);
      set({ error: error.message });
    }
  },

  fetchLeadNotes: async (leadId?: string) => {
    try {
      let query = supabase
        .from('lead_notes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (leadId) {
        query = query.eq('lead_id', leadId);
      }

      const { data, error } = await query;
      if (error) throw error;
      set({ leadNotes: data || [] });
    } catch (error: any) {
      console.error('Error fetching lead notes:', error);
      set({ error: error.message });
    }
  },

  addLeadNote: async (leadId: string, note: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('lead_notes')
        .insert({ lead_id: leadId, note, created_by: user?.id })
        .select()
        .single();

      if (error) throw error;
      
      const { leadNotes } = get();
      set({ leadNotes: [data, ...leadNotes] });
    } catch (error: any) {
      console.error('Error adding lead note:', error);
      set({ error: error.message });
    }
  },

  syncCalBookings: async (apiKey: string) => {
    set({ isLoading: true });
    try {
      // Fetch bookings from Cal.com API
      const response = await fetch('https://api.cal.com/v1/bookings?apiKey=' + apiKey);
      
      if (!response.ok) {
        throw new Error('Failed to fetch Cal.com bookings');
      }
      
      const result = await response.json();
      const bookings = result.bookings || [];
      
      // Upsert bookings to database
      for (const booking of bookings) {
        const bookingData = {
          cal_booking_id: String(booking.id),
          title: booking.title || null,
          description: booking.description || null,
          start_time: booking.startTime,
          end_time: booking.endTime,
          attendee_name: booking.attendees?.[0]?.name || null,
          attendee_email: booking.attendees?.[0]?.email || null,
          attendee_phone: booking.attendees?.[0]?.phone || null,
          status: booking.status || null,
          meeting_url: booking.metadata?.videoCallUrl || null,
          location: booking.location || null,
          event_type_id: String(booking.eventTypeId) || null,
          last_synced_at: new Date().toISOString()
        };
        
        await supabase
          .from('cal_bookings')
          .upsert(bookingData, { onConflict: 'cal_booking_id' });
      }
      
      // Refresh local state
      await get().fetchCalBookings();
    } catch (error: any) {
      console.error('Error syncing Cal.com bookings:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createPackage: async (data) => {
    try {
      const { error } = await supabase.from('packages').insert(data);
      if (error) throw error;
      await get().fetchPackages();
    } catch (error: any) {
      console.error('Error creating package:', error);
      set({ error: error.message });
      throw error;
    }
  },

  createFollowUp: async (data) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('follow_ups').insert({
        ...data,
        vertrieb_user_id: user?.id
      });
      if (error) throw error;
      await get().fetchFollowUps();
    } catch (error: any) {
      console.error('Error creating follow-up:', error);
      set({ error: error.message });
      throw error;
    }
  },

  createTrialLesson: async (data) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('trial_lessons').insert({
        ...data,
        vertrieb_user_id: user?.id
      });
      if (error) throw error;
      await get().fetchTrialLessons();
    } catch (error: any) {
      console.error('Error creating trial lesson:', error);
      set({ error: error.message });
      throw error;
    }
  },

  createSale: async (data) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('sales').insert({
        ...data,
        vertrieb_user_id: user?.id
      });
      if (error) throw error;
      await get().fetchSales();
    } catch (error: any) {
      console.error('Error creating sale:', error);
      set({ error: error.message });
      throw error;
    }
  },

  createUpsell: async (data) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('upsells').insert({
        ...data,
        vertrieb_user_id: user?.id
      });
      if (error) throw error;
      await get().fetchUpsells();
    } catch (error: any) {
      console.error('Error creating upsell:', error);
      set({ error: error.message });
      throw error;
    }
  },

  createLead: async (data) => {
    try {
      const { error } = await supabase.from('leads').insert({
        ...data,
        source: data.source || 'manual',
        status: data.status || 'new',
      });
      if (error) throw error;
      await get().fetchLeads();
    } catch (error: any) {
      console.error('Error creating lead:', error);
      set({ error: error.message });
      throw error;
    }
  },

  updatePackage: async (id, data) => {
    try {
      const { error } = await supabase.from('packages').update(data).eq('id', id);
      if (error) throw error;
      await get().fetchPackages();
    } catch (error: any) {
      console.error('Error updating package:', error);
      set({ error: error.message });
      throw error;
    }
  },

  updateFollowUp: async (id, data) => {
    try {
      const { error } = await supabase.from('follow_ups').update(data).eq('id', id);
      if (error) throw error;
      await get().fetchFollowUps();
    } catch (error: any) {
      console.error('Error updating follow-up:', error);
      set({ error: error.message });
      throw error;
    }
  },

  updateTrialLesson: async (id, data) => {
    try {
      const { error } = await supabase.from('trial_lessons').update(data).eq('id', id);
      if (error) throw error;
      await get().fetchTrialLessons();
    } catch (error: any) {
      console.error('Error updating trial lesson:', error);
      set({ error: error.message });
      throw error;
    }
  },

  updateSale: async (id, data) => {
    try {
      const { error } = await supabase.from('sales').update(data).eq('id', id);
      if (error) throw error;
      await get().fetchSales();
    } catch (error: any) {
      console.error('Error updating sale:', error);
      set({ error: error.message });
      throw error;
    }
  },

  updateUpsell: async (id, data) => {
    try {
      const { error } = await supabase.from('upsells').update(data).eq('id', id);
      if (error) throw error;
      await get().fetchUpsells();
    } catch (error: any) {
      console.error('Error updating upsell:', error);
      set({ error: error.message });
      throw error;
    }
  },

  deletePackage: async (id) => {
    try {
      const { error } = await supabase.from('packages').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      await get().fetchPackages();
    } catch (error: any) {
      console.error('Error deleting package:', error);
      set({ error: error.message });
      throw error;
    }
  },

  deleteFollowUp: async (id) => {
    try {
      const { error } = await supabase.from('follow_ups').delete().eq('id', id);
      if (error) throw error;
      await get().fetchFollowUps();
    } catch (error: any) {
      console.error('Error deleting follow-up:', error);
      set({ error: error.message });
      throw error;
    }
  },

  deleteTrialLesson: async (id) => {
    try {
      const { error } = await supabase.from('trial_lessons').delete().eq('id', id);
      if (error) throw error;
      await get().fetchTrialLessons();
    } catch (error: any) {
      console.error('Error deleting trial lesson:', error);
      set({ error: error.message });
      throw error;
    }
  },

  deleteSale: async (id) => {
    try {
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (error) throw error;
      await get().fetchSales();
    } catch (error: any) {
      console.error('Error deleting sale:', error);
      set({ error: error.message });
      throw error;
    }
  },

  deleteUpsell: async (id) => {
    try {
      const { error } = await supabase.from('upsells').delete().eq('id', id);
      if (error) throw error;
      await get().fetchUpsells();
    } catch (error: any) {
      console.error('Error deleting upsell:', error);
      set({ error: error.message });
      throw error;
    }
  },

  getKPISummary: () => {
    const { leads, sales } = get();
    
    // Total calls = all leads from Cal.com (historical data)
    const totalCalls = leads.length;
    
    // Closed deals from Monday.com sales
    const closedDeals = sales.length;
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    
    // Close rate = closed deals / total leads
    const closeRate = totalCalls > 0 
      ? (closedDeals / totalCalls) * 100 
      : 0;
    
    const avgDealSize = closedDeals > 0 ? totalRevenue / closedDeals : 0;
    
    return {
      totalCalls,
      closedTotal: closedDeals,
      closeRate,
      totalRevenue,
      avgDealSize
    };
  },

  // Real-time subscriptions for synchronization
  subscribeToChanges: () => {
    const { fetchLeads, fetchTrialLessons, fetchFollowUps, fetchCalBookings } = get();

    // Subscribe to leads changes
    const leadsChannel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .subscribe();

    // Subscribe to trial_lessons changes
    const trialsChannel = supabase
      .channel('trials-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trial_lessons' }, () => {
        fetchTrialLessons();
      })
      .subscribe();

    // Subscribe to follow_ups changes
    const followUpsChannel = supabase
      .channel('followups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_ups' }, () => {
        fetchFollowUps();
      })
      .subscribe();

    // Subscribe to cal_bookings changes
    const calBookingsChannel = supabase
      .channel('calbookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cal_bookings' }, () => {
        fetchCalBookings();
      })
      .subscribe();

    // Return cleanup function
    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(trialsChannel);
      supabase.removeChannel(followUpsChannel);
      supabase.removeChannel(calBookingsChannel);
    };
  }
}));
