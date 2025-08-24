import React, { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { FileUpload } from './FileUpload';
import { FileListWithMonthSegmentation } from './FileListWithMonthSegmentation';
import { File } from '../store/fileStore';
import { useFileStore } from '../store/fileStore';

interface Folder {
  id: string;
  name: string;
  is_system: boolean;
}

interface FileSectionProps {
  selectedFolder: Folder;
  files: File[];
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onFileUpload: (file: File) => Promise<void>;
  onFileAction: (filePath: string, fileName: string) => void;
  onFileDelete: (fileId: string) => void;
  onFolderEdit: (folder: Folder) => void;
  onFolderDelete: (id: string, name: string) => void;
}

export function FileSection({
  selectedFolder,
  files,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  onFileUpload,
  onFileAction,
  onFileDelete,
  onFolderEdit,
  onFolderDelete
}: FileSectionProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { updateFileAssignment, fetchFiles } = useFileStore();

  // Filter files by selected month and year
  const filteredFiles = files.filter(file => {
    const fileMonth = file.assigned_month || new Date(file.created_at).getMonth() + 1;
    const fileYear = file.assigned_year || new Date(file.created_at).getFullYear();
    return fileMonth === selectedMonth && fileYear === selectedYear;
  });

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      await onFileUpload(file);
      
      // Wait a moment for the file to be added to the store, then update assignment
      setTimeout(async () => {
        // Refresh files to get the latest uploaded file
        const { fetchFiles } = useFileStore.getState();
        await fetchFiles(selectedFolder.id);
        
        // Find the most recently uploaded file with matching name
        const { files: refreshedFiles } = useFileStore.getState();
        const uploadedFile = refreshedFiles.find(f => 
          f.name === file.name && 
          new Date(f.created_at).getTime() > Date.now() - 10000 // Within last 10 seconds
        );
        
        if (uploadedFile) {
          console.log('Assigning file to month/year:', selectedMonth, selectedYear);
          await updateFileAssignment(uploadedFile.id, selectedMonth, selectedYear);
          // Refresh files again to show the updated assignment
          await fetchFiles(selectedFolder.id);
        }
      }, 1000);
      
      setShowUpload(false);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileEditAssignment = async (fileId: string, month: number, year: number) => {
    try {
     console.log('Updating file assignment:', { fileId, month, year });
      await updateFileAssignment(fileId, month, year);
     console.log('Assignment updated, refreshing files...');
     // Refresh files to show the updated assignment immediately
     await fetchFiles(selectedFolder.id);
    } catch (error) {
      console.error('Failed to update file assignment:', error);
      alert('Fehler beim Aktualisieren der Datei-Zuordnung');
    }
  };

  const getMonthName = (month: number) => {
    return new Date(2023, month - 1).toLocaleDateString('de-DE', { month: 'long' });
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      {/* Header */}
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left: Section Name */}
          <h3 className="text-lg font-medium text-gray-900">
            {selectedFolder.name}
          </h3>
          
          {/* Right: Month/Year Selection + Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 sm:ml-auto">
            {/* Month/Year Selection */}
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monat</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => onMonthChange(parseInt(e.target.value))}
                  className="text-sm rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {getMonthName(i + 1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Jahr</label>
                <select
                  value={selectedYear}
                  onChange={(e) => onYearChange(parseInt(e.target.value))}
                  className="text-sm rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
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
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Datei hochladen
              </button>
              {!selectedFolder.is_system && (
                <>
                  <button
                    onClick={() => onFolderEdit(selectedFolder)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onFolderDelete(selectedFolder.id, selectedFolder.name)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {showUpload ? (
        <div className="p-6 border-b border-gray-200">
          {isUploading && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-3"></div>
                <span className="text-blue-700 font-medium">Datei wird hochgeladen...</span>
              </div>
            </div>
          )}
          <FileUpload onUpload={handleFileUpload} />
          {!isUploading && (
            <button
              onClick={() => setShowUpload(false)}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Abbrechen
            </button>
          )}
        </div>
      ) : (
        <FileListWithMonthSegmentation 
          files={filteredFiles}
          onFileAction={onFileAction}
          onFileDelete={onFileDelete}
          onFileEditAssignment={handleFileEditAssignment}
          folderName={selectedFolder.name}
        />
      )}
    </div>
  );
}