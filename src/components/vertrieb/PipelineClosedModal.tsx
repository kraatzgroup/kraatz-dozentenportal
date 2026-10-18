import { X, CheckCircle2 } from 'lucide-react';
import { Lead } from '../../store/salesStore';
import { deriveOfferConfig, summarizeOfferConfig } from './PipelineOfferModal';

interface PipelineClosedModalProps {
  lead: Lead | null;
  onClose: () => void;
  /** Vertragsgegenstand entspricht dem Angebot: direkt abschließen. */
  onUnchanged: () => Promise<void>;
  /** Es hat sich etwas geändert: Paket-Maske aus der Angebotserstellung öffnen. */
  onChanged: () => void;
}

const formatEuro = (value: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);

const formatDate = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('de-DE');

export function PipelineClosedModal({ lead, onClose, onUnchanged, onChanged }: PipelineClosedModalProps) {
  if (!lead) return null;
  const config = deriveOfferConfig(lead);
  const summary = config ? summarizeOfferConfig(config) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Lead abschließen</h3>
              <p className="text-xs text-gray-500">{lead.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          {summary && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="text-xs font-medium uppercase text-gray-500">Im Angebot versendet</p>
              <p className="mt-1 font-semibold text-gray-900">{summary.name}</p>
              <p className="text-xs text-gray-600">{summary.hours.toLocaleString('de-DE')} Std. · {summary.distribution}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-gray-500">Gesamtpreis</p><p className="text-sm font-semibold text-gray-900">{formatEuro(summary.price)}</p></div>
                <div><p className="text-xs text-gray-500">{summary.hourlyRate != null ? 'Stundenpreis' : 'Umfang'}</p><p className="text-sm font-semibold text-gray-900">{summary.hourlyRate != null ? formatEuro(summary.hourlyRate) : `${summary.hours} Std.`}</p></div>
                <div><p className="text-xs text-gray-500">Zahlung</p><p className="text-sm font-semibold text-gray-900">{summary.rateLabel}</p></div>
              </div>
              {lead.offer_start_date && <p className="mt-2 text-xs text-gray-600">Beginn {formatDate(lead.offer_start_date)}</p>}
            </div>
          )}

          <p className="text-sm font-medium text-gray-700">
            Ist das besprochene Produkt bzw. das im Angebot versendete Paket auch Gegenstand des Vertrags?
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onUnchanged}
              className="rounded-lg border border-gray-200 p-2.5 text-left text-sm transition-colors hover:border-green-500 hover:bg-green-50"
            >
              <span className="font-medium text-gray-900">Ja, unverändert</span>
            </button>
            <button
              type="button"
              onClick={onChanged}
              className="rounded-lg border border-gray-200 p-2.5 text-left text-sm transition-colors hover:border-amber-500 hover:bg-amber-50"
            >
              <span className="font-medium text-gray-900">Nein, es hat sich etwas geändert</span>
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100">
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
