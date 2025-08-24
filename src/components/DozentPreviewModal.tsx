import React, { useEffect, useState } from 'react';
import { X, FolderIcon, MessageSquare, LogOut, File, Download, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import { PDFViewerModal } from './PDFViewerModal';

interface DozentPreviewModalProps {
  dozentId: string;
  onClose: () => void;
}

interface Folder {
  id: string;
  name: string;
  is_system: boolean;
}

interface DozentFile {
  id: string;
  name: string;
  file_path: string;
  created_at: string;
  folder: {
    name: string;
  };
}

interface DozentInfo {
  full_name: string;
}

export function DozentPreviewModal({ dozentId, onClose }: DozentPreviewModalProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<DozentFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dozent, setDozent] = useState<DozentInfo | null>(null);
  const [editingFile, setEditingFile] = useState<{ id: string; name: string } | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [pdfViewer, setPdfViewer] = useState<{ isOpen: boolean; fileUrl: string; fileName: string }>({
    isOpen: false,
    fileUrl: '',
    fileName: ''
  });

  useEffect(() => {
    fetchDozentInfo();
    fetchFolders();
  }, [dozentId]);

  useEffect(() => {
    if (selectedFolder) {
      fetchFiles(selectedFolder.id);
    }
  }, [selectedFolder]);

  const fetchDozentInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', dozentId)
        .single();

      if (error) throw error;
      setDozent(data);
    } catch (error) {
      console.error('Error fetching dozent info:', error);
    }
  };

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', dozentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error('Error fetching folders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFiles = async (folderId: string) => {
    try {
      const { data, error } = await supabase
        .from('files')
        .select(`
          *,
          folder:folders(name)
        `)
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleFileAction = async (filePath: string, fileName: string) => {
    try {
      // Validate file path first
      if (!filePath || filePath.trim() === '') {
        throw new Error('Invalid file path');
      }

      if (fileName.toLowerCase().endsWith('.pdf')) {
        // For PDFs, get a temporary URL and open in PDF viewer modal
        const { data: { publicUrl }, error } = await supabase.storage
          .from('files')
          .getPublicUrl(filePath);

        if (error) throw error;
        
        // Validate the URL uses the correct domain
        if (!publicUrl.includes('baxmpvbwvtlbrzchabfw.supabase.co')) {
          console.error('❌ File URL uses wrong domain:', publicUrl);
          throw new Error('File URL generated with wrong domain. Please check Supabase configuration.');
        }

        // Additional URL validation
        try {
          new URL(publicUrl);
        } catch (urlError) {
          console.error('❌ Invalid URL generated:', publicUrl);
          throw new Error('Invalid file URL generated');
        }
        
        setPdfViewer({
          isOpen: true,
          fileUrl: publicUrl,
          fileName: fileName
        });
      } else {
        // For non-PDFs, download as before
        const { data, error } = await supabase.storage
          .from('files')
          .download(filePath);

        if (error) throw error;

        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error handling file:', error);
      
      // More specific error messages
      let errorMessage = 'Fehler beim Zugriff auf die Datei.';
      if (error instanceof Error) {
        if (error.message.includes('domain')) {
          errorMessage = 'Datei-URL-Konfigurationsfehler. Bitte wenden Sie sich an den Administrator.';
        } else if (error.message.includes('Invalid')) {
          errorMessage = 'Ungültige Datei oder beschädigter Link.';
        } else {
          errorMessage = `Fehler: ${error.message}`;
        }
      }
      
      alert(errorMessage);
    }
  };

  const handleFileEdit = (fileId: string, currentName: string, currentMonth?: number, currentYear?: number) => {
    setEditingFile({ id: fileId, name: currentName });
    setNewFileName(currentName);
  };

  const handleFileRename = async () => {
    if (!editingFile || !newFileName.trim()) return;
    
    try {
      // Update file name in database
      const { error } = await supabase
        .from('files')
        .update({ name: newFileName.trim() })
        .eq('id', editingFile.id);

      if (error) throw error;

      // Refresh files list
      if (selectedFolder) {
        fetchFiles(selectedFolder.id);
      }
      
      setEditingFile(null);
      setNewFileName('');
    } catch (error) {
      console.error('Error renaming file:', error);
      alert('Fehler beim Umbenennen der Datei');
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (window.confirm('Möchten Sie diese Datei wirklich löschen?')) {
      try {
        // First get the file to get the file_path
        const { data: fileData, error: fetchError } = await supabase
          .from('files')
          .select('file_path')
          .eq('id', fileId)
          .single();

        if (fetchError) throw fetchError;

        if (fileData?.file_path) {
          // Delete from storage first
          const { error: storageError } = await supabase.storage
            .from('files')
            .remove([fileData.file_path]);

          if (storageError) {
            console.error('Storage delete error:', storageError);
            throw storageError;
          }
        }

        // Then delete the database record
        const { error: dbError } = await supabase
          .from('files')
          .delete()
          .eq('id', fileId);

        if (dbError) throw dbError;
        
        // Refresh files list
        if (selectedFolder) {
          fetchFiles(selectedFolder.id);
        }
      } catch (error) {
        console.error('Delete process error:', error);
        alert('Fehler beim Löschen der Datei');
      }
    }
  };

  // Check if current folder allows edit/delete operations
  const allowFileOperations = selectedFolder && 
    (selectedFolder.name === 'Rechnungen' || selectedFolder.name === 'Tätigkeitsbericht');

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (pdfViewer.isOpen) {
        if (event.key === 'Escape') {
          setPdfViewer(prev => ({ ...prev, isOpen: false }));
        } else if (event.ctrlKey && event.key === 'd') {
          event.preventDefault();
          const link = document.createElement('a');
          link.href = pdfViewer.fileUrl;
          link.download = pdfViewer.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pdfViewer]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50">
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white w-[90vw] h-[90vh] rounded-lg shadow-xl flex flex-col">
          {/* Navbar */}
          <nav className="bg-white shadow-sm border-b">
            <div className="px-4">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <div className="flex-shrink-0 flex items-center">
                    <Logo />
                    <span className="ml-2 text-xl font-semibold text-gray-900">Dozenten-Portal</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 hover:text-gray-700 focus:outline-none transition">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Nachrichten
                  </button>
                  <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-500 hover:text-red-700 focus:outline-none transition">
                    <LogOut className="h-5 w-5 mr-2" />
                    Abmelden
                  </button>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-auto bg-gray-50">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium text-gray-900">Ordner</h2>
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        className={`relative block w-full text-left ${
                          selectedFolder?.id === folder.id
                            ? 'ring-2 ring-blue-500'
                            : 'hover:bg-gray-50'
                        } bg-white rounded-lg shadow p-4 transition-all`}
                      >
                        <button
                          onClick={() => setSelectedFolder(folder)}
                          className="w-full flex items-center"
                        >
                          <FolderIcon className="h-6 w-6 text-blue-600" />
                          <span className="ml-3 font-medium text-gray-900">{folder.name}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedFolder && (
                <div className="bg-white rounded-lg shadow">
                  <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">
                        Dateien in {selectedFolder.name}
                      </h3>
                      <button
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                        disabled
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        Datei hochladen
                      </button>
                    </div>
                  </div>

                  <ul className="divide-y divide-gray-200">
                    {files.length === 0 ? (
                      <li className="px-4 py-4 text-center text-gray-500">
                        Keine Dateien in diesem Ordner
                      </li>
                    ) : (
                      files.map((file) => (
                        <li key={file.id} className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                          <div className="flex items-center">
                            <File className="h-5 w-5 text-gray-400" />
                            <button
                              onClick={() => handleFileAction(file.file_path, file.name)}
                              className="ml-2 text-sm font-medium text-gray-900 hover:text-blue-600 cursor-pointer"
                            >
                              {file.name}
                            </button>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-sm text-gray-500 mr-4">
                              {new Date(file.created_at).toLocaleDateString('de-DE')}
                            </span>
                            <button
                              onClick={() => handleFileAction(file.file_path, file.name)}
                              className="text-gray-400 hover:text-gray-500"
                              title="Datei öffnen/herunterladen"
                            >
                              <Download className="h-5 w-5" />
                            </button>
                            {allowFileOperations && (
                              <>
                                <button
                                  onClick={() => handleFileEdit(file.id, file.name)}
                                  className="text-gray-400 hover:text-blue-600"
                                  title="Datei umbenennen"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleFileDelete(file.id)}
                                  className="text-gray-400 hover:text-red-500"
                                  title="Datei löschen"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <X className="h-6 w-6" />
          </button>

          {/* File Edit Dialog */}
          {editingFile && (
            <div className="fixed z-50 inset-0 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                  <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Datei umbenennen</h3>
                    <input
                      type="text"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      placeholder="Neuer Dateiname"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleFileRename();
                        }
                      }}
                    />
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      onClick={handleFileRename}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Speichern
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFile(null);
                        setNewFileName('');
                      }}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PDF Viewer Modal */}
          <PDFViewerModal
            isOpen={pdfViewer.isOpen}
            onClose={() => setPdfViewer(prev => ({ ...prev, isOpen: false }))}
            fileUrl={pdfViewer.fileUrl}
            fileName={pdfViewer.fileName}
          />
        </div>
      </div>
    </div>
  );
}