import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { lastDayOfMonth } from 'date-fns';

// Helper function to get the last day of a month, correctly handling leap years
const getLastDayOfMonth = (year: number, month: number): number => {
  // Use date-fns to get the last day of the month
  const date = new Date(year, month - 1, 1);
  const result = lastDayOfMonth(date).getDate();
  console.log('📄 [invoiceStore.ts getLastDayOfMonth] Debug:', { year, month, result, date });
  return result;
};

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
  exam_type?: '1. Staatsexamen' | '2. Staatsexamen';
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
  createInvoice: (data: { month: number; year: number; dozentId?: string; examType?: '1. Staatsexamen' | '2. Staatsexamen'; invoiceNumber?: string; invoiceDate?: string }) => Promise<Invoice>;
  createQuarterlyInvoice: (data: { dozentId?: string; examType?: '1. Staatsexamen' | '2. Staatsexamen'; invoiceNumber?: string; invoiceDate?: string }) => Promise<Invoice>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  generateInvoicePDF: (invoiceId: string) => Promise<void>;
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  invoices: [],
  isLoading: false,
  error: null,

  fetchInvoices: async (dozentId?: string) => {
    console.log('📄 fetchInvoices: Starting fetch for dozentId:', dozentId);
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('📄 fetchInvoices: Auth user:', user?.email);
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
          exam_type,
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
      console.log('📄 fetchInvoices: Query result:', { data, error });
      if (error) throw error;

      // Supabase returns joined single relations as arrays, normalize to objects
      const normalized = (data || []).map((inv: any) => ({
        ...inv,
        dozent: Array.isArray(inv.dozent) ? inv.dozent[0] : inv.dozent
      }));

      console.log('📄 fetchInvoices: Normalized invoices:', normalized.length);
      console.log('📄 fetchInvoices: Invoice details:', normalized.map(inv => ({ id: inv.id, invoice_number: inv.invoice_number, month: inv.month, year: inv.year, status: inv.status })));
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
      const customInvoiceNumber = data.invoiceNumber;
      const customInvoiceDate = data.invoiceDate;

      console.log('📄 [createInvoice] Creating invoice with invoiceNumber:', customInvoiceNumber, 'invoiceDate:', customInvoiceDate, 'month:', data.month, 'year:', data.year, 'examType:', data.examType);

      // Calculate period dates (first and last day of the selected month)
      // Use string format directly to avoid timezone issues
      const lastDayOfMonth = getLastDayOfMonth(data.year, data.month);
      const startDate = `${data.year}-${String(data.month).padStart(2, '0')}-01`;
      const endDate = `${data.year}-${String(data.month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
      console.log('📄 [invoiceStore.ts createInvoice] Calculating lastDayOfMonth:', {
        year: data.year,
        month: data.month,
        lastDayOfMonth,
        endDate
      });

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

      // Fetch participant hours with elite_kleingruppe flag and study_goal
      const { data: participantHours, error: hoursError } = await supabase
        .from('participant_hours')
        .select('hours, teilnehmer:teilnehmer(elite_kleingruppe, study_goal)')
        .eq('dozent_id', targetDozentId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (hoursError) throw hoursError;

      // Fetch dozent hours with category and exam_type
      const { data: dozentHours, error: dozentHoursError } = await supabase
        .from('dozent_hours')
        .select('hours, category, exam_type')
        .eq('dozent_id', targetDozentId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (dozentHoursError) throw dozentHoursError;

      // Normalize teilnehmer object (Supabase may return as array)
      const normalizedParticipantHours = (participantHours || []).map((h: any) => ({
        ...h,
        teilnehmer: Array.isArray(h.teilnehmer) ? h.teilnehmer[0] : h.teilnehmer
      }));

      // Filter participant hours by exam_type and study_goal
      let filteredParticipantHours = normalizedParticipantHours;
      if (data.examType === '1. Staatsexamen') {
        // Show: Elite Kleingruppe OR no study_goal OR study_goal doesn't include "2. Staatsexamen"
        filteredParticipantHours = normalizedParticipantHours.filter((h: any) => {
          const studyGoal = h.teilnehmer?.study_goal;
          return h.teilnehmer?.elite_kleingruppe || !studyGoal || !studyGoal.includes('2. Staatsexamen');
        });
      } else if (data.examType === '2. Staatsexamen') {
        // Show: NOT Elite Kleingruppe AND study_goal includes "2. Staatsexamen"
        filteredParticipantHours = normalizedParticipantHours.filter((h: any) => {
          const studyGoal = h.teilnehmer?.study_goal;
          return !h.teilnehmer?.elite_kleingruppe && studyGoal && studyGoal.includes('2. Staatsexamen');
        });
      }

      // Filter dozent hours by exam_type and category
      let filteredDozentHours = dozentHours || [];
      if (data.examType === '1. Staatsexamen') {
        // Elite Kleingruppe OR exam_type = '1. Staatsexamen' OR no exam_type
        filteredDozentHours = (dozentHours || []).filter((h: any) => {
          const category = h.category?.toLowerCase() || '';
          const examType = h.exam_type;
          
          if (category.includes('elite')) return true;
          if (examType === '1. Staatsexamen') return true;
          if (!examType) return true;
          
          return false;
        });
      } else if (data.examType === '2. Staatsexamen') {
        // NOT Elite Kleingruppe AND exam_type = '2. Staatsexamen'
        filteredDozentHours = (dozentHours || []).filter((h: any) => {
          const category = h.category?.toLowerCase() || '';
          const examType = h.exam_type;
          
          if (category.includes('elite')) return false;
          return examType === '2. Staatsexamen';
        });
      }

      // Calculate total hours per category
      const regularHours = filteredParticipantHours.filter((h: any) => !h.teilnehmer?.elite_kleingruppe);
      const eliteParticipantHours = filteredParticipantHours.filter((h: any) => h.teilnehmer?.elite_kleingruppe);
      const eliteUnterrichtHours = filteredDozentHours.filter((h: any) => h.category && h.category.toLowerCase().includes('elite') && !h.category.toLowerCase().includes('korrektur'));
      const eliteKorrekturHours = filteredDozentHours.filter((h: any) => h.category && h.category.toLowerCase().includes('elite') && h.category.toLowerCase().includes('korrektur'));
      const sonstigeHours = filteredDozentHours.filter((h: any) => !h.category || !h.category.toLowerCase().includes('elite'));

      const totalRegular = regularHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0);
      const totalElite = eliteParticipantHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0)
        + eliteUnterrichtHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0);
      const totalEliteKorrektur = eliteKorrekturHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0);
      const totalSonstige = sonstigeHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0);

      // Calculate total amount based on hourly rates
      const totalAmount = (totalRegular * rateUnterricht) + (totalElite * rateElite) + (totalEliteKorrektur * rateEliteKorrektur) + (totalSonstige * rateSonstige);

      // Generate invoice number if not provided
      const invoiceNumber = customInvoiceNumber || `RE${Date.now()}`;

      // Create invoice directly with custom invoice number and date
      const { data: newInvoice, error } = await supabase
        .from('invoices')
        .insert({
          dozent_id: targetDozentId,
          invoice_number: invoiceNumber,
          month: data.month,
          year: data.year,
          period_start: startDate,
          period_end: endDate,
          total_amount: totalAmount,
          status: 'draft',
          exam_type: data.examType || null,
          created_at: customInvoiceDate || new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      if (!newInvoice) throw new Error('Failed to create invoice');

      // Re-fetch to ensure consistency
      await get().fetchInvoices(targetDozentId);

      return newInvoice;
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      // Check for duplicate constraint error
      let errorMessage = error.message;
      if (error.message?.includes('invoices_invoice_number_dozent_unique') || 
          error.code === '23505') {
        errorMessage = 'Diese Rechnungsnummer existiert bereits für diesen Dozent. Bitte wählen Sie eine andere Rechnungsnummer.';
      } else if (error.message?.includes('invoices_dozent_month_year_unique') || 
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
  },

  createQuarterlyInvoice: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const targetDozentId = data.dozentId || user.id;
      const examType = data.examType || '1. Staatsexamen';
      const customInvoiceNumber = data.invoiceNumber;
      const customInvoiceDate = data.invoiceDate;

      console.log('📄 [createQuarterlyInvoice] Creating quarterly invoice with invoiceNumber:', customInvoiceNumber, 'invoiceDate:', customInvoiceDate, 'examType:', examType);

      // Calculate previous quarter
      const now = new Date();
      const currentQuarter = Math.floor((now.getMonth() + 3) / 3);
      const currentYear = now.getFullYear();
      
      let quarter, quarterYear;
      if (currentQuarter === 1) {
        quarter = 4;
        quarterYear = currentYear - 1;
      } else {
        quarter = currentQuarter - 1;
        quarterYear = currentYear;
      }

      // Get months for the quarter
      const quarterMonths: number[] = [];
      if (quarter === 1) quarterMonths.push(1, 2, 3);
      else if (quarter === 2) quarterMonths.push(4, 5, 6);
      else if (quarter === 3) quarterMonths.push(7, 8, 9);
      else quarterMonths.push(10, 11, 12);

      // Check which months already have invoices for this exam_type (exclude draft, submitted, sent, paid)
      // Also check for invoices without exam_type
      const { data: existingInvoices, error: existingError } = await supabase
        .from('invoices')
        .select('month, year, status, exam_type')
        .eq('dozent_id', targetDozentId)
        .in('month', quarterMonths)
        .eq('year', quarterYear)
        .or(`exam_type.eq.${examType},exam_type.is.null`)
        .in('status', ['draft', 'submitted', 'sent', 'paid']);

      console.log('📄 [createQuarterlyInvoice] Debug:', { quarterMonths, quarterYear, examType, existingInvoices, existingError });

      if (existingError) throw existingError;

      const existingMonths = new Set((existingInvoices || []).map(inv => inv.month));
      const missingMonths = quarterMonths.filter(month => !existingMonths.has(month));

      console.log('📄 [createQuarterlyInvoice] existingMonths:', existingMonths, 'missingMonths:', missingMonths);

      if (missingMonths.length === 0) {
        throw new Error('Für alle Monate dieses Quartals existieren bereits Rechnungen.');
      }

      // Fetch dozent's hourly rates
      const { data: dozentProfile } = await supabase
        .from('profiles')
        .select('full_name, email, phone, tax_id, bank_name, iban, bic, street, house_number, postal_code, city, hourly_rate_unterricht, hourly_rate_elite, hourly_rate_elite_korrektur, hourly_rate_sonstige')
        .eq('id', targetDozentId)
        .single();

      if (!dozentProfile) throw new Error('Dozent profile not found');

      const rateUnterricht = dozentProfile.hourly_rate_unterricht || 0;
      const rateElite = dozentProfile.hourly_rate_elite || 0;
      const rateEliteKorrektur = dozentProfile.hourly_rate_elite_korrektur || 0;
      const rateSonstige = dozentProfile.hourly_rate_sonstige || 0;

      // Fetch hours for each missing month
      const monthlyDataPromises = missingMonths.map(async (month) => {
        const lastDayOfMonth = getLastDayOfMonth(quarterYear, month);
        const startDate = `${quarterYear}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${quarterYear}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

        // Fetch participant hours with elite_kleingruppe flag and study_goal
        const { data: participantHours } = await supabase
          .from('participant_hours')
          .select('date, hours, description, legal_area, teilnehmer:teilnehmer(name, elite_kleingruppe, study_goal)')
          .eq('dozent_id', targetDozentId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true });

        // Fetch dozent hours with category and exam_type
        const { data: dozentHours } = await supabase
          .from('dozent_hours')
          .select('date, hours, description, category, exam_type')
          .eq('dozent_id', targetDozentId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true });

        // Normalize teilnehmer object
        const normalizedParticipantHours = (participantHours || []).map((h: any) => ({
          ...h,
          teilnehmer: Array.isArray(h.teilnehmer) ? h.teilnehmer[0] : h.teilnehmer
        }));

        // Filter participant hours by exam_type
        let filteredParticipantHours = normalizedParticipantHours;
        if (examType === '1. Staatsexamen') {
          filteredParticipantHours = normalizedParticipantHours.filter((h: any) => {
            const studyGoal = h.teilnehmer?.study_goal;
            return h.teilnehmer?.elite_kleingruppe || !studyGoal || !studyGoal.includes('2. Staatsexamen');
          });
        } else if (examType === '2. Staatsexamen') {
          filteredParticipantHours = normalizedParticipantHours.filter((h: any) => {
            const studyGoal = h.teilnehmer?.study_goal;
            return !h.teilnehmer?.elite_kleingruppe && studyGoal && studyGoal.includes('2. Staatsexamen');
          });
        }

        // Filter dozent hours by exam_type and category
        let filteredDozentHours = dozentHours || [];
        if (examType === '1. Staatsexamen') {
          filteredDozentHours = (dozentHours || []).filter((h: any) => {
            const category = h.category?.toLowerCase() || '';
            const entryExamType = h.exam_type;
            
            if (category.includes('elite')) return true;
            if (entryExamType === '1. Staatsexamen') return true;
            if (!entryExamType) return true;
            
            return false;
          });
        } else if (examType === '2. Staatsexamen') {
          filteredDozentHours = (dozentHours || []).filter((h: any) => {
            const category = h.category?.toLowerCase() || '';
            const entryExamType = h.exam_type;
            
            if (category.includes('elite')) return false;
            return entryExamType === '2. Staatsexamen';
          });
        }

        // Calculate totals for this month
        const regularHours = filteredParticipantHours.filter((h: any) => !h.teilnehmer?.elite_kleingruppe);
        const eliteParticipantHours = filteredParticipantHours.filter((h: any) => h.teilnehmer?.elite_kleingruppe);
        const eliteUnterrichtHours = filteredDozentHours.filter((h: any) => h.category && h.category.toLowerCase().includes('elite') && !h.category.toLowerCase().includes('korrektur'));
        const eliteKorrekturHours = filteredDozentHours.filter((h: any) => h.category && h.category.toLowerCase().includes('elite') && h.category.toLowerCase().includes('korrektur'));
        const sonstigeHours = filteredDozentHours.filter((h: any) => !h.category || !h.category.toLowerCase().includes('elite'));

        const totalRegular = regularHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0);
        const totalElite = eliteParticipantHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0)
          + eliteUnterrichtHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0);
        const totalEliteKorrektur = eliteKorrekturHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0);
        const totalSonstige = sonstigeHours.reduce((sum: number, h: any) => sum + parseFloat(h.hours.toString()), 0);
        const totalHours = totalRegular + totalElite + totalEliteKorrektur + totalSonstige;

        const totalAmount = (totalRegular * rateUnterricht) + (totalElite * rateElite) + (totalEliteKorrektur * rateEliteKorrektur) + (totalSonstige * rateSonstige);

        return {
          month,
          year: quarterYear,
          period_start: startDate,
          period_end: endDate,
          participantHours: filteredParticipantHours as any,
          dozentHours: filteredDozentHours as any,
          totalHours,
          totalAmount
        };
      });

      const monthlyData = await Promise.all(monthlyDataPromises);

      // Calculate grand total
      const grandTotalAmount = monthlyData.reduce((sum, m) => sum + m.totalAmount, 0);

      // Calculate period dates (first month start to last month end)
      const firstMonth = Math.min(...monthlyData.map(m => m.month));
      const lastMonth = Math.max(...monthlyData.map(m => m.month));
      const periodStart = `${quarterYear}-${String(firstMonth).padStart(2, '0')}-01`;
      const lastDayOfLastMonth = new Date(quarterYear, lastMonth + 1, 0).getDate();
      const periodEnd = `${quarterYear}-${String(lastMonth).padStart(2, '0')}-${String(lastDayOfLastMonth).padStart(2, '0')}`;

      // Generate invoice number if not provided
      const invoiceNumber = customInvoiceNumber || `RE${Date.now()}`;

      // Create invoice directly with custom invoice number and date
      const { data: newInvoice, error } = await supabase
        .from('invoices')
        .insert({
          dozent_id: targetDozentId,
          invoice_number: invoiceNumber,
          month: quarter * 3 - 2, // Use first month of the quarter for the invoice
          year: quarterYear,
          period_start: periodStart,
          period_end: periodEnd,
          total_amount: grandTotalAmount,
          status: 'draft',
          exam_type: examType,
          created_at: customInvoiceDate || new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      if (!newInvoice) throw new Error('Failed to create invoice');

      // Re-fetch to ensure consistency
      await get().fetchInvoices(targetDozentId);

      return newInvoice;
    } catch (error: any) {
      console.error('Error creating quarterly invoice:', error);
      // Check for duplicate constraint error
      let errorMessage = error.message;
      if (error.message?.includes('invoices_invoice_number_dozent_unique') || 
          error.code === '23505') {
        errorMessage = 'Diese Rechnungsnummer existiert bereits für diesen Dozent. Bitte wählen Sie eine andere Rechnungsnummer.';
      }
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  }
}));