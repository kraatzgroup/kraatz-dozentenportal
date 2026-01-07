import { useState, useEffect } from 'react';
import { X, Users, User, Calendar, Scale, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DozentTeilnehmerModalProps {
  dozentId: string;
  dozentName: string;
  onClose: () => void;
}

interface Teilnehmer {
  id: string;
  name: string;
  studienziel: string;
  contract_start: string | null;
  contract_end: string | null;
  booked_hours: number | null;
  completed_hours: number | null;
  legal_areas: string[];
  assignedAreas: string[];
}

// Inner component for rendering a teilnehmer card
function TeilnehmerCard({ 
  t, 
  formatDate, 
  getLegalAreaColor, 
  getProgressPercent,
  isActive 
}: { 
  t: Teilnehmer; 
  formatDate: (d: string | null) => string;
  getLegalAreaColor: (area: string) => string;
  getProgressPercent: (completed: number | null, booked: number | null) => number;
  isActive: boolean;
}) {
  return (
    <div className={`border rounded-lg p-4 transition-shadow ${isActive ? 'bg-white border-gray-200 hover:shadow-sm' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Name and Studienziel */}
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className={`font-medium ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>{t.name}</span>
            {t.studienziel && (
              <span className="text-sm text-gray-500">• {t.studienziel}</span>
            )}
            {!isActive && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                Abgeschlossen
              </span>
            )}
          </div>

          {/* Assigned Legal Areas */}
          <div className="flex items-center gap-2 mb-2">
            <Scale className="h-4 w-4 text-gray-400" />
            <div className="flex flex-wrap gap-1">
              {t.assignedAreas.map((area, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${getLegalAreaColor(area)}`}
                >
                  {area}
                </span>
              ))}
            </div>
          </div>

          {/* Contract Period */}
          {(t.contract_start || t.contract_end) && (
            <div className="flex items-center text-sm text-gray-500 mb-2">
              <Calendar className="h-4 w-4 mr-1.5 text-gray-400" />
              <span>{formatDate(t.contract_start)} - {formatDate(t.contract_end)}</span>
            </div>
          )}

          {/* Hours Progress */}
          {t.booked_hours && t.booked_hours > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center text-gray-500">
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  <span>Stunden</span>
                </div>
                <span className="font-medium">
                  {t.completed_hours || 0} / {t.booked_hours}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    getProgressPercent(t.completed_hours, t.booked_hours) >= 100
                      ? 'bg-green-500'
                      : getProgressPercent(t.completed_hours, t.booked_hours) >= 75
                      ? 'bg-orange-500'
                      : 'bg-primary'
                  }`}
                  style={{ width: `${getProgressPercent(t.completed_hours, t.booked_hours)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DozentTeilnehmerModal({ dozentId, dozentName, onClose }: DozentTeilnehmerModalProps) {
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPastTeilnehmer, setShowPastTeilnehmer] = useState(false);

  // Helper to check if contract is active
  const isContractActive = (t: Teilnehmer): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!t.contract_start || !t.contract_end) return true; // No dates = assume active
    const start = new Date(t.contract_start);
    const end = new Date(t.contract_end);
    return today >= start && today <= end;
  };

  // Split into active and past
  const activeTeilnehmer = teilnehmer.filter(isContractActive);
  const pastTeilnehmer = teilnehmer.filter(t => !isContractActive(t));

  useEffect(() => {
    fetchTeilnehmer();
  }, [dozentId]);

  const fetchTeilnehmer = async () => {
    setIsLoading(true);
    try {
      // Fetch all teilnehmer where this dozent is assigned to any legal area
      // Using three separate queries and combining results to avoid .or() issues
      const [zivilResult, strafResult, oeffResult] = await Promise.all([
        supabase.from('teilnehmer').select('*').eq('dozent_zivilrecht_id', dozentId),
        supabase.from('teilnehmer').select('*').eq('dozent_strafrecht_id', dozentId),
        supabase.from('teilnehmer').select('*').eq('dozent_oeffentliches_recht_id', dozentId)
      ]);

      // Combine and deduplicate results
      const allData = [
        ...(zivilResult.data || []),
        ...(strafResult.data || []),
        ...(oeffResult.data || [])
      ];
      
      // Remove duplicates by id
      const uniqueMap = new Map();
      allData.forEach(t => uniqueMap.set(t.id, t));
      const data = Array.from(uniqueMap.values());

      const error = zivilResult.error || strafResult.error || oeffResult.error;
      if (error) throw error;

      // Show all assigned teilnehmer (admin should see all, not just active contracts)
      const activeTeilnehmer = (data || [])
        .map(t => {
          const assignedAreas: string[] = [];
          if (t.dozent_zivilrecht_id === dozentId) assignedAreas.push('Zivilrecht');
          if (t.dozent_strafrecht_id === dozentId) assignedAreas.push('Strafrecht');
          if (t.dozent_oeffentliches_recht_id === dozentId) assignedAreas.push('Öffentliches Recht');

          return {
            id: t.id,
            name: t.name,
            studienziel: t.studienziel || '',
            contract_start: t.contract_start,
            contract_end: t.contract_end,
            booked_hours: t.booked_hours,
            completed_hours: t.completed_hours || 0,
            legal_areas: t.legal_areas || [],
            assignedAreas
          };
        });

      setTeilnehmer(activeTeilnehmer);
    } catch (error) {
      console.error('Error fetching teilnehmer:', error);
      setTeilnehmer([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
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

  const getProgressPercent = (completed: number | null, booked: number | null) => {
    if (!booked || booked === 0) return 0;
    return Math.min(100, Math.round(((completed || 0) / booked) * 100));
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-primary mr-2" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Aktive Teilnehmer</h2>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : teilnehmer.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Users className="h-12 w-12 mb-3 text-gray-300" />
              <p>Keine Teilnehmer zugewiesen</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Teilnehmer Section */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 text-green-800 rounded-full text-xs font-bold mr-2">
                    {activeTeilnehmer.length}
                  </span>
                  Aktive Teilnehmer
                </h3>
                {activeTeilnehmer.length === 0 ? (
                  <p className="text-sm text-gray-500 italic pl-7">Keine aktiven Teilnehmer</p>
                ) : (
                  <div className="space-y-2">
                    {activeTeilnehmer.map((t) => (
                      <TeilnehmerCard 
                        key={t.id} 
                        t={t} 
                        formatDate={formatDate}
                        getLegalAreaColor={getLegalAreaColor}
                        getProgressPercent={getProgressPercent}
                        isActive={true}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Past Teilnehmer Section (Collapsible) */}
              {pastTeilnehmer.length > 0 && (
                <div className="border-t pt-4">
                  <button
                    onClick={() => setShowPastTeilnehmer(!showPastTeilnehmer)}
                    className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    <div className="flex items-center">
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-gray-200 text-gray-600 rounded-full text-xs font-bold mr-2">
                        {pastTeilnehmer.length}
                      </span>
                      Abgeschlossene Teilnehmer
                    </div>
                    {showPastTeilnehmer ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  
                  {showPastTeilnehmer && (
                    <div className="space-y-2 mt-3">
                      {pastTeilnehmer.map((t) => (
                        <TeilnehmerCard 
                          key={t.id} 
                          t={t} 
                          formatDate={formatDate}
                          getLegalAreaColor={getLegalAreaColor}
                          getProgressPercent={getProgressPercent}
                          isActive={false}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {activeTeilnehmer.length} aktiv, {pastTeilnehmer.length} abgeschlossen
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
