import { useState, useEffect } from 'react';
import { X, Save, UserPlus, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToastStore } from '../store/toastStore';

interface Teilnehmer {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  study_goal: string;
  contract_start: string;
  contract_end: string;
  booked_hours: number | null;
  dozent_id: string | null;
  legal_areas: string[];
  dozent_zivilrecht_id: string | null;
  dozent_strafrecht_id: string | null;
  dozent_oeffentliches_recht_id: string | null;
  exam_date: string;
  state_law: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  elite_kleingruppe?: boolean;
  is_elite_kleingruppe?: boolean;
  elite_kleingruppe_id?: string | null;
  hours_zivilrecht: number | null;
  hours_strafrecht: number | null;
  hours_oeffentliches_recht: number | null;
  frequency_type: string;
  frequency_hours_zivilrecht: number | null;
  frequency_hours_strafrecht: number | null;
  frequency_hours_oeffentliches_recht: number | null;
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

interface TeilnehmerFormProps {
  teilnehmer?: Teilnehmer | null;
  onClose: () => void;
  onSaved: () => void;
  dozenten: { id: string; full_name: string }[];
}

interface EliteKleingruppe {
  id: string;
  name: string;
}

export function TeilnehmerForm({ teilnehmer, onClose, onSaved, dozenten }: TeilnehmerFormProps) {
  const { addToast } = useToastStore();
  const [isLoading, setIsLoading] = useState(false);
  const [eliteKleingruppen, setEliteKleingruppen] = useState<EliteKleingruppe[]>([]);
  const [formData, setFormData] = useState<Teilnehmer>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    study_goal: '',
    contract_start: '',
    contract_end: '',
    booked_hours: null,
    dozent_id: null,
    legal_areas: [],
    dozent_zivilrecht_id: null,
    dozent_strafrecht_id: null,
    dozent_oeffentliches_recht_id: null,
    exam_date: '',
    state_law: '',
    street: '',
    house_number: '',
    postal_code: '',
    city: '',
    elite_kleingruppe: false,
    is_elite_kleingruppe: false,
    elite_kleingruppe_id: null,
    hours_zivilrecht: null,
    hours_strafrecht: null,
    hours_oeffentliches_recht: null,
    frequency_type: '',
    frequency_hours_zivilrecht: null,
    frequency_hours_strafrecht: null,
    frequency_hours_oeffentliches_recht: null
  });

  const isEditing = !!teilnehmer?.id;

  useEffect(() => {
    const fetchEliteKleingruppen = async () => {
      const { data, error } = await supabase
        .from('elite_kleingruppen')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (!error && data) {
        setEliteKleingruppen(data);
      }
    };
    
    fetchEliteKleingruppen();
  }, []);

  useEffect(() => {
    if (teilnehmer) {
      setFormData({
        first_name: teilnehmer.first_name || '',
        last_name: teilnehmer.last_name || '',
        email: teilnehmer.email || '',
        phone: (teilnehmer as any).phone || '',
        study_goal: teilnehmer.study_goal || '',
        contract_start: teilnehmer.contract_start || '',
        contract_end: teilnehmer.contract_end || '',
        booked_hours: teilnehmer.booked_hours || null,
        dozent_id: teilnehmer.dozent_id || null,
        legal_areas: teilnehmer.legal_areas || [],
        dozent_zivilrecht_id: teilnehmer.dozent_zivilrecht_id || null,
        dozent_strafrecht_id: teilnehmer.dozent_strafrecht_id || null,
        dozent_oeffentliches_recht_id: teilnehmer.dozent_oeffentliches_recht_id || null,
        exam_date: teilnehmer.exam_date || '',
        state_law: teilnehmer.state_law || '',
        street: (teilnehmer as any).street || '',
        house_number: (teilnehmer as any).house_number || '',
        postal_code: (teilnehmer as any).postal_code || '',
        city: (teilnehmer as any).city || '',
        elite_kleingruppe: (teilnehmer as any).elite_kleingruppe || false,
        is_elite_kleingruppe: (teilnehmer as any).is_elite_kleingruppe || false,
        elite_kleingruppe_id: (teilnehmer as any).elite_kleingruppe_id || null,
        hours_zivilrecht: (teilnehmer as any).hours_zivilrecht || null,
        hours_strafrecht: (teilnehmer as any).hours_strafrecht || null,
        hours_oeffentliches_recht: (teilnehmer as any).hours_oeffentliches_recht || null,
        frequency_type: (teilnehmer as any).frequency_type || '',
        frequency_hours_zivilrecht: (teilnehmer as any).frequency_hours_zivilrecht || null,
        frequency_hours_strafrecht: (teilnehmer as any).frequency_hours_strafrecht || null,
        frequency_hours_oeffentliches_recht: (teilnehmer as any).frequency_hours_oeffentliches_recht || null
      });
    }
  }, [teilnehmer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      addToast('Bitte Vor- und Nachname eingeben', 'error');
      return;
    }

    // Validate per-subject hours don't exceed total
    if (formData.booked_hours && formData.legal_areas.length > 0) {
      const sumHours = 
        (formData.legal_areas.includes('Zivilrecht') ? (formData.hours_zivilrecht || 0) : 0) +
        (formData.legal_areas.includes('Strafrecht') ? (formData.hours_strafrecht || 0) : 0) +
        (formData.legal_areas.includes('Öffentliches Recht') ? (formData.hours_oeffentliches_recht || 0) : 0);
      if (sumHours > formData.booked_hours) {
        addToast(`Die Summe der Stunden pro Rechtsgebiet (${sumHours}) übersteigt das gebuchte Stundenpaket (${formData.booked_hours})`, 'error');
        return;
      }
    }

    setIsLoading(true);

    try {
      // Use selected dozent from dropdown, or any of the legal area dozents as fallback
      // Elite-Kleingruppe participants don't need a dozent assigned here
      const dozentId = formData.dozent_id || 
                       formData.dozent_zivilrecht_id || 
                       formData.dozent_strafrecht_id || 
                       formData.dozent_oeffentliches_recht_id;
      
      if (!dozentId && !formData.elite_kleingruppe) {
        addToast('Bitte mindestens einen Dozenten zuweisen', 'error');
        setIsLoading(false);
        return;
      }

      const fullName = `${formData.first_name.trim()} ${formData.last_name.trim()}`;
      
      const dataToSave = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        name: fullName,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        study_goal: formData.study_goal.trim() || null,
        contract_start: formData.contract_start || null,
        contract_end: formData.contract_end || null,
        booked_hours: formData.booked_hours || null,
        dozent_id: dozentId || null,
        legal_areas: formData.legal_areas.length > 0 ? formData.legal_areas : null,
        dozent_zivilrecht_id: formData.dozent_zivilrecht_id || null,
        dozent_strafrecht_id: formData.dozent_strafrecht_id || null,
        dozent_oeffentliches_recht_id: formData.dozent_oeffentliches_recht_id || null,
        exam_date: formData.exam_date || null,
        state_law: formData.state_law || null,
        street: formData.street.trim() || null,
        house_number: formData.house_number.trim() || null,
        postal_code: formData.postal_code.trim() || null,
        city: formData.city.trim() || null,
        elite_kleingruppe: formData.elite_kleingruppe || false,
        is_elite_kleingruppe: formData.is_elite_kleingruppe || false,
        elite_kleingruppe_id: formData.is_elite_kleingruppe ? (formData.elite_kleingruppe_id || null) : null,
        hours_zivilrecht: formData.legal_areas.includes('Zivilrecht') ? (formData.hours_zivilrecht || null) : null,
        hours_strafrecht: formData.legal_areas.includes('Strafrecht') ? (formData.hours_strafrecht || null) : null,
        hours_oeffentliches_recht: formData.legal_areas.includes('Öffentliches Recht') ? (formData.hours_oeffentliches_recht || null) : null,
        frequency_type: formData.frequency_type || null,
        frequency_hours_zivilrecht: formData.legal_areas.includes('Zivilrecht') ? (formData.frequency_hours_zivilrecht || null) : null,
        frequency_hours_strafrecht: formData.legal_areas.includes('Strafrecht') ? (formData.frequency_hours_strafrecht || null) : null,
        frequency_hours_oeffentliches_recht: formData.legal_areas.includes('Öffentliches Recht') ? (formData.frequency_hours_oeffentliches_recht || null) : null,
        updated_at: new Date().toISOString()
      };

      if (isEditing && teilnehmer?.id) {
        const { error } = await supabase
          .from('teilnehmer')
          .update(dataToSave)
          .eq('id', teilnehmer.id);

        if (error) throw error;
        addToast('Teilnehmer wurde aktualisiert', 'success');
      } else {
        const { error } = await supabase
          .from('teilnehmer')
          .insert({
            ...dataToSave,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        addToast('Teilnehmer wurde hinzugefügt', 'success');
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving teilnehmer:', error);
      addToast('Fehler beim Speichern des Teilnehmers', 'error');
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
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <UserPlus className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Teilnehmer bearbeiten' : 'Neuen Teilnehmer hinzufügen'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vorname *
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nachname *
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Mustermann"
                required
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-Mail-Adresse
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="max.mustermann@email.de"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefon
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="+49 123 456789"
              />
            </div>
          </div>

          {/* Address */}
          <div className="border-t pt-4 mt-2">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              Adressdaten
            </h4>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Straße</label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="Musterstraße"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hausnr.</label>
                <input
                  type="text"
                  value={formData.house_number}
                  onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="12a"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">PLZ</label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="12345"
                  maxLength={5}
                />
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Stadt</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="Musterstadt"
                />
              </div>
            </div>
          </div>

          {/* Study Goal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Studienziel
            </label>
            <select
              value={formData.study_goal}
              onChange={(e) => setFormData({ ...formData, study_goal: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Bitte auswählen</option>
              <option value="Grundstudium">Grundstudium</option>
              <option value="Hauptstudium">Hauptstudium</option>
              <option value="1. Staatsexamen Erstversuch">1. Staatsexamen Erstversuch</option>
              <option value="1. Staatsexamen Verbesserungsversuch">1. Staatsexamen Verbesserungsversuch</option>
              <option value="1. Staatsexamen Letztversuch">1. Staatsexamen Letztversuch</option>
              <option value="2. Staatsexamen Erstversuch">2. Staatsexamen Erstversuch</option>
              <option value="2. Staatsexamen Verbesserungsversuch">2. Staatsexamen Verbesserungsversuch</option>
              <option value="2. Staatsexamen Letztversuch">2. Staatsexamen Letztversuch</option>
            </select>
          </div>

          {/* Exam Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prüfungstermin
            </label>
            <input
              type="date"
              value={formData.exam_date}
              onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* State Law */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Landesrecht
            </label>
            <select
              value={formData.state_law}
              onChange={(e) => setFormData({ ...formData, state_law: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Bitte auswählen</option>
              {GERMAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          {/* Elite-Kleingruppe Section */}
          <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_elite_kleingruppe || false}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setFormData({ 
                    ...formData, 
                    is_elite_kleingruppe: isChecked,
                    elite_kleingruppe: isChecked,
                    elite_kleingruppe_id: isChecked ? formData.elite_kleingruppe_id : null
                  });
                }}
                className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">Elite-Kleingruppe Teilnehmer</span>
            </label>
            
            {formData.is_elite_kleingruppe && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Elite-Kleingruppe zuordnen
                </label>
                <select
                  value={formData.elite_kleingruppe_id || ''}
                  onChange={(e) => setFormData({ ...formData, elite_kleingruppe_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                  required={formData.is_elite_kleingruppe}
                >
                  <option value="">Bitte wählen...</option>
                  {eliteKleingruppen.map((gruppe) => (
                    <option key={gruppe.id} value={gruppe.id}>
                      {gruppe.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Legal Areas - Checkboxes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechtsgebiet
            </label>
            <div className="space-y-2">
              {['Zivilrecht', 'Strafrecht', 'Öffentliches Recht'].map((area) => (
                <label key={area} className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.legal_areas.includes(area)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, legal_areas: [...formData.legal_areas, area] });
                      } else {
                        setFormData({ ...formData, legal_areas: formData.legal_areas.filter(a => a !== area) });
                      }
                    }}
                    className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-gray-700">{area}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Per-Subject Hours - shown when booked_hours is set and legal areas are selected */}
          {formData.booked_hours && formData.legal_areas.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-blue-800">
                  Stundenverteilung pro Rechtsgebiet
                </label>
                <span className={`text-xs font-medium ${
                  (() => {
                    const sum = 
                      (formData.legal_areas.includes('Zivilrecht') ? (formData.hours_zivilrecht || 0) : 0) +
                      (formData.legal_areas.includes('Strafrecht') ? (formData.hours_strafrecht || 0) : 0) +
                      (formData.legal_areas.includes('Öffentliches Recht') ? (formData.hours_oeffentliches_recht || 0) : 0);
                    return sum > formData.booked_hours! ? 'text-red-600' : sum === formData.booked_hours! ? 'text-green-600' : 'text-blue-600';
                  })()
                }`}>
                  {(
                    (formData.legal_areas.includes('Zivilrecht') ? (formData.hours_zivilrecht || 0) : 0) +
                    (formData.legal_areas.includes('Strafrecht') ? (formData.hours_strafrecht || 0) : 0) +
                    (formData.legal_areas.includes('Öffentliches Recht') ? (formData.hours_oeffentliches_recht || 0) : 0)
                  )} / {formData.booked_hours} Std. verteilt
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {formData.legal_areas.includes('Zivilrecht') && (
                  <div>
                    <label className="block text-xs text-blue-700 mb-1">Zivilrecht</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max={formData.booked_hours || undefined}
                        value={formData.hours_zivilrecht ?? ''}
                        onChange={(e) => setFormData({ ...formData, hours_zivilrecht: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        placeholder="Std."
                      />
                    </div>
                  </div>
                )}
                {formData.legal_areas.includes('Strafrecht') && (
                  <div>
                    <label className="block text-xs text-blue-700 mb-1">Strafrecht</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max={formData.booked_hours || undefined}
                        value={formData.hours_strafrecht ?? ''}
                        onChange={(e) => setFormData({ ...formData, hours_strafrecht: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        placeholder="Std."
                      />
                    </div>
                  </div>
                )}
                {formData.legal_areas.includes('Öffentliches Recht') && (
                  <div>
                    <label className="block text-xs text-blue-700 mb-1">Öff. Recht</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max={formData.booked_hours || undefined}
                        value={formData.hours_oeffentliches_recht ?? ''}
                        onChange={(e) => setFormData({ ...formData, hours_oeffentliches_recht: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        placeholder="Std."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Frequency Hours per Subject - shown when legal areas are selected */}
          {formData.legal_areas.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-md p-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-purple-800">
                  Regelmäßige Stunden pro Rechtsgebiet
                </label>
                <select
                  value={formData.frequency_type}
                  onChange={(e) => setFormData({ ...formData, frequency_type: e.target.value })}
                  className="text-xs border border-purple-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Bitte wählen</option>
                  <option value="weekly">Wochenstunden</option>
                  <option value="monthly">Monatsstunden</option>
                </select>
              </div>
              {formData.frequency_type && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {formData.legal_areas.includes('Zivilrecht') && (
                    <div>
                      <label className="block text-xs text-purple-700 mb-1">Zivilrecht</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.frequency_hours_zivilrecht ?? ''}
                        onChange={(e) => setFormData({ ...formData, frequency_hours_zivilrecht: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white"
                        placeholder={formData.frequency_type === 'weekly' ? 'Std./Woche' : 'Std./Monat'}
                      />
                    </div>
                  )}
                  {formData.legal_areas.includes('Strafrecht') && (
                    <div>
                      <label className="block text-xs text-purple-700 mb-1">Strafrecht</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.frequency_hours_strafrecht ?? ''}
                        onChange={(e) => setFormData({ ...formData, frequency_hours_strafrecht: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white"
                        placeholder={formData.frequency_type === 'weekly' ? 'Std./Woche' : 'Std./Monat'}
                      />
                    </div>
                  )}
                  {formData.legal_areas.includes('Öffentliches Recht') && (
                    <div>
                      <label className="block text-xs text-purple-700 mb-1">Öff. Recht</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.frequency_hours_oeffentliches_recht ?? ''}
                        onChange={(e) => setFormData({ ...formData, frequency_hours_oeffentliches_recht: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white"
                        placeholder={formData.frequency_type === 'weekly' ? 'Std./Woche' : 'Std./Monat'}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Contract Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vertragslaufzeit
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Von</label>
                <input
                  type="date"
                  value={formData.contract_start}
                  onChange={(e) => setFormData({ ...formData, contract_start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bis</label>
                <input
                  type="date"
                  value={formData.contract_end}
                  onChange={(e) => setFormData({ ...formData, contract_end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Booked Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gebuchtes Stundenpaket
            </label>
            <input
              type="number"
              min="0"
              value={formData.booked_hours || ''}
              onChange={(e) => setFormData({ ...formData, booked_hours: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Stundenanzahl"
            />
          </div>

          {/* Dynamic Dozent Assignment based on selected legal areas - hidden for Elite-Kleingruppe */}
          {formData.legal_areas.length > 0 && !formData.elite_kleingruppe && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Dozenten nach Rechtsgebiet
              </label>
              
              {formData.legal_areas.includes('Zivilrecht') && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dozent Zivilrecht</label>
                  <select
                    value={formData.dozent_zivilrecht_id || ''}
                    onChange={(e) => setFormData({ ...formData, dozent_zivilrecht_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Kein Dozent zugewiesen</option>
                    {dozenten.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.legal_areas.includes('Strafrecht') && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dozent Strafrecht</label>
                  <select
                    value={formData.dozent_strafrecht_id || ''}
                    onChange={(e) => setFormData({ ...formData, dozent_strafrecht_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Kein Dozent zugewiesen</option>
                    {dozenten.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.legal_areas.includes('Öffentliches Recht') && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dozent Öffentliches Recht</label>
                  <select
                    value={formData.dozent_oeffentliches_recht_id || ''}
                    onChange={(e) => setFormData({ ...formData, dozent_oeffentliches_recht_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Kein Dozent zugewiesen</option>
                    {dozenten.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

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
              className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center disabled:opacity-50"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Speichern' : 'Hinzufügen'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
