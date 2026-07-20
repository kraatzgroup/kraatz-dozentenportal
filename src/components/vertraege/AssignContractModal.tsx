import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Loader2, FileText, UserRound, Unlink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../store/toastStore';

interface TeilnehmerRow {
  id: string;
  name: string;
  tn_nummer?: string | null;
  email?: string | null;
}

interface ContractRow {
  id: string;
  contract_number: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
}

interface Props {
  documentId: string;
  documentTitle: string;
  currentContractId?: string | null;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignContractModal({
  documentId,
  documentTitle,
  currentContractId,
  onClose,
  onAssigned,
}: Props) {
  const { addToast } = useToastStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TeilnehmerRow[]>([]);
  const [searching, setSearching] = useState(false);

  // Contract numbers per participant (for search result preview)
  const [contractNumbers, setContractNumbers] = useState<Record<string, string[]>>({});

  const [selectedTeilnehmer, setSelectedTeilnehmer] = useState<TeilnehmerRow | null>(null);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [unassigning, setUnassigning] = useState(false);

  // Which document ids are assigned to each contract (of the selected participant)
  const [assignedDocsByContract, setAssignedDocsByContract] = useState<Record<string, string[]>>({});
  // Where THIS document is currently assigned (tracked locally so toggling is live)
  const [currentDocContractId, setCurrentDocContractId] = useState<string | null>(currentContractId ?? null);

  // Debounced participant search
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('teilnehmer')
        .select('id, name, tn_nummer, email')
        .or(`name.ilike.%${term}%,tn_nummer.ilike.%${term}%,email.ilike.%${term}%`)
        .order('name', { ascending: true })
        .limit(20);
      if (error) {
        console.error(error);
        addToast('Fehler bei der Teilnehmersuche', 'error');
      } else {
        const rows = (data || []) as TeilnehmerRow[];
        setResults(rows);
        // Load contract numbers for the found participants (preview)
        if (rows.length) {
          const ids = rows.map((r) => r.id);
          const { data: cs } = await supabase
            .from('contracts')
            .select('teilnehmer_id, contract_number')
            .in('teilnehmer_id', ids);
          const map: Record<string, string[]> = {};
          (cs || []).forEach((c: any) => {
            (map[c.teilnehmer_id] ||= []).push(c.contract_number);
          });
          setContractNumbers(map);
        } else {
          setContractNumbers({});
        }
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, addToast]);

  const loadContracts = useCallback(
    async (teilnehmer: TeilnehmerRow) => {
      setSelectedTeilnehmer(teilnehmer);
      setLoadingContracts(true);
      const { data, error } = await supabase
        .from('contracts')
        .select('id, contract_number, start_date, end_date, status')
        .eq('teilnehmer_id', teilnehmer.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error(error);
        addToast('Fehler beim Laden der Verträge', 'error');
        setContracts([]);
      } else {
        const rows = (data || []) as ContractRow[];
        setContracts(rows);
        // Which documents are already assigned to these contracts?
        if (rows.length) {
          const ids = rows.map((r) => r.id);
          const { data: docs } = await supabase
            .from('signed_documents')
            .select('id, contract_id')
            .in('contract_id', ids);
          const map: Record<string, string[]> = {};
          (docs || []).forEach((d: any) => {
            if (d.contract_id) (map[d.contract_id] ||= []).push(d.id);
          });
          setAssignedDocsByContract(map);
        } else {
          setAssignedDocsByContract({});
        }
      }
      setLoadingContracts(false);
    },
    [addToast]
  );

  const assign = async (contract: ContractRow) => {
    if (!selectedTeilnehmer) return;
    setAssigningId(contract.id);
    try {
      const { error } = await supabase
        .from('signed_documents')
        .update({ contract_id: contract.id, teilnehmer_id: selectedTeilnehmer.id })
        .eq('id', documentId);
      if (error) throw error;
      addToast(`Dokument dem Vertrag ${contract.contract_number} zugeordnet`, 'success');
      // Update local state so the UI reflects the change without closing
      setCurrentDocContractId(contract.id);
      setAssignedDocsByContract((prev) => {
        const next: Record<string, string[]> = {};
        Object.keys(prev).forEach((cid) => {
          next[cid] = prev[cid].filter((id) => id !== documentId);
        });
        next[contract.id] = [...(next[contract.id] || []), documentId];
        return next;
      });
      onAssigned();
    } catch (e) {
      console.error(e);
      addToast('Fehler beim Zuordnen', 'error');
    } finally {
      setAssigningId(null);
    }
  };

  const unassign = async () => {
    setUnassigning(true);
    try {
      const { error } = await supabase
        .from('signed_documents')
        .update({ contract_id: null, teilnehmer_id: null })
        .eq('id', documentId);
      if (error) throw error;
      addToast('Zuordnung getrennt', 'success');
      setCurrentDocContractId(null);
      setAssignedDocsByContract((prev) => {
        const next: Record<string, string[]> = {};
        Object.keys(prev).forEach((cid) => {
          next[cid] = prev[cid].filter((id) => id !== documentId);
        });
        return next;
      });
      onAssigned();
    } catch (e) {
      console.error(e);
      addToast('Fehler beim Trennen der Zuordnung', 'error');
    } finally {
      setUnassigning(false);
    }
  };

  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900">Vertrag zuordnen</h2>
            <p className="text-xs text-gray-500 truncate">{documentTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {!selectedTeilnehmer ? (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Teilnehmer suchen (Name, TN-Nummer, E-Mail)…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {searching ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : query.trim().length < 2 ? (
                <p className="text-sm text-gray-400 text-center py-6">Mindestens 2 Zeichen eingeben.</p>
              ) : results.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Keine Teilnehmer gefunden.</p>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden">
                  {results.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => loadContracts(t)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <UserRound className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {[t.tn_nummer, t.email].filter(Boolean).join(' · ')}
                        </p>
                        {contractNumbers[t.id]?.length > 0 && (
                          <p className="text-xs text-gray-400 truncate">
                            Verträge: {contractNumbers[t.id].join(', ')}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserRound className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedTeilnehmer.name}</p>
                    <p className="text-xs text-gray-500">
                      {[selectedTeilnehmer.tn_nummer, selectedTeilnehmer.email].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedTeilnehmer(null);
                    setContracts([]);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Andere Person
                </button>
              </div>

              <p className="text-xs font-medium text-gray-500">Verträge</p>

              {loadingContracts ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : contracts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  Keine Verträge für diesen Teilnehmer.
                </p>
              ) : (
                <div className="space-y-2">
                  {contracts.map((c) => {
                    // Is THIS document currently assigned to this contract?
                    const isCurrentDoc = currentDocContractId === c.id;
                    // Is a DIFFERENT document already assigned to this contract?
                    const otherDocAssigned = (assignedDocsByContract[c.id] || []).some(
                      (id) => id !== documentId
                    );
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center gap-3 p-3 border rounded-md ${
                          isCurrentDoc
                            ? 'border-primary bg-primary/5'
                            : otherDocAssigned
                            ? 'border-gray-200 bg-gray-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{c.contract_number}</p>
                          <p className="text-xs text-gray-500">
                            {fmtDate(c.start_date)} – {fmtDate(c.end_date)}
                            {c.status ? ` · ${c.status}` : ''}
                          </p>
                          {otherDocAssigned && !isCurrentDoc && (
                            <p className="text-xs text-amber-600 mt-0.5">Bereits ein Dokument zugeordnet</p>
                          )}
                        </div>
                        {isCurrentDoc ? (
                          <button
                            onClick={unassign}
                            disabled={unassigning}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {unassigning ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Unlink className="w-4 h-4" /> Trennen
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => assign(c)}
                            disabled={assigningId === c.id || otherDocAssigned}
                            title={otherDocAssigned ? 'Diesem Vertrag ist bereits ein Dokument zugeordnet' : undefined}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {assigningId === c.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Zuordnen'
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
