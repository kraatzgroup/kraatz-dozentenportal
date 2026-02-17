import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Calendar, User, BookOpen, FileText, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useHoursStore } from '../store/hoursStore';

interface TeilnehmerDetailViewProps {
  teilnehmerId: string;
  teilnehmerName: string;
  onBack: () => void;
  isAdmin?: boolean;
}

interface TeilnehmerHours {
  id: string;
  hours: number;
  date: string;
  description: string;
  legal_area: string;
  created_at: string;
  dozent_id: string;
  dozent_name: string;
  dozent_email: string;
}

export function TeilnehmerDetailView({ teilnehmerId, teilnehmerName, onBack, isAdmin = false }: TeilnehmerDetailViewProps) {
  const [hours, setHours] = useState<TeilnehmerHours[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalHours, setTotalHours] = useState(0);
  const [uniqueDozenten, setUniqueDozenten] = useState<string[]>([]);
  const [showAddHoursDialog, setShowAddHoursDialog] = useState(false);
  const [dozenten, setDozenten] = useState<{ id: string; full_name: string }[]>([]);
  const [hoursFormData, setHoursFormData] = useState({
    dozent_id: '',
    hours: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    legal_area: ''
  });
  const [editingHours, setEditingHours] = useState<TeilnehmerHours | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [teilnehmerInfo, setTeilnehmerInfo] = useState<{
    booked_hours?: number;
    hours_zivilrecht?: number;
    hours_strafrecht?: number;
    hours_oeffentliches_recht?: number;
    frequency_type?: string;
    frequency_hours_zivilrecht?: number;
    frequency_hours_strafrecht?: number;
    frequency_hours_oeffentliches_recht?: number;
  }>({});
  const { user } = useAuthStore();

  useEffect(() => {
    fetchTeilnehmerHours();
    if (isAdmin) {
      fetchDozenten();
    }
    
    // Setup real-time subscription for participant hours
    const { setupRealtimeSubscription, cleanupSubscription } = useHoursStore.getState();
    setupRealtimeSubscription();
    
    return () => {
      cleanupSubscription();
    };
  }, [teilnehmerId]);

  const fetchTeilnehmerHours = async () => {
    if (!teilnehmerId) {
      console.warn('⚠️ teilnehmerId is null or undefined, skipping fetch');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Fetching ALL hours for teilnehmer:', teilnehmerId);

      // Fetch teilnehmer info (booked hours per subject)
      const { data: tData } = await supabase
        .from('teilnehmer')
        .select('booked_hours, hours_zivilrecht, hours_strafrecht, hours_oeffentliches_recht, frequency_type, frequency_hours_zivilrecht, frequency_hours_strafrecht, frequency_hours_oeffentliches_recht')
        .eq('id', teilnehmerId)
        .single();
      if (tData) {
        setTeilnehmerInfo(tData);
      }

      // Fetch hours using regular client - RLS policies handle access
      const { data, error } = await supabase
        .from('participant_hours')
        .select(`
          id,
          hours,
          date,
          description,
          legal_area,
          created_at,
          dozent_id,
          dozent:profiles!participant_hours_dozent_id_fkey(full_name, email)
        `)
        .eq('teilnehmer_id', teilnehmerId)
        .order('date', { ascending: false });

      if (error) {
        console.error('❌ Error fetching teilnehmer hours:', error);
        throw error;
      }

      console.log('✅ Raw hours data from database:', data);
      console.log('📊 Number of hours entries found:', data?.length || 0);
      
      // Debug: Show unique dozents in the data
      const uniqueDozentenInData = [...new Set(data?.map(h => (h.dozent as any)?.full_name).filter(Boolean))];
      console.log('👥 Unique dozents found in data:', uniqueDozentenInData);
      
      // Debug: Show hours per dozent
      uniqueDozentenInData.forEach(dozentName => {
        const dozentHours = data?.filter(h => (h.dozent as any)?.full_name === dozentName) || [];
        console.log(`📈 ${dozentName}: ${dozentHours.length} entries, ${dozentHours.reduce((sum, h) => sum + parseFloat(h.hours.toString()), 0)} total hours`);
      });

      // Transform data
      const transformedData: TeilnehmerHours[] = data?.map(item => ({
        id: item.id,
        hours: parseFloat(item.hours.toString()),
        date: item.date,
        description: item.description || '',
        legal_area: item.legal_area || '',
        created_at: item.created_at,
        dozent_id: item.dozent_id,
        dozent_name: (item.dozent as any)?.full_name || 'Unbekannt',
        dozent_email: (item.dozent as any)?.email || ''
      })) || [];

      setHours(transformedData);

      // Calculate totals (all hours for this teilnehmer)
      const total = transformedData.reduce((sum, h) => sum + h.hours, 0);
      setTotalHours(total);

      // Get unique dozenten
      const dozenten = [...new Set(transformedData.map(h => h.dozent_name))];
      setUniqueDozenten(dozenten);

    } catch (error: any) {
      console.error('Error in fetchTeilnehmerHours:', error);
      setError(error.message || 'Fehler beim Laden der Stunden');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDozenten = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'dozent')
        .order('full_name');

      if (error) throw error;
      setDozenten(data || []);
    } catch (error) {
      console.error('Error fetching dozenten:', error);
    }
  };

  const handleAddHours = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('participant_hours')
        .insert([{
          teilnehmer_id: teilnehmerId,
          dozent_id: hoursFormData.dozent_id,
          hours: parseFloat(hoursFormData.hours),
          date: hoursFormData.date,
          description: hoursFormData.description,
          legal_area: hoursFormData.legal_area
        }])
        .select()
        .single();

      if (error) throw error;

      // Refresh the hours data
      await fetchTeilnehmerHours();
      
      // Close dialog and reset form
      setShowAddHoursDialog(false);
      setHoursFormData({
        dozent_id: '',
        hours: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        legal_area: ''
      });
    } catch (error: any) {
      console.error('Error adding hours:', error);
      alert('Fehler beim Hinzufügen der Stunden: ' + error.message);
    }
  };

  const handleEditHours = (hoursEntry: TeilnehmerHours) => {
    setEditingHours(hoursEntry);
    setHoursFormData({
      dozent_id: hoursEntry.dozent_name, // This will be read-only
      hours: hoursEntry.hours.toString(),
      date: hoursEntry.date,
      description: hoursEntry.description,
      legal_area: hoursEntry.legal_area
    });
    setShowEditDialog(true);
  };

  const handleUpdateHours = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingHours) return;
    
    try {
      const { error } = await supabase
        .from('participant_hours')
        .update({
          hours: parseFloat(hoursFormData.hours),
          date: hoursFormData.date,
          description: hoursFormData.description,
          legal_area: hoursFormData.legal_area
        })
        .eq('id', editingHours.id);

      if (error) throw error;

      // Refresh the hours data
      await fetchTeilnehmerHours();
      
      // Close dialog and reset form
      setShowEditDialog(false);
      setEditingHours(null);
      setHoursFormData({
        dozent_id: '',
        hours: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        legal_area: ''
      });
    } catch (error: any) {
      console.error('Error updating hours:', error);
      alert('Fehler beim Aktualisieren der Stunden: ' + error.message);
    }
  };

  const handleDeleteHours = async (hoursEntry: TeilnehmerHours) => {
    if (window.confirm(`Möchten Sie den Stundeneintrag vom ${formatDate(hoursEntry.date)} (${hoursEntry.hours}h) wirklich löschen?`)) {
      try {
        const { error } = await supabase
          .from('participant_hours')
          .delete()
          .eq('id', hoursEntry.id);

        if (error) throw error;

        // Refresh the hours data
        await fetchTeilnehmerHours();
      } catch (error: any) {
        console.error('Error deleting hours:', error);
        alert('Fehler beim Löschen der Stunden: ' + error.message);
      }
    }
  };
  const handleGenerateTeilnehmerReport = async () => {
    try {
      // Import the PDF generator
      const { generateTeilnehmerStundenPDF } = await import('../utils/pdfGenerator');
      
      // Generate PDF with all hours data
      await generateTeilnehmerStundenPDF({
        teilnehmerName,
        hours,
        totalHours,
        uniqueDozenten
      });

    } catch (error) {
      console.error('Error generating Teilnehmer report:', error);
      alert('Fehler beim Generieren des PDF-Berichts: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLegalAreaColor = (legalArea: string) => {
    return 'bg-blue-100 text-blue-800';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-medium text-gray-900">
            Stundenübersicht für {teilnehmerName}
          </h3>
        </div>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-medium text-gray-900">
            Stundenübersicht für {teilnehmerName}
          </h3>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <>
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
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Stundenübersicht für {teilnehmerName}
            </h3>
            <p className="text-sm text-gray-500">
              {isAdmin 
                ? 'Alle eingetragenen Stunden von allen Dozenten'
                : 'Ihre eingetragenen Stunden für diesen Teilnehmer'
              }
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleGenerateTeilnehmerReport}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
          >
            <FileText className="h-4 w-4 mr-2" />
            Bericht erstellen
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAddHoursDialog(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              <Clock className="h-4 w-4 mr-2" />
              Stunden hinzufügen
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {(() => {
        const myHours = isAdmin ? hours : hours.filter(h => h.dozent_id === user?.id);
        const myTotal = myHours.reduce((sum, h) => sum + h.hours, 0);
        const uniqueAreas = [...new Set(hours.map(h => h.legal_area).filter(Boolean))];
        return (
          <div className={`grid grid-cols-1 gap-4 ${isAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-3'}`}>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Clock className="h-8 w-8 text-primary" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {isAdmin ? 'Gesamtstunden' : 'Meine Stunden'}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {isAdmin ? totalHours.toFixed(2) : myTotal.toFixed(2)}h
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Calendar className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {isAdmin ? 'Einträge' : 'Meine Einträge'}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {isAdmin ? hours.length : myHours.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BookOpen className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Rechtsgebiete
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {uniqueAreas.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Hours List */}
      {(() => {
        // For dozent: only show own entries. For admin: show all.
        const displayHours = isAdmin ? hours : hours.filter(h => h.dozent_id === user?.id);
        return (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {isAdmin ? 'Stundeneinträge (chronologisch)' : 'Meine Stundeneinträge'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {isAdmin 
                  ? `Alle Stunden für ${teilnehmerName} von allen Dozenten`
                  : `Ihre eingetragenen Stunden für ${teilnehmerName}`
                }
              </p>
            </div>

            {displayHours.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Keine Stunden eingetragen</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {isAdmin 
                    ? 'Für diesen Teilnehmer wurden noch keine Stunden eingetragen.'
                    : 'Sie haben noch keine Stunden für diesen Teilnehmer eingetragen.'
                  }
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {displayHours.map((hoursEntry) => (
                  <li key={hoursEntry.id} className="px-4 py-6 sm:px-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-primary" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center space-x-3">
                                <span className="text-lg font-semibold text-primary">
                                  {hoursEntry.hours}h
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLegalAreaColor(hoursEntry.legal_area)}`}>
                                  {hoursEntry.legal_area || 'Nicht angegeben'}
                                </span>
                              </div>
                              <div className="flex items-center mt-1 text-sm text-gray-500 space-x-4">
                                <div className="flex items-center">
                                  <Calendar className="h-4 w-4 mr-1" />
                                  <span>{formatDate(hoursEntry.date)}</span>
                                </div>
                                {isAdmin && (
                                  <div className="flex items-center">
                                    <User className="h-4 w-4 mr-1" />
                                    <span>{hoursEntry.dozent_name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEditHours(hoursEntry)}
                                className="text-gray-400 hover:text-primary transition-colors"
                                title="Stunden bearbeiten"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteHours(hoursEntry)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                                title="Stunden löschen"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="text-xs text-gray-500">
                              Eingetragen am
                            </div>
                            <div className="text-sm text-gray-900">
                              {formatDateTime(hoursEntry.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                        
                        {hoursEntry.description && (
                          <div className="mt-3 ml-14">
                            <div className="flex items-start">
                              <BookOpen className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-gray-700 bg-gray-50 rounded-md p-3 flex-1">
                                <div className="font-medium text-gray-900 mb-1">Inhalt:</div>
                                {hoursEntry.description}
                              </div>
                            </div>
                          </div>
                        )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* Stunden nach Rechtsgebiet */}
      {(() => {
        // For the per-subject breakdown, always use ALL hours (from all dozenten)
        // to show the real total completed per subject
        const allSubjectHours = hours;
        const sourceHours = isAdmin ? hours : hours.filter(h => h.dozent_id === user?.id);
        const uniqueAreas = [...new Set(allSubjectHours.map(h => h.legal_area).filter(Boolean))];
        if (uniqueAreas.length === 0) return null;

        const getAreaColor = (area: string) => {
          switch (area) {
            case 'Zivilrecht': return { bg: 'bg-blue-100', text: 'text-blue-800', icon: 'text-blue-600', ring: 'bg-blue-50' };
            case 'Strafrecht': return { bg: 'bg-red-100', text: 'text-red-800', icon: 'text-red-600', ring: 'bg-red-50' };
            case 'Öffentliches Recht': return { bg: 'bg-green-100', text: 'text-green-800', icon: 'text-green-600', ring: 'bg-green-50' };
            default: return { bg: 'bg-gray-100', text: 'text-gray-800', icon: 'text-gray-600', ring: 'bg-gray-50' };
          }
        };

        const getBookedForArea = (area: string): number | null => {
          switch (area) {
            case 'Zivilrecht': return teilnehmerInfo.hours_zivilrecht ?? null;
            case 'Strafrecht': return teilnehmerInfo.hours_strafrecht ?? null;
            case 'Öffentliches Recht': return teilnehmerInfo.hours_oeffentliches_recht ?? null;
            default: return null;
          }
        };

        const getFrequencyForArea = (area: string): number | null => {
          switch (area) {
            case 'Zivilrecht': return teilnehmerInfo.frequency_hours_zivilrecht ?? null;
            case 'Strafrecht': return teilnehmerInfo.frequency_hours_strafrecht ?? null;
            case 'Öffentliches Recht': return teilnehmerInfo.frequency_hours_oeffentliches_recht ?? null;
            default: return null;
          }
        };

        const frequencyLabel = teilnehmerInfo.frequency_type === 'weekly' ? 'Std./Woche' : teilnehmerInfo.frequency_type === 'monthly' ? 'Std./Monat' : null;

        return (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Stunden nach Rechtsgebiet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {isAdmin 
                  ? `Aufschlüsselung aller Stunden für ${teilnehmerName}`
                  : `Stundenübersicht für ${teilnehmerName} nach Rechtsgebiet`
                }
              </p>
            </div>
            <ul className="divide-y divide-gray-200">
              {uniqueAreas.map((area) => {
                const allAreaHours = allSubjectHours.filter(h => h.legal_area === area);
                const totalCompleted = allAreaHours.reduce((sum, h) => sum + h.hours, 0);
                const myAreaHours = sourceHours.filter(h => h.legal_area === area);
                const myTotal = myAreaHours.reduce((sum, h) => sum + h.hours, 0);
                const booked = getBookedForArea(area);
                const frequency = getFrequencyForArea(area);
                const remaining = booked !== null ? Math.max(0, booked - totalCompleted) : null;
                const pct = booked && booked > 0 ? Math.min(100, Math.round((totalCompleted / booked) * 100)) : 0;
                const colors = getAreaColor(area);
                
                return (
                  <li key={area} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <div className={`h-8 w-8 rounded-full ${colors.ring} flex items-center justify-center`}>
                            <BookOpen className={`h-4 w-4 ${colors.icon}`} />
                          </div>
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{area}</span>
                            {frequency !== null && frequencyLabel && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
                                Soll: {frequency} {frequencyLabel}
                              </span>
                            )}
                          </div>
                          {booked !== null && booked > 0 && (
                            <div className="mt-1">
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-orange-400' : colors.icon.replace('text-', 'bg-')
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {!isAdmin && myTotal !== totalCompleted && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              Davon von Ihnen: <span className="font-medium text-primary">{myTotal.toFixed(2)}h</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        {booked !== null ? (
                          <>
                            <div className="text-lg font-semibold text-primary">
                              {totalCompleted.toFixed(2)} / {booked}h
                            </div>
                            <div className="text-xs text-gray-500">
                              {remaining !== null && remaining > 0 ? (
                                <span className="text-green-600">{remaining} Std. offen</span>
                              ) : remaining === 0 ? (
                                <span className="text-gray-400">abgeschlossen</span>
                              ) : (
                                'gebucht'
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-lg font-semibold text-primary">
                              {totalCompleted.toFixed(2)}h
                            </div>
                            <div className="text-xs text-gray-400 italic">
                              keine Verteilung
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}
      </div>

      {/* Add Hours Dialog (Admin only) */}
      {showAddHoursDialog && isAdmin && (
      <div className="fixed z-10 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity" aria-hidden="true">
            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
          </div>
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <form onSubmit={handleAddHours}>
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Stunden für {teilnehmerName} hinzufügen
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <User className="h-4 w-4 inline mr-1" />
                      Dozent
                    </label>
                    <select
                      value={hoursFormData.dozent_id}
                      onChange={(e) => setHoursFormData({ ...hoursFormData, dozent_id: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                      required
                    >
                      <option value="">Dozent auswählen</option>
                      {dozenten.map((dozent) => (
                        <option key={dozent.id} value={dozent.id}>
                          {dozent.full_name}
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
                      value={hoursFormData.hours}
                      onChange={(e) => setHoursFormData({ ...hoursFormData, hours: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                      placeholder="z.B. 4"
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
                      value={hoursFormData.date}
                      onChange={(e) => setHoursFormData({ ...hoursFormData, date: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rechtsgebiet
                    </label>
                    <select
                      value={hoursFormData.legal_area}
                      onChange={(e) => setHoursFormData({ ...hoursFormData, legal_area: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                      required
                    >
                      <option value="">Rechtsgebiet auswählen</option>
                      <option value="Zivilrecht">Zivilrecht</option>
                      <option value="Öffentliches Recht">Öffentliches Recht</option>
                      <option value="Strafrecht">Strafrecht</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Beschreibung (optional)
                    </label>
                    <textarea
                      value={hoursFormData.description}
                      onChange={(e) => setHoursFormData({ ...hoursFormData, description: e.target.value })}
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
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Hinzufügen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddHoursDialog(false);
                    setHoursFormData({
                      dozent_id: '',
                      hours: '',
                      date: new Date().toISOString().split('T')[0],
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

      {/* Edit Hours Dialog */}
      {showEditDialog && editingHours && (
      <div className="fixed z-10 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity" aria-hidden="true">
            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
          </div>
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <form onSubmit={handleUpdateHours}>
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Stunden für {teilnehmerName} bearbeiten
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <User className="h-4 w-4 inline mr-1" />
                      Dozent
                    </label>
                    <input
                      type="text"
                      value={editingHours.dozent_name}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100"
                      disabled
                    />
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
                      value={hoursFormData.hours}
                      onChange={(e) => setHoursFormData({ ...hoursFormData, hours: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                      placeholder="z.B. 8.5"
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
                      value={hoursFormData.date}
                      onChange={(e) => setHoursFormData({ ...hoursFormData, date: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rechtsgebiet
                    </label>
                    <select
                      value={hoursFormData.legal_area}
                      onChange={(e) => setHoursFormData({ ...hoursFormData, legal_area: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                      required
                    >
                      <option value="">Rechtsgebiet auswählen</option>
                      <option value="Zivilrecht">Zivilrecht</option>
                      <option value="Öffentliches Recht">Öffentliches Recht</option>
                      <option value="Strafrecht">Strafrecht</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Beschreibung (optional)
                    </label>
                    <textarea
                      value={hoursFormData.description}
                      onChange={(e) => setHoursFormData({ ...hoursFormData, description: e.target.value })}
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
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingHours(null);
                    setHoursFormData({
                      dozent_id: '',
                      hours: '',
                      date: new Date().toISOString().split('T')[0],
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
    </>
  );
}