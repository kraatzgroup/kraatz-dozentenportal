import React, { useEffect, useState } from 'react';
import { lastDayOfMonth } from 'date-fns';
import { Plus, FileText, Download, Trash2, Calendar, Eye, Send, CheckCircle, Clock, X, User, AlertTriangle } from 'lucide-react';
import { useInvoiceStore, Invoice } from '../store/invoiceStore';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { supabase } from '../lib/supabase';

interface HourEntry {
  date: string;
  hours: number;
  description: string;
  legal_area?: string;
  teilnehmer_name?: string;
}

interface ConfirmHourEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  category?: string;
  elite_kleingruppe?: boolean;
  study_goal?: string;
  teilnehmer?: { name?: string };
  teilnehmer_name?: string;
  type: 'participant' | 'dozent';
}

interface InvoiceManagementProps {
  onBack: () => void;
  dozentId?: string;
  isAdmin?: boolean;
  selectedMonth?: number;
  selectedYear?: number;
  onNavigateToActivity?: () => void;
}

export function InvoiceManagement({ onBack, dozentId, isAdmin = false, selectedMonth, selectedYear, onNavigateToActivity }: InvoiceManagementProps) {
  const { invoices, isLoading, fetchInvoices, createInvoice, updateInvoice, deleteInvoice, generateInvoicePDF, createQuarterlyInvoice } = useInvoiceStore();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateTypeDialog, setShowCreateTypeDialog] = useState(false);
  const [showPeriodSelectionDialog, setShowPeriodSelectionDialog] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<{ month: number; year: number }[]>([]);
  const [availableQuarters, setAvailableQuarters] = useState<{ quarter: number; year: number; monthsWithInvoices: number[] }[]>([]);
  const [showInvoiceDetailsDialog, setShowInvoiceDetailsDialog] = useState(false);
  const [showExamTypeDialog, setShowExamTypeDialog] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceNumberError, setInvoiceNumberError] = useState('');
  const [isQuarterlyInvoice, setIsQuarterlyInvoice] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewHours, setPreviewHours] = useState<HourEntry[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [archiveFilterMonth, setArchiveFilterMonth] = useState<number | 'alle'>('alle');
  const [archiveFilterYear, setArchiveFilterYear] = useState<number>(new Date().getFullYear());
  const [createFormData, setCreateFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    examType: '1. Staatsexamen' as '1. Staatsexamen' | '2. Staatsexamen'
  });
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadInvoice, setUploadInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoursConfirmed, setHoursConfirmed] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewInvoice, setReviewInvoice] = useState<Invoice | null>(null);
  const [reviewPdfUrl, setReviewPdfUrl] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewHours, setReviewHours] = useState<any[]>([]);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; invoice: Invoice | null }>({ show: false, invoice: null });
  const [createPreviewHours, setCreatePreviewHours] = useState<ConfirmHourEntry[]>([]);
  const [createPreviewLoading, setCreatePreviewLoading] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [invoiceDeadlineDay, setInvoiceDeadlineDay] = useState<number>(5);

  // Suppress unused variable warnings
  void onBack;
  void user;
  void selectedMonth;
  void selectedYear;

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchInvoices(dozentId);
    // Fetch invoice deadline setting
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'invoice_deadline')
      .single()
      .then(({ data }) => {
        if (data?.value?.day) setInvoiceDeadlineDay(data.value.day);
      });
  }, [dozentId, fetchInvoices]);

  // Track if we've already checked for auto-create
  const [hasCheckedAutoCreate, setHasCheckedAutoCreate] = useState(false);

  // Auto-create invoices for current month if none exist (only once after initial load)
  // TEMPORARILY DISABLED FOR TESTING
  useEffect(() => {
    console.log('[Auto-Create] Disabled for testing');
    // if (!isLoading && !hasCheckedAutoCreate && dozentId && !isAdmin) {
    //   setHasCheckedAutoCreate(true);
    //   
    //   const hasFirstExamInvoice = invoices.some(
    //     invoice => invoice.month === currentMonth && invoice.year === currentYear && invoice.exam_type === '1. Staatsexamen'
    //   );
    //   
    //   const hasSecondExamInvoice = invoices.some(
    //     invoice => invoice.month === currentMonth && invoice.year === currentYear && invoice.exam_type === '2. Staatsexamen'
    //   );
    //   
    //   // Create invoice for 1. Staatsexamen if it doesn't exist
    //   if (!hasFirstExamInvoice) {
    //     createInvoice({
    //       month: currentMonth,
    //       year: currentYear,
    //       dozentId: dozentId,
    //       examType: '1. Staatsexamen'
    //     }).catch((error) => {
    //       if (!error.message?.includes('invoices_dozent_month_year_exam_type_unique')) {
    //         console.error('Error auto-creating 1. Staatsexamen invoice:', error);
    //       }
    //     });
    //   }
    //   
    //   // Create invoice for 2. Staatsexamen if it doesn't exist
    //   if (!hasSecondExamInvoice) {
    //     createInvoice({
    //       month: currentMonth,
    //       year: currentYear,
    //       dozentId: dozentId,
    //       examType: '2. Staatsexamen'
    //     }).then(() => {
    //       addToast('Rechnungen für aktuellen Monat erstellt', 'success');
    //     }).catch((error) => {
    //       if (!error.message?.includes('invoices_dozent_month_year_exam_type_unique')) {
    //         console.error('Error auto-creating 2. Staatsexamen invoice:', error);
    //       }
    //     });
    //   }
    // }
  }, [isLoading, hasCheckedAutoCreate, invoices, dozentId, isAdmin, currentMonth, currentYear, createInvoice, addToast]);

  // Current month invoices only (draft or review status, current month only)
  const currentMonthInvoices = invoices.filter(invoice => 
    invoice.status === 'draft' || invoice.status === 'review' || invoice.status === 'submitted' || invoice.status === 'sent'
  );

  // Archive invoices (submitted, sent, or paid - anything shared with admin)
  const archiveInvoices = invoices.filter(invoice => 
    invoice.status === 'submitted' || invoice.status === 'sent' || invoice.status === 'paid'
  );

  // Filter archive by month/year
  const filteredArchiveInvoices = archiveFilterMonth === 'alle'
    ? archiveInvoices.filter(invoice => invoice.year === archiveFilterYear)
    : archiveInvoices.filter(invoice => 
        invoice.month === archiveFilterMonth && invoice.year === archiveFilterYear
      );

  // Fetch hours preview when create dialog opens or month/year changes
  const fetchCreatePreviewHours = async () => {
    if (!dozentId) return;
    
    setCreatePreviewLoading(true);
    try {
      const periodStart = new Date(createFormData.year, createFormData.month - 1, 1);
      const periodEnd = new Date(createFormData.year, createFormData.month, 0);
      const startDate = periodStart.toISOString().split('T')[0];
      const lastDayOfMonth = getLastDayOfMonth(createFormData.year, createFormData.month);
      const endDate = `${createFormData.year}-${String(createFormData.month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

      console.log('Fetching hours for:', { dozentId, startDate, endDate, examType: createFormData.examType, isQuarterlyInvoice, createFormData });

      // For quarterly invoices, check which months already have invoices
      if (isQuarterlyInvoice) {
        console.log('📄 [fetchCreatePreviewHours] Quarterly invoice mode detected');
        const quarter = Math.ceil(createFormData.month / 3);
        const quarterMonths: number[] = [];
        if (quarter === 1) quarterMonths.push(1, 2, 3);
        else if (quarter === 2) quarterMonths.push(4, 5, 6);
        else if (quarter === 3) quarterMonths.push(7, 8, 9);
        else quarterMonths.push(10, 11, 12);

        console.log('📄 [fetchCreatePreviewHours] Quarter:', quarter, 'quarterMonths:', quarterMonths);

        // Fetch existing invoices for this quarter
        const { data: existingInvoices } = await supabase
          .from('invoices')
          .select('month, year')
          .eq('dozent_id', dozentId)
          .in('month', quarterMonths)
          .eq('year', createFormData.year)
          .in('status', ['draft', 'submitted', 'sent', 'paid']);

        console.log('📄 [fetchCreatePreviewHours] Existing invoices:', existingInvoices);

        const existingMonths = new Set((existingInvoices || []).map(inv => inv.month));
        const missingMonths = quarterMonths.filter(month => !existingMonths.has(month));

        console.log('📄 [fetchCreatePreviewHours] existingMonths:', existingMonths, 'missingMonths:', missingMonths);

        // If all months have invoices, return empty hours
        if (missingMonths.length === 0) {
          setCreatePreviewHours([]);
          return;
        }

        // Fetch hours only for missing months
        let allParticipantHours: any[] = [];
        let allDozentHours: any[] = [];

        for (const month of missingMonths) {
          const monthLastDay = getLastDayOfMonth(createFormData.year, month);
          const monthStartDate = `${createFormData.year}-${String(month).padStart(2, '0')}-01`;
          const monthEndDate = `${createFormData.year}-${String(month).padStart(2, '0')}-${String(monthLastDay).padStart(2, '0')}`;

          const { data: monthParticipantHours } = await supabase
            .from('participant_hours')
            .select('date, hours, description, teilnehmer:teilnehmer(name, elite_kleingruppe, study_goal)')
            .eq('dozent_id', dozentId)
            .gte('date', monthStartDate)
            .lte('date', monthEndDate)
            .order('date', { ascending: true });

          const { data: monthDozentHours } = await supabase
            .from('dozent_hours')
            .select('date, hours, description, category, exam_type')
            .eq('dozent_id', dozentId)
            .gte('date', monthStartDate)
            .lte('date', monthEndDate)
            .order('date', { ascending: true });

          allParticipantHours = [...allParticipantHours, ...(monthParticipantHours || [])];
          allDozentHours = [...allDozentHours, ...(monthDozentHours || [])];
        }

        // Normalize and filter
        const normalizedParticipantHours = allParticipantHours.map((h: any) => ({
          ...h,
          teilnehmer: Array.isArray(h.teilnehmer) ? h.teilnehmer[0] : h.teilnehmer
        }));

        let filteredParticipantHours = normalizedParticipantHours;
        if (createFormData.examType === '1. Staatsexamen') {
          filteredParticipantHours = normalizedParticipantHours.filter((h: any) => {
            const studyGoal = h.teilnehmer?.study_goal;
            return h.teilnehmer?.elite_kleingruppe || !studyGoal || !studyGoal.includes('2. Staatsexamen');
          });
        } else if (createFormData.examType === '2. Staatsexamen') {
          filteredParticipantHours = normalizedParticipantHours.filter((h: any) => {
            const studyGoal = h.teilnehmer?.study_goal;
            return !h.teilnehmer?.elite_kleingruppe && studyGoal && studyGoal.includes('2. Staatsexamen');
          });
        }

        let filteredDozentHours = allDozentHours;
        if (createFormData.examType === '1. Staatsexamen') {
          filteredDozentHours = allDozentHours.filter((h: any) => {
            const category = h.category?.toLowerCase() || '';
            const entryExamType = h.exam_type;
            
            if (category.includes('elite')) return true;
            if (entryExamType === '1. Staatsexamen') return true;
            if (!entryExamType) return true;
            
            return false;
          });
        } else if (createFormData.examType === '2. Staatsexamen') {
          filteredDozentHours = allDozentHours.filter((h: any) => {
            const category = h.category?.toLowerCase() || '';
            const entryExamType = h.exam_type;
            
            if (category.includes('elite')) return false;
            return entryExamType === '2. Staatsexamen';
          });
        }

        const allHours = [...filteredParticipantHours, ...filteredDozentHours].sort((a: any, b: any) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        setCreatePreviewHours(allHours);
        return;
      }

      // For monthly invoices, check if month already has an invoice
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('month, year')
        .eq('dozent_id', dozentId)
        .eq('month', createFormData.month)
        .eq('year', createFormData.year)
        .in('status', ['draft', 'submitted', 'sent', 'paid'])
        .single();

      if (existingInvoice) {
        console.log('Month already has invoice, returning empty hours');
        setCreatePreviewHours([]);
        return;
      }

      // Fetch participant hours with study_goal and elite_kleingruppe
      const { data: participantHours, error: phError } = await supabase
        .from('participant_hours')
        .select('date, hours, description, teilnehmer:teilnehmer(name, elite_kleingruppe, study_goal)')
        .eq('dozent_id', dozentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      console.log('Participant hours raw:', participantHours, 'Error:', phError);

      // Fetch dozent hours with category and exam_type
      const { data: dozentHours, error: dhError } = await supabase
        .from('dozent_hours')
        .select('date, hours, description, category, exam_type')
        .eq('dozent_id', dozentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      console.log('Dozent hours raw:', dozentHours, 'Error:', dhError);

      // Normalize teilnehmer object
      const normalizedParticipantHours = (participantHours || []).map((h: any) => ({
        ...h,
        teilnehmer: Array.isArray(h.teilnehmer) ? h.teilnehmer[0] : h.teilnehmer
      }));

      // Filter participant hours by exam_type
      let filteredParticipantHours = normalizedParticipantHours;
      if (createFormData.examType === '1. Staatsexamen') {
        // Show: Elite Kleingruppe OR no study_goal OR study_goal doesn't include "2. Staatsexamen"
        filteredParticipantHours = normalizedParticipantHours.filter((h: any) => {
          const studyGoal = h.teilnehmer?.study_goal;
          return h.teilnehmer?.elite_kleingruppe || !studyGoal || !studyGoal.includes('2. Staatsexamen');
        });
      } else if (createFormData.examType === '2. Staatsexamen') {
        // Show: NOT Elite Kleingruppe AND study_goal includes "2. Staatsexamen"
        filteredParticipantHours = normalizedParticipantHours.filter((h: any) => {
          const studyGoal = h.teilnehmer?.study_goal;
          return !h.teilnehmer?.elite_kleingruppe && studyGoal && studyGoal.includes('2. Staatsexamen');
        });
      }

      console.log('Filtered participant hours:', filteredParticipantHours);

      // Filter dozent hours by exam_type and category
      let filteredDozentHours = dozentHours || [];
      if (createFormData.examType === '1. Staatsexamen') {
        filteredDozentHours = (dozentHours || []).filter((h: any) => {
          const category = h.category?.toLowerCase() || '';
          const examType = h.exam_type;
          
          if (category.includes('elite')) return true;
          if (examType === '1. Staatsexamen') return true;
          if (!examType) return true;
          
          return false;
        });
      } else if (createFormData.examType === '2. Staatsexamen') {
        filteredDozentHours = (dozentHours || []).filter((h: any) => {
          const category = h.category?.toLowerCase() || '';
          const examType = h.exam_type;
          
          if (category.includes('elite')) return false;
          return examType === '2. Staatsexamen';
        });
      }

      console.log('Filtered dozent hours:', filteredDozentHours);

      // Combine and format hours
      const combined: HourEntry[] = [
        ...filteredParticipantHours.map((h: any) => ({
          date: h.date,
          hours: parseFloat(h.hours.toString()),
          description: h.teilnehmer?.name || 'Unbekannt',
          type: 'participant' as const
        })),
        ...filteredDozentHours.map((h: any) => ({
          date: h.date,
          hours: parseFloat(h.hours.toString()),
          description: h.description || h.category || 'Sonstige Tätigkeit',
          type: 'dozent' as const
        }))
      ];

      combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      console.log('Combined hours for preview:', combined);
      setCreatePreviewHours(combined as any);
    } catch (error) {
      console.error('Error fetching preview hours:', error);
    } finally {
      setCreatePreviewLoading(false);
    }
  };

  // Fetch preview when dialog opens or month/year/examType changes
  useEffect(() => {
    if (showCreateDialog) {
      fetchCreatePreviewHours();
    }
  }, [showCreateDialog, createFormData.month, createFormData.year, createFormData.examType]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const handleCreateMonthlyInvoice = async () => {
    setShowCreateTypeDialog(false);
    setIsQuarterlyInvoice(false);
    
    // Fetch available months with hours but no invoices
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      // Fetch months with hours
      const { data: participantMonths } = await supabase
        .from('participant_hours')
        .select('date')
        .eq('dozent_id', dozentId)
        .not('date', 'is', null);
      
      const { data: dozentMonths } = await supabase
        .from('dozent_hours')
        .select('date')
        .eq('dozent_id', dozentId)
        .not('date', 'is', null);
      
      // Get unique month/year combinations
      const monthYearSet = new Set<string>();
      [...(participantMonths || []), ...(dozentMonths || [])].forEach((h: any) => {
        const date = new Date(h.date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        // Exclude current month
        if (month !== currentMonth || year !== currentYear) {
          monthYearSet.add(`${year}-${month}`);
        }
      });
      
      // Fetch existing invoices
      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('month, year, period_start, period_end')
        .eq('dozent_id', dozentId);
      
      const existingMonthYearSet = new Set((existingInvoices || []).map((inv: any) => `${inv.year}-${inv.month}`));
      
      // Also exclude months that are covered by quarterly invoices
      const coveredMonths = new Set<string>();
      (existingInvoices || []).forEach((inv: any) => {
        if (inv.period_start && inv.period_end) {
          const startDate = new Date(inv.period_start);
          const endDate = new Date(inv.period_end);
          const startMonth = startDate.getMonth() + 1;
          const endMonth = endDate.getMonth() + 1;
          
          // Add all months in the period
          for (let m = startMonth; m <= endMonth; m++) {
            coveredMonths.add(`${inv.year}-${m}`);
          }
        }
      });
      
      // Filter out months with existing invoices or covered by quarterly invoices
      const availableMonths = Array.from(monthYearSet)
        .filter(my => !existingMonthYearSet.has(my) && !coveredMonths.has(my))
        .map(my => {
          const [year, month] = my.split('-').map(Number);
          return { month, year };
        })
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        });
      
      setAvailableMonths(availableMonths);
      setShowPeriodSelectionDialog(true);
    } catch (error) {
      console.error('Error fetching available months:', error);
      addToast('Fehler beim Laden der verfügbaren Monate', 'error');
    }
  };

  const handleCreateQuarterlyInvoiceDialog = async () => {
    setShowCreateTypeDialog(false);
    setIsQuarterlyInvoice(true);
    
    // Fetch available quarters with months that have hours but no invoices
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      // Fetch months with hours
      const { data: participantMonths } = await supabase
        .from('participant_hours')
        .select('date')
        .eq('dozent_id', dozentId)
        .not('date', 'is', null);
      
      const { data: dozentMonths } = await supabase
        .from('dozent_hours')
        .select('date')
        .eq('dozent_id', dozentId)
        .not('date', 'is', null);
      
      // Get unique month/year combinations
      const monthYearSet = new Set<string>();
      [...(participantMonths || []), ...(dozentMonths || [])].forEach((h: any) => {
        const date = new Date(h.date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        // Exclude current month
        if (month !== currentMonth || year !== currentYear) {
          monthYearSet.add(`${year}-${month}`);
        }
      });
      
      // Fetch existing invoices (include draft status)
      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('month, year, period_start, period_end')
        .eq('dozent_id', dozentId)
        .in('status', ['draft', 'submitted', 'sent', 'paid']);
      
      const existingMonthYearSet = new Set((existingInvoices || []).map((inv: any) => `${inv.year}-${inv.month}`));
      
      // Also include months covered by quarterly invoices
      const coveredMonths = new Set<string>();
      (existingInvoices || []).forEach((inv: any) => {
        if (inv.period_start && inv.period_end) {
          const startDate = new Date(inv.period_start);
          const endDate = new Date(inv.period_end);
          const startMonth = startDate.getMonth() + 1;
          const endMonth = endDate.getMonth() + 1;
          
          // Add all months in the period
          for (let m = startMonth; m <= endMonth; m++) {
            coveredMonths.add(`${inv.year}-${m}`);
          }
        }
      });
      
      // Filter out months with existing invoices or covered by quarterly invoices
      const availableMonths = Array.from(monthYearSet)
        .filter(my => !existingMonthYearSet.has(my) && !coveredMonths.has(my))
        .map(my => {
          const [year, month] = my.split('-').map(Number);
          return { month, year };
        });
      
      // Group by quarters - show quarters where at least 1 month is available
      const quarterSet = new Set<string>();
      const quarterMonthsMap = new Map<string, Set<number>>();

      availableMonths.forEach(({ month, year }) => {
        const quarter = Math.ceil(month / 3);
        const quarterKey = `${year}-${quarter}`;
        
        if (!quarterMonthsMap.has(quarterKey)) {
          quarterMonthsMap.set(quarterKey, new Set());
        }
        quarterMonthsMap.get(quarterKey)!.add(month);
      });

      // Include quarters where at least 1 month is available and not all months are covered
      quarterMonthsMap.forEach((months, quarterKey) => {
        const [year, quarter] = quarterKey.split('-').map(Number);
        const firstMonth = (quarter - 1) * 3 + 1;
        const lastMonth = quarter * 3;
        
        // Check if all months in this quarter are covered (either by monthly invoices or quarterly invoices)
        let allMonthsCovered = true;
        for (let m = firstMonth; m <= lastMonth; m++) {
          if (!existingMonthYearSet.has(`${year}-${m}`) && !coveredMonths.has(`${year}-${m}`)) {
            allMonthsCovered = false;
            break;
          }
        }
        
        // Only include the quarter if not all months are covered
        if (!allMonthsCovered) {
          quarterSet.add(quarterKey);
        }
      });

      const availableQuarters = Array.from(quarterSet)
        .map(qy => {
          const [year, quarter] = qy.split('-').map(Number);
          const firstMonth = (quarter - 1) * 3 + 1;
          const lastMonth = quarter * 3;
          
          // Find months in this quarter that have existing invoices or are covered by quarterly invoices
          const monthsWithInvoices: number[] = [];
          for (let m = firstMonth; m <= lastMonth; m++) {
            if (existingMonthYearSet.has(`${year}-${m}`) || coveredMonths.has(`${year}-${m}`)) {
              monthsWithInvoices.push(m);
            }
          }
          
          return { quarter, year, monthsWithInvoices };
        })
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.quarter - b.quarter;
        });
      
      setAvailableQuarters(availableQuarters);
      setShowPeriodSelectionDialog(true);
    } catch (error) {
      console.error('Error fetching available quarters:', error);
      addToast('Fehler beim Laden der verfügbaren Quartale', 'error');
    }
  };

  const handleSelectMonth = (month: number, year: number) => {
    setCreateFormData({ month, year, examType: createFormData.examType });
    setShowPeriodSelectionDialog(false);
    // Generate suggested invoice number
    const lastInvoice = invoices.find(inv => inv.dozent_id === dozentId);
    if (lastInvoice) {
      const lastNumber = parseInt(lastInvoice.invoice_number.replace(/\D/g, ''));
      const newNumber = lastNumber + 1;
      setInvoiceNumber(`RE${String(newNumber).padStart(8, '0')}`);
    } else {
      setInvoiceNumber('RE00000001');
    }
    setShowInvoiceDetailsDialog(true);
  };

  const handleSelectQuarter = (quarter: number, year: number) => {
    console.log('📄 [handleSelectQuarter] Called with quarter:', quarter, 'year:', year);
    // Calculate the first month of the quarter
    const firstMonth = (quarter - 1) * 3 + 1;
    setCreateFormData({ month: firstMonth, year, examType: createFormData.examType });
    setIsQuarterlyInvoice(true);
    console.log('📄 [handleSelectQuarter] Set isQuarterlyInvoice to true');
    setShowPeriodSelectionDialog(false);
    // Generate suggested invoice number
    const lastInvoice = invoices.find(inv => inv.dozent_id === dozentId);
    if (lastInvoice) {
      const lastNumber = parseInt(lastInvoice.invoice_number.replace(/\D/g, ''));
      const newNumber = lastNumber + 1;
      setInvoiceNumber(`RE${String(newNumber).padStart(8, '0')}`);
    } else {
      setInvoiceNumber('RE00000001');
    }
    setShowInvoiceDetailsDialog(true);
  };

  const handleInvoiceNumberBlur = async () => {
    if (!invoiceNumber || !dozentId) return;

    console.log('📄 [Invoice Number Validation] Checking invoiceNumber:', invoiceNumber, 'for dozentId:', dozentId);

    try {
      const { data: existingInvoice, error } = await supabase
        .from('invoices')
        .select('id')
        .eq('invoice_number', invoiceNumber)
        .eq('dozent_id', dozentId)
        .maybeSingle();

      if (error) {
        console.error('📄 [Invoice Number Validation] Error checking invoice number:', error);
        setInvoiceNumberError('');
        return;
      }

      if (existingInvoice) {
        console.log('📄 [Invoice Number Validation] Invoice number already exists');
        setInvoiceNumberError('Diese Rechnungsnummer existiert bereits für diesen Dozent.');
      } else {
        console.log('📄 [Invoice Number Validation] Invoice number is available');
        setInvoiceNumberError('');
      }
    } catch (error) {
      console.error('📄 [Invoice Number Validation] Error checking invoice number:', error);
      setInvoiceNumberError('');
    }
  };

  const handleConfirmInvoiceDetails = async () => {
    setShowInvoiceDetailsDialog(false);
    // Fetch hours before showing confirm modal
    setCreatePreviewLoading(true);
    try {
      console.log('📄 [handleConfirmInvoiceDetails] isQuarterlyInvoice:', isQuarterlyInvoice);
      
      // For quarterly invoices, use fetchCreatePreviewHours which has the correct logic
      if (isQuarterlyInvoice) {
        console.log('📄 [handleConfirmInvoiceDetails] Using fetchCreatePreviewHours for quarterly invoice');
        await fetchCreatePreviewHours();
        setShowConfirmModal(true);
        return;
      }
      
      // For monthly invoices, use the original logic
      const lastDayOfMonth = getLastDayOfMonth(createFormData.year, createFormData.month);
      console.log('📄 [handleConfirmInvoiceDetails] Calculating lastDayOfMonth:', {
        year: createFormData.year,
        month: createFormData.month,
        lastDayOfMonth,
        endDate: `${createFormData.year}-${String(createFormData.month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
      });
      const { data: participantHours } = await supabase
        .from('participant_hours')
        .select('id, date, hours, description, legal_area, teilnehmer(name)')
        .eq('dozent_id', dozentId)
        .gte('date', `${createFormData.year}-${String(createFormData.month).padStart(2, '0')}-01`)
        .lte('date', `${createFormData.year}-${String(createFormData.month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`);

      const { data: dozentHours } = await supabase
        .from('dozent_hours')
        .select('id, date, hours, description, category')
        .eq('dozent_id', dozentId)
        .gte('date', `${createFormData.year}-${String(createFormData.month).padStart(2, '0')}-01`)
        .lte('date', `${createFormData.year}-${String(createFormData.month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`);

      const allHours: HourEntry[] = [
        ...(participantHours || []).map(h => ({
          id: h.id,
          date: h.date,
          hours: h.hours,
          description: h.description,
          category: h.legal_area,
          elite_kleingruppe: h.description?.includes('Elite-Kleingruppe') || h.legal_area?.includes('Elite-Kleingruppe'),
          study_goal: h.legal_area,
          teilnehmer: h.teilnehmer,
          type: 'participant' as const
        })),
        ...(dozentHours || []).map(h => ({
          id: h.id,
          date: h.date,
          hours: h.hours,
          description: h.description,
          category: h.category,
          elite_kleingruppe: h.description?.includes('Elite-Kleingruppe') || h.category?.includes('Elite-Kleingruppe'),
          type: 'dozent' as const
        }))
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setCreatePreviewHours(allHours as any);
      setShowConfirmModal(true);
    } catch (error) {
      console.error('Error fetching hours:', error);
      addToast('Fehler beim Laden der Stunden', 'error');
    } finally {
      setCreatePreviewLoading(false);
    }
  };

  const handleConfirmExamType = (examType: '1. Staatsexamen' | '2. Staatsexamen') => {
    setCreateFormData(prev => ({ ...prev, examType }));
    setShowExamTypeDialog(false);
    setShowCreateTypeDialog(true);
  };

  const openReviewModal = async (invoice: Invoice) => {
    setReviewInvoice(invoice);
    setShowReviewModal(true);
    setReviewLoading(true);
    setHoursConfirmed(false);
    setReviewPdfUrl(null);

    try {
      // Fetch full invoice data with dozent info
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select(`
          *,
          dozent:profiles!invoices_dozent_id_fkey(full_name, email, phone, tax_id, bank_name, iban, bic, street, house_number, postal_code, city, hourly_rate_unterricht, hourly_rate_elite, hourly_rate_elite_korrektur, hourly_rate_sonstige)
        `)
        .eq('id', invoice.id)
        .single();

      if (!invoiceData) {
        throw new Error('Rechnung nicht gefunden');
      }

      // Use the invoice_number from the database - it's already set by the trigger
      const finalInvoiceNumber = invoiceData.invoice_number;

      // Fetch participant hours with elite_kleingruppe flag and study_goal
      const { data: participantHours } = await supabase
        .from('participant_hours')
        .select(`
          date, hours, description, legal_area,
          teilnehmer:teilnehmer(name, elite_kleingruppe, study_goal)
        `)
        .eq('dozent_id', invoiceData.dozent_id)
        .gte('date', invoiceData.period_start)
        .lte('date', invoiceData.period_end)
        .order('date', { ascending: true });

      // Fetch dozent hours with category and exam_type
      const { data: dozentHours } = await supabase
        .from('dozent_hours')
        .select('date, hours, description, category, exam_type')
        .eq('dozent_id', invoiceData.dozent_id)
        .gte('date', invoiceData.period_start)
        .lte('date', invoiceData.period_end)
        .order('date', { ascending: true });

      // Normalize teilnehmer object
      const normalizedParticipantHours = (participantHours || []).map((h: any) => ({
        ...h,
        teilnehmer: Array.isArray(h.teilnehmer) ? h.teilnehmer[0] : h.teilnehmer
      }));

      // Filter hours by exam_type
      let filteredParticipantHours = normalizedParticipantHours;
      let filteredDozentHours = dozentHours || [];

      if (invoiceData.exam_type === '1. Staatsexamen') {
        filteredParticipantHours = normalizedParticipantHours.filter((h: any) => {
          const studyGoal = h.teilnehmer?.study_goal;
          return h.teilnehmer?.elite_kleingruppe || !studyGoal || !studyGoal.includes('2. Staatsexamen');
        });
        filteredDozentHours = (dozentHours || []).filter((h: any) => {
          const category = h.category?.toLowerCase() || '';
          const entryExamType = h.exam_type;
          if (category.includes('elite')) return true;
          if (entryExamType === '1. Staatsexamen') return true;
          if (!entryExamType) return true;
          return false;
        });
      } else if (invoiceData.exam_type === '2. Staatsexamen') {
        filteredParticipantHours = normalizedParticipantHours.filter((h: any) => {
          const studyGoal = h.teilnehmer?.study_goal;
          return !h.teilnehmer?.elite_kleingruppe && studyGoal && studyGoal.includes('2. Staatsexamen');
        });
        filteredDozentHours = (dozentHours || []).filter((h: any) => {
          const category = h.category?.toLowerCase() || '';
          const entryExamType = h.exam_type;
          if (category.includes('elite')) return false;
          return entryExamType === '2. Staatsexamen';
        });
      }

      // Combine all hours
      const allHours = [
        ...filteredParticipantHours.map(h => ({
          id: h.id,
          date: h.date,
          hours: h.hours,
          description: h.description,
          legal_area: h.legal_area,
          elite_kleingruppe: h.description?.includes('Elite-Kleingruppe') || h.legal_area?.includes('Elite-Kleingruppe'),
          study_goal: h.legal_area,
          teilnehmer: h.teilnehmer,
          type: 'participant' as const
        })),
        ...filteredDozentHours.map((h: any) => ({
          id: h.id,
          date: h.date,
          hours: h.hours,
          description: h.description,
          category: h.category,
          elite_kleingruppe: h.description?.includes('Elite-Kleingruppe') || h.category?.includes('Elite-Kleingruppe'),
          type: 'dozent' as const
        }))
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setReviewHours(allHours);

      // Generate PDF for preview
      const { generateInvoicePDFBlob } = await import('../utils/invoicePDFGenerator');
      const pdfBlob = await generateInvoicePDFBlob({
        invoice: { ...invoiceData, dozent: invoiceData.dozent },
        participantHours: filteredParticipantHours as any,
        dozentHours: filteredDozentHours as any
      });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setReviewPdfUrl(pdfUrl);
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      addToast('Fehler beim Laden der Rechnungsdetails', 'error');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleConfirmInvoice = async () => {
    setShowConfirmModal(false);

    try {
      if (isQuarterlyInvoice) {
        console.log('📄 [Quarterly Invoice] Creating with invoiceNumber:', invoiceNumber, 'invoiceDate:', invoiceDate, 'examType:', createFormData.examType);
        const newInvoice = await createQuarterlyInvoice({
          dozentId: dozentId,
          examType: createFormData.examType,
          invoiceNumber,
          invoiceDate
        });
        await fetchInvoices(dozentId);
        // Open review modal for the newly created invoice
        openReviewModal(newInvoice);
        addToast('Quartals-Rechnung erfolgreich erstellt', 'success');
      } else {
        console.log('📄 [Monthly Invoice] Creating with invoiceNumber:', invoiceNumber, 'invoiceDate:', invoiceDate, 'examType:', createFormData.examType);
        const newInvoice = await createInvoice({
          month: createFormData.month,
          year: createFormData.year,
          dozentId: dozentId,
          examType: createFormData.examType,
          invoiceNumber,
          invoiceDate
        });
        await fetchInvoices(dozentId);
        setShowCreateDialog(false);
        setCreateFormData({
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          examType: '1. Staatsexamen'
        });

        // Open review modal immediately after creation
        if (newInvoice) {
          openReviewModal(newInvoice);
          addToast('Rechnung erfolgreich erstellt', 'success');
        }
      }
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      const errorMessage = error.message?.includes('invoices_invoice_number_dozent_unique') || error.code === '23505'
        ? 'Diese Rechnungsnummer existiert bereits für diesen Dozent. Bitte wählen Sie eine andere Rechnungsnummer.'
        : error.message?.includes('invoices_dozent_month_year_unique') || error.code === '23505'
        ? 'Es gibt bereits eine Rechnung für diesen Monat.'
        : 'Fehler beim Erstellen der Rechnung';
      addToast(errorMessage, 'error');
    }
  };

  const handleCorrectInvoice = async () => {
    if (!reviewInvoice) return;
    
    try {
      await deleteInvoice(reviewInvoice.id);
      setShowReviewModal(false);
      setReviewInvoice(null);
      if (reviewPdfUrl) {
        URL.revokeObjectURL(reviewPdfUrl);
        setReviewPdfUrl(null);
      }
      window.location.href = '/dashboard?tab=taetigkeitsbericht';
      addToast('Rechnung gelöscht. Bitte korrigieren Sie Ihre Stunden im Tätigkeitsbericht.', 'success');
      
      // Navigate to activity report
      if (onNavigateToActivity) {
        onNavigateToActivity();
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      addToast('Fehler beim Löschen der Rechnung', 'error');
    }
  };

  const handleConfirmAndSubmit = async () => {
    if (!reviewInvoice || !hoursConfirmed || !reviewPdfUrl) return;
    
    setIsSubmitting(true);
    try {
      // Use the already generated PDF from the preview (reviewPdfUrl is a blob URL)
      // Fetch the blob from the URL
      const response = await fetch(reviewPdfUrl);
      const pdfBlob = await response.blob();
      
      // Upload PDF to Supabase Storage directly - the blob already has correct type
      const monthName = getMonthName(reviewInvoice.month);
      const dozentName = (reviewInvoice.dozent?.full_name || '').replace(/\s+/g, '_');
      const fileName = `${reviewInvoice.dozent_id}/${reviewInvoice.invoice_number}_${monthName}_${reviewInvoice.year}_${dozentName}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, pdfBlob, { 
          contentType: 'application/pdf',
          upsert: true 
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Fehler beim Hochladen der PDF');
      }

      // Fix MIME type in storage metadata (Supabase bug workaround)
      await supabase.rpc('fix_storage_mimetype', { file_path: fileName });

      // Update invoice with file_path and status
      await updateInvoice(reviewInvoice.id, {
        status: 'submitted' as const,
        submitted_at: new Date().toISOString(),
        file_path: fileName
      });
      
      setShowReviewModal(false);
      setReviewInvoice(null);
      if (reviewPdfUrl) {
        URL.revokeObjectURL(reviewPdfUrl);
        setReviewPdfUrl(null);
      }
      setHoursConfirmed(false);
      addToast('Rechnung erfolgreich an Verwaltung übermittelt', 'success');
    } catch (error) {
      console.error('Error submitting invoice:', error);
      addToast('Fehler beim Übermitteln der Rechnung', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deleteModal.invoice) return;
    
    try {
      await deleteInvoice(deleteModal.invoice.id);
      addToast('Rechnung gelöscht', 'success');
    } catch (error) {
      console.error('Error deleting invoice:', error);
      addToast('Fehler beim Löschen der Rechnung', 'error');
    } finally {
      setDeleteModal({ show: false, invoice: null });
    }
  };

  const handleStatusChange = async (invoice: Invoice, newStatus: 'draft' | 'review' | 'submitted' | 'sent' | 'paid') => {
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'submitted') {
        updateData.submitted_at = new Date().toISOString();
      } else if (newStatus === 'sent' && !invoice.sent_at) {
        updateData.sent_at = new Date().toISOString();
      } else if (newStatus === 'paid' && !invoice.paid_at) {
        updateData.paid_at = new Date().toISOString();
      }
      
      await updateInvoice(invoice.id, updateData);
      
      // Show success toast
      const statusMessages: Record<string, string> = {
        'review': 'Rechnung zur Überprüfung markiert',
        'submitted': 'Rechnung an Verwaltung übermittelt',
        'sent': 'Rechnung als versendet markiert',
        'paid': 'Rechnung als bezahlt markiert'
      };
      addToast(statusMessages[newStatus] || 'Status aktualisiert', 'success');
    } catch (error) {
      console.error('Error updating invoice status:', error);
      addToast('Fehler beim Aktualisieren des Status', 'error');
    }
  };

  const handleSubmitInvoice = async () => {
    if (!uploadInvoice) {
      addToast('Keine Rechnung ausgewählt', 'error');
      return;
    }

    if (!hoursConfirmed) {
      addToast('Bitte bestätigen Sie die Richtigkeit der Stundenauflistung', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Fetch full invoice data with dozent info
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          dozent:profiles!invoices_dozent_id_fkey(full_name, email, phone, tax_id, bank_name, iban, bic, street, house_number, postal_code, city, hourly_rate_unterricht, hourly_rate_elite, hourly_rate_elite_korrektur, hourly_rate_sonstige)
        `)
        .eq('id', uploadInvoice.id)
        .single();

      if (invoiceError || !invoiceData) {
        throw new Error('Rechnung nicht gefunden');
      }

      // Fetch participant hours with elite_kleingruppe flag
      const { data: participantHours } = await supabase
        .from('participant_hours')
        .select(`
          date, hours, description, legal_area,
          teilnehmer:teilnehmer(name, elite_kleingruppe)
        `)
        .eq('dozent_id', invoiceData.dozent_id)
        .gte('date', invoiceData.period_start)
        .lte('date', invoiceData.period_end)
        .order('date', { ascending: true });

      // Fetch dozent hours with category
      const { data: dozentHours } = await supabase
        .from('dozent_hours')
        .select('date, hours, description, category')
        .eq('dozent_id', invoiceData.dozent_id)
        .gte('date', invoiceData.period_start)
        .lte('date', invoiceData.period_end)
        .order('date', { ascending: true });

      // Generate PDF
      const { generateInvoicePDFBlob } = await import('../utils/invoicePDFGenerator');
      const pdfBlob = await generateInvoicePDFBlob({
        invoice: { ...invoiceData, dozent: invoiceData.dozent },
        participantHours: (participantHours || []) as any,
        dozentHours: (dozentHours || []) as any
      });

      // Convert Blob to File with correct MIME type
      const monthName = getMonthName(invoiceData.month);
      const dozentName = (invoiceData.dozent?.full_name || '').replace(/\s+/g, '_');
      const pdfFileName = `${invoiceData.invoice_number}_${monthName}_${invoiceData.year}_${dozentName}.pdf`;
      const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

      // Upload PDF to Supabase Storage
      const fileName = `${invoiceData.dozent_id}/${pdfFileName}`;
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, pdfFile, { 
          contentType: 'application/pdf',
          upsert: true 
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Fehler beim Hochladen der PDF');
      }

      // Update invoice with file_path and status
      const updateData = {
        status: 'submitted' as const,
        submitted_at: new Date().toISOString(),
        file_path: fileName
      };

      await updateInvoice(uploadInvoice.id, updateData);
      
      addToast('Rechnung erfolgreich an Verwaltung übermittelt', 'success');
      setShowUploadDialog(false);
      setUploadInvoice(null);
      setHoursConfirmed(false);
    } catch (error) {
      console.error('Error submitting invoice:', error);
      addToast('Fehler beim Übermitteln der Rechnung', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = async (invoice: Invoice) => {
    setShowPreviewModal(true);
    setPreviewLoading(true);
    setPreviewHours([]);

    try {
      // Fetch fresh invoice data to get current file_path
      const { data: freshInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoice.id)
        .single();

      if (invoiceError) throw invoiceError;
      
      // Merge fresh data with existing invoice (to keep dozent info)
      setPreviewInvoice({ ...invoice, file_path: freshInvoice?.file_path });

      // If file exists, download it as blob and create URL for preview
      if (freshInvoice?.file_path) {
        const { data: pdfData, error: downloadError } = await supabase.storage
          .from('invoices')
          .download(freshInvoice.file_path);
        
        if (!downloadError && pdfData) {
          // Create blob with correct MIME type
          const pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
          const url = URL.createObjectURL(pdfBlob);
          setPreviewPdfUrl(url);
        }
      }

      // Fetch participant hours for this invoice period
      const { data: participantHours, error: pError } = await supabase
        .from('participant_hours')
        .select(`
          date,
          hours,
          description,
          legal_area,
          teilnehmer:teilnehmer(name)
        `)
        .eq('dozent_id', invoice.dozent_id)
        .gte('date', invoice.period_start)
        .lte('date', invoice.period_end)
        .order('date', { ascending: true });

      if (pError) throw pError;

      // Fetch dozent hours (sonstige Tätigkeiten)
      const { data: dozentHours, error: dError } = await supabase
        .from('dozent_hours')
        .select('date, hours, description')
        .eq('dozent_id', invoice.dozent_id)
        .gte('date', invoice.period_start)
        .lte('date', invoice.period_end)
        .order('date', { ascending: true });

      if (dError) throw dError;

      // Transform and combine data
      const hours: HourEntry[] = [
        ...(participantHours || []).map((h: any) => ({
          date: h.date,
          hours: h.hours,
          description: h.description,
          legal_area: h.legal_area,
          teilnehmer_name: h.teilnehmer?.name || 'Unbekannt'
        })),
        ...(dozentHours || []).map((h: any) => ({
          date: h.date,
          hours: h.hours,
          description: h.description,
          legal_area: 'Sonstige',
          teilnehmer_name: h.description || 'Sonstige Tätigkeit'
        }))
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setPreviewHours(hours);
    } catch (error) {
      console.error('Error fetching preview hours:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'review': return 'bg-orange-100 text-orange-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'sent': return 'bg-purple-100 text-purple-800';
      case 'paid': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Ausstehend';
      case 'review': return 'Überprüfen';
      case 'submitted': return 'Übermittelt';
      case 'sent': return 'Versendet';
      case 'paid': return 'Bezahlt';
      default: return status;
    }
  };

  const getMonthName = (month: number) => {
    return new Date(2023, month - 1).toLocaleDateString('de-DE', { month: 'long' });
  };

  const getQuarterName = (month: number) => {
    const quarter = Math.ceil(month / 3);
    return `${quarter}. Quartal`;
  };

  const getInvoicePeriodDisplay = (invoice: Invoice) => {
    // Check if this is a quarterly invoice (period_start and period_end span multiple months)
    const startDate = new Date(invoice.period_start);
    const endDate = new Date(invoice.period_end);
    
    const startMonth = startDate.getMonth() + 1;
    const endMonth = endDate.getMonth() + 1;
    
    // If it spans multiple months, display all months
    if (startMonth !== endMonth) {
      const months: string[] = [];
      for (let m = startMonth; m <= endMonth; m++) {
        months.push(getMonthName(m));
      }
      return `${months.join(' & ')} ${invoice.year}`;
    }
    
    // Otherwise, just show the single month
    return `${getMonthName(invoice.month)} ${invoice.year}`;
  };

  const getLastDayOfMonth = (year: number, month: number): number => {
    // Use date-fns to get the last day of the month
    const date = new Date(year, month - 1, 1);
    const result = lastDayOfMonth(date).getDate();
    console.log('📄 [getLastDayOfMonth] Debug:', { year, month, result, date });
    return result;
  };

  const getMonthDateRange = (month: number, year: number): string => {
    const startDate = `${String(1).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
    const lastDay = getLastDayOfMonth(year, month);
    const endDate = `${String(lastDay).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
    return `${startDate} - ${endDate}`;
  };

  const getQuarterDateRange = (quarter: number, year: number): string => {
    const firstMonth = (quarter - 1) * 3 + 1;
    const lastMonth = quarter * 3;
    const startDate = `${String(1).padStart(2, '0')}.${String(firstMonth).padStart(2, '0')}.${year}`;
    const lastDay = getLastDayOfMonth(year, lastMonth);
    const endDate = `${String(lastDay).padStart(2, '0')}.${String(lastMonth).padStart(2, '0')}.${year}`;
    return `${startDate} - ${endDate}`;
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Eigene Rechnungen
          </h3>
          <button
            onClick={() => setShowExamTypeDialog(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Rechnung erstellen
          </button>
        </div>
        {!isAdmin && currentMonthInvoices.length > 0 && (() => {
          const now = new Date();
          const deadlineDate = new Date(now.getFullYear(), now.getMonth() + 1, invoiceDeadlineDay);
          const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const isUrgent = daysLeft <= 5;
          const deadlineMonthName = deadlineDate.toLocaleDateString('de-DE', { month: 'long' });
          return (
            <div className={`mt-3 flex items-start gap-2 rounded-md p-3 text-sm ${
              isUrgent
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-amber-50 border border-amber-200 text-amber-800'
            }`}>
              <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
              <div>
                <span className="font-medium">
                  Rechnungsfrist: {invoiceDeadlineDay}. {deadlineMonthName}
                </span>
                <span className="ml-1">
                  — Bitte reichen Sie Ihre Rechnung bis zum <strong>{invoiceDeadlineDay}.</strong> des Folgemonats ein, da sie sonst erst im darauffolgenden Monat berücksichtigt werden kann.
                </span>
                {isUrgent && daysLeft > 0 && (
                  <span className="ml-1 font-semibold">Noch {daysLeft} {daysLeft === 1 ? 'Tag' : 'Tage'}!</span>
                )}
                {daysLeft <= 0 && (
                  <span className="ml-1 font-semibold">Frist abgelaufen!</span>
                )}
              </div>
            </div>
          );
        })()}
      </div>
      
      <div className="p-6 space-y-6">
      {/* Header */}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : currentMonthInvoices.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          <p>Keine offenen Rechnungen für {getMonthName(currentMonth)} {currentYear}</p>
          {!isAdmin && (
            <p className="mt-1 text-xs text-gray-400">
              Rechnungsfrist: bis zum <span className="font-medium">{invoiceDeadlineDay}.</span> des Folgemonats einreichen, sonst wird sie erst im darauffolgenden Monat berücksichtigt.
            </p>
          )}
        </div>
      ) : (
        /* Current Month Invoices List */
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {currentMonthInvoices.map((invoice) => (
              <li key={invoice.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          invoice.exam_type === '2. Staatsexamen' 
                            ? 'bg-amber-100' 
                            : 'bg-primary/10'
                        }`}>
                          <FileText className={`h-5 w-5 ${
                            invoice.exam_type === '2. Staatsexamen' 
                              ? 'text-amber-600' 
                              : 'text-primary'
                          }`} />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-gray-900">{invoice.invoice_number}</h4>
                          {invoice.exam_type && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              invoice.exam_type === '2. Staatsexamen'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {invoice.exam_type}
                            </span>
                          )}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                            {getStatusText(invoice.status)}
                          </span>
                        </div>
                        <div className="flex items-center mt-1 text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span>{getInvoicePeriodDisplay(invoice)}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Erstellt: {new Date(invoice.created_at).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 ml-14 sm:ml-0">
                      {/* Dozent Workflow Buttons (not admin) */}
                      {!isAdmin && (
                        <>
                          {/* Draft -> Open Review Modal */}
                          {invoice.status === 'draft' && (
                            <button
                              onClick={() => openReviewModal(invoice)}
                              className="inline-flex items-center px-3 py-1.5 border border-primary text-xs font-medium rounded-md text-white bg-primary hover:bg-primary/90"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Überprüfen & Einreichen
                            </button>
                          )}
                          
                          {/* Submitted confirmation */}
                          {invoice.status === 'submitted' && (
                            <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700">
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Übermittelt
                            </span>
                          )}
                        </>
                      )}
                      
                      {/* Admin Buttons */}
                      {isAdmin && invoice.status === 'submitted' && (
                        <button
                          onClick={() => handleStatusChange(invoice, 'paid')}
                          className="inline-flex items-center px-3 py-1.5 border border-green-300 text-xs font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100"
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Als bezahlt markieren
                        </button>
                      )}
                      
                      {/* Download Button */}
                      <button
                        onClick={() => generateInvoicePDF(invoice.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        title="PDF herunterladen"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      
                      {/* Delete Button (only for draft/review) */}
                      {(invoice.status === 'draft' || invoice.status === 'review') && !isAdmin && (
                        <button
                          onClick={() => setDeleteModal({ show: true, invoice })}
                          className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                          title="Rechnung löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Archive Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-4 border-b border-gray-200 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg font-medium text-gray-900">Übermittelte Rechnungen</h3>
            <div className="flex items-center gap-2">
              <select
                value={archiveFilterMonth}
                onChange={(e) => setArchiveFilterMonth(e.target.value === 'alle' ? 'alle' : parseInt(e.target.value))}
                className="text-sm rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
              >
                <option value="alle">Alle Monate</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {getMonthName(i + 1)}
                  </option>
                ))}
              </select>
              <select
                value={archiveFilterYear}
                onChange={(e) => setArchiveFilterYear(parseInt(e.target.value))}
                className="text-sm rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - 2 + i;
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
        
        {filteredArchiveInvoices.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <Clock className="h-8 w-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm">Keine archivierten Rechnungen für diesen Zeitraum</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredArchiveInvoices.map((invoice) => (
              <li key={invoice.id}>
                <div className="px-4 py-3 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="ml-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                            {getStatusText(invoice.status)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {getInvoicePeriodDisplay(invoice)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePreview(invoice)}
                        className="p-1.5 text-gray-400 hover:text-primary rounded"
                        title="Vorschau"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => generateInvoicePDF(invoice.id)}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded"
                        title="PDF herunterladen"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {invoice.status !== 'paid' && (
                        <button
                          onClick={() => setDeleteModal({ show: true, invoice })}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                          title="Rechnung löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create Type Dialog */}
      {showCreateTypeDialog && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowCreateTypeDialog(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <Plus className="h-6 w-6 text-primary mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">Rechnung erstellen</h3>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Wählen Sie den Zeitraum für die Rechnung:
                </p>

                <div className="space-y-3">
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="invoiceType"
                      value="monthly"
                      className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                      onChange={() => handleCreateMonthlyInvoice()}
                    />
                    <span className="ml-3 text-sm text-gray-700">Monatlich</span>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="invoiceType"
                      value="quarterly"
                      className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                      onChange={() => handleCreateQuarterlyInvoiceDialog()}
                    />
                    <span className="ml-3 text-sm text-gray-700">Quartalsweise</span>
                  </label>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateTypeDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Period Selection Dialog */}
      {showPeriodSelectionDialog && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowPeriodSelectionDialog(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <Plus className="h-6 w-6 text-primary mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">
                    {isQuarterlyInvoice ? 'Quartal auswählen' : 'Monat auswählen'}
                  </h3>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  {isQuarterlyInvoice
                    ? 'Wählen Sie das Quartal für die Rechnung:'
                    : 'Wählen Sie den Monat für die Rechnung:'}
                </p>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {isQuarterlyInvoice ? (
                    availableQuarters.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Keine verfügbaren Quartale gefunden
                      </p>
                    ) : (
                      availableQuarters.map(({ quarter, year, monthsWithInvoices }) => (
                        <label key={`${year}-${quarter}`} className="flex flex-col p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                          <div className="flex items-center">
                            <input
                              type="radio"
                              name="quarter"
                              className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                              onChange={() => handleSelectQuarter(quarter, year)}
                            />
                            <span className="ml-3 text-sm text-gray-700">
                              {quarter}. Quartal {year}
                            </span>
                          </div>
                          <span className="ml-7 text-xs text-gray-500 mt-1">
                            {getQuarterDateRange(quarter, year)}
                          </span>
                          {monthsWithInvoices.length > 0 && (
                            <span className="ml-7 text-xs text-orange-600 mt-1">
                              {monthsWithInvoices.map((m: number) => getMonthName(m)).join(', ')} bereits fakturiert
                            </span>
                          )}
                        </label>
                      ))
                    )
                  ) : (
                    availableMonths.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Keine verfügbaren Monate gefunden
                      </p>
                    ) : (
                      availableMonths.map(({ month, year }) => (
                        <label key={`${year}-${month}`} className="flex flex-col p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                          <div className="flex items-center">
                            <input
                              type="radio"
                              name="month"
                              className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                              onChange={() => handleSelectMonth(month, year)}
                            />
                            <span className="ml-3 text-sm text-gray-700">
                              {getMonthName(month)} {year}
                            </span>
                          </div>
                          <span className="ml-7 text-xs text-gray-500 mt-1">
                            {getMonthDateRange(month, year)}
                          </span>
                        </label>
                      ))
                    )
                  )}
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPeriodSelectionDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Dialog */}
      {showInvoiceDetailsDialog && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowInvoiceDetailsDialog(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <Plus className="h-6 w-6 text-primary mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">Rechnungsdetails</h3>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Geben Sie das Rechnungsdatum und die Rechnungsnummer für die neue Rechnung ein:
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsdatum</label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsnummer</label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => {
                        setInvoiceNumber(e.target.value);
                        setInvoiceNumberError('');
                        // Validate immediately when user types
                        if (e.target.value) {
                          handleInvoiceNumberBlur();
                        }
                      }}
                      onBlur={handleInvoiceNumberBlur}
                      className={`w-full px-3 py-2 border rounded-md ${invoiceNumberError ? 'border-red-500' : ''}`}
                      placeholder="z.B. RE00000001"
                    />
                    {invoiceNumberError && (
                      <p className="text-xs text-red-500 mt-1">{invoiceNumberError}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInvoiceDetailsDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInvoiceDetails}
                  disabled={!invoiceNumber || !!invoiceNumberError}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Weiter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exam Type Dialog */}
      {showExamTypeDialog && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowExamTypeDialog(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <Plus className="h-6 w-6 text-primary mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">Staatsexamen</h3>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Wählen Sie das Staatsexamen für die Rechnung:
                </p>

                <div className="space-y-3">
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="examType"
                      value="1. Staatsexamen"
                      className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                      onChange={() => handleConfirmExamType('1. Staatsexamen')}
                    />
                    <span className="ml-3 text-sm text-gray-700">1. Staatsexamen</span>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="examType"
                      value="2. Staatsexamen"
                      className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                      onChange={() => handleConfirmExamType('2. Staatsexamen')}
                    />
                    <span className="ml-3 text-sm text-gray-700">2. Staatsexamen</span>
                  </label>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowExamTypeDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Invoice Modal */}
      {showConfirmModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowConfirmModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <CheckCircle className="h-6 w-6 text-primary mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">Rechnung erstellen</h3>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  {isQuarterlyInvoice 
                    ? `Möchten Sie die Quartalsrechnung für das ${getQuarterName(createFormData.month)} ${createFormData.year} erstellen?`
                    : `Möchten Sie die Rechnung für ${getMonthName(createFormData.month)} ${createFormData.year} erstellen?`
                  }
                </p>

                <div className="space-y-2 text-sm text-gray-700 mb-4">
                  <p><strong>Rechnungsnummer:</strong> {invoiceNumber}</p>
                  <p><strong>Rechnungsdatum:</strong> {invoiceDate ? new Date(invoiceDate).toLocaleDateString('de-DE') : '-'}</p>
                  {isQuarterlyInvoice && (
                    <p><strong>Leistungszeitraum:</strong> {getQuarterDateRange(Math.ceil(createFormData.month / 3), createFormData.year)}</p>
                  )}
                  <p><strong>Staatsexamen:</strong> {createFormData.examType}</p>
                </div>

                {createPreviewLoading ? (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <p className="text-sm text-gray-500 mt-2">Stunden werden geladen...</p>
                  </div>
                ) : (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Stundenübersicht ({createPreviewHours.length} Einträge):</h4>
                    <div className="max-h-60 overflow-y-auto border rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr key="header">
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Typ</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beschreibung</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stunden</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {createPreviewHours.map((hour, index) => (
                            <tr key={hour.id || index}>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {new Date(hour.date).toLocaleDateString('de-DE')}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                <div className="flex flex-col">
                                  {hour.type === 'participant' ? (
                                    <span>Einzelunterricht</span>
                                  ) : hour.category === 'Elite-Kleingruppe Korrektur' ? (
                                    <>
                                      <span>Elite-Kleingruppe</span>
                                      <span className="text-xs text-gray-500">Klausurenkorrektur</span>
                                    </>
                                  ) : hour.category?.includes('Elite-Kleingruppe') ? (
                                    <span>Elite-Kleingruppe</span>
                                  ) : (
                                    <span>{hour.category || 'Sonstige Tätigkeit'}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 max-w-md line-clamp-2" title={hour.type === 'participant' ? `${hour.category || '-'} - ${hour.teilnehmer?.name || '-'} - ${hour.description || '-'}` : hour.description || '-'}>
                                {hour.type === 'participant' 
                                  ? `${hour.category || '-'} - ${hour.teilnehmer?.name || '-'} - ${hour.description || '-'}`
                                  : hour.description?.startsWith('Klausurkorrektur:') && (hour.category === 'Elite-Kleingruppe Korrektur' || hour.description?.includes('Elite-Kleingruppe')) 
                                    ? hour.description.replace('Klausurkorrektur:', '').trim().replace(/-\s*\d+\s*(?:Punkte|Punkte?)$/, '').trim()
                                    : hour.description || '-'}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                                {hour.hours}
                              </td>
                            </tr>
                          ))}
                          <tr key="total" className="bg-gray-50 sticky bottom-0">
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900"></td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900"></td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">Gesamt</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              {createPreviewHours.reduce((sum, hour) => sum + (hour.hours || 0), 0).toFixed(1)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInvoice}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary/90"
                >
                  Bestätigen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Dialog */}
      {showCreateDialog && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleCreateInvoice}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Neue Rechnung erstellen
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        Abrechnungsmonat
                      </label>
                      <select
                        value={createFormData.month}
                        onChange={(e) => setCreateFormData({ ...createFormData, month: parseInt(e.target.value) })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        required
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {getMonthName(i + 1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Jahr
                      </label>
                      <select
                        value={createFormData.year}
                        onChange={(e) => setCreateFormData({ ...createFormData, year: parseInt(e.target.value) })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        required
                      >
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Staatsexamen
                      </label>
                      <select
                        value={createFormData.examType}
                        onChange={(e) => setCreateFormData({ ...createFormData, examType: e.target.value as '1. Staatsexamen' | '2. Staatsexamen' })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        required
                      >
                        <option value="1. Staatsexamen">1. Staatsexamen</option>
                        <option value="2. Staatsexamen">2. Staatsexamen</option>
                      </select>
                    </div>

                    {/* Recipient Address Preview */}
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Rechnungsempfänger:</h4>
                      <div className="text-sm text-gray-700">
                        {createFormData.examType === '2. Staatsexamen' ? (
                          <>
                            <p className="font-semibold">Assessor Akademie Kraatz und Heinze GbR</p>
                            <p>Wilmersdorfer Str. 145 / 146</p>
                            <p>10585 Berlin</p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold">Akademie Kraatz GmbH</p>
                            <p>Wilmersdorfer Str. 145 / 146</p>
                            <p>10585 Berlin</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Hours Preview */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-900">
                          Stunden für {getMonthName(createFormData.month)} {createFormData.year}
                        </h4>
                        <span className="text-sm font-semibold text-primary">
                          {createPreviewHours.reduce((sum, h) => sum + h.hours, 0).toFixed(2).replace('.', ',')} Std.
                        </span>
                      </div>
                      {createPreviewLoading ? (
                        <div className="p-4 text-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                          <p className="mt-2 text-xs text-gray-500">Lade Stunden...</p>
                        </div>
                      ) : createPreviewHours.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <Clock className="h-6 w-6 mx-auto text-gray-300 mb-1" />
                          <p className="text-xs">Keine Stunden für diesen Zeitraum</p>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className={`divide-y divide-gray-200 ${createPreviewHours.length > 3 ? 'max-h-[124px] overflow-y-auto' : ''}`}>
                            {createPreviewHours.map((entry, idx) => (
                              <div key={idx} className="px-4 py-2 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-900">
                                      {new Date(entry.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                    {(entry.teilnehmer_name || entry.teilnehmer?.name) && (
                                      <span className="text-xs text-gray-500">{entry.teilnehmer_name || entry.teilnehmer?.name}</span>
                                    )}
                                  </div>
                                  <span className="text-xs font-semibold text-primary">{entry.hours} Std.</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          {createPreviewHours.length > 3 && (
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    ) : (
                      'Rechnung erstellen'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateDialog(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {showPreviewModal && previewInvoice && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowPreviewModal(false);
            if (previewPdfUrl) {
              URL.revokeObjectURL(previewPdfUrl);
              setPreviewPdfUrl(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-primary mr-2" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Rechnungsvorschau</h2>
                  <p className="text-sm text-gray-500">{previewInvoice.invoice_number}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  if (previewPdfUrl) {
                    URL.revokeObjectURL(previewPdfUrl);
                    setPreviewPdfUrl(null);
                  }
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content - Two column layout */}
            <div className="flex-1 overflow-hidden p-6">
              <div className="flex gap-6 h-full">
                {/* PDF Preview - Left side */}
                <div className="flex-1 border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                  {previewLoading ? (
                    <div className="flex items-center justify-center h-full bg-gray-50">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                        <p className="text-sm text-gray-500">PDF wird geladen...</p>
                      </div>
                    </div>
                  ) : previewPdfUrl ? (
                    <iframe
                      src={previewPdfUrl}
                      className="w-full h-full"
                      title="Rechnungsvorschau"
                    />
                  ) : previewInvoice.file_path ? (
                    <div className="flex items-center justify-center h-full bg-gray-50">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                        <p className="text-sm text-gray-500">PDF wird geladen...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gray-50">
                      <div className="text-center">
                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Keine PDF-Vorschau verfügbar</p>
                        <button
                          onClick={() => generateInvoicePDF(previewInvoice.id)}
                          className="mt-3 inline-flex items-center px-3 py-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          PDF generieren
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info - Right side */}
                <div className="w-72 flex flex-col space-y-4 overflow-y-auto">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Status:</span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(previewInvoice.status)}`}>
                      {getStatusText(previewInvoice.status)}
                    </span>
                  </div>

                  {/* Invoice Details */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Rechnungsnummer:</span>
                      <span className="text-xs font-medium text-gray-900">{previewInvoice.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Zeitraum:</span>
                      <span className="text-xs font-medium text-gray-900">{getMonthName(previewInvoice.month)} {previewInvoice.year}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Erstellt am:</span>
                      <span className="text-xs font-medium text-gray-900">
                        {new Date(previewInvoice.created_at).toLocaleDateString('de-DE')} {new Date(previewInvoice.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {previewInvoice.submitted_at && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">Übermittelt am:</span>
                        <span className="text-xs font-medium text-gray-900">
                          {new Date(previewInvoice.submitted_at).toLocaleDateString('de-DE')} {new Date(previewInvoice.submitted_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="text-xs font-medium text-gray-700">Gesamt:</span>
                      <span className="text-xs font-bold text-primary">
                        {previewHours.reduce((sum, h) => sum + h.hours, 0).toFixed(2).replace('.', ',')} Std.
                      </span>
                    </div>
                  </div>

                  {/* Workflow Status Info */}
                  <div className="border rounded-lg p-3">
                    <h3 className="text-xs font-medium text-gray-900 mb-2">Workflow-Status</h3>
                    <div className="space-y-1.5">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 bg-green-500`} />
                        <span className="text-xs text-gray-600">1. Rechnung erstellt</span>
                        <CheckCircle className="h-3 w-3 text-green-500 ml-auto" />
                      </div>
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          previewInvoice.status === 'draft' ? 'bg-gray-300' : 'bg-green-500'
                        }`} />
                        <span className="text-xs text-gray-600">2. Überprüft</span>
                        {previewInvoice.status !== 'draft' && <CheckCircle className="h-3 w-3 text-green-500 ml-auto" />}
                      </div>
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          ['draft', 'review'].includes(previewInvoice.status) ? 'bg-gray-300' : 'bg-green-500'
                        }`} />
                        <span className="text-xs text-gray-600">3. Übermittelt</span>
                        {['submitted', 'sent', 'paid'].includes(previewInvoice.status) && <CheckCircle className="h-3 w-3 text-green-500 ml-auto" />}
                      </div>
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          previewInvoice.status === 'paid' ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                        <span className="text-xs text-gray-600">4. Bearbeitet</span>
                        {previewInvoice.status === 'paid' && <CheckCircle className="h-3 w-3 text-green-500 ml-auto" />}
                      </div>
                    </div>
                  </div>

                  {/* Action Hint */}
                  {!isAdmin && previewInvoice.status === 'submitted' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-800">
                        Die Rechnung wurde an die Verwaltung übermittelt und wird bearbeitet.
                      </p>
                    </div>
                  )}
                  {previewInvoice.status === 'paid' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs text-green-800">
                        Die Rechnung wurde von der Verwaltung bearbeitet und als bezahlt markiert.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-between">
              <button
                onClick={() => generateInvoicePDF(previewInvoice.id)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-2" />
                PDF herunterladen
              </button>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  if (previewPdfUrl) {
                    URL.revokeObjectURL(previewPdfUrl);
                    setPreviewPdfUrl(null);
                  }
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Upload Dialog */}
      {showUploadDialog && uploadInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowUploadDialog(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <Send className="h-6 w-6 text-blue-500 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">Rechnung einreichen</h3>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  Sie sind dabei, die Rechnung <span className="font-semibold">{uploadInvoice.invoice_number}</span> an die Verwaltung zu übermitteln.
                </p>

                <div className="mb-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hoursConfirmed}
                      onChange={(e) => setHoursConfirmed(e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      Ich bestätige, dass die Stundenauflistung in dieser Rechnung korrekt und vollständig ist.
                    </span>
                  </label>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-800">
                    <strong>Hinweis:</strong> Nach dem Einreichen kann die Rechnung nicht mehr bearbeitet werden.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadDialog(false);
                    setUploadInvoice(null);
                    setHoursConfirmed(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleSubmitInvoice}
                  disabled={!hoursConfirmed || isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Wird übermittelt...' : 'Einreichen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && deleteModal.invoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <Trash2 className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Rechnung löschen
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Möchten Sie die Rechnung <span className="font-semibold">{deleteModal.invoice.invoice_number}</span> wirklich löschen?
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Diese Aktion kann nicht rückgängig gemacht werden.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  type="button"
                  onClick={handleDeleteInvoice}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
                >
                  Löschen
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteModal({ show: false, invoice: null })}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal with PDF Preview */}
      {showReviewModal && reviewInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <FileText className="h-6 w-6 text-primary mr-3" />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Rechnung überprüfen</h3>
                      <p className="text-sm text-gray-500">{reviewInvoice.invoice_number}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowReviewModal(false);
                      setReviewInvoice(null);
                      if (reviewPdfUrl) {
                        URL.revokeObjectURL(reviewPdfUrl);
                        setReviewPdfUrl(null);
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Two column layout: PDF left, controls right */}
                <div className="flex gap-6">
                  {/* PDF Preview - Left side */}
                  <div className="flex-1 border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                    {reviewLoading ? (
                      <div className="flex items-center justify-center h-full bg-gray-50">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                          <p className="text-sm text-gray-500">PDF wird generiert...</p>
                        </div>
                      </div>
                    ) : reviewPdfUrl ? (
                      <iframe
                        src={reviewPdfUrl}
                        className="w-full h-full"
                        title="Rechnungsvorschau"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-gray-50">
                        <p className="text-sm text-gray-500">Fehler beim Laden der Vorschau</p>
                      </div>
                    )}
                  </div>

                  {/* Controls - Right side */}
                  <div className="w-72 flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Confirmation Checkbox */}
                      <div>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hoursConfirmed}
                            onChange={(e) => setHoursConfirmed(e.target.checked)}
                            className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                          <span className="text-sm text-gray-700">
                            Ich bestätige, dass die Stundenauflistung in dieser Rechnung korrekt und vollständig ist.
                          </span>
                        </label>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-800">
                          <strong>Hinweis:</strong> Nach dem Übermitteln kann die Rechnung nicht mehr bearbeitet werden. 
                          Falls Sie Korrekturen vornehmen müssen, klicken Sie auf "Korrigieren".
                        </p>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="space-y-2 mt-4">
                      <button
                        type="button"
                        onClick={handleConfirmAndSubmit}
                        disabled={!hoursConfirmed || isSubmitting || reviewLoading}
                        className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {isSubmitting ? 'Wird übermittelt...' : 'An Verwaltung übermitteln'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCorrectInvoice}
                        disabled={isSubmitting}
                        className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-300 rounded-md hover:bg-orange-100 disabled:opacity-50"
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Korrigieren
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}