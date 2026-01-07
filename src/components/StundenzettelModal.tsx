import { useState, useEffect } from 'react';
import { X, Clock, Calendar, User, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StundenzettelEntry {
  id: string;
  date: string;
  hours: number;
  topic: string | null;
  notes: string | null;
  rechtsgebiet: string | null;
  dozent_id: string | null;
  dozent_name?: string;
}

interface StundenzettelModalProps {
  teilnehmer: {
    id: string;
    name: string;
    booked_hours: number | null;
    completed_hours: number | null;
  };
  onClose: () => void;
  dozenten: { id: string; full_name: string }[];
}

export function StundenzettelModal({ teilnehmer, onClose, dozenten }: StundenzettelModalProps) {
  const [entries, setEntries] = useState<StundenzettelEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEntries();
  }, [teilnehmer.id]);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('stundenzettel')
        .select('*')
        .eq('teilnehmer_id', teilnehmer.id)
        .order('date', { ascending: false });

      if (error) throw error;

      // Map dozent names
      const entriesWithDozentNames = (data || []).map(entry => ({
        ...entry,
        dozent_name: dozenten.find(d => d.id === entry.dozent_id)?.full_name || 'Unbekannt'
      }));

      setEntries(entriesWithDozentNames);
    } catch (error) {
      console.error('Error fetching stundenzettel:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalHours = entries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  const bookedHours = teilnehmer.booked_hours || 0;
  const remainingHours = bookedHours - totalHours;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center">
            <Clock className="h-5 w-5 text-primary mr-2" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Stundenzettel</h2>
              <p className="text-sm text-gray-500">{teilnehmer.name}</p>
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
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{totalHours}</div>
              <div className="text-xs text-gray-500">Abgehalten</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">{bookedHours}</div>
              <div className="text-xs text-gray-500">Gebucht</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${remainingHours > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {remainingHours}
              </div>
              <div className="text-xs text-gray-500">Ausstehend</div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  bookedHours > 0 && totalHours >= bookedHours ? 'bg-green-500' : 'bg-primary'
                }`}
                style={{ width: `${bookedHours > 0 ? Math.min(100, (totalHours / bookedHours) * 100) : 0}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 text-right mt-1">
              {bookedHours > 0 ? Math.round((totalHours / bookedHours) * 100) : 0}% abgeschlossen
            </div>
          </div>
        </div>

        {/* Entries List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Noch keine Stunden eingetragen</p>
              <p className="text-sm mt-1">Dozenten können hier Stunden für diesen Teilnehmer eintragen.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="h-4 w-4 mr-1" />
                          {new Date(entry.date).toLocaleDateString('de-DE', {
                            weekday: 'short',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="flex items-center text-sm font-medium text-primary">
                          <Clock className="h-4 w-4 mr-1" />
                          {entry.hours} Std.
                        </div>
                      </div>
                      
                      {entry.topic && (
                        <div className="flex items-start text-sm mb-1">
                          <BookOpen className="h-4 w-4 mr-1 mt-0.5 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-700">{entry.topic}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center text-xs text-gray-500 mt-2 space-x-3">
                        <div className="flex items-center">
                          <User className="h-3 w-3 mr-1" />
                          {entry.dozent_name}
                        </div>
                        {entry.rechtsgebiet && (
                          <span className="px-2 py-0.5 bg-gray-200 rounded text-gray-600">
                            {entry.rechtsgebiet}
                          </span>
                        )}
                      </div>
                      
                      {entry.notes && (
                        <p className="text-xs text-gray-500 mt-2 italic">{entry.notes}</p>
                      )}
                    </div>
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
