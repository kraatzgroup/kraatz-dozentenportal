import { useState, useEffect } from 'react';
import { FileText, Phone, Mail, ChevronDown, Calendar, Plus, Clock, MessageSquare, FileDown } from 'lucide-react';
import { Lead, LeadNote, useSalesStore } from '../../store/salesStore';
import { RequestContractModal } from './RequestContractModal';
import { ContractTemplateEditor } from './ContractTemplateEditor';

interface FinalgespraechListProps {
  leads: Lead[];
  onUpdateStatus: (id: string, status: string, contractRequestedAt?: string) => void;
  onUpdateLead: (id: string, data: Partial<Lead>) => void;
  onRefresh?: () => void;
}

const OUTCOME_OPTIONS = [
  { id: 'vertragsanforderung', label: 'Vertragsanforderung', color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'downsell', label: 'Downsell/Kraatz Club', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id: 'unqualified', label: 'Unqualifiziert', color: 'bg-red-100 text-red-800 border-red-200' },
];

export function FinalgespraechList({ leads, onUpdateStatus, onUpdateLead, onRefresh }: FinalgespraechListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [showContractModal, setShowContractModal] = useState(false);
  const [selectedLeadForContract, setSelectedLeadForContract] = useState<Lead | null>(null);
  const [showContractEditor, setShowContractEditor] = useState(false);
  const [selectedLeadForGenerate, setSelectedLeadForGenerate] = useState<Lead | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [newNote, setNewNote] = useState('');
  
  const { leadNotes, fetchLeadNotes, addLeadNote } = useSalesStore();
  
  useEffect(() => {
    fetchLeadNotes();
  }, [fetchLeadNotes]);
  
  // Get notes for a specific lead
  const getNotesForLead = (leadId: string): LeadNote[] => {
    return leadNotes.filter(n => n.lead_id === leadId);
  };
  
  const handleAddNote = async (leadId: string) => {
    if (newNote.trim()) {
      await addLeadNote(leadId, newNote.trim());
      setNewNote('');
    }
  };

  // Leads in Finalgespräch status (for outcome selection)
  const finalgespraechLeads = leads.filter(l => l.status === 'finalgespraech' || l.status === 'post_trial_call');
  
  // ALL leads with final_call_date (for calendar display, regardless of status)
  const allLeadsWithFinalCall = leads.filter(l => l.final_call_date);
  
  // Check if final_call_date is today
  const isToday = (dateStr: string | null) => {
    if (!dateStr) return false;
    const today = new Date();
    const callDate = new Date(dateStr);
    return today.toDateString() === callDate.toDateString();
  };

  // Leads with Finalgespräch today (from finalgespraechLeads for action)
  const todayLeads = finalgespraechLeads.filter(l => isToday(l.final_call_date));
  
  // ALL upcoming Finalgespräche (regardless of status, for display)
  const upcomingLeads = allLeadsWithFinalCall
    .filter(l => l.final_call_date && !isToday(l.final_call_date) && new Date(l.final_call_date) > new Date())
    .sort((a, b) => new Date(a.final_call_date!).getTime() - new Date(b.final_call_date!).getTime());
  
  // Leads without a scheduled date (from finalgespraechLeads)
  const unscheduledLeads = finalgespraechLeads.filter(l => !l.final_call_date);

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

        {/* Today's Finalgespräche */}
        {todayLeads.length > 0 ? (
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-medium text-green-700 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Heute ({todayLeads.length})
            </h3>
            {todayLeads.map(lead => (
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

                {/* Date Picker for Finalgespräch - Prominent Display */}
                <div className={`mt-3 p-3 rounded-lg ${lead.final_call_date ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className={`h-4 w-4 ${lead.final_call_date ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className={`text-sm font-medium ${lead.final_call_date ? 'text-blue-800' : 'text-gray-600'}`}>
                        Finalgespräch-Termin:
                      </span>
                    </div>
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
                        className={`text-sm font-medium ${lead.final_call_date ? 'text-blue-700 hover:text-blue-900' : 'text-primary hover:underline'}`}
                      >
                        {lead.final_call_date ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(lead.final_call_date).toLocaleString('de-DE', { 
                              weekday: 'short',
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        ) : (
                          'Termin festlegen'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {lead.notes && (
                  <div className="mt-2 p-2 bg-white rounded text-sm text-gray-600 border">
                    {lead.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-3">Keine Finalgespräche für heute geplant.</p>
            
            {/* Upcoming Finalgespräche Dropdown - shown when no today leads */}
            {(upcomingLeads.length > 0 || unscheduledLeads.length > 0) && (
              <div>
                <button
                  onClick={() => setShowUpcoming(!showUpcoming)}
                  className="flex items-center justify-between w-full p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition border border-blue-200"
                >
                  <span className="text-sm font-medium text-blue-700 flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                    Bevorstehende Finalgespräche anzeigen ({upcomingLeads.length + unscheduledLeads.length})
                  </span>
                  <ChevronDown className={`h-4 w-4 text-blue-500 transition ${showUpcoming ? 'rotate-180' : ''}`} />
                </button>
                
                {showUpcoming && (
                  <div className="mt-3 space-y-2">
                    {upcomingLeads.map(lead => (
                      <div key={lead.id} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{lead.name}</h4>
                            <div className="flex items-center text-xs text-blue-600 mt-1">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(lead.final_call_date!).toLocaleString('de-DE', { 
                                weekday: 'short',
                                day: '2-digit', 
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                            <div className="mt-2 text-xs text-gray-600 space-y-1">
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
                              {lead.study_goal && (
                                <div className="flex items-center">
                                  <span className="font-medium mr-1">Studienziel:</span> {lead.study_goal}
                                </div>
                              )}
                              {lead.study_location && (
                                <div className="flex items-center">
                                  <span className="font-medium mr-1">Standort:</span> {lead.study_location}
                                </div>
                              )}
                              {lead.source && (
                                <div className="flex items-center">
                                  <span className="font-medium mr-1">Quelle:</span> {lead.source}
                                </div>
                              )}
                              {/* All Notes with Timestamps */}
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center text-xs font-medium text-gray-700">
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  Notizen ({getNotesForLead(lead.id).length + (lead.notes ? 1 : 0)})
                                </div>
                                {/* Legacy notes field */}
                                {lead.notes && (
                                  <div className="p-2 bg-white rounded text-gray-600 border border-blue-100 text-xs">
                                    <div className="text-gray-400 text-xs mb-1">Ursprüngliche Notiz</div>
                                    {lead.notes}
                                  </div>
                                )}
                                {/* New notes from lead_notes table */}
                                {getNotesForLead(lead.id).map(note => (
                                  <div key={note.id} className="p-2 bg-white rounded text-gray-600 border border-blue-100 text-xs">
                                    <div className="text-gray-400 text-xs mb-1">
                                      {new Date(note.created_at).toLocaleString('de-DE', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                    {note.note}
                                  </div>
                                ))}
                                {/* Add new note */}
                                <div className="flex gap-1 mt-1">
                                  <input
                                    type="text"
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAddNote(lead.id);
                                    }}
                                    placeholder="Neue Notiz hinzufügen..."
                                    className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded"
                                  />
                                  <button
                                    onClick={() => handleAddNote(lead.id)}
                                    className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              lead.status === 'trial_pending' ? 'bg-orange-100 text-orange-700' :
                              lead.status === 'post_trial_call' ? 'bg-blue-100 text-blue-700' :
                              lead.status === 'finalgespraech' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {lead.status === 'trial_pending' ? 'Probestunde ausstehend' :
                               lead.status === 'post_trial_call' ? 'Nach Probestunde' :
                               lead.status === 'finalgespraech' ? 'Finalgespräch' :
                               lead.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {unscheduledLeads.map(lead => (
                      <div key={lead.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{lead.name}</h4>
                            <span className="text-xs text-yellow-600">Termin noch nicht festgelegt</span>
                          </div>
                          <button
                            onClick={() => setEditingDateId(lead.id)}
                            className="text-xs text-primary hover:underline"
                          >
                            Termin festlegen
                          </button>
                        </div>
                        {editingDateId === lead.id && (
                          <div className="mt-2">
                            <input
                              type="datetime-local"
                              onBlur={(e) => handleDateChange(lead.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleDateChange(lead.id, (e.target as HTMLInputElement).value);
                                if (e.key === 'Escape') setEditingDateId(null);
                              }}
                              autoFocus
                              className="text-sm border rounded px-2 py-1 w-full"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Upcoming Finalgespräche - Collapsible (shown when there ARE today leads) */}
        {todayLeads.length > 0 && (upcomingLeads.length > 0 || unscheduledLeads.length > 0) && (
          <div className="mt-4">
            <button
              onClick={() => setShowUpcoming(!showUpcoming)}
              className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
            >
              <span className="text-sm font-medium text-gray-700 flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                Bevorstehende Finalgespräche ({upcomingLeads.length + unscheduledLeads.length})
              </span>
              <ChevronDown className={`h-4 w-4 text-gray-500 transition ${showUpcoming ? 'rotate-180' : ''}`} />
            </button>
            
            {showUpcoming && (
              <div className="mt-3 space-y-2">
                {upcomingLeads.map(lead => (
                  <div key={lead.id} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{lead.name}</h4>
                        <div className="flex items-center text-xs text-blue-600 mt-1">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date(lead.final_call_date!).toLocaleString('de-DE', { 
                            weekday: 'short',
                            day: '2-digit', 
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="text-xs text-primary hover:underline">
                          <Phone className="h-3 w-3 inline mr-1" />{lead.phone}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {unscheduledLeads.map(lead => (
                  <div key={lead.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{lead.name}</h4>
                        <span className="text-xs text-yellow-600">Termin noch nicht festgelegt</span>
                      </div>
                      <button
                        onClick={() => setEditingDateId(lead.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        Termin festlegen
                      </button>
                    </div>
                    {editingDateId === lead.id && (
                      <div className="mt-2">
                        <input
                          type="datetime-local"
                          onBlur={(e) => handleDateChange(lead.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleDateChange(lead.id, (e.target as HTMLInputElement).value);
                            if (e.key === 'Escape') setEditingDateId(null);
                          }}
                          autoFocus
                          className="text-sm border rounded px-2 py-1 w-full"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedLeadForGenerate(null);
                  setShowContractEditor(true);
                }}
                className="flex items-center px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition"
              >
                <FileDown className="h-4 w-4 mr-1" />
                Vertrag generieren
              </button>
              <button
                onClick={() => {
                  setSelectedLeadForContract(null);
                  setShowContractModal(true);
                }}
                className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Plus className="h-4 w-4 mr-1" />
                Vertrag anfordern
              </button>
            </div>
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedLeadForGenerate(lead);
                            setShowContractEditor(true);
                          }}
                          className="px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20"
                        >
                          <FileDown className="h-3 w-3 inline mr-1" />
                          PDF
                        </button>
                        <button
                          onClick={() => onUpdateStatus(lead.id, 'vertrag_versendet')}
                          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Vertrag versendet
                        </button>
                      </div>
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

      {/* Contract Request Modal */}
      {showContractModal && (
        <RequestContractModal
          leads={leads}
          onClose={() => {
            setShowContractModal(false);
            setSelectedLeadForContract(null);
          }}
          onSuccess={() => {
            onRefresh?.();
          }}
          preselectedLead={selectedLeadForContract}
        />
      )}

      {/* Contract Template Editor Modal */}
      {showContractEditor && (
        <ContractTemplateEditor
          contractData={selectedLeadForGenerate ? {
            first_name: selectedLeadForGenerate.first_name || selectedLeadForGenerate.name.split(' ')[0] || '',
            last_name: selectedLeadForGenerate.last_name || selectedLeadForGenerate.name.split(' ').slice(1).join(' ') || '',
            email: selectedLeadForGenerate.email || '',
            phone: selectedLeadForGenerate.phone || '',
            street: selectedLeadForGenerate.street || '',
            house_number: selectedLeadForGenerate.house_number || '',
            postal_code: selectedLeadForGenerate.postal_code || '',
            city: selectedLeadForGenerate.city || '',
            study_goal: selectedLeadForGenerate.study_goal || '',
            exam_date: selectedLeadForGenerate.exam_date || '',
            state_law: selectedLeadForGenerate.state_law || '',
            legal_areas: selectedLeadForGenerate.legal_areas || [],
            booked_hours: null
          } : undefined}
          onClose={() => {
            setShowContractEditor(false);
            setSelectedLeadForGenerate(null);
          }}
        />
      )}
    </div>
  );
}
