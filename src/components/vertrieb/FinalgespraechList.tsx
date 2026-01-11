import { useState } from 'react';
import { FileText, Phone, Mail, ChevronDown, Calendar } from 'lucide-react';
import { Lead } from '../../store/salesStore';

interface FinalgespraechListProps {
  leads: Lead[];
  onUpdateStatus: (id: string, status: string, contractRequestedAt?: string) => void;
  onUpdateLead: (id: string, data: Partial<Lead>) => void;
}

const OUTCOME_OPTIONS = [
  { id: 'vertragsanforderung', label: 'Vertragsanforderung', color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'downsell', label: 'Downsell/Kraatz Club', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id: 'unqualified', label: 'Unqualifiziert', color: 'bg-red-100 text-red-800 border-red-200' },
];

export function FinalgespraechList({ leads, onUpdateStatus, onUpdateLead }: FinalgespraechListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);

  const finalgespraechLeads = leads.filter(l => l.status === 'finalgespraech' || l.status === 'post_trial_call');

  const handleOutcome = (leadId: string, outcome: string) => {
    if (outcome === 'vertragsanforderung') {
      onUpdateStatus(leadId, outcome, new Date().toISOString());
    } else {
      onUpdateStatus(leadId, outcome);
    }
    setExpandedId(null);
  };

  const handleDateChange = (leadId: string, date: string) => {
    onUpdateLead(leadId, { final_call_date: date ? new Date(date).toISOString() : null });
    setEditingDateId(null);
  };


  return (
    <div className="space-y-4">
      {/* Header with Finalgespräch Leads */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Finalgespräche</h2>
            <span className="ml-2 bg-primary text-white text-xs px-2 py-0.5 rounded-full">
              {finalgespraechLeads.length}
            </span>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Leads im Finalgespräch-Status. Wählen Sie das Ergebnis des Gesprächs.
        </p>

        {/* Finalgespräch Leads */}
        {finalgespraechLeads.length > 0 && (
          <div className="mt-4 space-y-3">
            {finalgespraechLeads.map(lead => (
              <div key={lead.id} className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{lead.name}</h4>
                    <div className="mt-1 text-sm text-gray-500 space-y-1">
                      {lead.email && (
                        <div className="flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          <a href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center">
                          <Phone className="h-3 w-3 mr-1" />
                          <a href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Outcome Selector */}
                  <div className="relative">
                    <button
                      onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                      className="flex items-center px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                    >
                      Ergebnis wählen
                      <ChevronDown className={`h-4 w-4 ml-1 transition ${expandedId === lead.id ? 'rotate-180' : ''}`} />
                    </button>

                    {expandedId === lead.id && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        {OUTCOME_OPTIONS.map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => handleOutcome(lead.id, opt.id)}
                            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg border-b last:border-b-0 ${opt.color}`}
                          >
                            <div className="font-medium">{opt.label}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Date Picker for Finalgespräch */}
                <div className="mt-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Finalgespräch-Termin:</span>
                  {editingDateId === lead.id ? (
                    <input
                      type="datetime-local"
                      defaultValue={lead.final_call_date ? new Date(lead.final_call_date).toISOString().slice(0, 16) : ''}
                      onBlur={(e) => handleDateChange(lead.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleDateChange(lead.id, (e.target as HTMLInputElement).value);
                        if (e.key === 'Escape') setEditingDateId(null);
                      }}
                      autoFocus
                      className="text-sm border rounded px-2 py-1"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingDateId(lead.id)}
                      className="text-sm text-primary hover:underline"
                    >
                      {lead.final_call_date 
                        ? new Date(lead.final_call_date).toLocaleString('de-DE', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Termin festlegen'}
                    </button>
                  )}
                </div>

                {lead.notes && (
                  <div className="mt-2 p-2 bg-white rounded text-sm text-gray-600 border">
                    {lead.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vertragsanforderung Section with Sub-sections */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-green-800">
              Vertragsanforderung
              <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                {leads.filter(l => l.status === 'vertragsanforderung' || l.status === 'vertrag_versendet').length}
              </span>
            </h3>
          </div>

          {/* Sub-section: Vertrag angefordert */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              Vertrag angefordert
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                {leads.filter(l => l.status === 'vertragsanforderung').length}
              </span>
            </h4>
            {leads.filter(l => l.status === 'vertragsanforderung').length === 0 ? (
              <p className="text-sm text-gray-400 py-2 pl-4">Keine Leads</p>
            ) : (
              <div className="space-y-2 pl-4">
                {leads.filter(l => l.status === 'vertragsanforderung').map(lead => (
                  <div key={lead.id} className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{lead.name}</h4>
                        <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                          {lead.email && <div><Mail className="h-3 w-3 inline mr-1" />{lead.email}</div>}
                          {lead.phone && <div><Phone className="h-3 w-3 inline mr-1" />{lead.phone}</div>}
                          {lead.contract_requested_at && (
                            <div className="text-green-600 font-medium">
                              Angefordert am: {new Date(lead.contract_requested_at).toLocaleDateString('de-DE')}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onUpdateStatus(lead.id, 'vertrag_versendet')}
                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Vertrag versendet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-section: Vertrag versendet */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
              <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></span>
              Vertrag versendet
              <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                {leads.filter(l => l.status === 'vertrag_versendet').length}
              </span>
            </h4>
            {leads.filter(l => l.status === 'vertrag_versendet').length === 0 ? (
              <p className="text-sm text-gray-400 py-2 pl-4">Keine Leads</p>
            ) : (
              <div className="space-y-2 pl-4">
                {leads.filter(l => l.status === 'vertrag_versendet').map(lead => (
                  <div key={lead.id} className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{lead.name}</h4>
                        <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                          {lead.email && <div><Mail className="h-3 w-3 inline mr-1" />{lead.email}</div>}
                          {lead.phone && <div><Phone className="h-3 w-3 inline mr-1" />{lead.phone}</div>}
                        </div>
                      </div>
                      <button
                        onClick={() => onUpdateStatus(lead.id, 'contract_closed')}
                        className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                      >
                        Vertragsabschluss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-section: Vertrag abgeschlossen */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
              <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
              Vertrag abgeschlossen
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                {leads.filter(l => l.status === 'contract_closed').length}
              </span>
            </h4>
            {leads.filter(l => l.status === 'contract_closed').length === 0 ? (
              <p className="text-sm text-gray-400 py-2 pl-4">Keine Leads</p>
            ) : (
              <div className="space-y-2 pl-4">
                {leads.filter(l => l.status === 'contract_closed').map(lead => (
                  <div key={lead.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-medium text-gray-900">{lead.name}</h4>
                    <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                      {lead.email && <div><Mail className="h-3 w-3 inline mr-1" />{lead.email}</div>}
                      {lead.phone && <div><Phone className="h-3 w-3 inline mr-1" />{lead.phone}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Downsell Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-yellow-800">
              Downsell/Kraatz Club
              <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                {leads.filter(l => l.status === 'downsell').length}
              </span>
            </h3>
          </div>
          {leads.filter(l => l.status === 'downsell').length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Keine Leads</p>
          ) : (
            <div className="space-y-2">
              {leads.filter(l => l.status === 'downsell').map(lead => (
                <div key={lead.id} className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">{lead.name}</h4>
                  <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                    {lead.email && <div><Mail className="h-3 w-3 inline mr-1" />{lead.email}</div>}
                    {lead.phone && <div><Phone className="h-3 w-3 inline mr-1" />{lead.phone}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Unqualifiziert Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-red-800">
              Unqualifiziert
              <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                {leads.filter(l => l.status === 'unqualified').length}
              </span>
            </h3>
          </div>
          {leads.filter(l => l.status === 'unqualified').length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Keine Leads</p>
          ) : (
            <div className="space-y-2">
              {leads.filter(l => l.status === 'unqualified').map(lead => (
                <div key={lead.id} className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">{lead.name}</h4>
                  <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                    {lead.email && <div><Mail className="h-3 w-3 inline mr-1" />{lead.email}</div>}
                    {lead.phone && <div><Phone className="h-3 w-3 inline mr-1" />{lead.phone}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
