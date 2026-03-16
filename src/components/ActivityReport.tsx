import React, { useEffect, useState } from 'react';
import { Calendar, Clock, User, BookOpen, FileText, Plus, Edit, Trash2, Check, X, AlertCircle } from 'lucide-react';
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
  examType?: '1. Staatsexamen' | '2. Staatsexamen';
}

interface ParticipantHoursEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  legal_area: string;
  teilnehmer_name: string;
  study_goal?: string;
  is_elite_kleingruppe?: boolean;
}

interface DozentHoursEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  category?: string;
  type: 'dozent';
}

interface CombinedHoursEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  legal_area?: string;
  teilnehmer_name?: string;
  category?: string;
  type: 'participant' | 'dozent';
}

interface PendingHoursEntry {
  id: string;
  elite_release_id: string;
  date: string;
  hours: number;
  description: string;
  category: string;
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
}

export function ActivityReport({ selectedMonth, selectedYear, onMonthChange, onYearChange, onShowActivityDialog, dozentId, examType }: ActivityReportProps) {
  const { user } = useAuthStore();
  const { dozentHours, fetchDozentHours, createDozentHours } = useDozentHoursStore();
  const [participantHours, setParticipantHours] = useState<ParticipantHoursEntry[]>([]);
  const [combinedHours, setCombinedHours] = useState<CombinedHoursEntry[]>([]);
  const [pendingHours, setPendingHours] = useState<PendingHoursEntry[]>([]);
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
    fetchPendingHours();
    
    // Setup real-time subscriptions
    const { setupRealtimeSubscription: setupHoursSub, cleanupSubscription: cleanupHoursSub } = useHoursStore.getState();
    const { setupRealtimeSubscription: setupDozentHoursSub, cleanupSubscription: cleanupDozentHoursSub } = useDozentHoursStore.getState();
    
    setupHoursSub();
    setupDozentHoursSub();
    
    // Setup realtime subscription for pending hours
    const pendingChannel = supabase
      .channel('pending-hours-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pending_dozent_hours',
        filter: `dozent_id=eq.${targetDozentId}`
      }, () => {
        fetchPendingHours();
      })
      .subscribe();
    
    return () => {
      cleanupHoursSub();
      cleanupDozentHoursSub();
      pendingChannel.unsubscribe();
    };
  }, [selectedMonth, selectedYear, targetDozentId]);

  useEffect(() => {
    // Filter dozent hours by exam type if specified
    let filteredDozentHours = dozentHours;
    
    if (examType === '1. Staatsexamen') {
      // Show: Elite Kleingruppe entries (category contains 'elite') OR entries with exam_type = '1. Staatsexamen' OR entries without exam_type
      filteredDozentHours = dozentHours.filter(h => {
        const category = (h as any).category?.toLowerCase() || '';
        const entryExamType = (h as any).exam_type;
        
        // Elite Kleingruppe entries always go to 1. Staatsexamen
        if (category.includes('elite')) return true;
        
        // Entries with exam_type = '1. Staatsexamen'
        if (entryExamType === '1. Staatsexamen') return true;
        
        // Entries without exam_type (legacy entries) also go to 1. Staatsexamen
        if (!entryExamType) return true;
        
        return false;
      });
    } else if (examType === '2. Staatsexamen') {
      // Only show entries with exam_type = '2. Staatsexamen' (exclude Elite Kleingruppe)
      filteredDozentHours = dozentHours.filter(h => {
        const category = (h as any).category?.toLowerCase() || '';
        const entryExamType = (h as any).exam_type;
        
        // Exclude Elite Kleingruppe
        if (category.includes('elite')) return false;
        
        // Only show if exam_type is explicitly '2. Staatsexamen'
        return entryExamType === '2. Staatsexamen';
      });
    }
    
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
      ...filteredDozentHours.map(h => ({
        id: h.id,
        date: h.date,
        hours: h.hours,
        description: h.description,
        category: h.category,
        type: 'dozent' as const
      }))
    ];
    
    // Sort by date (ascending - chronological)
    combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setCombinedHours(combined);
  }, [participantHours, dozentHours, examType]);

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

  const fetchPendingHours = async () => {
    if (!targetDozentId) return;
    
    try {
      const { data, error } = await supabase
        .from('pending_dozent_hours')
        .select('*')
        .eq('dozent_id', targetDozentId)
        .eq('status', 'pending')
        .order('date', { ascending: false });

      if (error) throw error;
      setPendingHours(data || []);
    } catch (error: any) {
      console.error('Error fetching pending hours:', error);
    }
  };

  const fetchAllHours = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      
      // Fetch participant hours with study_goal and elite_kleingruppe flag
      const { data, error } = await supabase
        .from('participant_hours')
        .select(`
          id,
          date,
          hours,
          description,
          legal_area,
          teilnehmer:teilnehmer(name, study_goal, elite_kleingruppe)
        `)
        .eq('dozent_id', targetDozentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;

      // Filter participant hours based on exam type and study_goal
      const allParticipantHours: ParticipantHoursEntry[] = data?.map(item => {
        // Supabase returns joined relations as arrays, normalize to object
        const teilnehmer = Array.isArray(item.teilnehmer) ? item.teilnehmer[0] : item.teilnehmer;
        
        return {
          id: item.id,
          date: item.date,
          hours: parseFloat(item.hours.toString()),
          description: item.description || '',
          legal_area: item.legal_area || '',
          teilnehmer_name: teilnehmer?.name || 'Unbekannt',
          study_goal: teilnehmer?.study_goal || '',
          is_elite_kleingruppe: teilnehmer?.elite_kleingruppe || false
        };
      }) || [];

      // Filter based on examType
      let filteredParticipantHours = allParticipantHours;
      if (examType === '2. Staatsexamen') {
        // Only show if teilnehmer has "2. Staatsexamen" in study_goal
        // BUT exclude Elite Kleingruppe (they always go to 1. Staatsexamen)
        filteredParticipantHours = allParticipantHours.filter(h => {
          const studyGoal = h.study_goal;
          return !h.is_elite_kleingruppe && studyGoal && studyGoal.includes('2. Staatsexamen');
        });
      } else if (examType === '1. Staatsexamen') {
        // Show Elite Kleingruppe OR no study_goal OR study_goal doesn't include "2. Staatsexamen"
        filteredParticipantHours = allParticipantHours.filter(h => {
          const studyGoal = h.study_goal;
          return h.is_elite_kleingruppe || !studyGoal || !studyGoal.includes('2. Staatsexamen');
        });
      }

      setParticipantHours(filteredParticipantHours);
      
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

  const handleConfirmPending = async (pendingId: string) => {
    try {
      const { error } = await supabase.rpc('confirm_pending_hours', { pending_id: pendingId });
      if (error) throw error;
      
      await fetchPendingHours();
      await fetchAllHours();
    } catch (error: any) {
      console.error('Error confirming pending hours:', error);
      alert('Fehler beim Bestätigen: ' + error.message);
    }
  };

  const handleRejectPending = async (pendingId: string) => {
    if (window.confirm('Möchten Sie diesen Eintrag wirklich ablehnen?')) {
      try {
        const { error } = await supabase.rpc('reject_pending_hours', { pending_id: pendingId });
        if (error) throw error;
        
        await fetchPendingHours();
      } catch (error: any) {
        console.error('Error rejecting pending hours:', error);
        alert('Fehler beim Ablehnen: ' + error.message);
      }
    }
  };

  const totalHours = combinedHours.reduce((sum, entry) => sum + entry.hours, 0);

  return (
    <div className="space-y-6">
      {/* Pending Hours Section */}
      {pendingHours.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-yellow-200 flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Ausstehende Bestätigungen
                </h3>
                <p className="text-sm text-gray-600">
                  Diese Einheiten sind zeitlich vorbei und warten auf Ihre Bestätigung
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              {pendingHours.length} {pendingHours.length === 1 ? 'Eintrag' : 'Einträge'}
            </span>
          </div>
          <div className="p-6 space-y-4">
            {pendingHours.map((pending) => (
              <div key={pending.id} className="bg-white border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                      <span className="font-medium text-gray-900">{formatDate(pending.date)}</span>
                    </div>
                    <div className="flex items-center space-x-4 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {pending.category}
                      </span>
                      <div className="flex items-center text-sm text-gray-900">
                        <Clock className="h-4 w-4 mr-1 text-primary" />
                        <span className="font-semibold">{pending.hours} {pending.hours === 1 ? 'Stunde' : 'Stunden'}</span>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <BookOpen className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Einheit: </span>
                        {pending.description}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleConfirmPending(pending.id)}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      title="Bestätigen und zu Tätigkeitsbericht hinzufügen"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Bestätigen
                    </button>
                    <button
                      onClick={() => handleRejectPending(pending.id)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      title="Ablehnen (Einheit hat nicht stattgefunden)"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Ablehnen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
                         <span className="font-medium">
                           {entry.category === 'Elite-Kleingruppe Korrektur' ? 'Klausurkorrektur' : 'Sonstige Tätigkeit'}
                         </span>
                       </div>
                     )}
                     <div className="flex items-center space-x-4 mb-3">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.category === 'Elite-Kleingruppe Korrektur' ? 'bg-orange-100 text-orange-800' : getLegalAreaColor(entry.legal_area || '')}`}>
                         {entry.type === 'participant' 
                           ? `Rechtsgebiet: ${entry.legal_area || 'Nicht angegeben'}`
                           : entry.category === 'Elite-Kleingruppe Korrektur' ? 'Klausurenkorrektur Elite-Kleingruppe' : 'Sonstige Tätigkeit'
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