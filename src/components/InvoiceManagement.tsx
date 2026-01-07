import React, { useEffect, useState } from 'react';
import { Plus, FileText, Download, Trash2, Calendar, Eye, Send, CheckCircle, Clock, X, User } from 'lucide-react';
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
}

export function InvoiceManagement({ onBack, dozentId, isAdmin = false, selectedMonth, selectedYear }: InvoiceManagementProps) {
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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Suppress unused variable warnings
  void onBack;
  void user;
  void selectedMonth;
  void selectedYear;

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchInvoices(dozentId);
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

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createInvoice({
        month: createFormData.month,
        year: createFormData.year,
        dozentId: dozentId
      });
      
      setShowCreateDialog(false);
      setCreateFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      });
      addToast('Rechnung erfolgreich erstellt', 'success');
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      // Show user-friendly error message as toast
      const errorMessage = error.message?.includes('invoices_dozent_month_year_unique') || error.code === '23505'
        ? 'Es gibt bereits eine Rechnung für diesen Monat.'
        : 'Fehler beim Erstellen der Rechnung';
      addToast(errorMessage, 'error');
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (window.confirm(`Möchten Sie die Rechnung ${invoice.invoice_number} wirklich löschen?`)) {
      try {
        await deleteInvoice(invoice.id);
      } catch (error) {
        console.error('Error deleting invoice:', error);
      }
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

  const handleSubmitWithPDF = async () => {
    if (!uploadInvoice || !uploadFile) {
      addToast('Bitte wählen Sie eine PDF-Datei aus', 'error');
      return;
    }

    setIsUploading(true);
    try {
      // Upload PDF to Supabase Storage
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${uploadInvoice.dozent_id}/${uploadInvoice.id}_${uploadInvoice.month}_${uploadInvoice.year}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, uploadFile, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Fehler beim Hochladen der Datei');
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
      setUploadFile(null);
    } catch (error) {
      console.error('Error submitting invoice:', error);
      addToast('Fehler beim Übermitteln der Rechnung', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreview = async (invoice: Invoice) => {
    setPreviewInvoice(invoice);
    setShowPreviewModal(true);
    setPreviewLoading(true);
    setPreviewHours([]);

    try {
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

      // Transform data
      const hours: HourEntry[] = (participantHours || []).map((h: any) => ({
        date: h.date,
        hours: h.hours,
        description: h.description,
        legal_area: h.legal_area,
        teilnehmer_name: h.teilnehmer?.name || 'Unbekannt'
      }));

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
          Keine offenen Rechnungen für {getMonthName(currentMonth)} {currentYear}
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
                          {/* Step 1: Draft -> Review (Überprüfen) */}
                          {invoice.status === 'draft' && (
                            <button
                              onClick={() => handleStatusChange(invoice, 'review')}
                              className="inline-flex items-center px-3 py-1.5 border border-orange-300 text-xs font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100"
                            >
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              Überprüfen
                            </button>
                          )}
                          
                          {/* Step 2: Review -> Submit (An Verwaltung übermitteln) */}
                          {invoice.status === 'review' && (
                            <button
                              onClick={() => {
                                setUploadInvoice(invoice);
                                setUploadFile(null);
                                setShowUploadDialog(true);
                              }}
                              className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
                            >
                              <Send className="h-3.5 w-3.5 mr-1" />
                              An Verwaltung übermitteln
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
                      
                      {/* Preview Button */}
                      <button
                        onClick={() => handlePreview(invoice)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        title="Vorschau"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Vorschau
                      </button>
                      
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
                          onClick={() => handleDeleteInvoice(invoice)}
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
            <h3 className="text-lg font-medium text-gray-900">Archiv</h3>
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

                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <FileText className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-blue-800">
                            Automatische Berechnung
                          </h3>
                          <div className="mt-2 text-sm text-blue-700">
                            <p>
                              Die Rechnung wird automatisch basierend auf Ihren eingetragenen Stunden 
                              für den ausgewählten Zeitraum erstellt.
                            </p>
                          </div>
                        </div>
                      </div>
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
          onClick={() => setShowPreviewModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
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
                onClick={() => setShowPreviewModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Status:</span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(previewInvoice.status)}`}>
                    {getStatusText(previewInvoice.status)}
                  </span>
                </div>

                {/* Invoice Details */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Rechnungsnummer:</span>
                    <span className="text-sm font-medium text-gray-900">{previewInvoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Abrechnungszeitraum:</span>
                    <span className="text-sm font-medium text-gray-900">{getMonthName(previewInvoice.month)} {previewInvoice.year}</span>
                  </div>
                  {previewInvoice.period_start && previewInvoice.period_end && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Zeitraum:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(previewInvoice.period_start).toLocaleDateString('de-DE')} - {new Date(previewInvoice.period_end).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-3 mt-3">
                    <span className="text-sm font-medium text-gray-700">Gesamt Stunden:</span>
                    <span className="text-sm font-bold text-primary">
                      {previewHours.reduce((sum, h) => sum + h.hours, 0).toFixed(2)} Std.
                    </span>
                  </div>
                </div>

                {/* Hours Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h3 className="text-sm font-medium text-gray-900">Geleistete Stunden</h3>
                  </div>
                  {previewLoading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-500">Lade Stunden...</p>
                    </div>
                  ) : previewHours.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Clock className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm">Keine Stunden für diesen Zeitraum erfasst</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                      {previewHours.map((entry, idx) => (
                        <div key={idx} className="px-4 py-3 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(entry.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                </span>
                                {entry.legal_area && (
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    entry.legal_area === 'Zivilrecht' ? 'bg-blue-100 text-blue-800' :
                                    entry.legal_area === 'Strafrecht' ? 'bg-red-100 text-red-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    {entry.legal_area}
                                  </span>
                                )}
                              </div>
                              {entry.teilnehmer_name && (
                                <div className="flex items-center text-xs text-gray-500 mt-1">
                                  <User className="h-3 w-3 mr-1" />
                                  {entry.teilnehmer_name}
                                </div>
                              )}
                              {entry.description && (
                                <p className="text-xs text-gray-500 mt-1 truncate">{entry.description}</p>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-primary ml-4">
                              {entry.hours} Std.
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Workflow Status Info */}
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Workflow-Status</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${previewInvoice.status === 'draft' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                      <span className="text-sm text-gray-600">1. Rechnung erstellt (Ausstehend)</span>
                      {previewInvoice.status !== 'draft' && <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />}
                    </div>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        previewInvoice.status === 'draft' ? 'bg-gray-300' : 
                        previewInvoice.status === 'review' ? 'bg-orange-500' : 'bg-green-500'
                      }`} />
                      <span className="text-sm text-gray-600">2. Überprüfung durch Dozent</span>
                      {['submitted', 'sent', 'paid'].includes(previewInvoice.status) && <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />}
                    </div>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        ['draft', 'review'].includes(previewInvoice.status) ? 'bg-gray-300' : 
                        previewInvoice.status === 'submitted' ? 'bg-blue-500' : 'bg-green-500'
                      }`} />
                      <span className="text-sm text-gray-600">3. An Verwaltung übermittelt</span>
                      {['sent', 'paid'].includes(previewInvoice.status) && <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />}
                    </div>
                  </div>
                </div>

                {/* Action Hint */}
                {!isAdmin && previewInvoice.status === 'draft' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Nächster Schritt:</strong> Überprüfen Sie die Rechnung und klicken Sie auf "Überprüfen", um fortzufahren.
                    </p>
                  </div>
                )}
                {!isAdmin && previewInvoice.status === 'review' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-sm text-orange-800">
                      <strong>Nächster Schritt:</strong> Wenn alles korrekt ist, klicken Sie auf "An Verwaltung übermitteln".
                    </p>
                  </div>
                )}
                {!isAdmin && previewInvoice.status === 'submitted' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Die Rechnung wurde an die Verwaltung übermittelt und wird bearbeitet.
                    </p>
                  </div>
                )}
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
                onClick={() => setShowPreviewModal(false)}
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
                  Bitte laden Sie die unterschriebene Rechnung als PDF hoch, um sie an die Verwaltung zu übermitteln.
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PDF-Datei auswählen *
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {uploadFile && (
                    <p className="mt-2 text-sm text-green-600">
                      ✓ {uploadFile.name} ausgewählt
                    </p>
                  )}
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
                    setUploadFile(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isUploading}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleSubmitWithPDF}
                  disabled={!uploadFile || isUploading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Wird hochgeladen...' : 'Einreichen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}