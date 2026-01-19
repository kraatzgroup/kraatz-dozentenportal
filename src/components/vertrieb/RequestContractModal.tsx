import { useState, useEffect } from 'react';
import { X, FileText, Search, User, MapPin, GraduationCap, Clock } from 'lucide-react';
import { Lead } from '../../store/salesStore';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../store/toastStore';

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
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLeadSearch, setShowLeadSearch] = useState(!preselectedLead);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(preselectedLead || null);
  
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
    notes: ''
  });

  // Filter leads for search
  const filteredLeads = leads.filter(lead => {
    const search = searchTerm.toLowerCase();
    return (
      lead.name.toLowerCase().includes(search) ||
      lead.email.toLowerCase().includes(search) ||
      (lead.phone && lead.phone.includes(search))
    );
  });

  // Pre-fill form when lead is selected
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
        study_goal: selectedLead.study_goal || ''
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
                      phone: ''
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
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-green-800">{selectedLead.name}</p>
                <p className="text-sm text-green-600">{selectedLead.email}</p>
                {selectedLead.phone && <p className="text-sm text-green-600">{selectedLead.phone}</p>}
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

          {/* Legal Areas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechtsgebiet *
            </label>
            <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
              {['Zivilrecht', 'Strafrecht', 'Öffentliches Recht'].map((area) => (
                <label key={area} className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.legal_areas.includes(area)}
                    onChange={(e) => handleLegalAreaChange(area, e.target.checked)}
                    className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-gray-700">{area}</span>
                </label>
              ))}
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
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t">
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
        </form>
      </div>
    </div>
  );
}
