import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Upload, PenTool, Download, Trash2, Loader2, CheckCircle, Clock, UserRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { ContractSignEditor, SignedDocumentRow } from './ContractSignEditor';
import { AssignContractModal } from './AssignContractModal';

export function VertraegeManager() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<SignedDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editorDoc, setEditorDoc] = useState<SignedDocumentRow | null>(null);
  const [assignDoc, setAssignDoc] = useState<SignedDocumentRow | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('signed_documents')
      .select(
        'id, title, original_file_path, signed_file_path, status, created_at, contract_id, teilnehmer_id, contract:contract_id(contract_number), teilnehmer:teilnehmer_id(name, tn_nummer)'
      )
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      addToast('Fehler beim Laden der Verträge', 'error');
    } else {
      // Supabase types nested relations as arrays; normalize to single objects
      const normalized = (data || []).map((d: any) => ({
        ...d,
        contract: Array.isArray(d.contract) ? d.contract[0] ?? null : d.contract ?? null,
        teilnehmer: Array.isArray(d.teilnehmer) ? d.teilnehmer[0] ?? null : d.teilnehmer ?? null,
      }));
      setDocuments(normalized as SignedDocumentRow[]);
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file || file.type !== 'application/pdf') {
        addToast('Bitte nur PDF-Dateien hochladen', 'error');
        return;
      }
      if (!user) return;
      setUploading(true);
      try {
        const title = file.name.replace(/\.pdf$/i, '');
        const path = `originale/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: upErr } = await supabase.storage
          .from('signed-documents')
          .upload(path, file, { contentType: 'application/pdf', upsert: true });
        if (upErr) throw upErr;

        const { error: dbErr } = await supabase.from('signed_documents').insert({
          uploaded_by: user.id,
          title,
          original_file_path: path,
          status: 'draft',
        });
        if (dbErr) throw dbErr;

        addToast('Vertrag hochgeladen', 'success');
        fetchDocuments();
      } catch (e) {
        console.error(e);
        addToast('Fehler beim Hochladen', 'error');
      } finally {
        setUploading(false);
      }
    },
    [user, addToast, fetchDocuments]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const downloadSigned = async (docRow: SignedDocumentRow) => {
    if (!docRow.signed_file_path) return;
    const { data, error } = await supabase.storage
      .from('signed-documents')
      .download(docRow.signed_file_path);
    if (error || !data) {
      addToast('Fehler beim Download', 'error');
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docRow.title}_signiert.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const deleteDocument = async (docRow: SignedDocumentRow) => {
    if (!confirm(`Vertrag "${docRow.title}" wirklich löschen?`)) return;
    try {
      const paths = [docRow.original_file_path, docRow.signed_file_path].filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from('signed-documents').remove(paths);
      await supabase.from('signed_documents').delete().eq('id', docRow.id);
      addToast('Vertrag gelöscht', 'success');
      fetchDocuments();
    } catch (e) {
      console.error(e);
      addToast('Fehler beim Löschen', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Verträge</h2>
        <p className="text-sm text-gray-500">PDF hochladen, unterschreiben und mit Stempel versehen.</p>
      </div>

      {/* Upload */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
        ) : (
          <Upload className="w-8 h-8 mx-auto text-gray-400" />
        )}
        <p className="mt-2 text-sm text-gray-600">
          {isDragActive ? 'PDF hier ablegen …' : 'PDF hierher ziehen oder klicken zum Hochladen'}
        </p>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2" />
          <p>Noch keine Verträge vorhanden.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {documents.map((docRow) => (
            <div key={docRow.id} className="flex items-center gap-4 p-4">
              <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{docRow.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                      docRow.status === 'signed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {docRow.status === 'signed' ? (
                      <>
                        <CheckCircle className="w-3 h-3" /> Signiert
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" /> Entwurf
                      </>
                    )}
                  </span>
                  {docRow.contract_id && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      <UserRound className="w-3 h-3" />
                      {docRow.teilnehmer?.name || 'Teilnehmer'}
                      {docRow.contract?.contract_number ? ` · ${docRow.contract.contract_number}` : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {docRow.signed_file_path && (
                  <button
                    onClick={() => setAssignDoc(docRow)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:opacity-90"
                  >
                    <UserRound className="w-4 h-4" /> Zuordnen
                  </button>
                )}
                <button
                  onClick={() => setEditorDoc(docRow)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${
                    docRow.signed_file_path
                      ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      : 'bg-primary text-white hover:opacity-90'
                  }`}
                >
                  <PenTool className="w-4 h-4" /> {docRow.signed_file_path ? 'Ändern' : 'Signieren'}
                </button>
                {docRow.signed_file_path && (
                  <button
                    onClick={() => downloadSigned(docRow)}
                    title="Signierte Version herunterladen"
                    className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-md"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => deleteDocument(docRow)}
                  title="Löschen"
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editorDoc && (
        <ContractSignEditor
          document={editorDoc}
          onClose={() => setEditorDoc(null)}
          onSigned={fetchDocuments}
        />
      )}

      {assignDoc && (
        <AssignContractModal
          documentId={assignDoc.id}
          documentTitle={assignDoc.title}
          currentContractId={assignDoc.contract_id}
          onClose={() => setAssignDoc(null)}
          onAssigned={fetchDocuments}
        />
      )}
    </div>
  );
}
