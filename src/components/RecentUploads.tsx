import React, { useEffect, useState } from 'react';
import { File, Download, FileText, X, ChevronRight, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useFileStore } from '../store/fileStore';
import { PDFViewerModal } from './PDFViewerModal';

interface RecentFile {
  id: string;
  name: string;
  file_path: string;
  created_at: string;
  downloaded_at: string | null;
  folder: {
    name: string;
  };
  uploaded_by_profile: {
    full_name: string;
  };
  type?: 'file' | 'invoice';
}

export function RecentUploads() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [allFiles, setAllFiles] = useState<RecentFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const { markFileAsDownloaded, fetchUndownloadedCount } = useFileStore();
  const [pdfViewer, setPdfViewer] = useState<{ isOpen: boolean; fileUrl: string; fileName: string }>({
    isOpen: false,
    fileUrl: '',
    fileName: ''
  });

  useEffect(() => {
    fetchRecentUploads();

    // Subscribe to changes in the files table
    const filesChannel = supabase
      .channel('files-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'files'
      }, () => {
        fetchRecentUploads();
      })
      .subscribe();

    // Subscribe to changes in the invoices table
    const invoicesChannel = supabase
      .channel('invoices-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'invoices'
      }, () => {
        fetchRecentUploads();
      })
      .subscribe();

    return () => {
      filesChannel.unsubscribe();
      invoicesChannel.unsubscribe();
    };
  }, []);

  const fetchRecentUploads = async () => {
    try {
      // Fetch recent files
      const { data: filesData, error: filesError } = await supabase
        .from('files') 
        .select(`
          *,
          folder:folders(name),
          uploaded_by_profile:profiles!files_uploaded_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (filesError) throw filesError;

      // Fetch recent submitted invoices - simplified query
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, month, year, status, submitted_at, dozent_id')
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(5);

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
      }
      console.log('Invoices fetched in RecentUploads:', invoicesData?.length || 0, invoicesData);

      // Fetch dozent names separately
      const dozentIds = [...new Set((invoicesData || []).map(inv => inv.dozent_id))];
      const { data: dozentProfiles } = dozentIds.length > 0 
        ? await supabase.from('profiles').select('id, full_name').in('id', dozentIds)
        : { data: [] };
      
      const dozentMap = new Map((dozentProfiles || []).map(p => [p.id, p.full_name]));

      // Transform files to common format
      const files: RecentFile[] = (filesData || []).map(f => ({
        ...f,
        type: 'file' as const
      }));

      // Transform invoices to common format
      const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
      const invoices: RecentFile[] = (invoicesData || []).map(inv => {
        const dozentName = dozentMap.get(inv.dozent_id) || 'Unbekannt';
        return {
          id: inv.id,
          name: `Rechnung ${monthNames[inv.month - 1]} ${inv.year}`,
          file_path: '',
          created_at: inv.submitted_at || new Date().toISOString(),
          downloaded_at: null,
          folder: { name: 'Rechnungen' },
          uploaded_by_profile: { full_name: dozentName },
          type: 'invoice' as const
        };
      });

      // Combine and sort by date
      const combined = [...files, ...invoices]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      console.log('Recent uploads fetched:', combined);
      setAllFiles(combined);
      setRecentFiles(combined.slice(0, 3));
    } catch (error) {
      console.error('Error fetching recent uploads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileAction = async (filePath: string, fileName: string) => {
    try {
      // Find the file to get its ID for marking as downloaded
      const file = recentFiles.find(f => f.file_path === filePath && f.name === fileName);
      
      // Validate file path first
      if (!filePath || filePath.trim() === '') {
        throw new Error('Invalid file path');
      }

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

      if (fileName.toLowerCase().endsWith('.pdf')) {
        // For PDFs, open in PDF viewer modal
        if (file) {
          await markFileAsDownloaded(file.id);
          await fetchUndownloadedCount(); // Update the count
        }
        setPdfViewer({
          isOpen: true,
          fileUrl: publicUrl,
          fileName: fileName
        });
      } else {
        const { data, error: downloadError } = await supabase.storage
          .from('files')
          .download(filePath);

        if (downloadError) throw downloadError;

        // Mark file as downloaded
        if (file) {
          await markFileAsDownloaded(file.id);
          await fetchUndownloadedCount(); // Update the count
        }

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

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (recentFiles.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-4 sm:p-6 text-center text-gray-500">
        Keine kürzlichen Uploads
      </div>
    );
  }

  return (
    <div className="relative">
      {recentFiles.map((file, index) => (
        <div
          key={file.id}
          className={`bg-white shadow-lg rounded-lg p-4 mb-2 transition-all duration-300 hover:z-10 hover:shadow-xl ${
            index > 0 ? '-mt-24' : ''
          } relative ${index > 0 ? 'sm:-mt-24 -mt-16' : ''}`}
          style={{
            zIndex: recentFiles.length - index,
            transform: `translateY(${index * (window.innerWidth < 640 ? 0.3 : 0.5)}rem)`
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center min-w-0">
              <div className="relative flex-shrink-0">
                {file.type === 'invoice' ? (
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                ) : (
                  <File className="h-4 w-4 sm:h-5 sm:w-5 text-primary/60" />
                )}
                {!file.downloaded_at && file.type !== 'invoice' && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full"></div>
                )}
                {file.type === 'invoice' && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                )}
              </div>
              <div className="ml-2 sm:ml-3 truncate flex-1 min-w-0">
                <div
                  className={`text-sm font-medium truncate block ${
                    file.type === 'invoice' ? 'text-green-700 font-semibold' : 
                    file.downloaded_at ? 'text-gray-500' : 'text-gray-900 font-semibold'
                  } ${file.type !== 'invoice' ? 'hover:text-primary cursor-pointer' : ''}`}
                  onClick={() => file.type !== 'invoice' && handleFileAction(file.file_path, file.name)}
                >
                  <span className="truncate block">{file.name}</span>
                  {file.type === 'invoice' && (
                    <span className="ml-1 sm:ml-2 text-xs text-green-600 font-normal">Eingereicht</span>
                  )}
                  {!file.downloaded_at && file.type !== 'invoice' && (
                    <span className="ml-1 sm:ml-2 text-xs text-red-600 font-normal">NEU</span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center text-xs text-gray-500 mt-1 gap-1 sm:gap-0">
                  <span className={`truncate ${file.downloaded_at ? 'text-gray-400' : 'text-gray-500'}`}>
                    {file.uploaded_by_profile.full_name}
                  </span>
                  <span className="mx-1 hidden sm:inline">•</span>
                  <span className={`truncate ${file.downloaded_at ? 'text-gray-400' : 'text-gray-500'}`}>
                    {file.folder.name}
                  </span>
                  <span className="mx-1 hidden sm:inline">•</span>
                  <span className={`whitespace-nowrap text-xs ${file.downloaded_at ? 'text-gray-400' : 'text-gray-500'}`}>
                    {new Date(file.created_at).toLocaleDateString('de-DE', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      ...(window.innerWidth >= 640 && {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    })}
                  </span>
                  {file.downloaded_at && (
                    <>
                      <span className="mx-1 hidden sm:inline">•</span>
                      <span className="text-green-600 font-medium text-xs">Heruntergeladen</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {file.type !== 'invoice' && (
              <button
                onClick={() => handleFileAction(file.file_path, file.name)}
                className={`ml-2 sm:ml-4 flex-shrink-0 ${
                  file.downloaded_at 
                    ? 'text-gray-300 hover:text-gray-500' 
                    : 'text-primary/60 hover:text-primary'
                }`}
              >
                <Download className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* View All Button */}
      {allFiles.length > 3 && (
        <button
          onClick={() => setShowAllActivity(true)}
          className="w-full mt-4 py-2 px-4 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-lg border border-gray-200 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Clock className="h-4 w-4" />
          Alle ansehen ({allFiles.length} Aktivitäten)
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Activity Log Modal */}
      {showAllActivity && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowAllActivity(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full relative">
              <div className="bg-white">
                <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-medium text-gray-900">Aktivitätsprotokoll</h3>
                  </div>
                  <button
                    onClick={() => setShowAllActivity(false)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  <div className="divide-y divide-gray-100">
                    {allFiles.map((file) => (
                      <div
                        key={file.id}
                        className="px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            {file.type === 'invoice' ? (
                              <FileText className="h-5 w-5 text-green-600" />
                            ) : (
                              <File className="h-5 w-5 text-primary/60" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${
                              file.type === 'invoice' ? 'text-green-700' : 'text-gray-900'
                            }`}>
                              {file.name}
                              {file.type === 'invoice' && (
                                <span className="ml-2 text-xs text-green-600 font-normal">Eingereicht</span>
                              )}
                            </div>
                            <div className="flex items-center text-xs text-gray-500 mt-0.5 gap-2">
                              <span>{file.uploaded_by_profile.full_name}</span>
                              <span>•</span>
                              <span>{file.folder.name}</span>
                              <span>•</span>
                              <span>
                                {new Date(file.created_at).toLocaleDateString('de-DE', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                          {file.type !== 'invoice' && (
                            <button
                              onClick={() => handleFileAction(file.file_path, file.name)}
                              className="flex-shrink-0 text-primary/60 hover:text-primary"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
  );
}