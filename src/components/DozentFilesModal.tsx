import { useState, useEffect } from 'react';
import { X, FolderIcon, FileText, Download, Eye, Calendar, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DozentFilesModalProps {
  dozentId: string;
  dozentName: string;
  folderType: string;
  onClose: () => void;
}

interface FileItem {
  id: string;
  name: string;
  created_at: string;
  file_path: string;
  file_size?: number;
  downloaded?: boolean;
}

export function DozentFilesModal({ dozentId, dozentName, folderType, onClose }: DozentFilesModalProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');

  useEffect(() => {
    fetchFiles();
  }, [dozentId, folderType]);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      // Get the folder for this dozent and folder type
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('id')
        .eq('user_id', dozentId)
        .eq('name', folderType)
        .single();

      if (folderError || !folder) {
        console.log('No folder found for', folderType);
        setFiles([]);
        setIsLoading(false);
        return;
      }

      // Get files in this folder
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select('*')
        .eq('folder_id', folder.id)
        .order('created_at', { ascending: false });

      if (filesError) throw filesError;

      setFiles(filesData || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const { data, error } = await supabase.storage
        .from('files')
        .download(file.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Mark as downloaded
      await supabase
        .from('files')
        .update({ downloaded: true })
        .eq('id', file.id);

      // Refresh files
      fetchFiles();
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handlePreview = async (file: FileItem) => {
    try {
      const { data, error } = await supabase.storage
        .from('files')
        .createSignedUrl(file.file_path, 3600); // 1 hour expiry

      if (error) throw error;

      setPreviewUrl(data.signedUrl);
      setPreviewFileName(file.name);
    } catch (error) {
      console.error('Error creating preview URL:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center">
            <FolderIcon className="h-5 w-5 text-primary mr-2" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{folderType}</h2>
              <p className="text-sm text-gray-500">{dozentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mb-3 text-gray-300" />
              <p>Keine Dateien vorhanden</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    file.downloaded ? 'bg-white border-gray-200' : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-center min-w-0 flex-1">
                    <FileText className={`h-5 w-5 mr-3 flex-shrink-0 ${file.downloaded ? 'text-gray-400' : 'text-yellow-600'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <div className="flex items-center text-xs text-gray-500 mt-0.5">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>{formatDate(file.created_at)}</span>
                        {file.file_size && (
                          <>
                            <span className="mx-2">•</span>
                            <span>{formatFileSize(file.file_size)}</span>
                          </>
                        )}
                        {!file.downloaded && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="text-yellow-600 font-medium">Neu</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => handlePreview(file)}
                      className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                      title="Vorschau"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                      title="Herunterladen"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {files.length} {files.length === 1 ? 'Datei' : 'Dateien'}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="text-sm font-medium text-gray-900 truncate">{previewFileName}</span>
              <button
                onClick={() => {
                  setPreviewUrl(null);
                  setPreviewFileName('');
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100">
              {previewFileName.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[70vh]"
                  title="PDF Preview"
                />
              ) : previewFileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <div className="flex items-center justify-center p-4">
                  <img
                    src={previewUrl}
                    alt={previewFileName}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mb-3 text-gray-300" />
                  <p>Vorschau nicht verfügbar</p>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 text-primary hover:underline"
                  >
                    In neuem Tab öffnen
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
