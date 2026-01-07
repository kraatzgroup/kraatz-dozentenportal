import { useState, useEffect } from 'react';
import { X, Clock, Calendar, User, BookOpen, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DozentTaetigkeitsberichtModalProps {
  dozentId: string;
  dozentName: string;
  onClose: () => void;
}

interface HoursEntry {
  id: string;
  hours: number;
  date: string;
  description: string;
  legal_area: string;
  created_at: string;
  teilnehmer_id: string;
  teilnehmer_name: string;
}

export function DozentTaetigkeitsberichtModal({ dozentId, dozentName, onClose }: DozentTaetigkeitsberichtModalProps) {
  const [entries, setEntries] = useState<HoursEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    fetchHours();
  }, [dozentId]);

  const fetchHours = async () => {
    setIsLoading(true);
    try {
      // Fetch all hours entries for this dozent
      const { data, error } = await supabase
        .from('participant_hours')
        .select(`
          id,
          hours,
          date,
          description,
          legal_area,
          created_at,
          teilnehmer_id,
          teilnehmer:teilnehmer!participant_hours_teilnehmer_id_fkey(name)
        `)
        .eq('dozent_id', dozentId)
        .order('date', { ascending: false });

      if (error) throw error;

      const formattedEntries = (data || []).map((entry: any) => ({
        id: entry.id,
        hours: entry.hours,
        date: entry.date,
        description: entry.description,
        legal_area: entry.legal_area,
        created_at: entry.created_at,
        teilnehmer_id: entry.teilnehmer_id,
        teilnehmer_name: entry.teilnehmer?.name || 'Unbekannt'
      }));

      setEntries(formattedEntries);
      setTotalHours(formattedEntries.reduce((sum, e) => sum + e.hours, 0));
    } catch (error) {
      console.error('Error fetching hours:', error);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getLegalAreaColor = (area: string) => {
    switch (area) {
      case 'Zivilrecht':
        return 'bg-blue-100 text-blue-800';
      case 'Strafrecht':
        return 'bg-red-100 text-red-800';
      case 'Öffentliches Recht':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Group entries by month
  const groupedByMonth = entries.reduce((acc, entry) => {
    const monthKey = new Date(entry.date).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(entry);
    return acc;
  }, {} as Record<string, HoursEntry[]>);

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-primary mr-2" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Tätigkeitsbericht</h2>
              <p className="text-sm text-gray-500">{dozentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="p-4 bg-primary/5 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-primary mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Gesamt Stunden</p>
                  <p className="text-xl font-bold text-primary">{totalHours}</p>
                </div>
              </div>
              <div className="flex items-center">
                <BookOpen className="h-5 w-5 text-primary mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Einträge</p>
                  <p className="text-xl font-bold text-gray-900">{entries.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mb-3 text-gray-300" />
              <p>Keine Einträge vorhanden</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByMonth).map(([month, monthEntries]) => (
                <div key={month}>
                  <h3 className="text-sm font-medium text-gray-500 mb-3 sticky top-0 bg-white py-1">
                    {month} ({monthEntries.reduce((sum, e) => sum + e.hours, 0)} Stunden)
                  </h3>
                  <div className="space-y-2">
                    {monthEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLegalAreaColor(entry.legal_area)}`}>
                                {entry.legal_area || 'Kein Rechtsgebiet'}
                              </span>
                              <span className="text-sm text-gray-500 flex items-center">
                                <Calendar className="h-3.5 w-3.5 mr-1" />
                                {formatDate(entry.date)}
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-gray-700 mb-1">
                              <User className="h-4 w-4 mr-1.5 text-gray-400" />
                              <span className="font-medium">{entry.teilnehmer_name}</span>
                            </div>
                            {entry.description && (
                              <p className="text-sm text-gray-600 mt-2">{entry.description}</p>
                            )}
                          </div>
                          <div className="ml-4 flex-shrink-0">
                            <div className="flex items-center bg-primary/10 text-primary px-3 py-1.5 rounded-full">
                              <Clock className="h-4 w-4 mr-1.5" />
                              <span className="font-bold">{entry.hours}</span>
                              <span className="ml-1 text-sm">Std.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
