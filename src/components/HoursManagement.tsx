import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Clock, Calendar, User, ArrowLeft } from 'lucide-react';
import { useHoursStore, ParticipantHours } from '../store/hoursStore';
import { useTeilnehmerStore } from '../store/teilnehmerStore';

interface HoursManagementProps {
  dozentId?: string;
  onBack: () => void;
  isAdmin?: boolean;
}

const getLegalAreaColor = (legalArea: string) => {
  return 'bg-blue-100 text-blue-800';
};
export function HoursManagement({ dozentId, onBack, isAdmin = false }: HoursManagementProps) {
  const { hours, monthlySummary, isLoading, error, fetchHours, fetchMonthlySummary, createHours, updateHours, deleteHours } = useHoursStore();
  const { teilnehmer, fetchTeilnehmer } = useTeilnehmerStore();
  const [showDialog, setShowDialog] = useState(false);
  const [editingHours, setEditingHours] = useState<ParticipantHours | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'summary' | 'details'>('summary');
  const [formData, setFormData] = useState({
    teilnehmer_id: '',
    hours: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  useEffect(() => {
    fetchTeilnehmer(dozentId);
    fetchMonthlySummary(dozentId, selectedYear, selectedMonth);
    if (viewMode === 'details') {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
      fetchHours(dozentId, startDate, endDate);
    }
  }, [dozentId, selectedYear, selectedMonth, viewMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const hoursData = {
        teilnehmer_id: formData.teilnehmer_id,
        hours: parseFloat(formData.hours),
        date: formData.date,
        description: formData.description,
        dozent_id: dozentId
      };

      if (editingHours) {
        await updateHours(editingHours.id, {
          hours: hoursData.hours,
          date: hoursData.date,
          legal_area: hoursData.legal_area,
          content: hoursData.content
        });
      } else {
        await createHours(hoursData);
      }
      handleCloseDialog();
      // Refresh data
      fetchMonthlySummary(dozentId, selectedYear, selectedMonth);
      if (viewMode === 'details') {
        const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
        fetchHours(dozentId, startDate, endDate);
      }
    } catch (error) {
      // Error is handled by the store
    }
  };

  const handleEdit = (hoursEntry: ParticipantHours) => {
    setEditingHours(hoursEntry);
    setFormData({
      teilnehmer_id: hoursEntry.teilnehmer_id,
      hours: hoursEntry.hours.toString(),
      date: hoursEntry.date,
      description: hoursEntry.description || ''
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string, teilnehmerName: string, date: string) => {
    if (window.confirm(`Möchten Sie die Stunden für ${teilnehmerName} am ${new Date(date).toLocaleDateString('de-DE')} wirklich löschen?`)) {
      await deleteHours(id);
      // Refresh data
      fetchMonthlySummary(dozentId, selectedYear, selectedMonth);
      if (viewMode === 'details') {
        const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
        fetchHours(dozentId, startDate, endDate);
      }
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingHours(null);
    setFormData({
      teilnehmer_id: '',
      hours: '',
      date: new Date().toISOString().split('T')[0],
      description: ''
    });
  };

  const getMonthName = (month: number) => {
    return new Date(2023, month - 1).toLocaleDateString('de-DE', { month: 'long' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-medium text-gray-900">
            Stunden pro Teilnehmer
          </h3>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Stunden eintragen
        </button>
      </div>

      {/* Month/Year Selector */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monat</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {getMonthName(i + 1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jahr</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                viewMode === 'summary'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Übersicht
            </button>
            <button
              onClick={() => setViewMode('details')}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                viewMode === 'details'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Details
            </button>
          </div>
        </div>
      </div>

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
      ) : viewMode === 'summary' ? (
        /* Summary View */
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Stundenübersicht für {getMonthName(selectedMonth)} {selectedYear}
            </h3>
          </div>
          {monthlySummary.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Keine Stunden eingetragen</h3>
              <p className="mt-1 text-sm text-gray-500">
                Tragen Sie Stunden für Ihre Teilnehmer ein.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowDialog(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Erste Stunden eintragen
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {monthlySummary.map((summary) => (
                <li key={summary.teilnehmer_id}>
                  <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <h4 className="text-sm font-medium text-gray-900">{summary.teilnehmer_name}</h4>
                        </div>
                        <div className="flex items-center mt-1 text-sm text-gray-500">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>{summary.total_hours} Stunden</span>
                          <span className="mx-2">•</span>
                          <span>{summary.days_worked} {summary.days_worked === 1 ? 'Tag' : 'Tage'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-primary">
                        {summary.total_hours}h
                      </div>
                      <div className="text-xs text-gray-500">
                        Gesamt
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* Details View */
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Stundendetails für {getMonthName(selectedMonth)} {selectedYear}
            </h3>
          </div>
          {hours.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Keine Stundeneinträge</h3>
              <p className="mt-1 text-sm text-gray-500">
                Für diesen Zeitraum wurden noch keine Stunden eingetragen.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {hours.map((hoursEntry) => (
                <li key={hoursEntry.id}>
                  <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <h4 className="text-sm font-medium text-gray-900">{hoursEntry.teilnehmer_name}</h4>
                          <span className="ml-2 text-lg font-semibold text-primary">{hoursEntry.hours}h</span>
                        </div>
                        <div className="flex items-center mt-1 text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span>{formatDate(hoursEntry.date)}</span>
                          {hoursEntry.description && (
                            <>
                              <span className="mx-2">•</span>
                              <span>{hoursEntry.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(hoursEntry)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDelete(hoursEntry.id, hoursEntry.teilnehmer_name || '', hoursEntry.date)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Löschen
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingHours ? 'Stunden bearbeiten' : 'Stunden eintragen'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <User className="h-4 w-4 inline mr-1" />
                        Teilnehmer
                      </label>
                      <select
                        value={formData.teilnehmer_id}
                        onChange={(e) => setFormData({ ...formData, teilnehmer_id: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        required
                        disabled={!!editingHours}
                      >
                        <option value="">Teilnehmer auswählen</option>
                        {teilnehmer.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Clock className="h-4 w-4 inline mr-1" />
                        Stunden
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        value={formData.hours}
                        onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="z.B. 8.5"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Geben Sie die Anzahl der Stunden ein (0.25 Schritte möglich)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        Datum
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Beschreibung (optional)
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="Was wurde in dieser Stunde behandelt..."
                      />
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
                      editingHours ? 'Speichern' : 'Eintragen'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseDialog}
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
  );
}