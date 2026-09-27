import { useEffect, useState } from 'react';
import { Users, Phone, Mail, Calendar, Star, MessageSquare, CheckCircle } from 'lucide-react';
import { Lead } from '../../store/salesStore';
import { supabase } from '../../lib/supabase';

interface AfterSalesListProps {
  leads: Lead[];
  onUpdateLead: (id: string, data: Partial<Lead>) => void;
}

interface AfterSalesEligibility {
  lead_id: string;
  teilnehmer_id: string;
  teilnehmer_name: string;
  contract_number: string;
  contract_start: string | null;
  contract_end: string | null;
  total_hours: number;
  used_hours: number;
  remaining_hours: number;
  duration_progress: number | null;
  hours_used_percent: number | null;
  trigger: 'both' | 'duration' | 'hours';
}

export function AfterSalesList({ leads, onUpdateLead }: AfterSalesListProps) {
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [eligibilities, setEligibilities] = useState<AfterSalesEligibility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchEligibility = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('after-sales');
        if (error) throw error;
        const result = data as { eligible?: AfterSalesEligibility[] } | null;
        if (isMounted) setEligibilities(Array.isArray(result?.eligible) ? result.eligible : []);
      } catch {
        if (isMounted) setLoadError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void fetchEligibility();
    return () => { isMounted = false; };
  }, []);

  const eligibilityByLeadId = new Map(eligibilities.map(eligibility => [eligibility.lead_id, eligibility]));
  const afterSalesLeads = eligibilities
    .map(eligibility => leads.find(lead => lead.id === eligibility.lead_id))
    .filter((lead): lead is Lead => Boolean(lead));

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-emerald-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">After Sales</h2>
            <span className="ml-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">
              {afterSalesLeads.length}
            </span>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Geschlossene, verknüpfte Leads mit aktivem Vertrag: ab 75 % Vertragslaufzeit oder höchstens 25 % Reststunden.
        </p>
      </div>

      {/* Customer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full bg-white rounded-lg shadow p-6 text-center text-gray-500">Prüfe verknüpfte aktive Verträge …</div>
        ) : loadError ? (
          <div className="col-span-full bg-white rounded-lg shadow p-6 text-center text-red-600">After-Sales-Daten konnten nicht geladen werden.</div>
        ) : afterSalesLeads.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow p-6 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aktuell keine Leads über der After-Sales-Schwelle</p>
          </div>
        ) : (
          afterSalesLeads.map(lead => {
            const eligibility = eligibilityByLeadId.get(lead.id);
            if (!eligibility) return null;
            const triggerLabel = eligibility.trigger === 'both'
              ? 'Laufzeit und Reststunden'
              : eligibility.trigger === 'duration'
                ? '75 % der Vertragslaufzeit'
                : '25 % oder weniger Reststunden';
            return (
            <div 
              key={lead.id} 
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="p-4 border-l-4 border-emerald-500">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{lead.name}</h3>
                    <div className="mt-2 space-y-1 text-sm text-gray-500">
                      {lead.email && (
                        <div className="flex items-center">
                          <Mail className="h-3 w-3 mr-1.5" />
                          <a href={`mailto:${lead.email}`} className="text-primary hover:underline truncate">
                            {lead.email}
                          </a>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center">
                          <Phone className="h-3 w-3 mr-1.5" />
                          <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                            {lead.phone}
                          </a>
                        </div>
                      )}
                      {lead.contract_requested_at && (
                        <div className="flex items-center text-emerald-600">
                          <CheckCircle className="h-3 w-3 mr-1.5" />
                          <span>Vertrag seit: {formatDate(lead.contract_requested_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-gray-700">
                  <p className="font-medium">Teilnehmer: {eligibility.teilnehmer_name}</p>
                  <p className="mt-1 text-xs text-gray-600">Vertrag {eligibility.contract_number} · {formatDate(eligibility.contract_start)}–{formatDate(eligibility.contract_end)}</p>
                  <p className="mt-2 text-xs">Vertragslaufzeit: {eligibility.duration_progress === null ? '—' : `${eligibility.duration_progress}%`}</p>
                  <p className="text-xs">Stunden: {eligibility.used_hours} von {eligibility.total_hours} verbraucht · {eligibility.remaining_hours} übrig</p>
                  <p className="mt-1 text-xs font-medium text-emerald-800">After-Sales-Auslöser: {triggerLabel}</p>
                </div>

                {/* Study Info */}
                {(lead.study_goal || lead.study_location) && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 space-y-1">
                      {lead.study_goal && <div><strong>Ziel:</strong> {lead.study_goal}</div>}
                      {lead.study_location && <div><strong>Standort:</strong> {lead.study_location}</div>}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {lead.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      {lead.notes}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedLead(selectedLead === lead.id ? null : lead.id)}
                    className="flex items-center px-3 py-1.5 text-xs bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Notiz hinzufügen
                  </button>
                  <button
                    className="flex items-center px-3 py-1.5 text-xs bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Upsell
                  </button>
                  <button
                    className="flex items-center px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Follow-Up
                  </button>
                </div>

                {/* Note Input */}
                {selectedLead === lead.id && (
                  <div className="mt-3">
                    <textarea
                      placeholder="Notiz eingeben..."
                      className="w-full text-sm border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      rows={2}
                      defaultValue={lead.notes || ''}
                      onBlur={(e) => {
                        if (e.target.value !== lead.notes) {
                          onUpdateLead(lead.id, { notes: e.target.value });
                        }
                        setSelectedLead(null);
                      }}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Summary Stats */}
      {afterSalesLeads.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Zusammenfassung</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">{afterSalesLeads.length}</div>
              <div className="text-xs text-gray-500">Aktive Kunden</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {afterSalesLeads.filter(l => l.study_goal).length}
              </div>
              <div className="text-xs text-gray-500">Mit Studienziel</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">0</div>
              <div className="text-xs text-gray-500">Upsell-Potenzial</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">0</div>
              <div className="text-xs text-gray-500">Empfehlungen</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
