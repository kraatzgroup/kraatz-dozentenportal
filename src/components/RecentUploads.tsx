import React, { useEffect, useState } from 'react';
import { File, Download } from 'lucide-react';
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
}

export function RecentUploads() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { markFileAsDownloaded, fetchUndownloadedCount } = useFileStore();
  const [pdfViewer, setPdfViewer] = useState<{ isOpen: boolean; fileUrl: string; fileName: string }>({
    isOpen: false,
    fileUrl: '',
    fileName: ''
  });

  useEffect(() => {
    fetchRecentUploads();

    // Subscribe to changes in the files table
    const channel = supabase
      .channel('files-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'files'
      }, () => {
        fetchRecentUploads();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const fetchRecentUploads = async () => {
    try {
      const { data, error } = await supabase
        .from('files') 
        .select(`
          *,
          folder:folders(name),
          uploaded_by_profile:profiles!files_uploaded_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      console.log('Recent uploads fetched:', data);
      setRecentFiles(data || []);
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
                <File className="h-4 w-4 sm:h-5 sm:w-5 text-primary/60" />
                {!file.downloaded_at && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full"></div>
                )}
              </div>
              <div className="ml-2 sm:ml-3 truncate flex-1 min-w-0">
                <button
                  onClick={() => handleFileAction(file.file_path, file.name)}
                  className={`text-sm font-medium hover:text-primary truncate block cursor-pointer ${
                    file.downloaded_at ? 'text-gray-500' : 'text-gray-900 font-semibold'
                  }`}
                >
                  <span className="truncate block">{file.name}</span>
                  {!file.downloaded_at && (
                    <span className="ml-1 sm:ml-2 text-xs text-red-600 font-normal">NEU</span>
                  )}
                </button>
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
          </div>
        </div>
      ))}

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