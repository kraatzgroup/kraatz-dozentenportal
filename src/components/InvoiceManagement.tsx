import React, { useEffect, useState } from 'react';
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

interface InvoiceManagementProps {
  onBack: () => void;
  dozentId?: string;
  isAdmin?: boolean;
  selectedMonth?: number;
  selectedYear?: number;
  onNavigateToActivity?: () => void;
}

export function InvoiceManagement({ onBack, dozentId, isAdmin = false, selectedMonth, selectedYear, onNavigateToActivity }: InvoiceManagementProps) {
  const { invoices, isLoading, fetchInvoices, createInvoice, updateInvoice, deleteInvoice, generateInvoicePDF } = useInvoiceStore();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewHours, setPreviewHours] = useState<HourEntry[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [archiveFilterMonth, setArchiveFilterMonth] = useState<number | 'alle'>('alle');
  const [archiveFilterYear, setArchiveFilterYear] = useState<number>(new Date().getFullYear());
  const [createFormData, setCreateFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadInvoice, setUploadInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoursConfirmed, setHoursConfirmed] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewInvoice, setReviewInvoice] = useState<Invoice | null>(null);
  const [reviewPdfUrl, setReviewPdfUrl] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; invoice: Invoice | null }>({ show: false, invoice: null });
  const [createPreviewHours, setCreatePreviewHours] = useState<HourEntry[]>([]);
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

  // Auto-create invoice for current month if none exists (only once after initial load)
  useEffect(() => {
    if (!isLoading && !hasCheckedAutoCreate && dozentId && !isAdmin) {
      setHasCheckedAutoCreate(true);
      
      const hasCurrentMonthInvoice = invoices.some(
        invoice => invoice.month === currentMonth && invoice.year === currentYear
      );
      
      if (!hasCurrentMonthInvoice) {
        // Auto-create invoice for current month
        createInvoice({
          month: currentMonth,
          year: currentYear,
          dozentId: dozentId
        }).then(() => {
          addToast('Rechnung für aktuellen Monat erstellt', 'success');
        }).catch((error) => {
          // Only show error if it's not a duplicate
          if (!error.message?.includes('invoices_dozent_month_year_unique')) {
            console.error('Error auto-creating invoice:', error);
          }
        });
      }
    }
  }, [isLoading, hasCheckedAutoCreate, invoices, dozentId, isAdmin, currentMonth, currentYear, createInvoice, addToast]);

  // Current month invoices only (draft or review status, current month only)
  const currentMonthInvoices = invoices.filter(invoice => 
    (invoice.status === 'draft' || invoice.status === 'review') &&
    invoice.month === currentMonth && 
    invoice.year === currentYear
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
    // Use dozentId if provided (admin view), otherwise use current user
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const targetDozentId = dozentId || currentUser?.id;
    
    if (!targetDozentId) return;
    
    setCreatePreviewLoading(true);
    try {
      const periodStart = new Date(createFormData.year, createFormData.month - 1, 1);
      const periodEnd = new Date(createFormData.year, createFormData.month, 0);
      const startDate = periodStart.toISOString().split('T')[0];
      const endDate = periodEnd.toISOString().split('T')[0];

      const { data: participantHours } = await supabase
        .from('participant_hours')
        .select(`
          date, hours, description, legal_area,
          teilnehmer:teilnehmer(name)
        `)
        .eq('dozent_id', targetDozentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      // Also fetch dozent_hours (sonstige Tätigkeiten)
      const { data: dozentHours } = await supabase
        .from('dozent_hours')
        .select('date, hours, description')
        .eq('dozent_id', targetDozentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

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
          legal_area: undefined,
          teilnehmer_name: h.description || 'Sonstige Tätigkeit'
        }))
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setCreatePreviewHours(hours);
    } catch (error) {
      console.error('Error fetching preview hours:', error);
    } finally {
      setCreatePreviewLoading(false);
    }
  };

  // Fetch preview when dialog opens or month/year changes
  useEffect(() => {
    if (showCreateDialog) {
      fetchCreatePreviewHours();
    }
  }, [showCreateDialog, createFormData.month, createFormData.year]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newInvoice = await createInvoice({
        month: createFormData.month,
        year: createFormData.year,
        dozentId: dozentId
      });
      
      setShowCreateDialog(false);
      setCreateFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      });
      
      // Open review modal immediately after creation
      if (newInvoice) {
        openReviewModal(newInvoice);
      }
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      const errorMessage = error.message?.includes('invoices_dozent_month_year_unique') || error.code === '23505'
        ? 'Es gibt bereits eine Rechnung für diesen Monat.'
        : 'Fehler beim Erstellen der Rechnung';
      addToast(errorMessage, 'error');
    }
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

      // Generate PDF preview with the correct invoice number
      const { generateInvoicePDFBlob } = await import('../utils/invoicePDFGenerator');
      const pdfBlob = await generateInvoicePDFBlob({
        invoice: { ...invoiceData, invoice_number: finalInvoiceNumber, dozent: invoiceData.dozent },
        participantHours: (participantHours || []) as any,
        dozentHours: (dozentHours || []) as any
      });

      const pdfUrl = URL.createObjectURL(pdfBlob);
      setReviewPdfUrl(pdfUrl);
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      addToast('Fehler beim Laden der Vorschau', 'error');
    } finally {
      setReviewLoading(false);
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

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Eigene Rechnungen
          </h3>
          <button
            onClick={() => setShowCreateDialog(true)}
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
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-gray-900">{invoice.invoice_number}</h4>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                            {getStatusText(invoice.status)}
                          </span>
                        </div>
                        <div className="flex items-center mt-1 text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span>{getMonthName(invoice.month)} {invoice.year}</span>
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
                          {getMonthName(invoice.month)} {invoice.year}
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
                                    {entry.teilnehmer_name && (
                                      <span className="text-xs text-gray-500">{entry.teilnehmer_name}</span>
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
                <div className="flex-1 border rounded-lg overflow-hidden" style={{ height: '500px' }}>
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
                  <div className="flex-1 border rounded-lg overflow-hidden" style={{ height: '500px' }}>
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