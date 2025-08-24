import React, { useEffect, useState } from 'react';
import { Calendar, Clock, User, BookOpen, FileText, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useHoursStore } from '../store/hoursStore';
import { useDozentHoursStore } from '../store/dozentHoursStore';

interface ActivityReportProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onShowActivityDialog: () => void;
  dozentId?: string;
}

interface ParticipantHoursEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  legal_area: string;
  teilnehmer_name: string;
}

interface DozentHoursEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  type: 'dozent';
}

interface CombinedHoursEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  legal_area?: string;
  teilnehmer_name?: string;
  type: 'participant' | 'dozent';
}

export function ActivityReport({ selectedMonth, selectedYear, onMonthChange, onYearChange, onShowActivityDialog, dozentId }: ActivityReportProps) {
  const { user } = useAuthStore();
  const { dozentHours, fetchDozentHours, createDozentHours } = useDozentHoursStore();
  const [participantHours, setParticipantHours] = useState<ParticipantHoursEntry[]>([]);
  const [combinedHours, setCombinedHours] = useState<CombinedHoursEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dozentName, setDozentName] = useState<string>('');
  const [editingEntry, setEditingEntry] = useState<CombinedHoursEntry | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    hours: '',
    date: '',
    description: '',
    legal_area: ''
  });

  // Use dozentId if provided (Admin View), otherwise use current user (Dozent View)
  const targetDozentId = dozentId || user?.id;
  
  useEffect(() => {
    fetchDozentName();
    fetchAllHours();
    
    // Setup real-time subscriptions
    const { setupRealtimeSubscription: setupHoursSub, cleanupSubscription: cleanupHoursSub } = useHoursStore.getState();
    const { setupRealtimeSubscription: setupDozentHoursSub, cleanupSubscription: cleanupDozentHoursSub } = useDozentHoursStore.getState();
    
    setupHoursSub();
    setupDozentHoursSub();
    
    return () => {
      cleanupHoursSub();
      cleanupDozentHoursSub();
    };
  }, [selectedMonth, selectedYear, targetDozentId]);

  useEffect(() => {
    // Combine participant hours and dozent hours
    const combined: CombinedHoursEntry[] = [
      ...participantHours.map(h => ({
        id: h.id,
        date: h.date,
        hours: h.hours,
        description: h.description,
        legal_area: h.legal_area,
        teilnehmer_name: h.teilnehmer_name,
        type: 'participant' as const
      })),
      ...dozentHours.map(h => ({
        id: h.id,
        date: h.date,
        hours: h.hours,
        description: h.description,
        type: 'dozent' as const
      }))
    ];
    
    // Sort by date (ascending - chronological)
    combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setCombinedHours(combined);
  }, [participantHours, dozentHours]);

  const fetchDozentName = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setDozentName(data.full_name || '');
    } catch (error) {
      console.error('Error fetching dozent name:', error);
    }
  };

  const fetchAllHours = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      
      // Fetch participant hours
      const { data, error } = await supabase
        .from('participant_hours')
        .select(`
          id,
          date,
          hours,
          description,
          legal_area,
          teilnehmer:teilnehmer(name)
        `)
        .eq('dozent_id', targetDozentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;

      const transformedData: ParticipantHoursEntry[] = data?.map(item => ({
        id: item.id,
        date: item.date,
        hours: parseFloat(item.hours.toString()),
        description: item.description || '',
        legal_area: item.legal_area || '',
        teilnehmer_name: item.teilnehmer?.name || 'Unbekannt'
      })) || [];

      setParticipantHours(transformedData);
      
      // Fetch dozent hours
      await fetchDozentHours(targetDozentId, startDate, endDate);
    } catch (error: any) {
      console.error('Error fetching all hours:', error);
      setError(error.message || 'Fehler beim Laden der Stunden');
    } finally {
      setIsLoading(false);
    }
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

  const getLegalAreaColor = (legalArea: string) => {
    return 'bg-blue-100 text-blue-800';
  };

  const handleEditEntry = (entry: CombinedHoursEntry) => {
    setEditingEntry(entry);
    setEditFormData({
      hours: entry.hours.toString(),
      date: entry.date,
      description: entry.description,
      legal_area: entry.legal_area || ''
    });
    setShowEditDialog(true);
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingEntry) return;
    
    try {
      if (editingEntry.type === 'participant') {
        const { error } = await supabase
          .from('participant_hours')
          .update({
            hours: parseFloat(editFormData.hours),
            date: editFormData.date,
            description: editFormData.description,
            legal_area: editFormData.legal_area
          })
          .eq('id', editingEntry.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dozent_hours')
          .update({
            hours: parseFloat(editFormData.hours),
            date: editFormData.date,
            description: editFormData.description
          })
          .eq('id', editingEntry.id);

        if (error) throw error;
      }

      // Refresh data
      await fetchAllHours();
      
      // Close dialog
      setShowEditDialog(false);
      setEditingEntry(null);
      setEditFormData({
        hours: '',
        date: '',
        description: '',
        legal_area: ''
      });
    } catch (error: any) {
      console.error('Error updating entry:', error);
      alert('Fehler beim Aktualisieren des Eintrags: ' + error.message);
    }
  };

  const handleDeleteEntry = async (entry: CombinedHoursEntry) => {
    const entryType = entry.type === 'participant' ? 'Unterrichtsstunde' : 'Sonstige Tätigkeit';
    const confirmMessage = `Möchten Sie den Eintrag "${entryType}" vom ${formatDate(entry.date)} (${entry.hours}h) wirklich löschen?`;
    
    if (window.confirm(confirmMessage)) {
      try {
        if (entry.type === 'participant') {
          const { error } = await supabase
            .from('participant_hours')
            .delete()
            .eq('id', entry.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('dozent_hours')
            .delete()
            .eq('id', entry.id);

          if (error) throw error;
        }

        // Refresh data
        await fetchAllHours();
      } catch (error: any) {
        console.error('Error deleting entry:', error);
        alert('Fehler beim Löschen des Eintrags: ' + error.message);
      }
    }
  };

  const totalHours = combinedHours.reduce((sum, entry) => sum + entry.hours, 0);

  return (
    <div className="space-y-6">
      {/* Hours Entries */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Stundeneinträge
            </h3>
            <p className="text-sm text-gray-500">
              Chronologische Auflistung aller Unterrichtsstunden
            </p>
          </div>
          <div className="inline-flex items-center px-4 py-2 bg-primary/10 rounded-lg">
            <Clock className="h-5 w-5 text-primary mr-2" />
            <span className="text-lg font-semibold text-primary">
              Summe: {totalHours} {totalHours === 1 ? 'Stunde' : 'Stunden'}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            <p>{error}</p>
          </div>
        ) : combinedHours.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Keine Stunden eingetragen</h3>
            <p className="mt-1 text-sm text-gray-500">
              Für {getMonthName(selectedMonth)} {selectedYear} wurden noch keine Stunden eingetragen.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {combinedHours.map((entry, index) => (
              <React.Fragment key={entry.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                   <div>
                     <div className="flex items-center mb-2">
                       <Calendar className="h-4 w-4 mr-1" />
                       <span className="font-medium">Datum {formatDate(entry.date)}</span>
                     </div>
                     {entry.type === 'participant' ? (
                       <div className="flex items-center text-sm text-gray-500">
                         <User className="h-4 w-4 mr-1" />
                         <span>Teilnehmer {entry.teilnehmer_name}</span>
                       </div>
                     ) : (
                       <div className="flex items-center text-sm text-gray-500">
                         <span className="font-medium">Sonstige Tätigkeit</span>
                       </div>
                     )}
                     <div className="flex items-center space-x-4 mb-3">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLegalAreaColor(entry.legal_area || '')}`}>
                         {entry.type === 'participant' 
                           ? `Rechtsgebiet: ${entry.legal_area || 'Nicht angegeben'}`
                           : 'Sonstige Tätigkeit'
                         }
                       </span>
                       <div className="flex items-center text-sm text-gray-900">
                         <Clock className="h-4 w-4 mr-1 text-primary" />
                         <span className="font-semibold">Anzahl Stunden: {entry.hours}</span>
                       </div>
                     </div>
                  
                     {entry.description && (
                       <div className="flex items-start">
                         <BookOpen className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                         <div className="text-sm text-gray-700">
                           <span className="font-medium">
                             {entry.type === 'participant' ? 'Inhalt (Thema): ' : 'Tätigkeit: '}
                           </span>
                           {entry.description}
                         </div>
                       </div>
                     )}
                   </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEditEntry(entry)}
                      className="text-gray-400 hover:text-primary transition-colors"
                      title="Eintrag bearbeiten"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Eintrag löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              
                {/* Separator line for visual clarity */}
                {index < combinedHours.length - 1 && (
                  <div className="mt-4 border-b border-gray-100"></div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Edit Entry Dialog */}
      {showEditDialog && editingEntry && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleUpdateEntry}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingEntry.type === 'participant' ? 'Unterrichtsstunde bearbeiten' : 'Sonstige Tätigkeit bearbeiten'}
                  </h3>
                  
                  <div className="space-y-4">
                    {editingEntry.type === 'participant' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <User className="h-4 w-4 inline mr-1" />
                          Teilnehmer
                        </label>
                        <input
                          type="text"
                          value={editingEntry.teilnehmer_name || ''}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100"
                          disabled
                        />
                      </div>
                    )}

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
                        value={editFormData.hours}
                        onChange={(e) => setEditFormData({ ...editFormData, hours: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        Datum
                      </label>
                      <input
                        type="date"
                        value={editFormData.date}
                        onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        required
                      />
                    </div>

                    {editingEntry.type === 'participant' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rechtsgebiet
                        </label>
                        <select
                          value={editFormData.legal_area}
                          onChange={(e) => setEditFormData({ ...editFormData, legal_area: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                          required
                        >
                          <option value="">Rechtsgebiet auswählen</option>
                          <option value="Zivilrecht">Zivilrecht</option>
                          <option value="Öffentliches Recht">Öffentliches Recht</option>
                          <option value="Strafrecht">Strafrecht</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {editingEntry.type === 'participant' ? 'Beschreibung (optional)' : 'Tätigkeit'}
                      </label>
                      <textarea
                        value={editFormData.description}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder={editingEntry.type === 'participant' ? 'Was wurde in dieser Stunde behandelt...' : 'z.B. Vorbereitung Unterlagen, Korrektur von Arbeiten...'}
                        required={editingEntry.type === 'dozent'}
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditDialog(false);
                      setEditingEntry(null);
                      setEditFormData({
                        hours: '',
                        date: '',
                        description: '',
                        legal_area: ''
                      });
                    }}
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