import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, LogOut, Settings, FolderIcon, Plus, Edit, Trash2, Users, FileText, User, Clock, Calendar, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useMessageStore } from '../store/messageStore';
import { useFolderStore } from '../store/folderStore';
import { useFileStore } from '../store/fileStore';
import { useTeilnehmerStore } from '../store/teilnehmerStore';
import { useHoursStore } from '../store/hoursStore';
import { UnreadMessagePopup } from './UnreadMessagePopup';
import { Logo } from './Logo';
import { supabase } from '../lib/supabase';
import { FileSection } from './FileSection';
import { ActivitySection } from './ActivitySection';
import { ParticipantHoursSection } from './ParticipantHoursSection';
import { TeilnehmerManagement } from './TeilnehmerManagement';
import { InvoiceManagement } from './InvoiceManagement';
import { AvailabilitySection } from './AvailabilitySection';
import '../utils/testDatabase'; // This will run the database test

interface DashboardProps {
  isAdmin?: boolean;
}

interface Folder {
  id: string;
  name: string;
  is_system?: boolean;
}

export function Dashboard({ isAdmin = false }: DashboardProps) {
  const navigate = useNavigate();
  const { user, signOut, userRole, isAdmin: isUserAdmin, isBuchhaltung, isVerwaltung, isVertrieb, isDozent } = useAuthStore();
  const { folders, fetchFolders, createFolder, updateFolder, deleteFolder } = useFolderStore();
  const { files, fetchFiles, uploadFile, deleteFile } = useFileStore();
  const { teilnehmer, fetchTeilnehmer } = useTeilnehmerStore();
  const { getCurrentMonthHours, fetchMonthlySummary } = useHoursStore();
  const { messages, fetchMessages, markAsRead, markAllAsRead, setupMessageSubscription } = useMessageStore();
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showTeilnehmerManagement, setShowTeilnehmerManagement] = useState(false);
  const [showInvoiceManagement, setShowInvoiceManagement] = useState(false);
  const [showHoursDialog, setShowHoursDialog] = useState(false);
  const [activityReportMonth, setActivityReportMonth] = useState(new Date().getMonth() + 1);
  const [activityReportYear, setActivityReportYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showUnreadPopup, setShowUnreadPopup] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showAvailabilityPopup, setShowAvailabilityPopup] = useState(false);
  const [currentAvailability, setCurrentAvailability] = useState<{status: string; notes?: string} | null>(null);
  const [hoursFormData, setHoursFormData] = useState({
    teilnehmer_id: '',
    hours: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    legal_area: ''
  });
  const [teilnehmerSearch, setTeilnehmerSearch] = useState('');
  const [teilnehmerSearchResults, setTeilnehmerSearchResults] = useState<any[]>([]);
  const [showTeilnehmerDropdown, setShowTeilnehmerDropdown] = useState(false);
  const [selectedTeilnehmerName, setSelectedTeilnehmerName] = useState('');
  const [activityFormData, setActivityFormData] = useState({
    hours: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const unreadMessages = messages.filter(message => !message.read);

  useEffect(() => {
    fetchFolders();
    fetchMessages();
    fetchTeilnehmer();
    fetchMonthlySummary(undefined, selectedYear, selectedMonth); // Fetch hours data for selected month

    // Setup message subscription
    const unsubscribe = setupMessageSubscription();
    
    // Setup real-time subscriptions
    const { setupRealtimeSubscription: setupTeilnehmerSub, cleanupSubscription: cleanupTeilnehmerSub } = useTeilnehmerStore.getState();
    const { setupRealtimeSubscription: setupHoursSub, cleanupSubscription: cleanupHoursSub } = useHoursStore.getState();
    const { setupRealtimeSubscription: setupFilesSub, cleanupSubscription: cleanupFilesSub } = useFileStore.getState();
    
    setupTeilnehmerSub();
    setupHoursSub();
    setupFilesSub(); // For undownloaded count
    
    return () => {
      unsubscribe();
      cleanupTeilnehmerSub();
      cleanupHoursSub();
      cleanupFilesSub();
    };
  }, [fetchFolders, fetchMessages, setupMessageSubscription]);

  // Refetch monthly summary when month/year changes
  useEffect(() => {
    fetchMonthlySummary(undefined, selectedYear, selectedMonth);
  }, [selectedMonth, selectedYear, fetchMonthlySummary]);

  // Fetch current month availability
  useEffect(() => {
    const fetchCurrentAvailability = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        const { data, error } = await supabase
          .from('dozent_availability')
          .select('capacity_status, notes')
          .eq('dozent_id', user.id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .single();
        
        if (!error && data) {
          setCurrentAvailability({ status: data.capacity_status, notes: data.notes });
        }
      } catch (error) {
        console.error('Error fetching availability:', error);
      }
    };
    
    fetchCurrentAvailability();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      fetchFiles(selectedFolder.id);
      // Setup file subscription for the selected folder
      const { setupRealtimeSubscription } = useFileStore.getState();
      setupRealtimeSubscription(selectedFolder.id);
    }
  }, [selectedFolder, fetchFiles]);

  // Check if selected folder is "Aktive Teilnehmer"
  const isActiveTeilnehmerFolder = selectedFolder?.name === 'Aktive Teilnehmer';
  const isTaetigkeitsberichtFolder = selectedFolder?.name === 'Tätigkeitsbericht';
  const isRechnungenFolder = selectedFolder?.name === 'Rechnungen';
  const isVerfuegbarkeitFolder = selectedFolder?.name === 'Verfügbarkeit';
  
  // Check permissions based on role
  // Dozenten can view their own Rechnungen and Tätigkeitsbericht folders
  const canViewRechnungen = isUserAdmin || isBuchhaltung || isDozent;
  const canViewTaetigkeitsbericht = isUserAdmin || isBuchhaltung || isDozent;
  const canManageAll = isUserAdmin || isBuchhaltung;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

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

  const handleBackToMain = () => {
    setShowTeilnehmerManagement(false);
  };

  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Import the dozent hours store
      const { useDozentHoursStore } = await import('../store/dozentHoursStore');
      const { createDozentHours } = useDozentHoursStore.getState();
      
      await createDozentHours({
        hours: parseFloat(activityFormData.hours),
        date: activityFormData.date,
        description: activityFormData.description
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const hoursData = {
        teilnehmer_id: hoursFormData.teilnehmer_id,
        hours: parseFloat(hoursFormData.hours),
        date: hoursFormData.date,
        description: hoursFormData.description,
        legal_area: hoursFormData.legal_area,
        dozent_id: user.id
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
      await fetchMonthlySummary();
      console.log('Monthly summary refreshed');
    } catch (error) {
      console.error('Error creating hours:', error);
      alert('Fehler beim Speichern der Stunden: ' + error.message);
    }
  };

  return (
    <>
      {showTeilnehmerManagement ? (
        <div className="min-h-screen bg-background">
          <nav className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <div className="flex-shrink-0 flex items-center">
                    <Logo />
                    <span className="ml-2 text-xl font-semibold text-gray-900">Dozenten-Portal</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <button
                    onClick={() => navigate('/messages')}
                    className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
                  >
                    <MessageSquare className="h-5 w-5 sm:mr-2" />
                    <span className="hidden sm:inline">Nachrichten</span>
                    {unreadMessages.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                        {unreadMessages.length > 99 ? '99+' : unreadMessages.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => navigate('/settings')}
                    className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition"
                  >
                    <Settings className="h-5 w-5 sm:mr-2" />
                    <span className="hidden sm:inline">Einstellungen</span>
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-500 hover:text-red-700 focus:outline-none transition"
                  >
                    <LogOut className="h-5 w-5 sm:mr-2" />
                    <span className="hidden sm:inline">Abmelden</span>
                  </button>
                </div>
              </div>
            </div>
          </nav>

          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
              <TeilnehmerManagement
                onBack={handleBackToMain}
                isAdmin={isAdmin}
              />
            </div>
          </main>
        </div>
      ) : (
    <div className="min-h-screen bg-background">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Logo />
                <span className="ml-2 text-xl font-semibold text-gray-900">Dozenten-Portal</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Availability Badge */}
              <button
                onClick={() => setShowAvailabilityPopup(true)}
                className={`inline-flex items-center px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                  currentAvailability?.status === 'available' 
                    ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                    : currentAvailability?.status === 'limited'
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
                    : currentAvailability?.status === 'full'
                    ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                }`}
                title="Verfügbarkeit bearbeiten"
              >
                <Calendar className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">
                  {currentAvailability?.status === 'available' ? 'Verfügbar' 
                    : currentAvailability?.status === 'limited' ? 'Begrenzt'
                    : currentAvailability?.status === 'full' ? 'Ausgelastet'
                    : 'Verfügbarkeit'}
                </span>
              </button>
              <button
                onClick={() => navigate('/messages')}
                className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
              >
                <MessageSquare className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline">Nachrichten</span>
                {unreadMessages.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {unreadMessages.length > 99 ? '99+' : unreadMessages.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition"
              >
                <Settings className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline">Einstellungen</span>
              </button>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-500 hover:text-red-700 focus:outline-none transition"
              >
                <LogOut className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Ordner</h2>
              {selectedFolder?.name === 'Aktive Teilnehmer' && (
                <button
                  onClick={() => setShowTeilnehmerManagement(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Teilnehmer verwalten
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {folders.filter(folder => {
                // Filter folders based on user role
                // Hide Verfügbarkeit folder - it's shown as a badge in the header
                if (folder.name === 'Verfügbarkeit') return false;
                if (userRole === 'verwaltung') {
                  return folder.name !== 'Rechnungen' && folder.name !== 'Tätigkeitsbericht';
                }
                if (userRole === 'vertrieb') {
                  return folder.name === 'Aktive Teilnehmer';
                }
                return true; // Admin, Buchhaltung, and Dozent see all their folders
              }).map((folder) => (
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
                  getCurrentMonthHours={getCurrentMonthHours}
                  isAdmin={canManageAll}
                />
              ) : isRechnungenFolder && canViewRechnungen ? (
                <div className="space-y-6">
                  <InvoiceManagement
                    onBack={handleBackToInvoices}
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
                />
              ) : isVerfuegbarkeitFolder ? (
                <AvailabilitySection isAdmin={canManageAll} />
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

          {/* Invoice Management Modal */}
          {showInvoiceManagement && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={handleBackToInvoices}>
                  <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full relative">
                  <button
                    onClick={handleBackToInvoices}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none z-10"
                  >
                    <X className="h-6 w-6" />
                  </button>
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <InvoiceManagement
                      onBack={handleBackToInvoices}
                      isAdmin={canManageAll}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Availability Popup */}
      {showAvailabilityPopup && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowAvailabilityPopup(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full relative">
              <button
                onClick={() => setShowAvailabilityPopup(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none z-10"
              >
                <X className="h-6 w-6" />
              </button>
              <div className="bg-white">
                <AvailabilitySection 
                  isAdmin={false}
                  onAvailabilityChange={(status) => setCurrentAvailability({ status })}
                />
              </div>
            </div>
          </div>
        </div>
      )}

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
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <User className="h-4 w-4 inline mr-1" />
                        Teilnehmer
                      </label>
                      <input
                        type="text"
                        value={selectedTeilnehmerName || teilnehmerSearch}
                        onChange={async (e) => {
                          const value = e.target.value;
                          setTeilnehmerSearch(value);
                          setSelectedTeilnehmerName('');
                          setHoursFormData({ ...hoursFormData, teilnehmer_id: '' });
                          
                          if (value.length >= 2) {
                            // Search all teilnehmer in database
                            const { data, error } = await supabase
                              .from('teilnehmer')
                              .select('id, name, email')
                              .ilike('name', `%${value}%`)
                              .limit(10);
                            console.log('Teilnehmer search results:', data, error);
                            if (data && data.length > 0) {
                              setTeilnehmerSearchResults(data);
                              setShowTeilnehmerDropdown(true);
                            } else {
                              setTeilnehmerSearchResults([]);
                              setShowTeilnehmerDropdown(false);
                            }
                          } else {
                            setTeilnehmerSearchResults([]);
                            setShowTeilnehmerDropdown(false);
                          }
                        }}
                        onFocus={() => {
                          if (teilnehmerSearchResults.length > 0) {
                            setShowTeilnehmerDropdown(true);
                          }
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="Namen eingeben zum Suchen..."
                        required
                      />
                      {/* Autocomplete dropdown */}
                      {showTeilnehmerDropdown && teilnehmerSearchResults.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                          {teilnehmerSearchResults.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setHoursFormData({ ...hoursFormData, teilnehmer_id: t.id });
                                setSelectedTeilnehmerName(t.name);
                                setTeilnehmerSearch('');
                                setShowTeilnehmerDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                            >
                              <div className="font-medium text-gray-900">{t.name}</div>
                              <div className="text-sm text-gray-500">{t.email}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Show assigned teilnehmer as quick select */}
                      {teilnehmer.length > 0 && !showTeilnehmerDropdown && !selectedTeilnehmerName && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Zugewiesene Teilnehmer:</p>
                          <div className="flex flex-wrap gap-1">
                            {teilnehmer.slice(0, 5).map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  setHoursFormData({ ...hoursFormData, teilnehmer_id: t.id });
                                  setSelectedTeilnehmerName(t.name);
                                }}
                                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
                              >
                                {t.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedTeilnehmerName && (
                        <p className="mt-1 text-xs text-green-600">✓ {selectedTeilnehmerName} ausgewählt</p>
                      )}
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

      {/* Unread Messages Popup */}
      {showUnreadPopup && (
        <UnreadMessagePopup
          messages={unreadMessages}
          onClose={() => setShowUnreadPopup(false)}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
        />
      )}
    </div>
      )}
    </>
  );
}