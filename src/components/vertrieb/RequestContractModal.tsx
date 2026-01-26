import { useState, useEffect } from 'react';
import { X, FileText, Search, User, MapPin, GraduationCap, Clock, MessageSquare, FileDown } from 'lucide-react';
import { Lead, LeadNote, useSalesStore } from '../../store/salesStore';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../store/toastStore';
import { ContractTemplateEditor } from './ContractTemplateEditor';

interface ContractRequest {
  id?: string;
  lead_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  study_goal: string;
  exam_date: string;
  state_law: string;
  legal_areas: string[];
  booked_hours: number | null;
  notes: string;
  preferred_dozent_zivilrecht_id: string | null;
  preferred_dozent_strafrecht_id: string | null;
  preferred_dozent_oeffentliches_recht_id: string | null;
}

interface Dozent {
  id: string;
  full_name: string;
  legal_areas: string[] | null;
}

interface RequestContractModalProps {
  leads: Lead[];
  onClose: () => void;
  onSuccess: () => void;
  preselectedLead?: Lead | null;
}

const GERMAN_STATES = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen'
];

const STUDY_GOALS = [
  'Grundstudium',
  'Hauptstudium',
  '1. Staatsexamen Erstversuch',
  '1. Staatsexamen Verbesserungsversuch',
  '1. Staatsexamen Letztversuch',
  '2. Staatsexamen Erstversuch',
  '2. Staatsexamen Verbesserungsversuch',
  '2. Staatsexamen Letztversuch'
];

export function RequestContractModal({ leads, onClose, onSuccess, preselectedLead }: RequestContractModalProps) {
  const { addToast } = useToastStore();
  const { leadNotes, fetchLeadNotes } = useSalesStore();
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLeadSearch, setShowLeadSearch] = useState(!preselectedLead);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(preselectedLead || null);

  // Fetch lead notes on mount
  useEffect(() => {
    fetchLeadNotes();
  }, [fetchLeadNotes]);

  // Get notes for selected lead
  const getNotesForLead = (leadId: string): LeadNote[] => {
    return leadNotes.filter(n => n.lead_id === leadId).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };
  
  const [formData, setFormData] = useState<ContractRequest>({
    lead_id: null,
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    street: '',
    house_number: '',
    postal_code: '',
    city: '',
    study_goal: '',
    exam_date: '',
    state_law: '',
    legal_areas: [],
    booked_hours: null,
    notes: '',
    preferred_dozent_zivilrecht_id: null,
    preferred_dozent_strafrecht_id: null,
    preferred_dozent_oeffentliches_recht_id: null
  });

  const [dozenten, setDozenten] = useState<Dozent[]>([]);
  const [showContractEditor, setShowContractEditor] = useState(false);

  // Fetch dozenten on mount
  useEffect(() => {
    const fetchDozenten = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, legal_areas')
        .eq('role', 'dozent')
        .order('full_name');
      if (data) setDozenten(data);
    };
    fetchDozenten();
  }, []);

  // Get dozenten for a specific legal area
  const getDozentenForArea = (area: string): Dozent[] => {
    return dozenten.filter(d => d.legal_areas?.includes(area));
  };

  // Filter leads for search
  const filteredLeads = leads.filter(lead => {
    const search = searchTerm.toLowerCase();
    return (
      lead.name.toLowerCase().includes(search) ||
      lead.email.toLowerCase().includes(search) ||
      (lead.phone && lead.phone.includes(search))
    );
  });

  // Pre-fill form when lead is selected - includes all available data
  useEffect(() => {
    if (selectedLead) {
      const nameParts = selectedLead.name.split(' ');
      const firstName = selectedLead.first_name || nameParts[0] || '';
      const lastName = selectedLead.last_name || nameParts.slice(1).join(' ') || '';
      
      setFormData(prev => ({
        ...prev,
        lead_id: selectedLead.id,
        first_name: firstName,
        last_name: lastName,
        email: selectedLead.email || '',
        phone: selectedLead.phone || '',
        street: selectedLead.street || '',
        house_number: selectedLead.house_number || '',
        postal_code: selectedLead.postal_code || '',
        city: selectedLead.city || '',
        study_goal: selectedLead.study_goal || '',
        exam_date: selectedLead.exam_date || '',
        state_law: selectedLead.state_law || '',
        legal_areas: selectedLead.legal_areas || []
      }));
      setShowLeadSearch(false);
    }
  }, [selectedLead]);

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setSearchTerm('');
  };

  const handleLegalAreaChange = (area: string, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, legal_areas: [...formData.legal_areas, area] });
    } else {
      setFormData({ ...formData, legal_areas: formData.legal_areas.filter(a => a !== area) });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      addToast('Bitte Vor- und Nachname eingeben', 'error');
      return;
    }

    if (formData.legal_areas.length === 0) {
      addToast('Bitte mindestens ein Rechtsgebiet auswählen', 'error');
      return;
    }

    setIsLoading(true);

    try {
      // Create contract request
      const { error: requestError } = await supabase
        .from('contract_requests')
        .insert({
          lead_id: formData.lead_id,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          street: formData.street.trim() || null,
          house_number: formData.house_number.trim() || null,
          postal_code: formData.postal_code.trim() || null,
          city: formData.city.trim() || null,
          study_goal: formData.study_goal || null,
          exam_date: formData.exam_date || null,
          state_law: formData.state_law || null,
          legal_areas: formData.legal_areas,
          booked_hours: formData.booked_hours,
          notes: formData.notes.trim() || null,
          preferred_dozent_zivilrecht_id: formData.preferred_dozent_zivilrecht_id || null,
          preferred_dozent_strafrecht_id: formData.preferred_dozent_strafrecht_id || null,
          preferred_dozent_oeffentliches_recht_id: formData.preferred_dozent_oeffentliches_recht_id || null,
          status: 'requested',
          requested_at: new Date().toISOString()
        });

      if (requestError) throw requestError;

      // Update lead status to vertragsanforderung if lead is selected
      if (formData.lead_id) {
        const { error: leadError } = await supabase
          .from('leads')
          .update({ 
            status: 'vertragsanforderung',
            contract_requested_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', formData.lead_id);

        if (leadError) throw leadError;
      }

      addToast('Vertragsanforderung wurde erstellt', 'success');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating contract request:', error);
      addToast('Fehler beim Erstellen der Vertragsanforderung', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-green-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Vertrag anfordern</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Lead Selection */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <User className="h-4 w-4 mr-2" />
                Teilnehmer/Lead auswählen
              </label>
              {selectedLead && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLead(null);
                    setShowLeadSearch(true);
                    setFormData(prev => ({
                      ...prev,
                      lead_id: null,
                      first_name: '',
                      last_name: '',
                      email: '',
                      phone: '',
                      street: '',
                      house_number: '',
                      postal_code: '',
                      city: '',
                      study_goal: '',
                      exam_date: '',
                      state_law: '',
                      legal_areas: []
                    }));
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Anderen Lead wählen
                </button>
              )}
            </div>

            {showLeadSearch ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Lead suchen (Name, E-Mail, Telefon)..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                {searchTerm && (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                    {filteredLeads.length === 0 ? (
                      <p className="p-3 text-sm text-gray-500 text-center">Keine Leads gefunden</p>
                    ) : (
                      filteredLeads.slice(0, 10).map(lead => (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => handleSelectLead(lead)}
                          className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0 transition"
                        >
                          <p className="font-medium text-gray-900">{lead.name}</p>
                          <p className="text-sm text-gray-500">{lead.email}</p>
                          {lead.phone && <p className="text-sm text-gray-400">{lead.phone}</p>}
                        </button>
                      ))
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Oder füllen Sie die Daten manuell aus, wenn kein Lead vorhanden ist.
                </p>
              </div>
            ) : selectedLead ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
                <div>
                  <p className="font-medium text-green-800">{selectedLead.name}</p>
                  <p className="text-sm text-green-600">{selectedLead.email}</p>
                  {selectedLead.phone && <p className="text-sm text-green-600">{selectedLead.phone}</p>}
                </div>
                
                {/* Adresse anzeigen wenn vorhanden */}
                {(selectedLead.street || selectedLead.city) && (
                  <div className="pt-2 border-t border-green-200">
                    <p className="text-xs font-medium text-green-700 mb-1">Adresse:</p>
                    <p className="text-sm text-green-600">
                      {selectedLead.street && `${selectedLead.street} ${selectedLead.house_number || ''}`}
                      {selectedLead.street && (selectedLead.postal_code || selectedLead.city) && ', '}
                      {selectedLead.postal_code && `${selectedLead.postal_code} `}
                      {selectedLead.city}
                    </p>
                  </div>
                )}
                
                {/* Studieninfos anzeigen wenn vorhanden */}
                {(selectedLead.study_goal || selectedLead.state_law || selectedLead.exam_date || selectedLead.study_location) && (
                  <div className="pt-2 border-t border-green-200">
                    <p className="text-xs font-medium text-green-700 mb-1">Studieninformationen:</p>
                    <div className="text-sm text-green-600 space-y-0.5">
                      {selectedLead.study_goal && <p>Studienziel: {selectedLead.study_goal}</p>}
                      {selectedLead.study_location && <p>Standort: {selectedLead.study_location}</p>}
                      {selectedLead.state_law && <p>Landesrecht: {selectedLead.state_law}</p>}
                      {selectedLead.exam_date && <p>Prüfungstermin: {new Date(selectedLead.exam_date).toLocaleDateString('de-DE')}</p>}
                    </div>
                  </div>
                )}
                
                {/* Rechtsgebiete anzeigen wenn vorhanden */}
                {selectedLead.legal_areas && selectedLead.legal_areas.length > 0 && (
                  <div className="pt-2 border-t border-green-200">
                    <p className="text-xs font-medium text-green-700 mb-1">Rechtsgebiete:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedLead.legal_areas.map((area) => (
                        <span key={area} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Notizen anzeigen wenn vorhanden */}
                {getNotesForLead(selectedLead.id).length > 0 && (
                  <div className="pt-2 border-t border-green-200">
                    <p className="text-xs font-medium text-green-700 mb-1 flex items-center">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Notizen ({getNotesForLead(selectedLead.id).length}):
                    </p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {getNotesForLead(selectedLead.id).map((note) => (
                        <div key={note.id} className="text-sm text-green-600 bg-green-100/50 rounded p-2">
                          <p className="whitespace-pre-wrap">{note.note}</p>
                          <p className="text-xs text-green-500 mt-1">
                            {new Date(note.created_at).toLocaleDateString('de-DE', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Personal Data */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <User className="h-4 w-4 mr-2" />
              Persönliche Daten
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vorname *</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Max"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nachname *</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Mustermann"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="max.mustermann@email.de"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="+49 123 456789"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              Adressdaten
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Musterstraße"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hausnr.</label>
                <input
                  type="text"
                  value={formData.house_number}
                  onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="12a"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="12345"
                  maxLength={5}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Musterstadt"
                />
              </div>
            </div>
          </div>

          {/* Study Information */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <GraduationCap className="h-4 w-4 mr-2" />
              Studieninformationen
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Studienziel</label>
                <select
                  value={formData.study_goal}
                  onChange={(e) => setFormData({ ...formData, study_goal: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Bitte auswählen</option>
                  {STUDY_GOALS.map(goal => (
                    <option key={goal} value={goal}>{goal}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prüfungstermin</label>
                <input
                  type="date"
                  value={formData.exam_date}
                  onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Landesrecht</label>
                <select
                  value={formData.state_law}
                  onChange={(e) => setFormData({ ...formData, state_law: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Bitte auswählen</option>
                  {GERMAN_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Legal Areas with Dozent Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechtsgebiet * & Bevorzugte Dozenten
            </label>
            <div className="space-y-3 bg-gray-50 p-3 rounded-lg">
              {/* Zivilrecht */}
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.legal_areas.includes('Zivilrecht')}
                    onChange={(e) => handleLegalAreaChange('Zivilrecht', e.target.checked)}
                    className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">Zivilrecht</span>
                </label>
                {formData.legal_areas.includes('Zivilrecht') && (
                  <div className="ml-6">
                    <select
                      value={formData.preferred_dozent_zivilrecht_id || ''}
                      onChange={(e) => setFormData({ ...formData, preferred_dozent_zivilrecht_id: e.target.value || null })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Bevorzugter Dozent (optional)</option>
                      {getDozentenForArea('Zivilrecht').map(d => (
                        <option key={d.id} value={d.id}>{d.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Strafrecht */}
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.legal_areas.includes('Strafrecht')}
                    onChange={(e) => handleLegalAreaChange('Strafrecht', e.target.checked)}
                    className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">Strafrecht</span>
                </label>
                {formData.legal_areas.includes('Strafrecht') && (
                  <div className="ml-6">
                    <select
                      value={formData.preferred_dozent_strafrecht_id || ''}
                      onChange={(e) => setFormData({ ...formData, preferred_dozent_strafrecht_id: e.target.value || null })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Bevorzugter Dozent (optional)</option>
                      {getDozentenForArea('Strafrecht').map(d => (
                        <option key={d.id} value={d.id}>{d.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Öffentliches Recht */}
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.legal_areas.includes('Öffentliches Recht')}
                    onChange={(e) => handleLegalAreaChange('Öffentliches Recht', e.target.checked)}
                    className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">Öffentliches Recht</span>
                </label>
                {formData.legal_areas.includes('Öffentliches Recht') && (
                  <div className="ml-6">
                    <select
                      value={formData.preferred_dozent_oeffentliches_recht_id || ''}
                      onChange={(e) => setFormData({ ...formData, preferred_dozent_oeffentliches_recht_id: e.target.value || null })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Bevorzugter Dozent (optional)</option>
                      {getDozentenForArea('Öffentliches Recht').map(d => (
                        <option key={d.id} value={d.id}>{d.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Hours Package */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Stundenpaket
            </h3>
            <input
              type="number"
              min="0"
              value={formData.booked_hours || ''}
              onChange={(e) => setFormData({ ...formData, booked_hours: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Stundenanzahl eingeben"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Zusätzliche Informationen..."
            />
          </div>

          {/* Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowContractEditor(true)}
              className="w-full sm:w-auto px-4 py-2 text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors flex items-center justify-center"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Vertrag generieren
            </button>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Vertrag anfordern
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Contract Template Editor Modal */}
        {showContractEditor && (
          <ContractTemplateEditor
            contractData={{
              first_name: formData.first_name,
              last_name: formData.last_name,
              email: formData.email,
              phone: formData.phone,
              street: formData.street,
              house_number: formData.house_number,
              postal_code: formData.postal_code,
              city: formData.city,
              study_goal: formData.study_goal,
              exam_date: formData.exam_date,
              state_law: formData.state_law,
              legal_areas: formData.legal_areas,
              booked_hours: formData.booked_hours
            }}
            onClose={() => setShowContractEditor(false)}
          />
        )}
      </div>
    </div>
  );
}
