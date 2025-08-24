import React, { useState } from 'react';
import { File, Download, Trash2, Calendar, ChevronDown, ChevronRight, Archive, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface FileWithAssignment {
  id: string;
  name: string;
  file_path: string;
  created_at: string;
  assigned_month?: number;
  assigned_year?: number;
}

interface FileListWithMonthSegmentationProps {
  files: FileWithAssignment[];
  onFileAction: (filePath: string, fileName: string) => void;
  onFileDelete: (fileId: string) => void;
  onFileEditAssignment?: (fileId: string, month: number, year: number) => void;
  folderName?: string;
}

interface MonthGroup {
  month: number;
  year: number;
  files: FileWithAssignment[];
}

export function FileListWithMonthSegmentation({ 
  files, 
  onFileAction, 
  onFileDelete,
  onFileEditAssignment,
  folderName = 'Dateien'
}: FileListWithMonthSegmentationProps) {
  const { user } = useAuthStore();
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [downloadingMonth, setDownloadingMonth] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<{
    id: string;
    name: string;
    month: number;
    year: number;
  } | null>(null);

  // Group files by month/year
  const groupFilesByMonth = (): MonthGroup[] => {
    const groups: { [key: string]: MonthGroup } = {};

    files.forEach(file => {
      const month = file.assigned_month || new Date(file.created_at).getMonth() + 1;
      const year = file.assigned_year || new Date(file.created_at).getFullYear();
      const key = `${year}-${month}`;

      if (!groups[key]) {
        groups[key] = {
          month,
          year,
          files: []
        };
      }
      groups[key].files.push(file);
    });

    // Sort by year and month (newest first)
    return Object.values(groups).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  };

  const monthGroups = groupFilesByMonth();

  // Auto-expand the newest month when files change
  React.useEffect(() => {
    if (monthGroups.length > 0) {
      const newestMonth = monthGroups[0];
      const newestMonthKey = `${newestMonth.year}-${newestMonth.month}`;
      setExpandedMonths(prev => new Set([...prev, newestMonthKey]));
    }
  }, [files.length, monthGroups.length > 0 ? `${monthGroups[0].year}-${monthGroups[0].month}` : '']);

  const getMonthName = (month: number) => {
    return new Date(2023, month - 1).toLocaleDateString('de-DE', { month: 'long' });
  };

  const toggleMonth = (monthKey: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(monthKey)) {
      newExpanded.delete(monthKey);
    } else {
      newExpanded.add(monthKey);
    }
    setExpandedMonths(newExpanded);
  };

  const downloadMonthAsZip = async (group: MonthGroup) => {
    const monthKey = `${group.year}-${group.month}`;
    setDownloadingMonth(monthKey);

    try {
      // Get user's full name for ZIP filename
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      const userName = profile.full_name.replace(/\s+/g, '_');
      const monthName = getMonthName(group.month);
      const zipFileName = `${folderName}_${monthName}_${group.year}_${userName}.zip`;

      // Import JSZip dynamically
      const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
      const zip = new JSZip();

      // Download all files and add to ZIP
      const downloadPromises = group.files.map(async (file) => {
        try {
          const { data, error } = await supabase.storage
            .from('files')
            .download(file.file_path);

          if (error) throw error;
          
          zip.file(file.name, data);
          return { success: true, fileName: file.name };
        } catch (error) {
          console.error(`Error downloading file ${file.name}:`, error);
          return { success: false, fileName: file.name, error };
        }
      });

      const results = await Promise.all(downloadPromises);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      if (successful === 0) {
        throw new Error('Keine Dateien konnten heruntergeladen werden');
      }

      if (failed > 0) {
        console.warn(`${failed} von ${group.files.length} Dateien konnten nicht heruntergeladen werden`);
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Create download link
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      if (failed > 0) {
        alert(`ZIP-Download abgeschlossen. ${successful} Dateien erfolgreich, ${failed} Dateien fehlgeschlagen.`);
      }

    } catch (error) {
      console.error('Error creating ZIP download:', error);
      alert(`Fehler beim Erstellen des ZIP-Downloads: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setDownloadingMonth(null);
    }
  };

  const handleFileEdit = (fileId: string, fileName: string, currentMonth?: number, currentYear?: number) => {
    const month = currentMonth || new Date().getMonth() + 1;
    const year = currentYear || new Date().getFullYear();
    setEditingFile({ id: fileId, name: fileName, month, year });
  };

  const handleEditSave = () => {
    if (editingFile && onFileEditAssignment) {
      onFileEditAssignment(editingFile.id, editingFile.month, editingFile.year);
      setEditingFile(null);
    }
  };

  if (files.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500">
        Keine Dateien in diesem Ordner
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {/* Edit Modal */}
      {editingFile && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Monat/Jahr bearbeiten
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Datei: {editingFile.name}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monat
                  </label>
                  <select
                    value={editingFile.month}
                    onChange={(e) => setEditingFile({
                      ...editingFile,
                      month: parseInt(e.target.value)
                    })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {getMonthName(i + 1)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jahr
                  </label>
                  <select
                    value={editingFile.year}
                    onChange={(e) => setEditingFile({
                      ...editingFile,
                      year: parseInt(e.target.value)
                    })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setEditingFile(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleEditSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {monthGroups.map((group) => {
        const monthKey = `${group.year}-${group.month}`;
        const isExpanded = expandedMonths.has(monthKey);

        return (
          <div key={monthKey}>
            {/* Month Header */}
            <button
              onClick={() => toggleMonth(monthKey)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left transition-colors group"
            >
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-primary mr-3" />
                <span className="font-medium text-gray-900">
                  {getMonthName(group.month)} {group.year}
                </span>
                <span className="ml-2 text-sm text-gray-500">
                  ({group.files.length} {group.files.length === 1 ? 'Datei' : 'Dateien'})
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadMonthAsZip(group);
                  }}
                  disabled={downloadingMonth === monthKey}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-primary hover:bg-primary/10 disabled:opacity-50"
                  title={`Alle Dateien von ${getMonthName(group.month)} ${group.year} als ZIP herunterladen`}
                >
                  {downloadingMonth === monthKey ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-primary border-t-transparent mr-1" />
                  ) : (
                    <Archive className="h-3 w-3 mr-1" />
                  )}
                  Download {getMonthName(group.month)}
                </button>
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* Files List */}
            {isExpanded && (
              <div className="bg-white">
                {group.files.map((file) => (
                  <div
                    key={file.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 border-l-4 border-primary/20"
                  >
                    <div className="flex items-center">
                      <File className="h-5 w-5 text-gray-400" />
                      <div className="ml-3">
                        <span className="text-sm font-medium text-gray-900">{file.name}</span>
                        <div className="text-xs text-gray-500">
                          Hochgeladen: {new Date(file.created_at).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onFileAction(file.file_path, file.name)}
                        className="text-gray-400 hover:text-primary transition-colors"
                        title="Datei herunterladen"
                      >
                        <Download className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleFileEdit(file.id, file.name, file.assigned_month, file.assigned_year)}
                        className="text-gray-400 hover:text-primary transition-colors"
                        title="Monat/Jahr bearbeiten"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onFileDelete(file.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Datei löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}