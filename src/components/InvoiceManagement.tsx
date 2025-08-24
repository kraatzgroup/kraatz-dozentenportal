import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, FileText, Download, Trash2, Calendar, Euro, Eye } from 'lucide-react';
import { useInvoiceStore, Invoice } from '../store/invoiceStore';
import { useAuthStore } from '../store/authStore';

interface InvoiceManagementProps {
  onBack: () => void;
  dozentId?: string;
  isAdmin?: boolean;
  selectedMonth?: number;
  selectedYear?: number;
}

export function InvoiceManagement({ onBack, dozentId, isAdmin = false, selectedMonth, selectedYear }: InvoiceManagementProps) {
  const { invoices, isLoading, error, fetchInvoices, createInvoice, updateInvoice, deleteInvoice, generateInvoicePDF } = useInvoiceStore();
  const { user } = useAuthStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  useEffect(() => {
    fetchInvoices(dozentId);
  }, [dozentId, fetchInvoices]);

  // Filter invoices by selected month and year if provided
  const filteredInvoices = selectedMonth && selectedYear 
    ? invoices.filter(invoice => invoice.month === selectedMonth && invoice.year === selectedYear)
    : invoices;

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
    } catch (error) {
      console.error('Error creating invoice:', error);
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

  const handleStatusChange = async (invoice: Invoice, newStatus: 'draft' | 'sent' | 'paid') => {
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'sent' && !invoice.sent_at) {
        updateData.sent_at = new Date().toISOString();
      } else if (newStatus === 'paid' && !invoice.paid_at) {
        updateData.paid_at = new Date().toISOString();
      }
      
      await updateInvoice(invoice.id, updateData);
    } catch (error) {
      console.error('Error updating invoice status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Entwurf';
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

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          Keine Rechnungen vorhanden
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          Keine Rechnungen für {selectedMonth && selectedYear ? `${getMonthName(selectedMonth)} ${selectedYear}` : 'den ausgewählten Zeitraum'} vorhanden
        </div>
      ) : (
        /* Invoices List */
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredInvoices.map((invoice) => (
              <li key={invoice.id}>
                <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <h4 className="text-sm font-medium text-gray-900">{invoice.invoice_number}</h4>
                      </div>
                      <div className="flex items-center mt-1 text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>{getMonthName(invoice.month)} {invoice.year}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Erstellt: {new Date(invoice.created_at).toLocaleDateString('de-DE')}
                        {invoice.sent_at && (
                          <span className="ml-2">
                            • Versendet: {new Date(invoice.sent_at).toLocaleDateString('de-DE')}
                          </span>
                        )}
                        {invoice.paid_at && (
                          <span className="ml-2">
                            • Bezahlt: {new Date(invoice.paid_at).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {invoice.status === 'sent' && isAdmin && (
                      <button
                        onClick={() => handleStatusChange(invoice, 'paid')}
                        className="inline-flex items-center px-2 py-1 border border-green-300 text-xs font-medium rounded text-green-700 bg-green-50 hover:bg-green-100"
                      >
                        Als bezahlt markieren
                      </button>
                    )}
                    
                    <button
                      onClick={() => generateInvoicePDF(invoice.id)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      title="PDF herunterladen"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    
                    {invoice.status === 'draft' && (
                      <button
                        onClick={() => handleDeleteInvoice(invoice)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        title="Rechnung löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
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
      </div>
    </div>
  );
}