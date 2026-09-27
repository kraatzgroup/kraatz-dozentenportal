import { FormEvent, useState } from 'react';
import { X } from 'lucide-react';
import { Lead } from '../../store/salesStore';

interface LeadCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateLead: (data: Partial<Lead>) => Promise<void>;
}

interface LeadFormValues {
  name: string;
  email: string;
  phone: string;
  study_goal: string;
  study_location: string;
  notes: string;
  booking_date: string;
  source: string;
}

const EMPTY_LEAD: LeadFormValues = {
  name: '',
  email: '',
  phone: '',
  study_goal: '',
  study_location: '',
  notes: '',
  booking_date: '',
  source: '',
};

export function LeadCreateModal({ isOpen, onClose, onCreateLead }: LeadCreateModalProps) {
  const [newLead, setNewLead] = useState<LeadFormValues>(EMPTY_LEAD);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newLead.name.trim() || !newLead.email.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateLead({
        name: newLead.name.trim(),
        email: newLead.email.trim(),
        phone: newLead.phone.trim() || null,
        study_goal: newLead.study_goal.trim() || null,
        study_location: newLead.study_location.trim() || null,
        notes: newLead.notes.trim() || null,
        booking_date: newLead.booking_date || null,
        source: newLead.source.trim() || 'manual',
        status: 'new',
      });
      setNewLead(EMPTY_LEAD);
      onClose();
    } catch (error) {
      console.error('Error creating lead:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold text-gray-900">Neuen Lead hinzufügen</h3>
          <button type="button" onClick={onClose} aria-label="Lead-Erstellung schließen" className="rounded p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
            <input type="text" value={newLead.name} onChange={event => setNewLead(previous => ({ ...previous, name: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" placeholder="Max Mustermann" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">E-Mail <span className="text-red-500">*</span></label>
            <input type="email" value={newLead.email} onChange={event => setNewLead(previous => ({ ...previous, email: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" placeholder="max@beispiel.de" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Telefon</label>
            <input type="tel" value={newLead.phone} onChange={event => setNewLead(previous => ({ ...previous, phone: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" placeholder="+49 123 456789" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Studienziel</label>
            <input type="text" value={newLead.study_goal} onChange={event => setNewLead(previous => ({ ...previous, study_goal: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" placeholder="z.B. Staatsexamen, Bachelor" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Standort</label>
            <input type="text" value={newLead.study_location} onChange={event => setNewLead(previous => ({ ...previous, study_location: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" placeholder="z.B. München, Berlin" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Quelle</label>
            <input type="text" value={newLead.source} onChange={event => setNewLead(previous => ({ ...previous, source: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" placeholder="z.B. Empfehlung, Website" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Termin</label>
            <input type="datetime-local" value={newLead.booking_date} onChange={event => setNewLead(previous => ({ ...previous, booking_date: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notizen</label>
            <textarea value={newLead.notes} onChange={event => setNewLead(previous => ({ ...previous, notes: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" rows={3} placeholder="Zusätzliche Informationen..." />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200">Abbrechen</button>
            <button type="submit" disabled={isSubmitting || !newLead.name.trim() || !newLead.email.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
              {isSubmitting ? 'Speichern...' : 'Lead erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
