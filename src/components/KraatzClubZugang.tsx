import { useState, useEffect, useCallback } from 'react';
import { Gift, Trash2, Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';

type ZugangStatus =
  | 'ausstehend'
  | 'freischaltung_gesendet'
  | 'aktiv'
  | 'entzug_gesendet'
  | 'entzogen'
  | 'uebersprungen'
  | 'fehler';

interface MemberspotZugang {
  id: string;
  zugang: string;
  dauerhaft: boolean;
  status: ZugangStatus;
  letzte_aktion: 'grant' | 'revoke' | null;
  last_error: string | null;
  granted_at: string | null;
  revoked_at: string | null;
}

interface KraatzClubZugangRow {
  id: string;
  vorname: string;
  nachname: string;
  email: string;
  vertragsbeginn: string;
  vertragsende: string;
  zugang: string[];
  created_at: string;
  zugaenge: MemberspotZugang[];
}

const STATUS_LABEL: Record<ZugangStatus, string> = {
  ausstehend: 'wartet auf Vertragsbeginn',
  freischaltung_gesendet: 'Freischaltung läuft',
  aktiv: 'aktiv',
  entzug_gesendet: 'Entzug läuft',
  entzogen: 'entzogen',
  uebersprungen: 'übersprungen (Vertrag bereits beendet)',
  fehler: 'Fehler',
};

const STATUS_DOT: Record<ZugangStatus, string | null> = {
  ausstehend: 'bg-gray-400',
  freischaltung_gesendet: null,
  aktiv: null,
  entzug_gesendet: null,
  entzogen: 'bg-gray-300',
  uebersprungen: 'bg-gray-300',
  fehler: 'bg-red-500',
};

const ZUGANG_ORDER = ['Premium-Mitgliedschaft', 'Gratis Monat', 'Zivilrecht', 'Strafrecht', 'Öffentliches Recht', 'Free Access'];

const ZUGANG_OPTIONS = [
  'Premium-Mitgliedschaft',
  'Gratis Monat',
  'Zivilrecht',
  'Strafrecht',
  'Öffentliches Recht',
] as const;

const ZUGANG_BADGE: Record<string, string> = {
  'Premium-Mitgliedschaft': 'bg-purple-100 text-purple-700',
  'Gratis Monat': 'bg-amber-100 text-amber-700',
  'Zivilrecht': 'bg-blue-100 text-blue-700',
  'Strafrecht': 'bg-red-100 text-red-700',
  'Öffentliches Recht': 'bg-green-100 text-green-700',
  'Free Access': 'bg-gray-100 text-gray-700',
};

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm';

const todayISO = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('de-DE');
};

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function KraatzClubZugang() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const [rows, setRows] = useState<KraatzClubZugangRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [email, setEmail] = useState('');
  const [vertragsbeginn, setVertragsbeginn] = useState('');
  const [vertragsende, setVertragsende] = useState('');
  const [zugang, setZugang] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, setSyncing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('memberspot_kraatzclub_mitglieder')
      .select('*, zugaenge:memberspot_kraatzclub_zugaenge(id, zugang, dauerhaft, status, letzte_aktion, last_error, granted_at, revoked_at)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      addToast('Fehler beim Laden der Zugänge', 'error');
    } else {
      setRows((data || []) as KraatzClubZugangRow[]);
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const runSync = useCallback(async (showToast: boolean) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('memberspot-kraatzclub-sync');
      if (error || data?.success === false) throw new Error(data?.error || error?.message);
      if (showToast) {
        addToast(
          data.due > 0 ? `${data.sent} Zugänge an Memberspot übergeben` : 'Keine fälligen Zugänge',
          data.failed > 0 ? 'error' : 'success'
        );
      }
    } catch (e) {
      console.error(e);
      if (showToast) addToast('Synchronisierung mit Memberspot fehlgeschlagen', 'error');
    } finally {
      setSyncing(false);
      fetchRows();
    }
  }, [addToast, fetchRows]);

  const retryZugang = async (z: MemberspotZugang) => {
    setRetryingId(z.id);
    const { error } = await supabase
      .from('memberspot_kraatzclub_zugaenge')
      .update({ status: z.letzte_aktion === 'revoke' ? 'aktiv' : 'ausstehend', versuche: 0, last_error: null })
      .eq('id', z.id);
    setRetryingId(null);
    if (error) {
      console.error(error);
      addToast('Fehler beim Zurücksetzen', 'error');
      return;
    }
    runSync(true);
  };

  const toggleZugang = (option: string) => {
    const isOn = !zugang.includes(option);
    let next = isOn ? [...zugang, option] : zugang.filter((o) => o !== option);

    if (option === 'Gratis Monat' && isOn) {
      // Startdatum default heute, Vertragsende automatisch +30 Tage (fixiert)
      const start = vertragsbeginn || todayISO();
      setVertragsbeginn(start);
      setVertragsende(addDays(start, 30));
      // Premium-Mitgliedschaft automatisch vorauswählen (änderbar)
      if (!next.includes('Premium-Mitgliedschaft')) {
        next = [...next, 'Premium-Mitgliedschaft'];
      }
    }

    setZugang(next);
  };

  const resetForm = () => {
    setVorname('');
    setNachname('');
    setEmail('');
    setVertragsbeginn('');
    setVertragsende('');
    setZugang([]);
  };

  const submit = async () => {
    if (!vorname.trim() || !nachname.trim() || !email.trim()) {
      addToast('Bitte Vorname, Nachname und E-Mail-Adresse ausfüllen', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      addToast('Bitte eine gültige E-Mail-Adresse angeben', 'error');
      return;
    }
    if (!vertragsbeginn || !vertragsende) {
      addToast('Bitte Vertragsbeginn und Vertragsende angeben', 'error');
      return;
    }
    if (new Date(vertragsende) <= new Date(vertragsbeginn)) {
      addToast('Das Vertragsende muss mindestens einen Tag nach dem Vertragsbeginn liegen', 'error');
      return;
    }
    if (zugang.length === 0) {
      addToast('Bitte mindestens einen Zugang auswählen', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('memberspot_kraatzclub_mitglieder').insert({
        vorname: vorname.trim(),
        nachname: nachname.trim(),
        email: email.trim(),
        vertragsbeginn,
        vertragsende,
        zugang,
        created_by: user?.id,
      });
      if (error) throw error;

      // Freischaltung und Aktivierungs-E-Mail laufen im Backend: sofort, wenn der
      // Vertragsbeginn erreicht ist, sonst am Tag des Beginns um 00:15 Uhr.
      const startetSpaeter = vertragsbeginn > todayISO();
      addToast(
        startetSpaeter
          ? `Zugang gespeichert – Freischaltung und E-Mail am ${formatDate(vertragsbeginn)} um 00:15 Uhr`
          : 'Zugang gespeichert – Freischaltung und E-Mail werden versendet',
        'success'
      );
      resetForm();
      runSync(false);
    } catch (err) {
      console.error(err);
      addToast('Fehler beim Speichern', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRow = async (row: KraatzClubZugangRow) => {
    if (
      !confirm(
        `Eintrag für „${row.vorname} ${row.nachname}" wirklich löschen?\n\nAchtung: Bereits freigeschaltete Zugänge in Memberspot werden dadurch NICHT entzogen.`
      )
    ) return;
    setDeletingId(row.id);
    try {
      const { error } = await supabase.from('memberspot_kraatzclub_mitglieder').delete().eq('id', row.id);
      if (error) throw error;
      addToast('Zugang gelöscht', 'success');
      fetchRows();
    } catch (e) {
      console.error(e);
      addToast('Fehler beim Löschen', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 px-10">
      <div className="flex items-center gap-4">
        <img
          src="https://files.mspotcdn.de/schools%2FwgExlBUwDc02VQa5IKie%2Flogo-1682680505711.png?alt=media&token=0ef3ffa7-d1c4-427e-a8a3-5f4c1d21529e"
          alt="Kraatz Club"
          className="h-12 w-auto flex-shrink-0"
        />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Kraatz Club Zugang</h3>
          <p className="text-sm text-gray-500 mt-1">
            Hier können Zugänge zum Kraatz Club vergeben und verwaltet werden.
          </p>
        </div>
      </div>

      <div className="w-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-gray-900">Kraatz Club Zugang erstellen</h4>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vorname</label>
                <input
                  type="text"
                  value={vorname}
                  onChange={(e) => setVorname(e.target.value)}
                  placeholder="Vorname"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nachname</label>
                <input
                  type="text"
                  value={nachname}
                  onChange={(e) => setNachname(e.target.value)}
                  placeholder="Nachname"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@beispiel.de"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vertragsbeginn</label>
                <input
                  type="date"
                  value={vertragsbeginn}
                  onChange={(e) => {
                    const v = e.target.value;
                    setVertragsbeginn(v);
                    if (zugang.includes('Gratis Monat')) {
                      setVertragsende(addDays(v, 30));
                    }
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vertragsende</label>
                <input
                  type="date"
                  value={vertragsende}
                  onChange={(e) => setVertragsende(e.target.value)}
                  disabled={zugang.includes('Gratis Monat')}
                  title={zugang.includes('Gratis Monat') ? 'Bei „Gratis Monat" automatisch Vertragsbeginn + 30 Tage' : undefined}
                  className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zugang</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ZUGANG_OPTIONS.map((option) => {
                  const checked = zugang.includes(option);
                  return (
                    <label
                      key={option}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm transition-colors ${
                        checked
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleZugang(option)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              Zugang speichern
            </button>
          </form>
        </div>
      </div>

      {/* Vergebene Zugänge */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h4 className="font-semibold text-gray-900">Vergebene Zugänge</h4>
            <p className="text-sm text-gray-500 mt-0.5">
              {rows.length} Einträge · Freischaltung ab Vertragsbeginn, Entzug nach Vertragsende (Free Access bleibt bestehen)
            </p>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Noch keine Zugänge vergeben.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-Mail-Adresse</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vertrag</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zugang</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Erstellt</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {row.vorname} {row.nachname}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{row.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(row.vertragsbeginn)} – {formatDate(row.vertragsende)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {[...(row.zugaenge || [])]
                          .sort((a, b) => ZUGANG_ORDER.indexOf(a.zugang) - ZUGANG_ORDER.indexOf(b.zugang))
                          .map((z) => (
                            <span
                              key={z.id}
                              title={`${STATUS_LABEL[z.status]}${z.last_error ? `: ${z.last_error}` : ''}`}
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                                ZUGANG_BADGE[z.zugang] || 'bg-gray-100 text-gray-700'
                              } ${z.status === 'entzogen' || z.status === 'uebersprungen' ? 'opacity-50 line-through' : ''}`}
                            >
                              {STATUS_DOT[z.status] && (
                                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[z.status]}`} />
                              )}
                              {z.zugang}
                              {z.status === 'fehler' && (
                                <button
                                  onClick={() => retryZugang(z)}
                                  disabled={retryingId === z.id}
                                  className="ml-0.5 text-red-600 hover:text-red-800 disabled:opacity-50"
                                  title="Erneut senden"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(row.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteRow(row)}
                        disabled={deletingId === row.id}
                        className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                        title="Löschen"
                      >
                        {deletingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
