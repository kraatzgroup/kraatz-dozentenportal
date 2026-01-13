import { useState } from 'react';
import { Users, Phone, Mail, Calendar, Star, MessageSquare, CheckCircle } from 'lucide-react';
import { Lead } from '../../store/salesStore';

interface AfterSalesListProps {
  leads: Lead[];
  onUpdateLead: (id: string, data: Partial<Lead>) => void;
}

export function AfterSalesList({ leads, onUpdateLead }: AfterSalesListProps) {
  const [selectedLead, setSelectedLead] = useState<string | null>(null);

  // Filter leads with contract_closed status (After Sales customers)
  const afterSalesLeads = leads.filter(l => l.status === 'contract_closed');

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
          Kunden mit abgeschlossenem Vertrag. Pflegen Sie die Kundenbeziehung für Upsells und Empfehlungen.
        </p>
      </div>

      {/* Customer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {afterSalesLeads.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow p-6 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Noch keine Kunden mit abgeschlossenem Vertrag</p>
          </div>
        ) : (
          afterSalesLeads.map(lead => (
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
          ))
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
