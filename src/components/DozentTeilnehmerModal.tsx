import { useState, useEffect } from 'react';
import { X, Users, User, Calendar, Scale, Clock, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DozentTeilnehmerModalProps {
  dozentId: string;
  dozentName: string;
  onClose: () => void;
}

interface SubjectHours {
  booked: number | null;
  completed: number;
  dozentCompleted: number;
}

interface Teilnehmer {
  id: string;
  name: string;
  studienziel: string;
  contract_start: string | null;
  contract_end: string | null;
  booked_hours: number | null;
  completed_hours: number | null;
  dozentHours: number; // Hours logged by this specific dozent
  legal_areas: string[];
  assignedAreas: string[];
  hours_zivilrecht: SubjectHours | null;
  hours_strafrecht: SubjectHours | null;
  hours_oeffentliches_recht: SubjectHours | null;
  frequency_type: string | null;
  frequency_hours_zivilrecht: number | null;
  frequency_hours_strafrecht: number | null;
  frequency_hours_oeffentliches_recht: number | null;
}

// Helper to get status info
function getStatusInfo(t: Teilnehmer, isActive: boolean): { label: string; bgColor: string; textColor: string } {
  const hasHoursLeft = t.booked_hours && (t.booked_hours - (t.completed_hours || 0)) > 0;
  const isStundenVoll = t.booked_hours && !hasHoursLeft;
  
  if (!isActive && hasHoursLeft) {
    return { label: 'Dringend', bgColor: 'bg-red-100', textColor: 'text-red-800' };
  }
  if (isActive && hasHoursLeft) {
    return { label: 'Laufend', bgColor: 'bg-blue-100', textColor: 'text-blue-800' };
  }
  if (isActive && isStundenVoll) {
    return { label: 'Stunden voll', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' };
  }
  return { label: 'Abgeschlossen', bgColor: 'bg-gray-200', textColor: 'text-gray-600' };
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
  const status = getStatusInfo(t, isActive);
  
  return (
    <div className={`border rounded-lg p-4 transition-shadow ${isActive ? 'bg-white border-gray-200 hover:shadow-sm' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Name and Status */}
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className={`font-medium ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>{t.name}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.bgColor} ${status.textColor}`}>
              {status.label}
            </span>
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
                  <span>Stunden (gesamt)</span>
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
              {t.dozentHours > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Davon von Ihnen: <span className="font-medium text-primary">{t.dozentHours} Std.</span>
                </div>
              )}
            </div>
          )}

          {/* Per-Subject Hours Breakdown */}
          {t.booked_hours && t.booked_hours > 0 && t.legal_areas.length > 0 && (
            <div className="mt-3 bg-gray-50 rounded-md p-3 space-y-2">
              <div className="flex items-center text-sm font-medium text-gray-700 mb-1">
                <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                Stundenverteilung pro Rechtsgebiet
              </div>
              {t.legal_areas.map((area) => {
                const subjectData = area === 'Zivilrecht' ? t.hours_zivilrecht
                  : area === 'Strafrecht' ? t.hours_strafrecht
                  : t.hours_oeffentliches_recht;
                const booked = subjectData?.booked ?? null;
                const completed = subjectData?.completed ?? 0;
                const dozentCompleted = subjectData?.dozentCompleted ?? 0;
                const remaining = booked !== null ? Math.max(0, booked - completed) : null;
                const pct = booked && booked > 0 ? Math.min(100, Math.round((completed / booked) * 100)) : 0;
                const frequency = area === 'Zivilrecht' ? t.frequency_hours_zivilrecht
                  : area === 'Strafrecht' ? t.frequency_hours_strafrecht
                  : t.frequency_hours_oeffentliches_recht;
                const frequencyLabel = t.frequency_type === 'weekly' ? 'Std./Woche' : t.frequency_type === 'monthly' ? 'Std./Monat' : null;

                return (
                  <div key={area} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-600 font-medium">{area}</span>
                        {frequency !== null && frequencyLabel && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-purple-100 text-purple-700">
                            Soll: {frequency} {frequencyLabel}
                          </span>
                        )}
                      </div>
                      {booked !== null ? (
                        <span className="text-gray-700">
                          <span className="font-semibold">{completed}</span> / {booked} Std.
                          {remaining !== null && remaining > 0 && (
                            <span className="text-green-600 ml-1">({remaining} offen)</span>
                          )}
                          {remaining === 0 && booked > 0 && (
                            <span className="text-gray-400 ml-1">(abgeschlossen)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">keine Verteilung</span>
                      )}
                    </div>
                    {booked !== null && booked > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-orange-400' : 'bg-blue-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    {dozentCompleted > 0 && (
                      <div className="text-[11px] text-gray-400">
                        Davon von Ihnen: <span className="font-medium text-primary">{dozentCompleted} Std.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Contract Period Detail */}
          {(t.contract_start || t.contract_end) && (
            <div className="mt-3 bg-blue-50 rounded-md px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-700 font-medium">Vertragslaufzeit</span>
                <span className="text-blue-800">{formatDate(t.contract_start)} - {formatDate(t.contract_end)}</span>
              </div>
              {t.contract_end && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const end = new Date(t.contract_end);
                end.setHours(0, 0, 0, 0);
                const diffMs = end.getTime() - today.getTime();
                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                if (diffDays < 0) {
                  return <div className="text-[11px] text-red-600 font-medium mt-0.5">Vertrag seit {Math.abs(diffDays)} Tagen abgelaufen</div>;
                }
                if (diffDays <= 30) {
                  return <div className="text-[11px] text-orange-600 font-medium mt-0.5">Noch {diffDays} Tage verbleibend</div>;
                }
                if (diffDays <= 90) {
                  return <div className="text-[11px] text-blue-600 mt-0.5">Noch {diffDays} Tage verbleibend</div>;
                }
                const months = Math.floor(diffDays / 30);
                return <div className="text-[11px] text-blue-600 mt-0.5">Noch ca. {months} Monate verbleibend</div>;
              })()}
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
  const [showActiveTeilnehmer, setShowActiveTeilnehmer] = useState(true);
  const [showPastTeilnehmer, setShowPastTeilnehmer] = useState(false);

  // Disable body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Helper to check if contract is active
  const isContractActive = (t: Teilnehmer): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!t.contract_start || !t.contract_end) return true; // No dates = assume active
    const start = new Date(t.contract_start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(t.contract_end);
    end.setHours(0, 0, 0, 0);
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

      // Fetch hours logged by this dozent for each teilnehmer (with legal_area)
      const teilnehmerIds = data.map(t => t.id);
      const { data: dozentHoursData } = await supabase
        .from('participant_hours')
        .select('teilnehmer_id, hours, legal_area')
        .eq('dozent_id', dozentId)
        .in('teilnehmer_id', teilnehmerIds);

      // Fetch ALL hours for each teilnehmer (from all dozenten, with legal_area)
      const { data: allHoursData } = await supabase
        .from('participant_hours')
        .select('teilnehmer_id, hours, legal_area')
        .in('teilnehmer_id', teilnehmerIds);

      // Calculate hours per teilnehmer from this dozent (total + per subject)
      const dozentHoursMap = new Map<string, number>();
      const dozentSubjectHoursMap = new Map<string, Map<string, number>>();
      (dozentHoursData || []).forEach(h => {
        const current = dozentHoursMap.get(h.teilnehmer_id) || 0;
        dozentHoursMap.set(h.teilnehmer_id, current + (h.hours || 0));
        // Per subject
        if (h.legal_area) {
          if (!dozentSubjectHoursMap.has(h.teilnehmer_id)) dozentSubjectHoursMap.set(h.teilnehmer_id, new Map());
          const subMap = dozentSubjectHoursMap.get(h.teilnehmer_id)!;
          subMap.set(h.legal_area, (subMap.get(h.legal_area) || 0) + (h.hours || 0));
        }
      });

      // Calculate total hours per teilnehmer from all dozenten (total + per subject)
      const totalHoursMap = new Map<string, number>();
      const totalSubjectHoursMap = new Map<string, Map<string, number>>();
      (allHoursData || []).forEach(h => {
        const current = totalHoursMap.get(h.teilnehmer_id) || 0;
        totalHoursMap.set(h.teilnehmer_id, current + (h.hours || 0));
        // Per subject
        if (h.legal_area) {
          if (!totalSubjectHoursMap.has(h.teilnehmer_id)) totalSubjectHoursMap.set(h.teilnehmer_id, new Map());
          const subMap = totalSubjectHoursMap.get(h.teilnehmer_id)!;
          subMap.set(h.legal_area, (subMap.get(h.legal_area) || 0) + (h.hours || 0));
        }
      });

      // Show all assigned teilnehmer (admin should see all, not just active contracts)
      const activeTeilnehmer = (data || [])
        .map(t => {
          const assignedAreas: string[] = [];
          if (t.dozent_zivilrecht_id === dozentId) assignedAreas.push('Zivilrecht');
          if (t.dozent_strafrecht_id === dozentId) assignedAreas.push('Strafrecht');
          if (t.dozent_oeffentliches_recht_id === dozentId) assignedAreas.push('Öffentliches Recht');

          // Use hours from this dozent's entries and total hours from all dozenten
          const dozentHours = dozentHoursMap.get(t.id) || 0;
          const totalCompletedHours = totalHoursMap.get(t.id) || 0;

          const totalSubject = totalSubjectHoursMap.get(t.id);
          const dozentSubject = dozentSubjectHoursMap.get(t.id);

          const buildSubjectHours = (area: string, bookedField: number | null): SubjectHours | null => {
            return {
              booked: bookedField,
              completed: totalSubject?.get(area) || 0,
              dozentCompleted: dozentSubject?.get(area) || 0
            };
          };

          return {
            id: t.id,
            name: t.name,
            studienziel: t.studienziel || '',
            contract_start: t.contract_start,
            contract_end: t.contract_end,
            booked_hours: t.booked_hours,
            completed_hours: totalCompletedHours,
            dozentHours,
            legal_areas: t.legal_areas || [],
            assignedAreas,
            hours_zivilrecht: buildSubjectHours('Zivilrecht', t.hours_zivilrecht),
            hours_strafrecht: buildSubjectHours('Strafrecht', t.hours_strafrecht),
            hours_oeffentliches_recht: buildSubjectHours('Öffentliches Recht', t.hours_oeffentliches_recht),
            frequency_type: t.frequency_type || null,
            frequency_hours_zivilrecht: t.frequency_hours_zivilrecht || null,
            frequency_hours_strafrecht: t.frequency_hours_strafrecht || null,
            frequency_hours_oeffentliches_recht: t.frequency_hours_oeffentliches_recht || null
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

  const getLegalAreaColor = (_area: string) => {
    // Use neutral gray for all legal areas
    return 'bg-gray-100 text-gray-700';
  };

  const getProgressPercent = (completed: number | null, booked: number | null) => {
    if (!booked || booked === 0) return 0;
    return Math.min(100, Math.round(((completed || 0) / booked) * 100));
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-hidden"
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
              {/* Active Teilnehmer Section (Collapsible) */}
              <div>
                <button
                  onClick={() => setShowActiveTeilnehmer(!showActiveTeilnehmer)}
                  className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors mb-2"
                >
                  <div className="flex items-center">
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 text-green-800 rounded-full text-xs font-bold mr-2">
                      {activeTeilnehmer.length}
                    </span>
                    Aktive Teilnehmer
                  </div>
                  {showActiveTeilnehmer ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {showActiveTeilnehmer && (
                  activeTeilnehmer.length === 0 ? (
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
                  )
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
                      {(() => {
                        // Check if any past teilnehmer has "Dringend" status (contract ended but hours left)
                        const hasDringend = pastTeilnehmer.some(t => {
                          const hasHoursLeft = t.booked_hours && (t.booked_hours - (t.completed_hours || 0)) > 0;
                          return hasHoursLeft;
                        });
                        return (
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold mr-2 ${
                            hasDringend ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {pastTeilnehmer.length}
                          </span>
                        );
                      })()}
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
