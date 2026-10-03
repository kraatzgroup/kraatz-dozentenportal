import { useEffect, useMemo, useState, FormEvent } from 'react';
import { X, FileText, Eye, Send, Package as PackageIcon } from 'lucide-react';
import { Lead } from '../../store/salesStore';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../store/toastStore';
import { getNextMonday } from './dateDefaults';

interface EmailTemplateRow {
  id: string;
  title: string;
  icon?: string | null;
  description?: string | null;
  subject: string;
  body: string;
  category?: string | null;
  is_html?: boolean | null;
}

interface PipelineOfferModalProps {
  lead: Lead | null;
  onClose: () => void;
  /** Wird nach erfolgreichem Versand aufgerufen (Parent setzt den Ziel-Status). */
  onSent: (info: { packageName: string | null; beginDate: string | null; price: number | null; reason: string | null }) => Promise<void>;
  /** Kategorie der E-Mail-Vorlagen (z.B. 'angebot' oder 'kraatzclub'). */
  templateCategory?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  /** Zeigt zusätzlich den "nichts senden"-Button an. */
  allowSkip?: boolean;
  skipLabel?: string;
  onSkip?: (reason: string) => Promise<void>;
  /** Paket-Auswahl und geplanter Beginn ausblenden (z.B. bei Info-Mails). */
  showPackageFields?: boolean;
  /** Grund der Unqualifizierung abfragen (Zu teuer / anderes Rep / Freitext). */
  askReason?: boolean;
}

const PLACEHOLDERS = [
  { token: '[Vorname]', label: 'Vorname' },
  { token: '[Name]', label: 'Name' },
  { token: '[Stundenpaket]', label: 'Stundenpaket' },
  { token: '[Stundenanzahl]', label: 'Stundenanzahl' },
  { token: '[Preis]', label: 'Preis' },
  { token: '[Beginn]', label: 'Beginn' },
];

interface OfferPackage {
  id: string;
  name: string;
  hours: number;
  price: number;
  group: 'paket' | 'rechtsgebiet';
  detail: string;
}

const OFFER_PACKAGES: OfferPackage[] = [
  { id: '70h', name: '70 Stunden Paket', hours: 70, price: 9905, group: 'paket', detail: '12 Monate à 825,42 € · 141,50 €/h (hälftiges Paket)' },
  { id: '140h', name: '140 Stunden Paket', hours: 140, price: 19530, group: 'paket', detail: '12 Monate à 1.627,50 € · 139,50 €/h (TOP-SELLER)' },
  { id: '200h', name: '200 Stunden Paket', hours: 200, price: 27700, group: 'paket', detail: '12 Monate à 2.308,34 € · 138,50 €/h (inkl. 60 Std. Wiederholungspaket)' },
  { id: 'zr', name: 'Zivilrecht', hours: 55, price: 7892.5, group: 'rechtsgebiet', detail: '55 Std. · 143,50 €/h' },
  { id: 'oer', name: 'Öffentliches Recht', hours: 50, price: 7175, group: 'rechtsgebiet', detail: '50 Std. · 143,50 €/h' },
  { id: 'str', name: 'Strafrecht', hours: 35, price: 5022.5, group: 'rechtsgebiet', detail: '35 Std. · 143,50 €/h' },
];

const OFFER_SENDER = { name: 'Mario Kraatz', email: 'mariokraatz@kraatz-group.de' };

const formatEuro = (value: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);

const formatDate = (value: string) =>
  value ? new Date(value + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

export function PipelineOfferModal({ lead, onClose, onSent, templateCategory = 'angebot', title = 'Angebot senden', description, submitLabel = 'Angebot senden', allowSkip = false, skipLabel = 'Ohne Mail verschieben', onSkip, showPackageFields = true, askReason = false }: PipelineOfferModalProps) {
  const { addToast } = useToastStore();
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isHtml, setIsHtml] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [beginDate, setBeginDate] = useState(getNextMonday);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [reasonOption, setReasonOption] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (lead) setBeginDate(getNextMonday());
  }, [lead?.id]);

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('email_templates')
        .select('*')
        .order('id');
      const rows = (data || []) as EmailTemplateRow[];
      const offerTemplates = rows.filter(t => t.category === templateCategory);
      const all = offerTemplates.length > 0 ? offerTemplates : rows;
      setTemplates(all);
      if (all.length > 0) {
        setSelectedTemplateId(all[0].id);
        setIsHtml(Boolean(all[0].is_html));
        setSubject(all[0].subject || '');
        setBody(all[0].body || '');
      }
    };
    fetchTemplates();
  }, []);

  const selectedPackage = useMemo(
    () => OFFER_PACKAGES.find(p => p.id === selectedPackageId) || null,
    [selectedPackageId]
  );

  const placeholderValues = useMemo(() => {
    const firstName = lead?.first_name || lead?.name?.split(/\s+/)[0] || '';
    return {
      '[Vorname]': firstName,
      '[Name]': lead?.name || '',
      '[Stundenpaket]': selectedPackage?.name || '',
      '[Stundenanzahl]': selectedPackage ? String(selectedPackage.hours) : '',
      '[Preis]': selectedPackage ? formatEuro(selectedPackage.price) : '',
      '[Beginn]': formatDate(beginDate),
    };
  }, [lead, selectedPackage, beginDate]);

  // Bedingte Blöcke (<!--IF:key-->…<!--/IF:key-->) entfernen, wenn der Wert fehlt
  const applyConditionals = (text: string) => {
    const flags: Record<string, boolean> = {
      paket: Boolean(selectedPackage),
      beginn: Boolean(beginDate),
    };
    flags.angebot = flags.paket || flags.beginn;
    return ['paket', 'beginn', 'angebot'].reduce(
      (acc, key) => acc.replace(new RegExp(`<!--IF:${key}-->([\\s\\S]*?)<!--/IF:${key}-->`, 'g'), flags[key] ? '$1' : ''),
      text
    );
  };

  const replacePlaceholders = (text: string) =>
    PLACEHOLDERS.reduce((acc, p) => acc.split(p.token).join(placeholderValues[p.token as keyof typeof placeholderValues]), applyConditionals(text));

  const previewSubject = replacePlaceholders(subject);
  const previewBody = replacePlaceholders(body);
  // Vorschau für HTML-Vorlagen: Tags entfernen, damit sie lesbar bleibt
  const previewBodyText = isHtml
    ? previewBody
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h\d|li)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : previewBody;

  const insertPlaceholder = (token: string) => {
    setBody(prev => prev + (prev && !prev.endsWith('\n') ? ' ' : '') + token);
  };

  const selectTemplate = (template: EmailTemplateRow) => {
    setSelectedTemplateId(template.id);
    setIsHtml(Boolean(template.is_html));
    setShowSource(false);
    setSubject(template.subject || '');
    setBody(template.body || '');
  };

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lead?.email || !previewSubject.trim() || !previewBody.trim()) {
      addToast('E-Mail-Adresse, Betreff und Text sind erforderlich', 'error');
      return;
    }
    setIsSending(true);
    try {
      // HTML-Vorlagen unverändert senden, Klartext in <p>-Absätze wrappen
      const html = isHtml
        ? previewBody
        : previewBody.split('\n').map(line => `<p>${line}</p>`).join('');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht eingeloggt');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            to: lead.email,
            toName: lead.name,
            subject: previewSubject,
            html,
            fromName: OFFER_SENDER.name,
            fromEmail: OFFER_SENDER.email,
            replyTo: OFFER_SENDER.email,
            edgeFunction: 'send-offer-email',
            context: { leadId: lead.id, templateId: selectedTemplateId || null, packageId: selectedPackageId || null },
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || result?.details || 'Send failed');
      addToast(`Angebot an ${lead.email} versendet`, 'success');
      await onSent({ packageName: selectedPackage?.name ?? null, beginDate: beginDate || null, price: selectedPackage?.price ?? null, reason: reasonText.trim() || reasonOption || null });
      onClose();
    } catch (error: any) {
      console.error('Error sending offer email:', error);
      addToast(`Versand fehlgeschlagen: ${error.message}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500">Lead: {lead.name} · {lead.email}</p>
              {description && <p className="text-xs text-gray-500">{description}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSend} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {/* Grund der Unqualifizierung */}
          {askReason && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warum unqualifiziert?</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                {['Zu teuer', 'aktuell noch in einem anderen Rep'].map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setReasonOption(prev => (prev === option ? '' : option))}
                    className={`text-left p-2.5 rounded-lg border transition-colors ${
                      reasonOption === option ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{option}</p>
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={reasonText}
                onChange={e => setReasonText(e.target.value)}
                placeholder="Sonstiger Grund..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          )}

          {/* Template-Auswahl */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail-Vorlage</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {templates.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => selectTemplate(template)}
                  className={`text-left p-2.5 rounded-lg border transition-colors ${
                    selectedTemplateId === template.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{template.icon} {template.title}</p>
                  {template.description && <p className="text-xs text-gray-500 truncate">{template.description}</p>}
                </button>
              ))}
            </div>
          </div>

          {/* Platzhalter-Daten: Paket + Beginn */}
          {showPackageFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <PackageIcon className="h-4 w-4 mr-1" />Stundenpaket
              </label>
              <select
                value={selectedPackageId}
                onChange={e => setSelectedPackageId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Paket auswählen...</option>
                <optgroup label="Pakete">
                  {OFFER_PACKAGES.filter(p => p.group === 'paket').map(p => (
                    <option key={p.id} value={p.id}>{p.hours} Stunden · {formatEuro(p.price)}</option>
                  ))}
                </optgroup>
                <optgroup label="Rechtsgebiete einzeln buchbar">
                  {OFFER_PACKAGES.filter(p => p.group === 'rechtsgebiet').map(p => (
                    <option key={p.id} value={p.id}>{p.name} · {p.hours} Std. · {formatEuro(p.price)}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Geplanter Beginn</label>
              <input
                type="date"
                value={beginDate}
                onChange={e => setBeginDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
          )}

          {/* Betreff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Betreff</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* HTML-Vorlage: gerenderte Vorschau statt Quelltext */}
          {isHtml && !showSource ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Vorschau der E-Mail</label>
                <button
                  type="button"
                  onClick={() => setShowSource(true)}
                  className="text-xs text-gray-500 underline hover:text-primary"
                >
                  Quelltext bearbeiten
                </button>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-sm font-semibold text-gray-900">{previewSubject}</p>
                <iframe
                  title="E-Mail-Vorschau"
                  sandbox=""
                  srcDoc={previewBody}
                  className="h-[520px] w-full rounded border border-gray-200 bg-white"
                />
              </div>

            </div>
          ) : (
          <div>
            {isHtml && (
              <button type="button" onClick={() => setShowSource(false)} className="mb-2 text-xs text-gray-500 underline hover:text-primary">
                Zurück zur Vorschau
              </button>
            )}
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Nachricht</label>
              <div className="flex items-center gap-1">
                {PLACEHOLDERS.map(p => (
                  <button
                    key={p.token}
                    type="button"
                    onClick={() => insertPlaceholder(p.token)}
                    title={`Platzhalter ${p.token} einfügen`}
                    className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-primary/10 hover:text-primary"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Platzhalter werden beim Versand ersetzt: {PLACEHOLDERS.map(p => p.token).join(' ')}
            </p>
          </div>
          )}

          {/* Vorschau */}
          {showPreview && !(isHtml && !showSource) && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Vorschau</p>
              <p className="text-sm font-semibold text-gray-900 mb-2">{previewSubject}</p>
              {isHtml ? (
                <iframe
                  title="E-Mail-Vorschau"
                  sandbox=""
                  srcDoc={previewBody}
                  className="h-[420px] w-full rounded border border-gray-200 bg-white"
                />
              ) : (
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{previewBodyText}</div>
              )}
            </div>
          )}

          </div>
          <div className="flex shrink-0 justify-end space-x-3 border-t border-gray-200 p-4 sm:p-6">
            {!(isHtml && !showSource) && (
            <button
              type="button"
              onClick={() => setShowPreview(prev => !prev)}
              className="flex items-center px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <Eye className="h-4 w-4 mr-1.5" />{showPreview ? 'Vorschau ausblenden' : 'Vorschau'}
            </button>
            )}
            {allowSkip && onSkip && (
              <button
                type="button"
                onClick={async () => { await onSkip(reasonText.trim() || reasonOption); onClose(); }}
                disabled={isSending}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                {skipLabel}
              </button>
            )}
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSending || !lead.email}
              className="flex items-center px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
            >
              <Send className="h-4 w-4 mr-1.5" />{isSending ? 'Wird gesendet...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
