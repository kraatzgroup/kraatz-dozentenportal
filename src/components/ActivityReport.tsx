import React, { useEffect, useState } from 'react';
import { Calendar, Clock, User, BookOpen, FileText, Plus, Edit, Trash2, Check, X, AlertCircle, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useHoursStore } from '../store/hoursStore';
import { useDozentHoursStore } from '../store/dozentHoursStore';
import { Teilnehmer } from '../store/teilnehmerStore';

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

interface FlatRateItem {
  id: string;
  dozent_id: string;
  name: string;
  description: string;
  quantity: number;
  amount_euro: number;
  total_euro: number;
  date: string;
  created_at: string;
}

interface TeilnehmerWithHours extends Teilnehmer {
  monthly_hours: number;
}

export function ActivityReport({ selectedMonth, selectedYear, onMonthChange, onYearChange, onShowActivityDialog, dozentId, examType }: ActivityReportProps) {
  const { user } = useAuthStore();
  const { dozentHours, fetchDozentHours, createDozentHours } = useDozentHoursStore();
  const [participantHours, setParticipantHours] = useState<ParticipantHoursEntry[]>([]);
  const [combinedHours, setCombinedHours] = useState<CombinedHoursEntry[]>([]);
  const [pendingHours, setPendingHours] = useState<PendingHoursEntry[]>([]);
  const [flatRateItems, setFlatRateItems] = useState<FlatRateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dozentName, setDozentName] = useState<string>('');
  const [editingEntry, setEditingEntry] = useState<CombinedHoursEntry | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingFlatRateItem, setEditingFlatRateItem] = useState<FlatRateItem | null>(null);
  const [showEditFlatRateDialog, setShowEditFlatRateDialog] = useState(false);
  const [activeTeilnehmer, setActiveTeilnehmer] = useState<TeilnehmerWithHours[]>([]);
  const ACTIVITY_CATEGORIES = [
    'Materialüberarbeitung Grundsemester',
    'Materialüberarbeitung Examen',
    'Kraatz Club',
    'Materialüberarbeitung Crashkurs',
    'Webinar',
    'Rechtsprechungsübersichten',
    'Social Media'
  ];

  const [editFormData, setEditFormData] = useState({
    hours: '',
    date: '',
    description: '',
    legal_area: '',
    category: ''
  });

  const FLAT_RATE_CATEGORIES = [
    'Auslagen',
    'Reisekosten',
    'Pauschalvereinbarungen'
  ];

  const [editFlatRateFormData, setEditFlatRateFormData] = useState({
    category: '',
    description: '',
    quantity: '',
    amount_euro: '',
    date: ''
  });
  const [showAllHours, setShowAllHours] = useState(false);
  const [showAllTeilnehmer, setShowAllTeilnehmer] = useState(false);

  // Debug logging for load more functionality
  useEffect(() => {
    console.log('🔍 Debug: combinedHours.length =', combinedHours.length, 'showAllHours =', showAllHours);
    console.log('🔍 Debug: Should show all?', showAllHours);
    console.log('🔍 Debug: Should show first 3?', !showAllHours && combinedHours.length > 3);
  }, [combinedHours.length, showAllHours]);

  // Use dozentId if provided (Admin View), otherwise use current user (Dozent View)
  const targetDozentId = dozentId || user?.id;
  
  useEffect(() => {
    console.log('📊 ActivityReport: Loading for dozentId:', targetDozentId);
    console.log('📊 ActivityReport: Current URL:', window.location.href);
    console.log('📊 ActivityReport: Current tab:', new URLSearchParams(window.location.search).get('tab'));
    console.log('📊 ActivityReport: Selected month:', selectedMonth);
    console.log('📊 ActivityReport: Selected year:', selectedYear);

    fetchDozentName();
    fetchAllHours();
    fetchPendingHours();
    fetchActiveTeilnehmer();
    fetchFlatRateItems();

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

    // Setup realtime subscription for flat rate items
    const flatRateChannel = supabase
      .channel('flat-rate-items-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dozent_flat_rate_items',
        filter: `dozent_id=eq.${targetDozentId}`
      }, () => {
        fetchFlatRateItems();
      })
      .subscribe();

    return () => {
      cleanupHoursSub();
      cleanupDozentHoursSub();
      pendingChannel.unsubscribe();
      flatRateChannel.unsubscribe();
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

  const fetchFlatRateItems = async () => {
    if (!targetDozentId) return;

    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('dozent_flat_rate_items')
        .select('*')
        .eq('dozent_id', targetDozentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;
      setFlatRateItems(data || []);
    } catch (error: any) {
      console.error('Error fetching flat rate items:', error);
    }
  };

  const fetchActiveTeilnehmer = async () => {
    if (!targetDozentId) return;

    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

      // Fetch all teilnehmer assigned to this dozent
      const { data: teilnehmerData, error: teilnehmerError } = await supabase
        .from('teilnehmer')
        .select('*')
        .or(`dozent_zivilrecht_id.eq.${targetDozentId},dozent_strafrecht_id.eq.${targetDozentId},dozent_oeffentliches_recht_id.eq.${targetDozentId}`);

      if (teilnehmerError) throw teilnehmerError;

      // Filter by exam type and active contract
      const filteredTeilnehmer = (teilnehmerData || []).filter(t => {
        // Check if contract is active
        if (!t.contract_start || !t.contract_end) return false;
        const now = new Date();
        const start = new Date(t.contract_start);
        const end = new Date(t.contract_end);
        if (!(now >= start && now <= end)) return false;

        // Filter by exam type
        if (examType === '2. Staatsexamen') {
          // Only show if study_goal includes "2. Staatsexamen" and NOT elite_kleingruppe
          return !t.elite_kleingruppe && t.study_goal && t.study_goal.includes('2. Staatsexamen');
        } else if (examType === '1. Staatsexamen') {
          // Show if: elite_kleingruppe OR study_goal includes "1. Staatsexamen" OR no study_goal OR study_goal doesn't include "2. Staatsexamen"
          if (t.elite_kleingruppe) return true;
          if (!t.study_goal) return true;
          if (t.study_goal.includes('1. Staatsexamen')) return true;
          // Exclude only if explicitly "2. Staatsexamen"
          return !t.study_goal.includes('2. Staatsexamen');
        }
        return true;
      });

      // Fetch contracts for all teilnehmer to get booked hours
      const teilnehmerIds = filteredTeilnehmer.map(t => t.id);
      const { data: contractsData } = await supabase
        .from('contracts')
        .select('id, teilnehmer_id, total_hours')
        .in('teilnehmer_id', teilnehmerIds);

      const contractsByTeilnehmer: Record<string, any> = {};
      (contractsData || []).forEach(c => {
        if (!contractsByTeilnehmer[c.teilnehmer_id]) {
          contractsByTeilnehmer[c.teilnehmer_id] = { totalHours: 0 };
        }
        contractsByTeilnehmer[c.teilnehmer_id].totalHours += c.total_hours || 0;
      });

      // Fetch hours for each teilnehmer for the selected month and total hours
      const teilnehmerWithHours: TeilnehmerWithHours[] = await Promise.all(
        filteredTeilnehmer.map(async (t) => {
          // Fetch monthly hours
          const { data: monthlyHoursData } = await supabase
            .from('participant_hours')
            .select('hours')
            .eq('teilnehmer_id', t.id)
            .eq('dozent_id', targetDozentId)
            .gte('date', startDate)
            .lte('date', endDate);

          const monthly_hours = (monthlyHoursData || []).reduce((sum, h) => sum + parseFloat(h.hours.toString()), 0);

          // Fetch total hours (all time)
          const { data: totalHoursData } = await supabase
            .from('participant_hours')
            .select('hours')
            .eq('teilnehmer_id', t.id);

          const completed_hours = (totalHoursData || []).reduce((sum, h) => sum + parseFloat(h.hours.toString()), 0);

          const booked_hours = contractsByTeilnehmer[t.id]?.totalHours || t.booked_hours || 0;

          return {
            ...t,
            monthly_hours,
            completed_hours,
            booked_hours
          };
        })
      );

      setActiveTeilnehmer(teilnehmerWithHours);
    } catch (error: any) {
      console.error('Error fetching active teilnehmer:', error);
    }
  };

  const fetchAllHours = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
      
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
      legal_area: entry.legal_area || '',
      category: entry.category || ''
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
            description: editFormData.description,
            category: editFormData.category || null
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
        legal_area: '',
        category: ''
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

  const handleEditFlatRateItem = (item: FlatRateItem) => {
    setEditingFlatRateItem(item);
    setEditFlatRateFormData({
      category: item.name,
      description: item.description || '',
      quantity: item.quantity.toString(),
      amount_euro: item.amount_euro.toString(),
      date: item.date
    });
    setShowEditFlatRateDialog(true);
  };

  const handleUpdateFlatRateItem = async () => {
    if (!editingFlatRateItem) return;

    try {
      const { error } = await supabase
        .from('dozent_flat_rate_items')
        .update({
          name: editFlatRateFormData.category,
          description: editFlatRateFormData.description,
          quantity: parseFloat(editFlatRateFormData.quantity),
          amount_euro: parseFloat(editFlatRateFormData.amount_euro),
          date: editFlatRateFormData.date
        })
        .eq('id', editingFlatRateItem.id);

      if (error) throw error;

      setShowEditFlatRateDialog(false);
      setEditingFlatRateItem(null);
      await fetchFlatRateItems();
    } catch (error: any) {
      console.error('Error updating flat rate item:', error);
      alert('Fehler beim Aktualisieren des Eintrags: ' + error.message);
    }
  };

  const handleDeleteFlatRateItem = async (item: FlatRateItem) => {
    const confirmMessage = `Möchten Sie die pauschale Vergütung "${item.name}" vom ${formatDate(item.date)} (${item.total_euro.toFixed(2)} €) wirklich löschen?`;

    if (window.confirm(confirmMessage)) {
      try {
        const { error } = await supabase
          .from('dozent_flat_rate_items')
          .delete()
          .eq('id', item.id);

        if (error) throw error;

        // Refresh data
        await fetchFlatRateItems();
      } catch (error: any) {
        console.error('Error deleting flat rate item:', error);
        alert('Fehler beim Löschen des Eintrags: ' + error.message);
      }
    }
  };

  const totalHours = combinedHours.reduce((sum, entry) => sum + entry.hours, 0);

  // Filter participants to only show those with hours in the selected month
  const activeTeilnehmerWithHours = activeTeilnehmer.filter(t => t.monthly_hours > 0);

  return (
    <div className="space-y-6">
      {/* Active Participants Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Aktive Teilnehmer ({examType})
            </h3>
            <div className="text-xs text-gray-500">
              {getMonthName(selectedMonth)} {selectedYear}
            </div>
          </div>
        </div>
        <div className="p-6">
          {activeTeilnehmerWithHours.length > 0 ? (
            <div className="space-y-3">
              {showAllTeilnehmer ? (
                <>
                  {/* Show all participants */}
                  {activeTeilnehmerWithHours.map((teilnehmer) => {
                const bookedHours = teilnehmer.booked_hours || 0;
                const completedHours = teilnehmer.completed_hours || 0;
                const progressPercent = bookedHours > 0 ? Math.min((completedHours / bookedHours) * 100, 100) : 0;
                const hasMonthlyHours = teilnehmer.monthly_hours > 0;
                
                return (
                  <div key={teilnehmer.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center flex-1">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="flex items-center">
                          <h4 className="text-sm font-medium text-gray-900">{teilnehmer.name}</h4>
                        </div>
                        {teilnehmer.contract_start && teilnehmer.contract_end && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(teilnehmer.contract_start).toLocaleDateString('de-DE')} - {new Date(teilnehmer.contract_end).toLocaleDateString('de-DE')}
                          </div>
                        )}
                        {bookedHours > 0 && (
                          <div className="mt-1.5">
                            <div className="flex items-center space-x-2">
                              <div className="w-32 bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    progressPercent >= 100 ? 'bg-green-500' : 
                                    progressPercent >= 75 ? 'bg-yellow-500' : 'bg-primary'
                                  }`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{completedHours}/{bookedHours}h gesamt</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      {hasMonthlyHours ? (
                        <>
                          <div className="text-lg font-semibold text-primary">
                            {teilnehmer.monthly_hours}h
                          </div>
                          <div className="text-xs text-green-600">
                            {getMonthName(selectedMonth)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-lg font-semibold text-gray-400">
                            0h
                          </div>
                          <div className="text-xs text-gray-400">
                            Keine Stunden
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

                {/* Show less button */}
                {activeTeilnehmerWithHours.length > 3 && (
                  <div className="flex items-center justify-center py-4">
                    <button
                      onClick={() => setShowAllTeilnehmer(false)}
                      className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Weniger anzeigen
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Show first 3 participants */}
                {activeTeilnehmerWithHours.slice(0, 3).map((teilnehmer) => {
                const bookedHours = teilnehmer.booked_hours || 0;
                const completedHours = teilnehmer.completed_hours || 0;
                const progressPercent = bookedHours > 0 ? Math.min((completedHours / bookedHours) * 100, 100) : 0;
                const hasMonthlyHours = teilnehmer.monthly_hours > 0;
                
                return (
                  <div key={teilnehmer.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center flex-1">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="flex items-center">
                          <h4 className="text-sm font-medium text-gray-900">{teilnehmer.name}</h4>
                        </div>
                        {teilnehmer.contract_start && teilnehmer.contract_end && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(teilnehmer.contract_start).toLocaleDateString('de-DE')} - {new Date(teilnehmer.contract_end).toLocaleDateString('de-DE')}
                          </div>
                        )}
                        {bookedHours > 0 && (
                          <div className="mt-1.5">
                            <div className="flex items-center space-x-2">
                              <div className="w-32 bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    progressPercent >= 100 ? 'bg-green-500' : 
                                    progressPercent >= 75 ? 'bg-yellow-500' : 'bg-primary'
                                  }`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{completedHours}/{bookedHours}h gesamt</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      {hasMonthlyHours ? (
                        <>
                          <div className="text-lg font-semibold text-primary">
                            {teilnehmer.monthly_hours}h
                          </div>
                          <div className="text-xs text-green-600">
                            {getMonthName(selectedMonth)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-lg font-semibold text-gray-400">
                            0h
                          </div>
                          <div className="text-xs text-gray-400">
                            Keine Stunden
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

                {/* Load more button */}
                {activeTeilnehmerWithHours.length > 3 && (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50 pointer-events-none" style={{ height: '40px' }}></div>
                    <div className="flex items-center justify-center py-4 relative z-10">
                      <button
                        onClick={() => setShowAllTeilnehmer(true)}
                        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        <ChevronDown className="h-4 w-4 mr-2" />
                        {activeTeilnehmerWithHours.length - 3} weitere Teilnehmer laden
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="mx-auto h-10 w-10 text-gray-300 mb-2" />
            <p>Keine aktiven Teilnehmer ({examType})</p>
            <p className="text-xs mt-2">Es sind derzeit keine Teilnehmer mit diesem Studienziel zugewiesen.</p>
          </div>
        )}
        </div>
      </div>
      {/* Pending Hours Section - only for 1. Staatsexamen since Elite-Kleingruppe is only for 1. Staatsexamen */}
      {pendingHours.length > 0 && examType === '1. Staatsexamen' && (
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
      {/* Flat Rate Items Section */}
      {flatRateItems.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-purple-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Pauschale Vergütungen
              </h3>
              <p className="text-sm text-gray-500">
                Sonstige Posten und pauschale Zahlungen
              </p>
            </div>
            <div className="inline-flex items-center px-4 py-2 bg-purple-100 rounded-lg">
              <span className="text-lg font-semibold text-purple-700">
                {flatRateItems.reduce((sum, item) => sum + item.total_euro, 0).toFixed(2)} €
              </span>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {flatRateItems.map((item) => (
              <div key={item.id} className="bg-white border border-purple-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                      <span className="font-medium text-gray-900">{formatDate(item.date)}</span>
                    </div>
                    <div className="flex items-center space-x-4 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Pauschale Vergütung
                      </span>
                      <div className="flex items-center text-sm text-gray-900">
                        <span className="font-semibold">{item.quantity} × {item.amount_euro.toFixed(2)} € = {item.total_euro.toFixed(2)} €</span>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <BookOpen className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Name: </span>
                        {item.name}
                      </div>
                    </div>
                    {item.description && (
                      <div className="flex items-start mt-1">
                        <BookOpen className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-gray-700">
                          <span className="font-medium">Beschreibung: </span>
                          {item.description}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEditFlatRateItem(item)}
                      className="text-gray-400 hover:text-primary transition-colors"
                      title="Eintrag bearbeiten"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteFlatRateItem(item)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Eintrag löschen"
                    >
                      <Trash2 className="h-4 w-4" />
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
            {showAllHours ? (
              <>
                {/* Show all entries */}
                {combinedHours.map((entry, index) => (
                  <React.Fragment key={entry.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                       <div>
                         <div className="flex items-center mb-2">
                           <Calendar className="h-4 w-4 mr-1" />
                           <span className="font-medium">Datum {formatDate(entry.date)}</span>
                         </div>
                         {entry.type === 'participant' && (
                           <div className="flex items-center text-sm text-gray-500">
                             <User className="h-4 w-4 mr-1" />
                             <span>Teilnehmer {entry.teilnehmer_name}</span>
                           </div>
                         )}
                         <div className="flex items-center space-x-4 mb-3">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.type === 'participant' ? 'bg-blue-100 text-blue-800' : entry.category === 'Elite-Kleingruppe Korrektur' || entry.description?.includes('Elite-Kleingruppe') ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                             {entry.type === 'participant'
                               ? 'Einzelunterricht'
                               : entry.category === 'Elite-Kleingruppe Korrektur' ? 'Elite-Kleingruppe Klausurenkorrektur'
                               : entry.description?.includes('Elite-Kleingruppe') ? 'Elite-Kleingruppe'
                               : entry.category || 'Sonstige Tätigkeit'
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

                {/* Show less button */}
                {combinedHours.length > 3 && (
                  <div className="flex items-center justify-center py-4">
                    <button
                      onClick={() => setShowAllHours(false)}
                      className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Weniger anzeigen
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Show first 3 entries */}
                {combinedHours.slice(0, 3).map((entry, index) => (
                  <React.Fragment key={entry.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                       <div>
                         <div className="flex items-center mb-2">
                           <Calendar className="h-4 w-4 mr-1" />
                           <span className="font-medium">Datum {formatDate(entry.date)}</span>
                         </div>
                         {entry.type === 'participant' && (
                           <div className="flex items-center text-sm text-gray-500">
                             <User className="h-4 w-4 mr-1" />
                             <span>Teilnehmer {entry.teilnehmer_name}</span>
                           </div>
                         )}
                         <div className="flex items-center space-x-4 mb-3">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.type === 'participant' ? 'bg-blue-100 text-blue-800' : entry.category === 'Elite-Kleingruppe Korrektur' || entry.description?.includes('Elite-Kleingruppe') ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                             {entry.type === 'participant'
                               ? 'Einzelunterricht'
                               : entry.category === 'Elite-Kleingruppe Korrektur' ? 'Elite-Kleingruppe Klausurenkorrektur'
                               : entry.description?.includes('Elite-Kleingruppe') ? 'Elite-Kleingruppe'
                               : entry.category || 'Sonstige Tätigkeit'
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
                    {index < 2 && (
                      <div className="mt-4 border-b border-gray-100"></div>
                    )}
                  </React.Fragment>
                ))}

                {/* Fade to 4th entry */}
                {combinedHours.length > 3 && (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50 pointer-events-none" style={{ height: '40px' }}></div>
                    <div className="flex items-center justify-center py-4 relative z-10">
                      <button
                        onClick={() => setShowAllHours(true)}
                        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        <ChevronDown className="h-4 w-4 mr-2" />
                        {combinedHours.length - 3} weitere Einträge laden
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
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
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Eintrag bearbeiten</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Stunden</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={editFormData.hours}
                      onChange={(e) => setEditFormData({ ...editFormData, hours: e.target.value })}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                    <input
                      type="date"
                      value={editFormData.date}
                      onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                    />
                  </div>
                  {editingEntry?.type === 'dozent' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tätigkeit</label>
                      <select
                        value={editFormData.category}
                        onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                      >
                        <option value="">Keine Kategorie</option>
                        {ACTIVITY_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inhalt/Thema</label>
                    <textarea
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      rows={3}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleUpdateEntry}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Speichern
                </button>
                <button
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingEntry(null);
                    setEditFormData({ hours: '', date: '', description: '', legal_area: '', category: '' });
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Edit Flat Rate Item Dialog */}
      {showEditFlatRateDialog && editingFlatRateItem && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end sm:items-center justify-center z-50">
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Pauschale Vergütung bearbeiten</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                  <select
                    value={editFlatRateFormData.category}
                    onChange={(e) => setEditFlatRateFormData({ ...editFlatRateFormData, category: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                    required
                  >
                    <option value="">Kategorie wählen...</option>
                    {FLAT_RATE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                  <textarea
                    value={editFlatRateFormData.description}
                    onChange={(e) => setEditFlatRateFormData({ ...editFlatRateFormData, description: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                    placeholder="z.B. Druckkosten für Unterrichtsmaterialien"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Menge</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={editFlatRateFormData.quantity}
                      onChange={(e) => setEditFlatRateFormData({ ...editFlatRateFormData, quantity: e.target.value })}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                      placeholder="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Betrag (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFlatRateFormData.amount_euro}
                      onChange={(e) => setEditFlatRateFormData({ ...editFlatRateFormData, amount_euro: e.target.value })}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                      placeholder="z.B. 50.00"
                      required
                    />
                  </div>
                </div>
                {editFlatRateFormData.quantity && editFlatRateFormData.amount_euro && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <p className="text-sm font-medium text-green-800">
                      Gesamtbetrag: {(parseFloat(editFlatRateFormData.quantity) * parseFloat(editFlatRateFormData.amount_euro)).toFixed(2)} €
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                  <input
                    type="date"
                    value={editFlatRateFormData.date}
                    onChange={(e) => setEditFlatRateFormData({ ...editFlatRateFormData, date: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                onClick={handleUpdateFlatRateItem}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm"
              >
                Speichern
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditFlatRateDialog(false);
                  setEditingFlatRateItem(null);
                  setEditFlatRateFormData({ category: '', description: '', quantity: '', amount_euro: '', date: '' });
                }}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};