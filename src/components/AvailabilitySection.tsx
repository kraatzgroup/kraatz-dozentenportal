import { useState, useEffect } from 'react';
import { Calendar, Users, CheckCircle, AlertCircle, XCircle, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToastStore } from '../store/toastStore';

interface Availability {
  id?: string;
  dozent_id: string;
  month: number;
  year: number;
  capacity_status: 'available' | 'limited' | 'full';
  max_participants?: number;
  current_participants?: number;
  notes?: string;
}

interface AvailabilitySectionProps {
  dozentId?: string;
  isAdmin?: boolean;
  onAvailabilityChange?: (status: string) => void;
}

export function AvailabilitySection({ dozentId, isAdmin = false, onAvailabilityChange }: AvailabilitySectionProps) {
  const { addToast } = useToastStore();
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [startMonth, setStartMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  // Generate 6 months starting from startMonth
  const months = Array.from({ length: 6 }, (_, i) => {
    let month = startMonth.month + i;
    let year = startMonth.year;
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    return { month, year };
  });

  const getMonthName = (month: number) => {
    return new Date(2023, month - 1).toLocaleDateString('de-DE', { month: 'long' });
  };

  const fetchAvailabilities = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const targetDozentId = dozentId || user?.id;
      
      if (!targetDozentId) return;

      const { data, error } = await supabase
        .from('dozent_availability')
        .select('*')
        .eq('dozent_id', targetDozentId)
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (error) throw error;
      setAvailabilities(data || []);
    } catch (error) {
      console.error('Error fetching availabilities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailabilities();
  }, [dozentId]);

  const getAvailabilityForMonth = (month: number, year: number): Availability | undefined => {
    return availabilities.find(a => a.month === month && a.year === year);
  };

  const handleStatusChange = async (month: number, year: number, status: 'available' | 'limited' | 'full') => {
    if (isAdmin) return; // Admin can only view
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const existing = getAvailabilityForMonth(month, year);
      
      if (existing) {
        const { error } = await supabase
          .from('dozent_availability')
          .update({ capacity_status: status, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dozent_availability')
          .insert({
            dozent_id: user.id,
            month,
            year,
            capacity_status: status
          });
        
        if (error) throw error;
      }

      await fetchAvailabilities();
      addToast('Verfügbarkeit aktualisiert', 'success');
      
      // Notify parent if this is the current month
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      if (month === currentMonth && year === currentYear && onAvailabilityChange) {
        onAvailabilityChange(status);
      }
    } catch (error) {
      console.error('Error updating availability:', error);
      addToast('Fehler beim Speichern', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotesChange = async (month: number, year: number, notes: string) => {
    if (isAdmin) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const existing = getAvailabilityForMonth(month, year);
      
      if (existing) {
        const { error } = await supabase
          .from('dozent_availability')
          .update({ notes, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dozent_availability')
          .insert({
            dozent_id: user.id,
            month,
            year,
            capacity_status: 'available',
            notes
          });
        
        if (error) throw error;
      }

      await fetchAvailabilities();
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  const handleMaxParticipantsChange = async (month: number, year: number, maxParticipants: number) => {
    if (isAdmin) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const existing = getAvailabilityForMonth(month, year);
      
      if (existing) {
        const { error } = await supabase
          .from('dozent_availability')
          .update({ max_participants: maxParticipants, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dozent_availability')
          .insert({
            dozent_id: user.id,
            month,
            year,
            capacity_status: 'available',
            max_participants: maxParticipants
          });
        
        if (error) throw error;
      }

      await fetchAvailabilities();
    } catch (error) {
      console.error('Error updating max participants:', error);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 border-green-300';
      case 'limited': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'full': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="h-4 w-4" />;
      case 'limited': return <AlertCircle className="h-4 w-4" />;
      case 'full': return <XCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'available': return 'Verfügbar';
      case 'limited': return 'Begrenzt';
      case 'full': return 'Ausgelastet';
      default: return 'Nicht angegeben';
    }
  };

  const navigateMonths = (direction: 'prev' | 'next') => {
    setStartMonth(prev => {
      let newMonth = direction === 'next' ? prev.month + 3 : prev.month - 3;
      let newYear = prev.year;
      
      while (newMonth > 12) {
        newMonth -= 12;
        newYear += 1;
      }
      while (newMonth < 1) {
        newMonth += 12;
        newYear -= 1;
      }
      
      return { month: newMonth, year: newYear };
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg font-medium text-gray-900">Verfügbarkeit & Kapazität</h3>
        </div>
        <div className="p-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Verfügbarkeit & Kapazität</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonths('prev')}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigateMonths('next')}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin 
            ? 'Übersicht der Dozenten-Verfügbarkeit'
            : 'Teilen Sie Ihre Verfügbarkeit für die kommenden Monate mit'}
        </p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {months.map(({ month, year }) => {
            const availability = getAvailabilityForMonth(month, year);
            const isPast = new Date(year, month - 1) < new Date(new Date().getFullYear(), new Date().getMonth());
            
            return (
              <div 
                key={`${month}-${year}`} 
                className={`border rounded-lg p-4 ${isPast ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{getMonthName(month)}</h4>
                    <p className="text-sm text-gray-500">{year}</p>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(availability?.capacity_status)}`}>
                    {getStatusIcon(availability?.capacity_status)}
                    <span>{getStatusText(availability?.capacity_status)}</span>
                  </div>
                </div>

                {!isAdmin && !isPast && (
                  <>
                    <div className="flex gap-1 mb-3">
                      <button
                        onClick={() => handleStatusChange(month, year, 'available')}
                        disabled={isSaving}
                        className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors ${
                          availability?.capacity_status === 'available'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-green-100'
                        }`}
                      >
                        <CheckCircle className="h-3 w-3 mx-auto" />
                      </button>
                      <button
                        onClick={() => handleStatusChange(month, year, 'limited')}
                        disabled={isSaving}
                        className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors ${
                          availability?.capacity_status === 'limited'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-yellow-100'
                        }`}
                      >
                        <AlertCircle className="h-3 w-3 mx-auto" />
                      </button>
                      <button
                        onClick={() => handleStatusChange(month, year, 'full')}
                        disabled={isSaving}
                        className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors ${
                          availability?.capacity_status === 'full'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-red-100'
                        }`}
                      >
                        <XCircle className="h-3 w-3 mx-auto" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Max. Teilnehmer</label>
                        <input
                          type="number"
                          min="0"
                          value={availability?.max_participants || ''}
                          onChange={(e) => handleMaxParticipantsChange(month, year, parseInt(e.target.value) || 0)}
                          placeholder="z.B. 5"
                          className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Anmerkungen</label>
                        <input
                          type="text"
                          value={availability?.notes || ''}
                          onChange={(e) => handleNotesChange(month, year, e.target.value)}
                          placeholder="z.B. Urlaub 15.-20."
                          className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </>
                )}

                {(isAdmin || isPast) && availability && (
                  <div className="space-y-2 text-sm">
                    {availability.max_participants && (
                      <div className="flex items-center text-gray-600">
                        <Users className="h-4 w-4 mr-1" />
                        Max. {availability.max_participants} Teilnehmer
                      </div>
                    )}
                    {availability.notes && (
                      <p className="text-gray-500 text-xs italic">{availability.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!isAdmin && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800">Hinweis</h4>
                <p className="mt-1 text-sm text-blue-700">
                  Ihre Verfügbarkeitsangaben helfen der Verwaltung bei der Zuweisung neuer Teilnehmer. 
                  Bitte halten Sie diese Informationen aktuell.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
