import { useEffect, useMemo } from 'react';
import { X, History } from 'lucide-react';
import { Lead, useSalesStore } from '../../store/salesStore';

const STATUS_LABELS: Record<string, string> = {
  new: 'Beratungsgespräch',
  offer_sent: 'Angebot versendet',
  post_offer_call: '2. Gespräch',
  trial_pending: 'Probestunde',
  post_trial_call: 'Finalgespräch',
  finalgespraech: 'Finalgespräch',
  vertragsanforderung: 'Vertragsanforderung',
  vertrag_versendet: 'Vertrag versendet',
  contract_closed: 'Vertrag geschlossen',
  downsell: 'Downsell / Unqualifiziert',
  unqualified: 'Downsell / Unqualifiziert',
  closed: 'Geschlossen',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  offer_sent: 'bg-amber-100 text-amber-800',
  post_offer_call: 'bg-orange-100 text-orange-800',
  trial_pending: 'bg-purple-100 text-purple-800',
  post_trial_call: 'bg-rose-100 text-rose-800',
  finalgespraech: 'bg-rose-100 text-rose-800',
  vertragsanforderung: 'bg-rose-100 text-rose-800',
  vertrag_versendet: 'bg-rose-100 text-rose-800',
  contract_closed: 'bg-green-100 text-green-800',
  downsell: 'bg-teal-100 text-teal-800',
  unqualified: 'bg-teal-100 text-teal-800',
  closed: 'bg-green-100 text-green-800',
};

interface LeadHistoryModalProps {
  lead: Lead | null;
  onClose: () => void;
}

export function LeadHistoryModal({ lead, onClose }: LeadHistoryModalProps) {
  const { leadHistory, fetchLeadHistory } = useSalesStore();

  useEffect(() => {
    if (lead) fetchLeadHistory(lead.id);
  }, [lead, fetchLeadHistory]);

  const timeline = useMemo(() => {
    if (!lead) return [];
    const items = leadHistory
      .filter(entry => entry.lead_id === lead.id)
      .map(entry => ({ at: entry.changed_at, status: entry.status, label: STATUS_LABELS[entry.status] || entry.status }));
    // Fallback: kein Verlauf -> Anlagezeitpunkt + aktueller Status
    if (items.length === 0) {
      return [
        { at: lead.created_at, status: 'new', label: STATUS_LABELS.new || 'Lead angelegt' },
        { at: lead.updated_at, status: lead.status, label: STATUS_LABELS[lead.status] || lead.status },
      ];
    }
    return items;
  }, [lead, leadHistory]);

  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Customer Journey</h3>
              <p className="text-xs text-gray-500">{lead.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-500 py-3">Noch kein Verlauf vorhanden.</p>
          ) : (
            <ol className="relative space-y-5 border-l border-gray-200 pl-5">
              {timeline.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="relative">
                  <span
                    className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${
                      index === timeline.length - 1 ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  />
                  <p className="text-xs text-gray-400">
                    {new Date(entry.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr
                  </p>
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[entry.status] || 'bg-gray-100 text-gray-700'}`}>
                    {entry.label}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-gray-400">
            Aktueller Status: <span className="font-medium text-gray-600">{STATUS_LABELS[lead.status] || lead.status}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
