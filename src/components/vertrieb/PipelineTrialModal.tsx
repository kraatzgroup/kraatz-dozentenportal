import { useEffect, useMemo, useState, FormEvent } from 'react';
import { X, User, GraduationCap } from 'lucide-react';
import { Lead } from '../../store/salesStore';
import { supabase } from '../../lib/supabase';
import { getNextMondayDateTime } from './dateDefaults';

interface Dozent {
  id: string;
  name: string;
  email: string;
  legal_areas: string[];
}

export interface TrialRequestData {
  teilnehmer_name: string;
  teilnehmer_email: string | null;
  teilnehmer_phone: string | null;
  scheduled_date: string;
  dozent_id?: string;
  rechtsgebiet?: string;
  uni_standort?: string;
  landesrecht?: string;
  notes?: string;
  duration: number;
  lead_id?: string;
}

interface PipelineTrialModalProps {
  lead: Lead | null;
  /** Vorbefüllung bei Neuanfrage nach Ablehnung (Dozent bleibt frei wählbar). */
  initial?: TrialRequestData | null;
  /** Dozent, der abgelehnt hat – im Dropdown markiert und nicht wählbar. */
  rejectedDozentId?: string | null;
  rejectedDozentName?: string | null;
  onClose: () => void;
  onSubmit: (data: TrialRequestData) => Promise<void>;
}

const BUNDESLAENDER = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg',
  'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen',
  'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
];

export function PipelineTrialModal({ lead, initial, rejectedDozentId, rejectedDozentName, onClose, onSubmit }: PipelineTrialModalProps) {
  const [dozenten, setDozenten] = useState<Dozent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    teilnehmer_name: '',
    teilnehmer_email: '',
    teilnehmer_phone: '',
    scheduled_date: getNextMondayDateTime(),
    dozent_id: '',
    rechtsgebiet: '',
    uni_standort: '',
    landesrecht: '',
    notes: '',
    duration: '60',
  });

  useEffect(() => {
    if (lead) {
      setFormData({
        teilnehmer_name: initial?.teilnehmer_name || lead.name || '',
        teilnehmer_email: initial?.teilnehmer_email || lead.email || '',
        teilnehmer_phone: initial?.teilnehmer_phone || lead.phone || '',
        scheduled_date: initial?.scheduled_date || getNextMondayDateTime(),
        dozent_id: initial?.dozent_id || '',
        rechtsgebiet: initial?.rechtsgebiet || '',
        uni_standort: initial?.uni_standort || lead.study_location || '',
        landesrecht: initial?.landesrecht || '',
        notes: initial?.notes || '',
        duration: String(initial?.duration || 60),
      });
    }
  }, [lead, initial]);

  useEffect(() => {
    const fetchDozenten = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, legal_areas')
        .eq('role', 'dozent')
        .eq('is_archived', false)
        .neq('vb_springer', true);
      setDozenten((data || []).map(d => ({ id: d.id, name: d.full_name, email: d.email, legal_areas: d.legal_areas || [] })));
    };
    fetchDozenten();
  }, []);

  // Rechtsgebiete: Vereinigung über alle Dozenten (Fallback, falls keine hinterlegt sind)
  const rechtsgebiete = useMemo(() => {
    const set = new Set<string>();
    dozenten.forEach(d => (d.legal_areas || []).forEach(r => set.add(r)));
    const areas = Array.from(set).sort();
    return areas.length > 0 ? areas : ['Zivilrecht', 'Öffentliches Recht', 'Strafrecht'];
  }, [dozenten]);

  // Nur Dozenten, die das gewählte Rechtsgebiet abdecken (ohne Angabe = macht alles)
  const filteredDozenten = useMemo(
    () => formData.rechtsgebiet
      ? dozenten.filter(d => !(d.legal_areas && d.legal_areas.length) || d.legal_areas.includes(formData.rechtsgebiet))
      : [],
    [dozenten, formData.rechtsgebiet]
  );

  if (!lead) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        teilnehmer_name: formData.teilnehmer_name.trim(),
        teilnehmer_email: formData.teilnehmer_email.trim() || null,
        teilnehmer_phone: formData.teilnehmer_phone.trim() || null,
        scheduled_date: formData.scheduled_date,
        dozent_id: formData.dozent_id || undefined,
        rechtsgebiet: formData.rechtsgebiet || undefined,
        uni_standort: formData.uni_standort || undefined,
        landesrecht: formData.landesrecht || undefined,
        notes: formData.notes || undefined,
        duration: parseInt(formData.duration, 10) || 60,
        lead_id: lead.id,
      });
      onClose();
    } catch (error) {
      console.error('Error creating trial lesson:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-purple-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Probestunde anfragen</h3>
              <p className="text-xs text-gray-500">Lead: {lead.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                required
                value={formData.teilnehmer_name}
                onChange={e => setFormData({ ...formData, teilnehmer_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input
                type="tel"
                value={formData.teilnehmer_phone}
                onChange={e => setFormData({ ...formData, teilnehmer_phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <input
                type="email"
                value={formData.teilnehmer_email}
                onChange={e => setFormData({ ...formData, teilnehmer_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum & Uhrzeit *</label>
              <input
                type="datetime-local"
                required
                value={formData.scheduled_date}
                onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rechtsgebiet *</label>
              <select
                value={formData.rechtsgebiet}
                onChange={e => setFormData({ ...formData, rechtsgebiet: e.target.value, dozent_id: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Rechtsgebiet auswählen...</option>
                {rechtsgebiete.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="h-4 w-4 inline mr-1" />
                Anfrage bei Dozent
              </label>
              <select
                value={formData.dozent_id}
                onChange={e => setFormData({ ...formData, dozent_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={!formData.rechtsgebiet}
              >
                <option value="">{formData.rechtsgebiet ? 'Dozent auswählen...' : 'Erst Rechtsgebiet wählen...'}</option>
                {rejectedDozentId && (
                  <option value={rejectedDozentId} disabled>
                    {rejectedDozentName || 'Dozent'} (hat abgelehnt)
                  </option>
                )}
                {filteredDozenten.filter(d => d.id !== rejectedDozentId).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uni-Standort</label>
              <input
                type="text"
                value={formData.uni_standort}
                onChange={e => setFormData({ ...formData, uni_standort: e.target.value })}
                placeholder="z.B. Köln, München, Berlin..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Landesrecht</label>
              <select
                value={formData.landesrecht}
                onChange={e => setFormData({ ...formData, landesrecht: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Bundesland auswählen...</option>
                {BUNDESLAENDER.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dauer (Minuten)</label>
              <select
                value={formData.duration}
                onChange={e => setFormData({ ...formData, duration: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="60">60</option>
                <option value="90">90</option>
                <option value="120">120</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Wird angelegt...' : 'Probestunde anfragen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
