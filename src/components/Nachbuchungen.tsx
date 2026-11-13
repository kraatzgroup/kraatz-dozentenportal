import { useEffect, useRef, useState } from 'react';
import { BookPlus, Loader2, Send, RefreshCw, Search, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToastStore } from '../store/toastStore';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm';

const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const RECHTSGEBIETE = ['Zivilrecht', 'Strafrecht', 'Öffentliches Recht'];

interface TeilnehmerOption {
  id: string;
  name: string;
  tn_nummer: string | null;
}

interface DozentOption {
  id: string;
  full_name: string;
  email: string;
  legal_areas: string[];
}

interface NachbuchungRow {
  id: string;
  teilnehmer_id: string | null;
  teilnehmer_name: string | null;
  teilnehmer_tn_nummer: string | null;
  dozent_id: string | null;
  rechtsgebiet: string;
  status: 'ausstehend' | 'beantwortet';
  sent_at: string;
  responded_at: string | null;
  antwort_bedarf: boolean | null;
  antwort_stunden: number | null;
  antwort_erreichbar: string | null;
  antwort_notiz: string | null;
}

function splitName(full: string): { vorname: string; nachname: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { vorname: '', nachname: '' };
  if (parts.length === 1) return { vorname: parts[0], nachname: '' };
  return { vorname: parts[0], nachname: parts.slice(1).join(' ') };
}

function isPlaceholderEmail(email: string): boolean {
  return /^dozent\d+@kraatz-group\.de$/i.test(email.trim());
}

function participantKey(r: NachbuchungRow): string {
  return r.teilnehmer_id || `name:${r.teilnehmer_name || ''}`;
}

function statusInfo(row: NachbuchungRow): { label: string; className: string; dot: string } {
  if (row.status === 'beantwortet') {
    return { label: 'Antwort eingereicht', className: 'bg-green-100 text-green-700', dot: 'bg-green-500' };
  }
  const overdue = Date.now() - new Date(row.sent_at).getTime() > 3 * 24 * 60 * 60 * 1000;
  if (overdue) {
    return { label: 'Handlungsbedarf', className: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
  }
  return { label: 'Ausstehend', className: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
}

export function Nachbuchungen() {
  const { addToast } = useToastStore();

  const [teilnehmer, setTeilnehmer] = useState<TeilnehmerOption[]>([]);
  const [dozenten, setDozenten] = useState<DozentOption[]>([]);
  const [rows, setRows] = useState<NachbuchungRow[]>([]);
  const [dozentNameMap, setDozentNameMap] = useState<Record<string, string>>({});

  // Teilnehmer-Suche (Combobox)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeilnehmerId, setSelectedTeilnehmerId] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Lokaler "Teilnehmer erstellen"-Modus (kein DB-Eintrag)
  const [createMode, setCreateMode] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createVorname, setCreateVorname] = useState('');
  const [createNachname, setCreateNachname] = useState('');
  const [createTnNummer, setCreateTnNummer] = useState('');

  const [rechtsgebiet, setRechtsgebiet] = useState('');
  const [dozentId, setDozentId] = useState('');
  const [dozentSearchTerm, setDozentSearchTerm] = useState('');
  const [dozentDropdownOpen, setDozentDropdownOpen] = useState(false);
  const [dozentEmail, setDozentEmail] = useState('');
  const dozentRef = useRef<HTMLDivElement>(null);

  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resendConfirm, setResendConfirm] = useState<NachbuchungRow | null>(null);
  const [viewAnswerParticipantKey, setViewAnswerParticipantKey] = useState<string | null>(null);
  const [viewAnswerRechtsgebiet, setViewAnswerRechtsgebiet] = useState('');

  const query = searchTerm.trim().toLowerCase();
  const filteredTeilnehmer = query
    ? teilnehmer
        .filter((t) => t.name.toLowerCase().includes(query) || (t.tn_nummer || '').toLowerCase().includes(query))
        .slice(0, 8)
    : [];
  const showCreateOption = query !== '' && filteredTeilnehmer.length === 0 && !selectedTeilnehmerId;

  // Klick außerhalb schließt das Dropdown
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (dozentRef.current && !dozentRef.current.contains(e.target as Node)) {
        setDozentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const fetchList = async () => {
    const { data, error } = await supabase
      .from('nachbuchungen')
      .select('id, teilnehmer_id, teilnehmer_name, teilnehmer_tn_nummer, dozent_id, rechtsgebiet, status, sent_at, responded_at, antwort_bedarf, antwort_stunden, antwort_erreichbar, antwort_notiz')
      .order('sent_at', { ascending: false });

    if (error) {
      console.error('Fehler beim Laden der Nachbuchungen:', error);
      return;
    }

    const list = (data || []) as NachbuchungRow[];
    setRows(list);

    const dzIds = [...new Set(list.map((r) => r.dozent_id).filter(Boolean))] as string[];
    const map: Record<string, string> = {};
    if (dzIds.length > 0) {
      const { data: dzData } = await supabase.from('profiles').select('id, full_name').in('id', dzIds);
      (dzData || []).forEach((d) => (map[d.id] = d.full_name));
    }
    setDozentNameMap(map);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [tnRes, dzRes] = await Promise.all([
        supabase.from('teilnehmer').select('id, name, tn_nummer').order('name'),
        supabase
          .from('profiles')
          .select('id, full_name, email, legal_areas')
          .eq('role', 'dozent')
          .eq('is_archived', false)
          .order('full_name'),
      ]);
      if (tnRes.data) setTeilnehmer(tnRes.data as TeilnehmerOption[]);
      if (dzRes.data) setDozenten(dzRes.data as DozentOption[]);
      await fetchList();
      setLoading(false);
    };
    load();
  }, []);

  const filteredDozenten = rechtsgebiet
    ? dozenten.filter((d) => (d.legal_areas || []).includes(rechtsgebiet))
    : dozenten;

  const dozentQuery = dozentSearchTerm.trim().toLowerCase();
  const dozentMatches = dozentQuery
    ? filteredDozenten.filter((d) => d.full_name.toLowerCase().includes(dozentQuery)).slice(0, 8)
    : [];

  const dozentEmailInvalid = !!dozentId && (isPlaceholderEmail(dozentEmail) || dozentEmail.trim() === '');

  const viewAnswerRows = viewAnswerParticipantKey
    ? rows.filter((r) => r.status === 'beantwortet' && participantKey(r) === viewAnswerParticipantKey)
    : [];
  const viewAnswerRechtsgebiete = [...new Set(viewAnswerRows.map((r) => r.rechtsgebiet))];
  const viewAnswerCurrent = viewAnswerRows.find((r) => r.rechtsgebiet === viewAnswerRechtsgebiet) || null;

  const selectTeilnehmer = (t: TeilnehmerOption) => {
    setSelectedTeilnehmerId(t.id);
    setSearchTerm(t.name);
    setDropdownOpen(false);
    setCreateMode(false);
  };

  const selectDozent = (d: DozentOption) => {
    setDozentId(d.id);
    setDozentSearchTerm(d.full_name);
    setDozentEmail(d.email);
    setDozentDropdownOpen(false);
  };

  const startCreateMode = () => {
    const { vorname, nachname } = splitName(searchTerm);
    setCreateName(searchTerm.trim());
    setCreateVorname(vorname);
    setCreateNachname(nachname);
    setCreateTnNummer('');
    setCreateMode(true);
    setDropdownOpen(false);
  };

  const resetForm = () => {
    setSearchTerm('');
    setSelectedTeilnehmerId('');
    setCreateMode(false);
    setCreateName('');
    setCreateVorname('');
    setCreateNachname('');
    setCreateTnNummer('');
    setRechtsgebiet('');
    setDozentId('');
    setDozentSearchTerm('');
    setDozentEmail('');
    setDozentDropdownOpen(false);
    setEditingId(null);
  };

  const startEdit = (row: NachbuchungRow) => {
    setEditingId(row.id);
    setRechtsgebiet(row.rechtsgebiet);
    setDozentId(row.dozent_id || '');
    const dz = dozenten.find((d) => d.id === row.dozent_id);
    setDozentSearchTerm(dz?.full_name || dozentNameMap[row.dozent_id || ''] || '');
    setDozentEmail(dz?.email || '');

    if (row.teilnehmer_id) {
      const t = teilnehmer.find((x) => x.id === row.teilnehmer_id);
      setSelectedTeilnehmerId(row.teilnehmer_id);
      setSearchTerm(t?.name || row.teilnehmer_name || '');
      setCreateMode(false);
    } else {
      const s = splitName(row.teilnehmer_name || '');
      setSelectedTeilnehmerId('');
      setCreateName(row.teilnehmer_name || '');
      setCreateVorname(s.vorname);
      setCreateNachname(s.nachname);
      setCreateTnNummer(row.teilnehmer_tn_nummer || '');
      setCreateMode(true);
      setSearchTerm(row.teilnehmer_name || '');
    }
  };

  const handleDelete = async (row: NachbuchungRow) => {
    if (!window.confirm('Diese Anfrage wirklich löschen?')) return;
    try {
      const { error } = await supabase.functions.invoke('nachbuchung-loeschen', { body: { id: row.id } });
      if (error) throw error;
      addToast('Anfrage gelöscht', 'success');
      await fetchList();
    } catch (err) {
      console.error(err);
      addToast('Fehler beim Löschen', 'error');
    }
  };

  const handleResend = async (row: NachbuchungRow) => {
    try {
      const { error } = await supabase.functions.invoke('nachbuchung-erneut-senden', { body: { id: row.id } });
      if (error) throw error;
      addToast('Anfrage erneut gesendet', 'success');
      await fetchList();
    } catch (err) {
      console.error(err);
      addToast('Fehler beim erneuten Senden', 'error');
    }
  };

  const confirmResend = async () => {
    if (!resendConfirm) return;
    await handleResend(resendConfirm);
    setResendConfirm(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechtsgebiet || !dozentId) {
      addToast('Bitte Rechtsgebiet und Dozent auswählen', 'error');
      return;
    }
    if (dozentEmailInvalid) {
      addToast('Bitte korrekte E-Mail-Adresse des Dozenten eingeben', 'error');
      return;
    }
    const hasExisting = !!selectedTeilnehmerId;
    const hasCreated = createMode && createName.trim() !== '';
    if (!hasExisting && !hasCreated) {
      addToast('Bitte einen Teilnehmer auswählen oder erstellen', 'error');
      return;
    }

    setSending(true);
    try {
      const base = { dozent_id: dozentId, rechtsgebiet, dozent_email: dozentEmail.trim() };
      const body = hasExisting
        ? { ...base, teilnehmer_id: selectedTeilnehmerId }
        : { ...base, teilnehmer_name: createName.trim(), teilnehmer_tn_nummer: createTnNummer.trim() || null };

      if (editingId) {
        const { error } = await supabase.functions.invoke('nachbuchung-aendern', { body: { id: editingId, ...body } });
        if (error) throw error;
        addToast('Anfrage geändert', 'success');
      } else {
        const { error } = await supabase.functions.invoke('nachbuchung-senden', { body });
        if (error) throw error;
        addToast('Nachbuchungs-Anfrage an den Dozenten gesendet', 'success');
      }

      resetForm();
      await fetchList();
    } catch (err) {
      console.error(err);
      addToast('Fehler beim Speichern der Anfrage', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Formular */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookPlus className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-gray-900">
            {editingId ? 'Nachbuchungs-Anfrage bearbeiten' : 'Nachbuchungs-Anfrage erstellen'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Teilnehmer-Combobox */}
          <div ref={comboboxRef} className="relative">
            <label className={labelClass}>Teilnehmer</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedTeilnehmerId('');
                  setCreateMode(false);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                placeholder="Name oder Teilnehmernummer suchen…"
                className={`${inputClass} pl-9`}
              />
            </div>

            {selectedTeilnehmerId && (
              <p className="mt-1 text-xs text-gray-500">
                Ausgewählt:{' '}
                {(() => {
                  const t = teilnehmer.find((x) => x.id === selectedTeilnehmerId);
                  return [t?.name, t?.tn_nummer].filter(Boolean).join(' · ');
                })()}
              </p>
            )}

            {dropdownOpen && query !== '' && !selectedTeilnehmerId && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto">
                {filteredTeilnehmer.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTeilnehmer(t)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2"
                  >
                    <span className="text-sm text-gray-900">{t.name}</span>
                    {t.tn_nummer && <span className="text-xs text-gray-400">{t.tn_nummer}</span>}
                  </button>
                ))}

                {showCreateOption && (
                  <button
                    type="button"
                    onClick={startCreateMode}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary/5 flex items-center gap-2 border-t border-gray-100"
                  >
                    <UserPlus className="h-4 w-4 text-primary" />
                    <span className="text-sm text-primary font-medium">
                      Teilnehmer „{searchTerm.trim()}" erstellen
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Lokaler Erstellen-Modus */}
          {createMode && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Teilnehmer erstellen (ohne Datenbank-Eintrag)
              </p>
              <div>
                <label className={labelClass}>Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCreateName(v);
                    const s = splitName(v);
                    setCreateVorname(s.vorname);
                    setCreateNachname(s.nachname);
                  }}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Vorname</label>
                  <input
                    type="text"
                    value={createVorname}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCreateVorname(v);
                      setCreateName(`${v} ${createNachname}`.trim());
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Nachname</label>
                  <input
                    type="text"
                    value={createNachname}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCreateNachname(v);
                      setCreateName(`${createVorname} ${v}`.trim());
                    }}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Teilnehmernummer (TN)</label>
                <input
                  type="text"
                  value={createTnNummer}
                  onChange={(e) => setCreateTnNummer(e.target.value)}
                  placeholder="z. B. TN0001"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Rechtsgebiet</label>
            <select
              value={rechtsgebiet}
              onChange={(e) => {
                setRechtsgebiet(e.target.value);
                setDozentId('');
                setDozentSearchTerm('');
                setDozentEmail('');
              }}
              className={inputClass}
            >
              <option value="">Rechtsgebiet auswählen…</option>
              {RECHTSGEBIETE.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div ref={dozentRef} className="relative">
            <label className={labelClass}>Dozent</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={dozentSearchTerm}
                onChange={(e) => {
                  setDozentSearchTerm(e.target.value);
                  setDozentId('');
                  setDozentDropdownOpen(true);
                }}
                onFocus={() => setDozentDropdownOpen(true)}
                placeholder={rechtsgebiet ? 'Dozent suchen…' : 'Bitte zuerst Rechtsgebiet wählen'}
                disabled={!rechtsgebiet}
                className={`${inputClass} pl-9 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
              />
            </div>

            {dozentId && (
              <div className="mt-2">
                <label className={labelClass}>E-Mail-Adresse</label>
                <input
                  type="email"
                  value={dozentEmail}
                  onChange={(e) => setDozentEmail(e.target.value)}
                  className={`${inputClass} ${dozentEmailInvalid ? 'border-red-400 focus:ring-red-400' : ''}`}
                />
                {isPlaceholderEmail(dozentEmail) && (
                  <p className="mt-1 text-xs text-red-600">
                    Dies ist eine Platzhalter-Adresse. Bitte korrekte E-Mail-Adresse eintragen, bevor du abschickst.
                  </p>
                )}
              </div>
            )}

            {dozentDropdownOpen && dozentQuery !== '' && !dozentId && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto">
                {dozentMatches.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => selectDozent(d)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2"
                  >
                    <span className="text-sm text-gray-900">{d.full_name}</span>
                    <span className="text-xs text-gray-400">{d.email}</span>
                  </button>
                ))}
                {dozentMatches.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-400">Kein Dozent gefunden</div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={sending || dozentEmailInvalid}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {editingId ? 'Speichern' : 'Abschicken'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50"
              >
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Ampel-Liste */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900">Gesendete Anfragen</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Gelb = ausstehend · Rot = Handlungsbedarf (nach 3 Tagen) · Grün = Antwort eingereicht
            </p>
          </div>
          <button
            onClick={() => fetchList()}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary"
            title="Aktualisieren"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Lädt…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-gray-500">Noch keine Anfragen gesendet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Teilnehmer</th>
                  <th className="px-4 py-3">Dozent</th>
                  <th className="px-4 py-3">Rechtsgebiet</th>
                  <th className="px-4 py-3">Gesendet</th>
                  <th className="px-4 py-3">Beantwortet</th>
                  <th className="px-4 py-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const info = statusInfo(r);
                  const teilnehmerLabel = [r.teilnehmer_name, r.teilnehmer_tn_nummer].filter(Boolean).join(' · ');
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        {r.status === 'beantwortet' ? (
                          <button
                            type="button"
                            onClick={() => {
                            setViewAnswerParticipantKey(participantKey(r));
                            setViewAnswerRechtsgebiet(r.rechtsgebiet);
                          }}
                            title="Antwort ansehen"
                            className="group flex flex-col items-start"
                          >
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${info.className} group-hover:ring-2 group-hover:ring-primary/40`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
                              {info.label}
                            </span>
                            <span className="text-xs text-primary mt-1">Antwort ansehen</span>
                          </button>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${info.className}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
                            {info.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{teilnehmerLabel || '–'}</td>
                      <td className="px-4 py-3 text-gray-900">{dozentNameMap[r.dozent_id || ''] || '–'}</td>
                      <td className="px-4 py-3 text-gray-600">{r.rechtsgebiet}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(r.sent_at).toLocaleDateString('de-DE')}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.responded_at ? new Date(r.responded_at).toLocaleDateString('de-DE') : '–'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            title="Ändern"
                            className="p-1.5 rounded-md text-gray-400 hover:text-primary hover:bg-gray-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResendConfirm(r)}
                            title={r.status === 'ausstehend' ? 'Erneut senden' : 'Bereits beantwortet'}
                            disabled={r.status !== 'ausstehend'}
                            className="p-1.5 rounded-md text-gray-400 hover:text-primary hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            title="Löschen"
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-5">
            <h4 className="font-semibold text-gray-900 mb-2">Erneut senden?</h4>
            <p className="text-sm text-gray-600 mb-4">
              Die Anfrage für{' '}
              <strong>{[resendConfirm.teilnehmer_name, resendConfirm.teilnehmer_tn_nummer].filter(Boolean).join(' · ') || '–'}</strong>{' '}
              wird erneut an den Dozenten gesendet. Der bisherige Link wird dabei ungültig.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResendConfirm(null)}
                className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmResend}
                className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                Erneut senden
              </button>
            </div>
          </div>
        </div>
      )}
    {viewAnswerCurrent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-5">
            <h4 className="font-semibold text-gray-900 mb-4">Antwort des Dozenten</h4>

            {viewAnswerRechtsgebiete.length > 1 && (
              <div className="mb-4">
                <label className={labelClass}>Rechtsgebiet</label>
                <select
                  value={viewAnswerRechtsgebiet}
                  onChange={(e) => setViewAnswerRechtsgebiet(e.target.value)}
                  className={inputClass}
                >
                  {viewAnswerRechtsgebiete.map((rg) => (
                    <option key={rg} value={rg}>
                      {rg}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2 text-sm mb-5">
              <p>
                <span className="text-gray-500">Teilnehmer:</span>{' '}
                <span className="text-gray-900 font-medium">
                  {[viewAnswerCurrent.teilnehmer_name, viewAnswerCurrent.teilnehmer_tn_nummer].filter(Boolean).join(' · ') || '–'}
                </span>
              </p>
              <p>
                <span className="text-gray-500">Dozent:</span>{' '}
                <span className="text-gray-900 font-medium">{dozentNameMap[viewAnswerCurrent.dozent_id || ''] || '–'}</span>
              </p>
              <p>
                <span className="text-gray-500">Rechtsgebiet:</span>{' '}
                <span className="text-gray-900 font-medium">{viewAnswerCurrent.rechtsgebiet}</span>
              </p>
              <p>
                <span className="text-gray-500">Nachbuchungsbedarf:</span>{' '}
                <span className="text-gray-900 font-medium">{viewAnswerCurrent.antwort_bedarf ? 'Ja' : 'Nein'}</span>
              </p>
              {viewAnswerCurrent.antwort_bedarf && viewAnswerCurrent.antwort_stunden !== null && (
                <p>
                  <span className="text-gray-500">Zusatzstunden:</span>{' '}
                  <span className="text-gray-900 font-medium">{viewAnswerCurrent.antwort_stunden}</span>
                </p>
              )}
              {viewAnswerCurrent.antwort_bedarf && viewAnswerCurrent.antwort_erreichbar && (
                <p>
                  <span className="text-gray-500">Erreichbarkeit:</span>{' '}
                  <span className="text-gray-900 font-medium">{viewAnswerCurrent.antwort_erreichbar}</span>
                </p>
              )}
              {viewAnswerCurrent.antwort_notiz && (
                <div>
                  <span className="text-gray-500">Notiz:</span>
                  <p className="text-gray-900 mt-1 whitespace-pre-wrap">{viewAnswerCurrent.antwort_notiz}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setViewAnswerParticipantKey(null);
                  setViewAnswerRechtsgebiet('');
                }}
                className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}