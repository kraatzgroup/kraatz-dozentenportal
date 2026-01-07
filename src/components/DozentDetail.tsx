import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderIcon, Plus, Edit, Trash2, Users, FileText, Mail, User, Clock, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useFolderStore } from '../store/folderStore';
import { useFileStore } from '../store/fileStore';
import { useTeilnehmerStore } from '../store/teilnehmerStore';
import { useHoursStore } from '../store/hoursStore';
import { Logo } from './Logo';
import { FileSection } from './FileSection';
import { ActivitySection } from './ActivitySection';
import { ParticipantHoursSection } from './ParticipantHoursSection';
import { TeilnehmerManagement } from './TeilnehmerManagement';
import { InvoiceManagement } from './InvoiceManagement';

interface Folder {
  id: string;
  name: string;
  is_system?: boolean;
}

export function DozentDetail() {
  const { id: dozentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userRole, isAdmin, isBuchhaltung, isVerwaltung, isVertrieb } = useAuthStore();
  const { folders, fetchFolders, createFolder, updateFolder, deleteFolder } = useFolderStore();
  const { files, fetchFiles, uploadFile, deleteFile } = useFileStore();
  const { teilnehmer, fetchTeilnehmer } = useTeilnehmerStore();
  const { getCurrentMonthHours, fetchMonthlySummary } = useHoursStore();
  
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showTeilnehmerManagement, setShowTeilnehmerManagement] = useState(false);
  const [showInvoiceManagement, setShowInvoiceManagement] = useState(false);
  const [showHoursDialog, setShowHoursDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [activityReportMonth, setActivityReportMonth] = useState(new Date().getMonth() + 1);
  const [activityReportYear, setActivityReportYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dozentInfo, setDozentInfo] = useState<{ full_name: string; email: string } | null>(null);
  const [hoursFormData, setHoursFormData] = useState({
    teilnehmer_id: '',
    hours: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    legal_area: ''
  });
  const [activityFormData, setActivityFormData] = useState({
    hours: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  useEffect(() => {
    if (dozentId) {
      fetchDozentInfo();
      console.log('DozentDetail: Fetching folders for dozentId:', dozentId);
      fetchFolders(dozentId);
      fetchTeilnehmer();
      fetchMonthlySummary(dozentId, selectedYear, selectedMonth);
      
      // Setup real-time subscriptions
      const { setupRealtimeSubscription: setupTeilnehmerSub, cleanupSubscription: cleanupTeilnehmerSub } = useTeilnehmerStore.getState();
      const { setupRealtimeSubscription: setupHoursSub, cleanupSubscription: cleanupHoursSub } = useHoursStore.getState();
      const { setupRealtimeSubscription: setupFilesSub, cleanupSubscription: cleanupFilesSub } = useFileStore.getState();
      
      setupTeilnehmerSub();
      setupHoursSub();
      setupFilesSub();
      
      return () => {
        cleanupTeilnehmerSub();
        cleanupHoursSub();
        cleanupFilesSub();
      };
    }
  }, [dozentId]);

  // Refetch monthly summary when month/year changes
  useEffect(() => {
    if (dozentId) {
      fetchMonthlySummary(dozentId, selectedYear, selectedMonth);
    }
  }, [dozentId, selectedMonth, selectedYear, fetchMonthlySummary]);

  // Create a function to get hours for the specific dozent
  const getDozentMonthHours = (teilnehmerId: string) => {
    const { monthlySummary } = useHoursStore.getState();
    const teilnehmerSummary = monthlySummary.find(s => s.teilnehmer_id === teilnehmerId);
    return teilnehmerSummary?.total_hours || 0;
  };

  useEffect(() => {
    if (selectedFolder) {
      fetchFiles(selectedFolder.id);
    }
  }, [selectedFolder, fetchFiles]);

  const fetchDozentInfo = async () => {
    if (!dozentId) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', dozentId)
        .single();

      if (error) throw error;
      setDozentInfo(data);
    } catch (error) {
      console.error('Error fetching dozent info:', error);
    }
  };

  // Check if selected folder is "Aktive Teilnehmer"
  const isActiveTeilnehmerFolder = selectedFolder?.name === 'Aktive Teilnehmer';
  const isTaetigkeitsberichtFolder = selectedFolder?.name === 'Tätigkeitsbericht';
  const isRechnungenFolder = selectedFolder?.name === 'Rechnungen';
  
  // Check permissions based on role
  const canViewRechnungen = isAdmin || isBuchhaltung;
  const canViewTaetigkeitsbericht = isAdmin || isBuchhaltung;
  const canManageAll = isAdmin || isBuchhaltung;

  const handleFileUpload = async (file: File) => {
    if (!selectedFolder) return;
    await uploadFile(file, file.name, selectedFolder.id);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    try {
      await createFolder(newFolderName);
      setNewFolderName('');
      setShowNewFolder(false);
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleUpdateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder || !editingFolder.name.trim()) return;
    
    try {
      await updateFolder(editingFolder.id, editingFolder.name);
      setEditingFolder(null);
    } catch (error) {
      console.error('Failed to update folder:', error);
    }
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    if (window.confirm(`Möchten Sie den Ordner "${name}" wirklich löschen?`)) {
      try {
        await deleteFolder(id);
        if (selectedFolder?.id === id) {
          setSelectedFolder(null);
        }
      } catch (error) {
        console.error('Failed to delete folder:', error);
      }
    }
  };

  const handleFileAction = async (filePath: string, fileName: string) => {
    try {
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
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Fehler beim Herunterladen der Datei');
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (window.confirm('Möchten Sie diese Datei wirklich löschen?')) {
      try {
        await deleteFile(fileId);
      } catch (error) {
        console.error('Error deleting file:', error);
        alert('Fehler beim Löschen der Datei');
      }
    }
  };

  const handleBackToTeilnehmer = () => {
    setShowTeilnehmerManagement(false);
  };

  const handleBackToInvoices = () => {
    setShowInvoiceManagement(false);
  };

  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Import the dozent hours store
      const { useDozentHoursStore } = await import('../store/dozentHoursStore');
      const { createDozentHours } = useDozentHoursStore.getState();
      
      await createDozentHours({
        hours: parseFloat(activityFormData.hours),
        date: activityFormData.date,
        description: activityFormData.description,
        dozent_id: dozentId
      });
      
      setShowActivityDialog(false);
      setActivityFormData({
        hours: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
    } catch (error) {
      console.error('Error creating activity:', error);
      alert('Fehler beim Speichern der Tätigkeit: ' + error.message);
    }
  };

  const handleHoursSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const hoursData = {
        teilnehmer_id: hoursFormData.teilnehmer_id,
        hours: parseFloat(hoursFormData.hours),
        date: hoursFormData.date,
        description: hoursFormData.description,
        legal_area: hoursFormData.legal_area,
        dozent_id: dozentId
      };
      
      console.log('Creating hours with data:', hoursData);
      
      // Use the hours store to create hours
      const { createHours } = useHoursStore.getState();
      await createHours(hoursData);
      
      console.log('Hours created successfully, refreshing data...');
      
      // Close modal and reset form
      setShowHoursDialog(false);
      setHoursFormData({
        teilnehmer_id: '',
        hours: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        legal_area: ''
      });
      
      // Refresh the monthly summary to show updated hours
      await fetchMonthlySummary(dozentId);
      console.log('Monthly summary refreshed');
    } catch (error) {
      console.error('Error creating hours:', error);
      alert('Fehler beim Speichern der Stunden: ' + error.message);
    }
  };

  const handleGenerateReport = () => {
    handleGeneratePDFReport();
  };

  const handleGeneratePDFReport = async () => {
    if (!dozentInfo) return;
    
    try {
      // Import the PDF generator
      const { generateTaetigkeitsberichtPDF } = await import('../utils/pdfGenerator');
      
      // Fetch the activity data for the selected month/year
      const startDate = `${activityReportYear}-${String(activityReportMonth).padStart(2, '0')}-01`;
      const endDate = new Date(activityReportYear, activityReportMonth, 0).toISOString().split('T')[0];
      
      // Get participant hours
      const { data: participantHoursData, error: participantError } = await supabase
        .from('participant_hours')
        .select(`
          id,
          date,
          hours,
          description,
          legal_area,
          teilnehmer:teilnehmer(name)
        `)
        .eq('dozent_id', dozentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (participantError) throw participantError;

      // Get dozent hours
      const { data: dozentHoursData, error: dozentError } = await supabase
        .from('dozent_hours')
        .select('id, date, hours, description')
        .eq('dozent_id', dozentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (dozentError) throw dozentError;

      // Combine and format the data
      const combinedHours = [
        ...(participantHoursData || []).map(h => ({
          id: h.id,
          date: h.date,
          hours: parseFloat(h.hours.toString()),
          description: h.description || '',
          legal_area: h.legal_area || '',
          teilnehmer_name: h.teilnehmer?.name || 'Unbekannt',
          type: 'participant' as const
        })),
        ...(dozentHoursData || []).map(h => ({
          id: h.id,
          date: h.date,
          hours: parseFloat(h.hours.toString()),
          description: h.description || '',
          type: 'dozent' as const
        }))
      ];

      // Sort by date (ascending - chronological)
      combinedHours.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const totalHours = combinedHours.reduce((sum, entry) => sum + entry.hours, 0);

      // Generate PDF
      await generateTaetigkeitsberichtPDF({
        dozentName: dozentInfo.full_name,
        selectedMonth: activityReportMonth,
        selectedYear: activityReportYear,
        combinedHours,
        totalHours
      });

    } catch (error) {
      console.error('Error generating PDF report:', error);
      alert('Fehler beim Generieren des PDF-Berichts: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Logo />
                <span className="ml-2 text-xl font-semibold text-gray-900">Admin Dashboard</span>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {dozentInfo && (
            <div className="mb-8">
              <div className="flex items-center mb-2">
                <button
                  onClick={() => navigate('/admin')}
                  className="mr-4 p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full"
                >
                  <ArrowLeft className="h-6 w-6" />
                </button>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {dozentInfo.full_name}
                </h1>
              </div>
              <div className="flex items-center text-gray-500">
                <Mail className="h-4 w-4 mr-2" />
                <span>{dozentInfo.email}</span>
              </div>
            </div>
          )}

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Ordner</h2>
              {isActiveTeilnehmerFolder && (
                <button
                  onClick={() => setShowTeilnehmerManagement(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Teilnehmer verwalten
                </button>
              )}
              {isRechnungenFolder && (
                <button
                  onClick={() => setShowInvoiceManagement(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Rechnungen verwalten
                </button>
              )}
              {isTaetigkeitsberichtFolder && (
                <button
                  onClick={handleGenerateReport}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Bericht generieren
                </button>
              )}
            </div>

            {folders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-sm">
                  Keine Ordner gefunden für diesen Dozenten.
                  <br />
                  <span className="text-xs">Dozent ID: {dozentId}</span>
                  <br />
                  <span className="text-xs">Folders count: {folders.length}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={`relative block w-full text-left ${
                      selectedFolder?.id === folder.id
                        ? 'ring-2 ring-primary'
                        : 'hover:bg-gray-50'
                    } bg-white rounded-lg shadow p-4 transition-all`}
                  >
                    <button
                      onClick={() => setSelectedFolder(folder)}
                      className="w-full flex items-center text-left"
                    >
                      <FolderIcon className="h-6 w-6 text-primary" />
                      <span className="ml-3 font-medium text-gray-900">{folder.name}</span>
                    </button>
                    {!folder.is_system && canManageAll && (
                      <div className="absolute top-2 right-2 flex space-x-1">
                        <button
                          onClick={() => setEditingFolder(folder)}
                          className="text-gray-400 hover:text-primary"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFolder(folder.id, folder.name)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>


          {selectedFolder && (
            <>
              {isActiveTeilnehmerFolder ? (
                <ParticipantHoursSection
                  teilnehmer={teilnehmer}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  onMonthChange={setSelectedMonth}
                  onYearChange={setSelectedYear}
                  onShowTeilnehmerManagement={() => setShowTeilnehmerManagement(true)}
                  onShowHoursDialog={() => setShowHoursDialog(true)}
                  getCurrentMonthHours={getDozentMonthHours}
                  isAdmin={canManageAll}
                />
              ) : isRechnungenFolder && canViewRechnungen ? (
                <div className="space-y-6">
                  <InvoiceManagement
                    onBack={handleBackToInvoices}
                    dozentId={dozentId}
                    isAdmin={canManageAll}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                  />
                  <FileSection
                    selectedFolder={selectedFolder}
                    files={files}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onMonthChange={setSelectedMonth}
                    onYearChange={setSelectedYear}
                    onFileUpload={handleFileUpload}
                    onFileAction={handleFileAction}
                    onFileDelete={handleFileDelete}
                    onFolderEdit={setEditingFolder}
                    onFolderDelete={handleDeleteFolder}
                  />
                </div>
              ) : isTaetigkeitsberichtFolder && canViewTaetigkeitsbericht ? (
                <ActivitySection
                  selectedMonth={activityReportMonth}
                  selectedYear={activityReportYear}
                  onMonthChange={setActivityReportMonth}
                  onYearChange={setActivityReportYear}
                  onShowActivityDialog={() => setShowActivityDialog(true)}
                  dozentId={dozentId}
                />
              ) : (isRechnungenFolder && !canViewRechnungen) || (isTaetigkeitsberichtFolder && !canViewTaetigkeitsbericht) ? (
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <div className="px-4 py-8 text-center text-gray-500">
                    <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                      🔒
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Zugriff nicht erlaubt</h3>
                    <p>Sie haben keine Berechtigung, diesen Ordner einzusehen.</p>
                  </div>
                </div>
              ) : (
                <FileSection
                  selectedFolder={selectedFolder}
                  files={files}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  onMonthChange={setSelectedMonth}
                  onYearChange={setSelectedYear}
                  onFileUpload={handleFileUpload}
                  onFileAction={handleFileAction}
                  onFileDelete={handleFileDelete}
                  onFolderEdit={setEditingFolder}
                  onFolderDelete={handleDeleteFolder}
                />
              )}
            </>
          )}

          {/* Teilnehmer Management Modal */}
          {showTeilnehmerManagement && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                  <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <TeilnehmerManagement
                      onBack={handleBackToTeilnehmer}
                      isAdmin={canManageAll}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Invoice Management Modal */}
          {showInvoiceManagement && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                  <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <InvoiceManagement
                      onBack={handleBackToInvoices}
                      dozentId={dozentId}
                      isAdmin={canManageAll}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Edit Folder Dialog */}
      {editingFolder && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleUpdateFolder}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Ordner umbenennen</h3>
                  <input
                    type="text"
                    value={editingFolder.name}
                    onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                    placeholder="Ordnername"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                    required
                  />
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingFolder(null)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Hours Entry Modal */}
      {showHoursDialog && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleHoursSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Stunden eintragen
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <User className="h-4 w-4 inline mr-1" />
                        Teilnehmer
                      </label>
                      <select
                        value={hoursFormData.teilnehmer_id}
                        onChange={(e) => setHoursFormData({ ...hoursFormData, teilnehmer_id: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        required
                      >
                        <option value="">Teilnehmer auswählen</option>
                        {teilnehmer.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Clock className="h-4 w-4 inline mr-1" />
                        Stunden
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        value={hoursFormData.hours}
                        onChange={(e) => setHoursFormData({ ...hoursFormData, hours: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="z.B. 8.5"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Geben Sie die Anzahl der Stunden ein (0.25 Schritte möglich)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        Datum
                      </label>
                      <input
                        type="date"
                        value={hoursFormData.date}
                        onChange={(e) => setHoursFormData({ ...hoursFormData, date: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rechtsgebiet
                      </label>
                      <select
                        value={hoursFormData.legal_area}
                        onChange={(e) => setHoursFormData({ ...hoursFormData, legal_area: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        required
                      >
                        <option value="">Rechtsgebiet auswählen</option>
                        <option value="Zivilrecht">Zivilrecht</option>
                        <option value="Öffentliches Recht">Öffentliches Recht</option>
                        <option value="Strafrecht">Strafrecht</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Beschreibung (optional)
                      </label>
                      <textarea
                        value={hoursFormData.description}
                        onChange={(e) => setHoursFormData({ ...hoursFormData, description: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="Was wurde in dieser Stunde behandelt..."
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Eintragen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHoursDialog(false);
                      setHoursFormData({
                        teilnehmer_id: '',
                        hours: '',
                        date: new Date().toISOString().split('T')[0],
                        description: '',
                        legal_area: ''
                      });
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Activity Dialog */}
      {showActivityDialog && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleActivitySubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Sonstige Tätigkeit hinzufügen
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Clock className="h-4 w-4 inline mr-1" />
                        Stunden
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        value={activityFormData.hours}
                        onChange={(e) => setActivityFormData({ ...activityFormData, hours: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="z.B. 2.5"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Geben Sie die Anzahl der Stunden ein (0.25 Schritte möglich)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        Datum
                      </label>
                      <input
                        type="date"
                        value={activityFormData.date}
                        onChange={(e) => setActivityFormData({ ...activityFormData, date: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tätigkeit
                      </label>
                      <textarea
                        value={activityFormData.description}
                        onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="z.B. Vorbereitung Unterlagen, Korrektur von Arbeiten..."
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Hinzufügen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowActivityDialog(false);
                      setActivityFormData({
                        hours: '',
                        date: new Date().toISOString().split('T')[0],
                        description: ''
                      });
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}