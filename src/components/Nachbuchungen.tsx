import { useEffect, useRef, useState } from 'react';
import { BookPlus, Loader2, Send, RefreshCw, Search, UserPlus, Pencil, Trash2, Bell, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';

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
  reminder_sent_at: string | null;
  antwort_bedarf: boolean | null;
  antwort_stunden: number | null;
  antwort_erreichbar: string | null;
  antwort_grund_lernziel: string | null;
  antwort_notiz: string | null;
  nachbuchung_zustande: boolean | null;
  nachbuchung_stunden: number | null;
  nachbuchung_provision: number | null;
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

interface NotifyRecipient {
  id: string;
  email: string;
  name: string | null;
  notify_send: boolean;
  notify_response: boolean;
  notify_reminder: boolean;
}

const NOTIFY_FLAGS = [
  { key: 'notify_send', label: 'Anfrage versendet' },
  { key: 'notify_response', label: 'Rückmeldung Dozent' },
  { key: 'notify_reminder', label: 'Erinnerung (72 h)' },
] as const;

export function Nachbuchungen() {
  const { addToast } = useToastStore();
  const isAdmin = useAuthStore((s) => s.isAdmin);

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
  const formRef = useRef<HTMLDivElement>(null);

  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resendRows, setResendRows] = useState<NachbuchungRow[] | null>(null);
  const [entrySelect, setEntrySelect] = useState<{ action: 'edit' | 'resend' | 'delete'; rows: NachbuchungRow[]; selectedId: string } | null>(null);
  const [viewAnswerParticipantKey, setViewAnswerParticipantKey] = useState<string | null>(null);
  const [viewAnswerRechtsgebiet, setViewAnswerRechtsgebiet] = useState('');
  const [zustandeSelection, setZustandeSelection] = useState<'offen' | 'ja' | 'nein'>('offen');
  const [zustandeStunden, setZustandeStunden] = useState('');
  const [zustandeProvision, setZustandeProvision] = useState('');

  // Benachrichtigungs-Empfänger (nur Admin)
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyRecipients, setNotifyRecipients] = useState<NotifyRecipient[]>([]);
  const [notifySaving, setNotifySaving] = useState(false);
  const [newNotifyName, setNewNotifyName] = useState('');
  const [newNotifyEmail, setNewNotifyEmail] = useState('');

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
      .select('id, teilnehmer_id, teilnehmer_name, teilnehmer_tn_nummer, dozent_id, rechtsgebiet, status, sent_at, responded_at, reminder_sent_at, antwort_bedarf, antwort_stunden, antwort_erreichbar, antwort_grund_lernziel, antwort_notiz, nachbuchung_zustande, nachbuchung_stunden, nachbuchung_provision')
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

  const fetchNotifyRecipients = async () => {
    const { data, error } = await supabase
      .from('nachbuchung_notification_recipients')
      .select('id, email, name, notify_send, notify_response, notify_reminder')
      .order('email');
    if (error) {
      console.error('Fehler beim Laden der Empfänger:', error);
      return;
    }
    setNotifyRecipients((data || []) as NotifyRecipient[]);
  };

  useEffect(() => {
    if (isAdmin) fetchNotifyRecipients();
  }, [isAdmin]);

  const toggleNotifyFlag = async (recipient: NotifyRecipient, flag: keyof Omit<NotifyRecipient, 'id' | 'email' | 'name'>) => {
    const next = !recipient[flag];
    setNotifyRecipients((prev) => prev.map((r) => (r.id === recipient.id ? { ...r, [flag]: next } : r)));
    const { error } = await supabase
      .from('nachbuchung_notification_recipients')
      .update({ [flag]: next })
      .eq('id', recipient.id);
    if (error) {
      setNotifyRecipients((prev) => prev.map((r) => (r.id === recipient.id ? { ...r, [flag]: !next } : r)));
      addToast('Einstellung konnte nicht gespeichert werden', 'error');
    }
  };

  const addNotifyRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newNotifyEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      addToast('Bitte eine gültige E-Mail-Adresse eingeben', 'error');
      return;
    }
    setNotifySaving(true);
    const { error } = await supabase
      .from('nachbuchung_notification_recipients')
      .insert({ email, name: newNotifyName.trim() || null });
    setNotifySaving(false);
    if (error) {
      addToast(error.code === '23505' ? 'Diese E-Mail ist bereits eingetragen' : 'Empfänger konnte nicht hinzugefügt werden', 'error');
      return;
    }
    setNewNotifyName('');
    setNewNotifyEmail('');
    addToast('Empfänger hinzugefügt', 'success');
    await fetchNotifyRecipients();
  };

  const removeNotifyRecipient = async (recipient: NotifyRecipient) => {
    const { error } = await supabase
      .from('nachbuchung_notification_recipients')
      .delete()
      .eq('id', recipient.id);
    if (error) {
      addToast('Empfänger konnte nicht entfernt werden', 'error');
      return;
    }
    setNotifyRecipients((prev) => prev.filter((r) => r.id !== recipient.id));
    addToast('Empfänger entfernt', 'success');
  };

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

  const activeRows = rows.filter((r) => r.nachbuchung_zustande === null);
  const nachbuchungenRows = rows.filter((r) => r.nachbuchung_zustande === true);
  const keineNachbuchungenRows = rows.filter((r) => r.nachbuchung_zustande === false);

  const groupedRows = (() => {
    const map = new Map<string, NachbuchungRow[]>();
    activeRows.forEach((r) => {
      const k = participantKey(r);
      const arr = map.get(k);
      if (arr) arr.push(r);
      else map.set(k, [r]);
    });
    return [...map.values()];
  })();

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
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const deleteRequest = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke('nachbuchung-loeschen', { body: { id } });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleDelete = async (rowsToDelete: NachbuchungRow[]) => {
    const label = [rowsToDelete[0]?.teilnehmer_name, rowsToDelete[0]?.teilnehmer_tn_nummer].filter(Boolean).join(' · ') || '–';
    const msg = rowsToDelete.length === 1
      ? `Anfrage im Fachgebiet ${rowsToDelete[0].rechtsgebiet} wirklich löschen?`
      : `Alle ${rowsToDelete.length} Anfragen für ${label} wirklich löschen?`;
    if (!window.confirm(msg)) return;

    let ok = 0;
    for (const r of rowsToDelete) {
      if (await deleteRequest(r.id)) ok++;
    }
    addToast(`${ok} Anfrage(n) gelöscht`, 'success');
    await fetchList();
  };

  const resendRequest = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke('nachbuchung-erneut-senden', { body: { id } });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const confirmResend = async () => {
    if (!resendRows) return;
    let ok = 0;
    for (const r of resendRows) {
      if (await resendRequest(r.id)) ok++;
    }
    setResendRows(null);
    addToast(`${ok} Anfrage(n) erneut gesendet`, 'success');
    await fetchList();
  };

  const applyEntryAction = (action: 'edit' | 'resend' | 'delete', row: NachbuchungRow) => {
    if (action === 'edit') startEdit(row);
    else if (action === 'resend') setResendRows([row]);
    else if (action === 'delete') handleDelete([row]);
  };

  const openEntryAction = (action: 'edit' | 'resend' | 'delete', gRows: NachbuchungRow[]) => {
    const candidates = gRows;
    if (candidates.length === 0) return;
    if (candidates.length === 1) {
      applyEntryAction(action, candidates[0]);
      return;
    }
    setEntrySelect({ action, rows: candidates, selectedId: candidates[0].id });
  };

  const confirmEntrySelect = () => {
    if (!entrySelect) return;
    const row = entrySelect.rows.find((r) => r.id === entrySelect.selectedId);
    if (row) applyEntryAction(entrySelect.action, row);
    setEntrySelect(null);
  };

  const saveZustande = async () => {
    if (!viewAnswerCurrent) return;
    const zustande = zustandeSelection === 'ja' ? true : zustandeSelection === 'nein' ? false : null;
    try {
      const { error } = await supabase.functions.invoke('nachbuchung-zustande', {
        body: {
          id: viewAnswerCurrent.id,
          zustande,
          stunden: zustandeStunden,
          provision: zustandeProvision,
        },
      });
      if (error) throw error;

      if (zustande !== null) {
        const { error: abschlussError } = await supabase.functions.invoke('nachbuchung-abschluss', {
          body: { id: viewAnswerCurrent.id },
        });
        if (abschlussError) console.error('Abschluss-Mail fehlgeschlagen:', abschlussError);
      }

      addToast('Nachbuchung vermerkt', 'success');
      await fetchList();
    } catch (err) {
      console.error(err);
      addToast('Fehler beim Speichern des Vermerks', 'error');
    }
  };

  const openAnswerForRow = (r: NachbuchungRow) => {
    setViewAnswerParticipantKey(participantKey(r));
    setViewAnswerRechtsgebiet(r.rechtsgebiet);
    setZustandeSelection(
      r.nachbuchung_zustande === true ? 'ja' : r.nachbuchung_zustande === false ? 'nein' : 'offen'
    );
    setZustandeStunden(r.nachbuchung_stunden != null ? String(r.nachbuchung_stunden) : '');
    setZustandeProvision(r.nachbuchung_provision != null ? String(r.nachbuchung_provision) : '');
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
      <div ref={formRef} className={`bg-white rounded-xl shadow-sm border p-5 sm:p-6 ${editingId ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100'}`}>
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

      {/* Benachrichtigungs-Empfänger (nur Admin) */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            type="button"
            onClick={() => setNotifyOpen((o) => !o)}
            className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">E-Mail-Benachrichtigungen</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Zusätzliche Empfänger für Nachbuchungs-Ereignisse. Admins werden bei allen Ereignissen immer benachrichtigt.
                </p>
              </div>
            </div>
            {notifyOpen ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>

          {notifyOpen && (
            <div className="px-4 sm:px-5 pb-5 border-t border-gray-100">
              <form onSubmit={addNotifyRecipient} className="flex flex-col sm:flex-row gap-2 mt-4">
                <input
                  type="text"
                  value={newNotifyName}
                  onChange={(e) => setNewNotifyName(e.target.value)}
                  placeholder="Name (optional)"
                  className={`${inputClass} sm:w-56`}
                />
                <input
                  type="email"
                  value={newNotifyEmail}
                  onChange={(e) => setNewNotifyEmail(e.target.value)}
                  placeholder="E-Mail-Adresse"
                  required
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="submit"
                  disabled={notifySaving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {notifySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Hinzufügen
                </button>
              </form>

              {notifyRecipients.length > 0 ? (
                <div className="overflow-x-auto mt-4">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Empfänger</th>
                        {NOTIFY_FLAGS.map((f) => (
                          <th key={f.key} className="px-4 py-3 text-center">{f.label}</th>
                        ))}
                        <th className="px-4 py-3 text-right">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {notifyRecipients.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-3">
                            <div className="text-gray-900">{r.name || r.email}</div>
                            {r.name && <div className="text-xs text-gray-500">{r.email}</div>}
                          </td>
                          {NOTIFY_FLAGS.map((f) => (
                            <td key={f.key} className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={r[f.key]}
                                onChange={() => toggleNotifyFlag(r, f.key)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                              />
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeNotifyRecipient(r)}
                              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                              title="Entfernen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 mt-4">
                  Noch keine zusätzlichen Empfänger eingetragen.
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
                {groupedRows.map((gRows) => {
                  const r0 = gRows[0];
                  const allAnswered = gRows.every((r) => r.status === 'beantwortet');
                  const anyAnswered = gRows.some((r) => r.status === 'beantwortet');

                  const teilnehmerLabel = [r0.teilnehmer_name, r0.teilnehmer_tn_nummer].filter(Boolean).join(' · ');
                  const rechtsgebiete = [...new Set(gRows.map((r) => r.rechtsgebiet))].join(', ');
                  const dozenten = [...new Set(gRows.map((r) => dozentNameMap[r.dozent_id || ''] || '–'))].join(', ');
                  const sentAt = gRows.reduce((max, r) => (r.sent_at > max ? r.sent_at : max), '');
                  const respondedAt = gRows.reduce((max, r) => (r.responded_at && r.responded_at > max ? r.responded_at : max), '');

                  let info: { label: string; className: string; dot: string };
                  if (allAnswered) {
                    info = { label: 'Antwort eingereicht', className: 'bg-green-100 text-green-700', dot: 'bg-green-500' };
                  } else if (anyAnswered) {
                    info = { label: 'Teilweise beantwortet', className: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
                  } else {
                    const anyOverdueAfterReminder = gRows.some(
                      (r) => r.reminder_sent_at && Date.now() - new Date(r.reminder_sent_at).getTime() > 24 * 60 * 60 * 1000
                    );
                    info = anyOverdueAfterReminder
                      ? { label: 'Handlungsbedarf', className: 'bg-red-100 text-red-700', dot: 'bg-red-500' }
                      : { label: 'Ausstehend', className: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
                  }

                  return (
                    <tr key={r0.id}>
                      <td className="px-4 py-3">
                        {anyAnswered ? (
                          <button
                            type="button"
                            onClick={() => {
                              setViewAnswerParticipantKey(participantKey(r0));
                              const firstAnswered = gRows.find((r) => r.status === 'beantwortet');
                              setViewAnswerRechtsgebiet(firstAnswered ? firstAnswered.rechtsgebiet : r0.rechtsgebiet);
                              setZustandeSelection(
                                firstAnswered?.nachbuchung_zustande === true
                                  ? 'ja'
                                  : firstAnswered?.nachbuchung_zustande === false
                                    ? 'nein'
                                    : 'offen'
                              );
                              setZustandeStunden(firstAnswered?.nachbuchung_stunden != null ? String(firstAnswered.nachbuchung_stunden) : '');
                              setZustandeProvision(firstAnswered?.nachbuchung_provision != null ? String(firstAnswered.nachbuchung_provision) : '');
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
                      <td className="px-4 py-3 text-gray-900">{dozenten}</td>
                      <td className="px-4 py-3 text-gray-600">{rechtsgebiete}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(sentAt).toLocaleDateString('de-DE')}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {respondedAt ? new Date(respondedAt).toLocaleDateString('de-DE') : '–'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEntryAction('edit', gRows)}
                            title="Ändern"
                            className="p-1.5 rounded-md text-gray-400 hover:text-primary hover:bg-gray-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEntryAction('resend', gRows)}
                            title="Erneut senden"
                            className="p-1.5 rounded-md text-gray-400 hover:text-primary hover:bg-gray-50"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEntryAction('delete', gRows)}
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

      {/* Abgeschlossen (dritte Ebene) */}
      {(nachbuchungenRows.length > 0 || keineNachbuchungenRows.length > 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Abgeschlossen</h3>
          </div>

          <div className="p-4 sm:p-5 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-green-700 mb-3">Nachbuchungen</h4>
            {nachbuchungenRows.length === 0 ? (
              <p className="text-sm text-gray-500">Keine</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Teilnehmer</th>
                      <th className="px-4 py-3">Dozent</th>
                      <th className="px-4 py-3">Rechtsgebiet</th>
                      <th className="px-4 py-3">Stunden</th>
                      <th className="px-4 py-3">Provision</th>
                      <th className="px-4 py-3 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {nachbuchungenRows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-gray-900">
                          {[r.teilnehmer_name, r.teilnehmer_tn_nummer].filter(Boolean).join(' · ') || '–'}
                        </td>
                        <td className="px-4 py-3 text-gray-900">{dozentNameMap[r.dozent_id || ''] || '–'}</td>
                        <td className="px-4 py-3 text-gray-600">{r.rechtsgebiet}</td>
                        <td className="px-4 py-3 text-gray-600">{r.nachbuchung_stunden != null ? r.nachbuchung_stunden : '–'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {r.nachbuchung_provision != null ? `${r.nachbuchung_provision} €` : '–'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openAnswerForRow(r)}
                              title="Bearbeiten"
                              className="p-1.5 rounded-md text-gray-400 hover:text-primary hover:bg-gray-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5">
            <h4 className="text-sm font-semibold text-gray-500 mb-3">Keine Nachbuchungen</h4>
            {keineNachbuchungenRows.length === 0 ? (
              <p className="text-sm text-gray-500">Keine</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Teilnehmer</th>
                      <th className="px-4 py-3">Dozent</th>
                      <th className="px-4 py-3">Rechtsgebiet</th>
                      <th className="px-4 py-3 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {keineNachbuchungenRows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-gray-900">
                          {[r.teilnehmer_name, r.teilnehmer_tn_nummer].filter(Boolean).join(' · ') || '–'}
                        </td>
                        <td className="px-4 py-3 text-gray-900">{dozentNameMap[r.dozent_id || ''] || '–'}</td>
                        <td className="px-4 py-3 text-gray-600">{r.rechtsgebiet}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openAnswerForRow(r)}
                              title="Bearbeiten"
                              className="p-1.5 rounded-md text-gray-400 hover:text-primary hover:bg-gray-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {resendRows && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-5">
            <h4 className="font-semibold text-gray-900 mb-2">Erneut senden?</h4>
            <p className="text-sm text-gray-600 mb-4">
              {resendRows.length === 1 ? (
                <>
                  Die Anfrage für{' '}
                  <strong>{[resendRows[0].teilnehmer_name, resendRows[0].teilnehmer_tn_nummer].filter(Boolean).join(' · ') || '–'}</strong>{' '}
                  im Fachgebiet <strong>{resendRows[0].rechtsgebiet}</strong> wird erneut an den Dozenten gesendet. Der bisherige Link wird dabei ungültig.
                </>
              ) : (
                <>
                  <strong>{resendRows.length} ausstehende Anfragen</strong> für{' '}
                  <strong>{[resendRows[0].teilnehmer_name, resendRows[0].teilnehmer_tn_nummer].filter(Boolean).join(' · ') || '–'}</strong>{' '}
                  werden erneut an den Dozenten gesendet. Die bisherigen Links werden dabei ungültig.
                </>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResendRows(null)}
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
                  onChange={(e) => {
                    const rg = e.target.value;
                    setViewAnswerRechtsgebiet(rg);
                    const rowForRg = viewAnswerRows.find((r) => r.rechtsgebiet === rg);
                    setZustandeSelection(
                      rowForRg?.nachbuchung_zustande === true
                        ? 'ja'
                        : rowForRg?.nachbuchung_zustande === false
                          ? 'nein'
                          : 'offen'
                    );
                    setZustandeStunden(rowForRg?.nachbuchung_stunden != null ? String(rowForRg.nachbuchung_stunden) : '');
                    setZustandeProvision(rowForRg?.nachbuchung_provision != null ? String(rowForRg.nachbuchung_provision) : '');
                  }}
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
              {viewAnswerCurrent.antwort_bedarf && viewAnswerCurrent.antwort_grund_lernziel && (
                <div>
                  <span className="text-gray-500">Grund / Lernziel:</span>
                  <p className="text-gray-900 mt-1 whitespace-pre-wrap">{viewAnswerCurrent.antwort_grund_lernziel}</p>
                </div>
              )}
              {viewAnswerCurrent.antwort_notiz && (
                <div>
                  <span className="text-gray-500">Notiz:</span>
                  <p className="text-gray-900 mt-1 whitespace-pre-wrap">{viewAnswerCurrent.antwort_notiz}</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 mt-2">
              <span className={labelClass}>Nachbuchung zustande gekommen?</span>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(
                  [
                    { value: 'offen', label: 'Offen' },
                    { value: 'nein', label: 'Nein' },
                    { value: 'ja', label: 'Ja' },
                  ] as { value: 'offen' | 'ja' | 'nein'; label: string }[]
                ).map((o) => (
                  <label
                    key={o.value}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm transition-colors ${
                      zustandeSelection === o.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="zustande"
                      value={o.value}
                      checked={zustandeSelection === o.value}
                      onChange={() => setZustandeSelection(o.value)}
                      className="h-4 w-4 text-primary focus:ring-primary"
                    />
                    {o.label}
                  </label>
                ))}
              </div>

              {zustandeSelection === 'ja' && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelClass}>Stunden</label>
                    <input
                      type="number"
                      min="0"
                      value={zustandeStunden}
                      onChange={(e) => setZustandeStunden(e.target.value)}
                      placeholder="z. B. 10"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Provision (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={zustandeProvision}
                      onChange={(e) => setZustandeProvision(e.target.value)}
                      placeholder="z. B. 150"
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={saveZustande}
                className="w-full px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                Vermerk speichern
              </button>
            </div>

            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={() => {
                  setViewAnswerParticipantKey(null);
                  setViewAnswerRechtsgebiet('');
                }}
                className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {entrySelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-5">
            <h4 className="font-semibold text-gray-900 mb-3">
              {entrySelect.action === 'edit'
                ? 'Eintrag zum Ändern auswählen'
                : entrySelect.action === 'resend'
                  ? 'Eintrag zum erneuten Senden auswählen'
                  : 'Eintrag zum Löschen auswählen'}
            </h4>
            <label className={labelClass}>Rechtsgebiet</label>
            <select
              value={entrySelect.selectedId}
              onChange={(e) => setEntrySelect({ ...entrySelect, selectedId: e.target.value })}
              className={inputClass}
            >
              {entrySelect.rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.rechtsgebiet}
                  {r.status === 'beantwortet' ? ' (beantwortet)' : ' (ausstehend)'}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setEntrySelect(null)}
                className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmEntrySelect}
                className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                Weiter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}