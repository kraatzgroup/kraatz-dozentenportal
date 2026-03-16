import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Invoice {
  id: string;
  invoice_number: string;
  dozent_id: string;
  month: number;
  year: number;
  period_start: string;
  period_end: string;
  total_amount: number;
  status: 'draft' | 'review' | 'submitted' | 'sent' | 'paid';
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  sent_at?: string;
  paid_at?: string;
  file_path?: string;
  dozent?: {
    full_name: string;
    email: string;
    phone: string;
    tax_id: string;
    bank_name: string;
    iban: string;
    bic: string;
    street?: string;
    house_number?: string;
    postal_code?: string;
    city?: string;
    hourly_rate_unterricht?: number;
    hourly_rate_elite?: number;
    hourly_rate_sonstige?: number;
  };
}

interface InvoiceState {
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;
  fetchInvoices: (dozentId?: string) => Promise<void>;
  createInvoice: (data: { month: number; year: number; dozentId?: string }) => Promise<Invoice>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  generateInvoicePDF: (invoiceId: string) => Promise<void>;
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  invoices: [],
  isLoading: false,
  error: null,

  fetchInvoices: async (dozentId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user, skipping fetchInvoices');
        set({ invoices: [], isLoading: false });
        return;
      }

      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          dozent_id,
          month,
          year,
          period_start,
          period_end,
          total_amount,
          status,
          created_at,
          updated_at,
          sent_at,
          paid_at,
          dozent:profiles!invoices_dozent_id_fkey(
            full_name,
            email,
            phone,
            tax_id,
            bank_name,
            iban,
            bic,
            street,
            house_number,
            postal_code,
            city,
            hourly_rate_unterricht,
            hourly_rate_elite,
            hourly_rate_sonstige
          )
        `)
        .order('created_at', { ascending: false });

      // Filter by dozent if specified (for admin view)
      if (dozentId) {
        query = query.eq('dozent_id', dozentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Supabase returns joined single relations as arrays, normalize to objects
      const normalized = (data || []).map((inv: any) => ({
        ...inv,
        dozent: Array.isArray(inv.dozent) ? inv.dozent[0] : inv.dozent
      }));

      set({ invoices: normalized as Invoice[] });
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createInvoice: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const targetDozentId = data.dozentId || user.id;

      // Calculate period dates (first and last day of the selected month)
      // Use string format directly to avoid timezone issues
      const lastDayOfMonth = new Date(data.year, data.month, 0).getDate();
      const startDate = `${data.year}-${String(data.month).padStart(2, '0')}-01`;
      const endDate = `${data.year}-${String(data.month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

      // Fetch dozent's hourly rates
      const { data: dozentProfile } = await supabase
        .from('profiles')
        .select('hourly_rate_unterricht, hourly_rate_elite, hourly_rate_elite_korrektur, hourly_rate_sonstige')
        .eq('id', targetDozentId)
        .single();

      const rateUnterricht = dozentProfile?.hourly_rate_unterricht || 0;
      const rateElite = dozentProfile?.hourly_rate_elite || 0;
      const rateEliteKorrektur = dozentProfile?.hourly_rate_elite_korrektur || 0;
      const rateSonstige = dozentProfile?.hourly_rate_sonstige || 0;

      // Fetch participant hours with elite_kleingruppe flag
      const { data: participantHours, error: hoursError } = await supabase
        .from('participant_hours')
        .select('hours, teilnehmer:teilnehmer(elite_kleingruppe)')
        .eq('dozent_id', targetDozentId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (hoursError) throw hoursError;

      // Fetch dozent hours with category
      const { data: dozentHours, error: dozentHoursError } = await supabase
        .from('dozent_hours')
        .select('hours, category')
        .eq('dozent_id', targetDozentId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (dozentHoursError) throw dozentHoursError;

      // Calculate total hours per category
      const regularHours = (participantHours || []).filter((h: any) => !h.teilnehmer?.elite_kleingruppe);
      const eliteParticipantHours = (participantHours || []).filter((h: any) => h.teilnehmer?.elite_kleingruppe);
      const eliteUnterrichtHours = (dozentHours || []).filter((h: any) => h.category && h.category.toLowerCase().includes('elite') && !h.category.toLowerCase().includes('korrektur'));
      const eliteKorrekturHours = (dozentHours || []).filter((h: any) => h.category && h.category.toLowerCase().includes('elite') && h.category.toLowerCase().includes('korrektur'));
      const sonstigeHours = (dozentHours || []).filter((h: any) => !h.category || !h.category.toLowerCase().includes('elite'));

      const totalRegular = regularHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0);
      const totalElite = eliteParticipantHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0)
        + eliteUnterrichtHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0);
      const totalEliteKorrektur = eliteKorrekturHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0);
      const totalSonstige = sonstigeHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0);

      // Calculate total amount based on hourly rates
      const totalAmount = (totalRegular * rateUnterricht) + (totalElite * rateElite) + (totalEliteKorrektur * rateEliteKorrektur) + (totalSonstige * rateSonstige);

      // Use atomic stored procedure to create invoice with unique number
      const { data: newInvoice, error } = await supabase
        .rpc('create_invoice_atomic', {
          p_dozent_id: targetDozentId,
          p_month: data.month,
          p_year: data.year,
          p_period_start: startDate,
          p_period_end: endDate,
          p_total_amount: totalAmount,
          p_status: 'draft'
        });

      if (error) throw error;
      if (!newInvoice || newInvoice.length === 0) throw new Error('Failed to create invoice');

      const createdInvoice = newInvoice[0];

      // Re-fetch to ensure consistency
      await get().fetchInvoices(targetDozentId);

      return createdInvoice;
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      // Check for duplicate constraint error
      let errorMessage = error.message;
      if (error.message?.includes('invoices_dozent_month_year_unique') || 
          error.code === '23505') {
        errorMessage = 'Es gibt bereits eine Rechnung für diesen Monat.';
      }
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateInvoice: async (id, data) => {
    try {
      console.log('[updateInvoice] Starting update for:', id, 'data:', data);
      
      // Simple update without select
      const { error } = await supabase
        .from('invoices')
        .update(data)
        .eq('id', id);

      if (error) {
        console.error('[updateInvoice] Supabase error:', error);
        throw error;
      }
      
      console.log('[updateInvoice] Update successful, updating local state');

      // Update local state
      set(state => ({
        invoices: state.invoices.map(invoice =>
          invoice.id === id ? { ...invoice, ...data } : invoice
        )
      }));
      
      console.log('[updateInvoice] Local state updated');
    } catch (error: any) {
      console.error('[updateInvoice] Error:', error);
      throw error;
    }
  },

  deleteInvoice: async (id) => {
    set({ isLoading: true, error: null });
    try {
      console.log('[deleteInvoice] Deleting invoice:', id);
      
      const { data, error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id)
        .select();

      console.log('[deleteInvoice] Response:', { data, error });

      if (error) throw error;

      // Update local state
      set(state => ({
        invoices: state.invoices.filter(invoice => invoice.id !== id)
      }));
      
      console.log('[deleteInvoice] Local state updated');
      
      // Re-fetch to ensure consistency
      const dozentId = data?.[0]?.dozent_id;
      if (dozentId) {
        await get().fetchInvoices(dozentId);
      }
    } catch (error: any) {
      console.error('[deleteInvoice] Error:', error);
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  generateInvoicePDF: async (invoiceId) => {
    try {
      const invoice = get().invoices.find(inv => inv.id === invoiceId);
      if (!invoice) throw new Error('Invoice not found');

      // Import PDF generator
      const { generateInvoicePDF } = await import('../utils/invoicePDFGenerator');
      
      // Fetch detailed hours data for the invoice period
      const startDate = invoice.period_start;
      const endDate = invoice.period_end;

      // Get participant hours with elite_kleingruppe flag
      const { data: participantHours, error: participantError } = await supabase
        .from('participant_hours')
        .select(`
          date,
          hours,
          description,
          legal_area,
          teilnehmer:teilnehmer(name, elite_kleingruppe)
        `)
        .eq('dozent_id', invoice.dozent_id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (participantError) throw participantError;

      // Get dozent hours with category
      const { data: dozentHours, error: dozentError } = await supabase
        .from('dozent_hours')
        .select('date, hours, description, category')
        .eq('dozent_id', invoice.dozent_id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (dozentError) throw dozentError;

      // Generate PDF - normalize Supabase join arrays to objects
      const normalizedParticipantHours = (participantHours || []).map((h: any) => ({
        ...h,
        teilnehmer: Array.isArray(h.teilnehmer) ? h.teilnehmer[0] : h.teilnehmer
      }));

      await generateInvoicePDF({
        invoice: invoice as any,
        participantHours: normalizedParticipantHours as any,
        dozentHours: (dozentHours || []) as any
      });

    } catch (error: any) {
      console.error('Error generating invoice PDF:', error);
      set({ error: error.message });
      throw error;
    }
  }
}));