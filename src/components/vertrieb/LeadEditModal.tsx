import { FormEvent, useEffect, useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { Lead } from '../../store/salesStore';

interface LeadEditModalProps {
  lead: Lead | null;
  onClose: () => void;
  onSave: (id: string, data: Partial<Lead>) => Promise<void>;
}

interface LeadFormValues {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  study_goal: string;
  study_location: string;
  state_law: string;
  exam_date: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  source: string;
  notes: string;
}

const splitName = (lead: Lead) => {
  const parts = (lead.name || '').trim().split(/\s+/);
  return {
    first: lead.first_name ?? (parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || ''),
    last: lead.last_name ?? (parts.length > 1 ? parts[parts.length - 1] : ''),
  };
};

const toForm = (lead: Lead): LeadFormValues => {
  const { first, last } = splitName(lead);
  return {
    first_name: first,
    last_name: last,
    email: lead.email || '',
    phone: lead.phone || '',
    study_goal: lead.study_goal || '',
    study_location: lead.study_location || '',
    state_law: lead.state_law || '',
    exam_date: lead.exam_date ? lead.exam_date.slice(0, 10) : '',
    street: lead.street || '',
    house_number: lead.house_number || '',
    postal_code: lead.postal_code || '',
    city: lead.city || '',
    source: lead.source || '',
    notes: lead.notes || '',
  };
};

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary';

export function LeadEditModal({ lead, onClose, onSave }: LeadEditModalProps) {
  const [form, setForm] = useState<LeadFormValues | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(lead ? toForm(lead) : null);
  }, [lead?.id]);

  if (!lead || !form) return null;

  const set = (key: keyof LeadFormValues) => (e: { target: { value: string } }) =>
    setForm(prev => (prev ? { ...prev, [key]: e.target.value } : prev));

  const canSave = Boolean((form.first_name.trim() || form.last_name.trim()) && form.email.trim());

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    try {
      const first = form.first_name.trim();
      const last = form.last_name.trim();
      await onSave(lead.id, {
        name: `${first} ${last}`.trim(),
        first_name: first || null,
        last_name: last || null,
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        study_goal: form.study_goal.trim() || null,
        study_location: form.study_location.trim() || null,
        state_law: form.state_law.trim() || null,
        exam_date: form.exam_date || null,
        street: form.street.trim() || null,
        house_number: form.house_number.trim() || null,
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        source: form.source.trim() || lead.source,
        notes: form.notes.trim() || null,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Lead bearbeiten</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Vorname</label>
              <input type="text" value={form.first_name} onChange={set('first_name')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Nachname</label>
              <input type="text" value={form.last_name} onChange={set('last_name')} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">E-Mail <span className="text-red-500">*</span></label>
              <input type="email" value={form.email} onChange={set('email')} className={inputClass} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Telefon</label>
              <input type="tel" value={form.phone} onChange={set('phone')} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Studienziel</label>
              <input type="text" value={form.study_goal} onChange={set('study_goal')} className={inputClass} placeholder="z.B. 1. Staatsexamen" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Standort / Uni</label>
              <input type="text" value={form.study_location} onChange={set('study_location')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Landesrecht</label>
              <input type="text" value={form.state_law} onChange={set('state_law')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Prüfungstermin</label>
              <input type="date" value={form.exam_date} onChange={set('exam_date')} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="mb-1 block text-xs font-medium text-gray-700">Straße</label>
              <input type="text" value={form.street} onChange={set('street')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Nr.</label>
              <input type="text" value={form.house_number} onChange={set('house_number')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">PLZ</label>
              <input type="text" value={form.postal_code} onChange={set('postal_code')} className={inputClass} />
            </div>
            <div className="col-span-3">
              <label className="mb-1 block text-xs font-medium text-gray-700">Ort</label>
              <input type="text" value={form.city} onChange={set('city')} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Quelle</label>
            <input type="text" value={form.source} onChange={set('source')} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Notizen</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3} className={inputClass} />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100">Abbrechen</button>
            <button
              type="submit"
              disabled={isSaving || !canSave}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
