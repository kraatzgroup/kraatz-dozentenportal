import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { MessageSquare, LogOut, Settings, FolderIcon, Plus, Edit, Trash2, Users, FileText, User, Clock, Calendar, X, GraduationCap, Check, AlertTriangle, Menu, Bell, Upload } from 'lucide-react';
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
import { SecondExamHoursSection } from './SecondExamHoursSection';
import { TeilnehmerManagement } from './TeilnehmerManagement';
import { InvoiceManagement } from './InvoiceManagement';
import { AvailabilitySection } from './AvailabilitySection';
import { useSalesStore } from '../store/salesStore';
import { DozentenDashboard } from './DozentenDashboard';

interface DashboardProps {
  isAdmin?: boolean;
}

interface Folder {
  id: string;
  name: string;
  is_system?: boolean;
}

const EK_SUB_TAB_MAP: Record<string, string> = {
  'einheiten-materialfreigabe': 'einheiten',
  'klausurenkorrekturen': 'klausuren',
  'kommunikation': 'kommunikation',
  'kurszeiten': 'kurszeiten',
};

const EK_SUB_TAB_REVERSE: Record<string, string> = {
  'einheiten': 'einheiten-materialfreigabe',
  'klausuren': 'klausurenkorrekturen',
  'kommunikation': 'kommunikation',
  'kurszeiten': 'kurszeiten',
};

export function Dashboard({ isAdmin = false }: DashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { subTab: urlSubTab } = useParams<{ subTab?: string }>();
  const { user, signOut, userRole, isAdmin: isUserAdmin, isBuchhaltung, isVerwaltung, isVertrieb, isDozent } = useAuthStore();
  const { folders, fetchFolders, createFolder, updateFolder, deleteFolder } = useFolderStore();
  const { files, fetchFiles, uploadFile, deleteFile } = useFileStore();
  const { teilnehmer, fetchTeilnehmer } = useTeilnehmerStore();
  const hoursStore = useHoursStore();
  const { fetchMonthlySummary } = hoursStore;
  const getCurrentMonthHours = hoursStore.getCurrentMonthHours;
  const { messages, fetchMessages, markAsRead, markAllAsRead, setupMessageSubscription } = useMessageStore();
  const { trialLessons, fetchTrialLessons, updateTrialLesson } = useSalesStore();
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  
  // Handle folder selection - always clear localStorage to ensure dashboard loads on page refresh
  const handleSelectFolder = (folder: Folder | null) => {
    setSelectedFolder(folder);
    // Always remove from localStorage so page reload shows dashboard
    localStorage.removeItem('dozentSelectedFolder');
    
    if (folder) {
      // Lazy load data based on folder type
      if (folder.name === 'Aktive Teilnehmer' && teilnehmer.length === 0) {
        fetchTeilnehmer();
      }
      if (folder.id && files.length === 0) {
        fetchFiles(folder.id);
      }
    }
  };
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showTeilnehmerManagement, setShowTeilnehmerManagement] = useState(false);
  const [showInvoiceManagement, setShowInvoiceManagement] = useState(() => {
    return localStorage.getItem('dozentDashboardView') === 'invoices';
  });
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBundeslaenderModal, setShowBundeslaenderModal] = useState(false);
  const [selectedBundeslaender, setSelectedBundeslaender] = useState<string[]>([]);
  const [showActivityDropdown, setShowActivityDropdown] = useState(false);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const activityDropdownRef = React.useRef<HTMLDivElement>(null);
  const [hoursFormData, setHoursFormData] = useState({
    teilnehmer_id: '',
    hours: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    legal_area: '',
    lesson_type: 'einzelunterricht' as 'einzelunterricht' | 'elite_kleingruppe'
  });
  const [teilnehmerSearch, setTeilnehmerSearch] = useState('');
  const [teilnehmerSearchResults, setTeilnehmerSearchResults] = useState<any[]>([]);
  const [showTeilnehmerDropdown, setShowTeilnehmerDropdown] = useState(false);
  const [selectedTeilnehmerName, setSelectedTeilnehmerName] = useState('');
  const [activityFormData, setActivityFormData] = useState({
    hours: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    exam_type: '1. Staatsexamen'
  });
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [isEliteKleingruppeDozent, setIsEliteKleingruppeDozent] = useState(false);
  const [userExamTypes, setUserExamTypes] = useState<string[]>([]);

  // Derive EK view state from URL
  const isEliteKleingruppeRoute = location.pathname.startsWith('/dashboard/elite-kleingruppe');
  const showEliteKleingruppe = isEliteKleingruppeRoute;
  const ekSubTab = urlSubTab ? (EK_SUB_TAB_MAP[urlSubTab] || 'einheiten') : 'einheiten';
  const [duplicateWarning, setDuplicateWarning] = useState<{ show: boolean; existingEntries: any[]; pendingData: any | null }>({
    show: false, existingEntries: [], pendingData: null
  });

  const unreadMessages = messages.filter(message => !message.read);

  // Don't restore selected folder automatically - Dozenten should always start at main dashboard
  // The folder selection is only persisted during the session, not across page reloads

  useEffect(() => {
    // Nur laden wenn Benutzer authentifiziert ist
    if (!user) return;
    
    // Alle Daten beim Start laden
    fetchFolders();
    fetchMessages();
    fetchTeilnehmer();
    fetchTrialLessons();
    fetchMonthlySummary(undefined, selectedYear, selectedMonth);

    // Check if user is an Elite-Kleingruppe dozent
    const checkEliteKleingruppeDozent = async () => {
      if (!user) return;
      const { data } = await supabase.from('elite_kleingruppe_dozenten').select('id').eq('dozent_id', user.id);
      setIsEliteKleingruppeDozent((data && data.length > 0) || false);
    };
    if (isDozent) checkEliteKleingruppeDozent();

    // Fetch user exam_types
    const fetchUserExamTypes = async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('exam_types').eq('id', user.id).single();
      setUserExamTypes(data?.exam_types || ['1. Staatsexamen']);
    };
    fetchUserExamTypes();

    // Setup message subscription
    const cleanup = setupMessageSubscription();
    return cleanup;
  }, [user, fetchFolders, fetchMessages, fetchMonthlySummary, fetchTeilnehmer, fetchTrialLessons, setupMessageSubscription, selectedYear, selectedMonth, isDozent]);

  // Close activity dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activityDropdownRef.current && !activityDropdownRef.current.contains(event.target as Node)) {
        setShowActivityDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch recent activities for dozent
  const fetchRecentActivities = async () => {
    if (!user) return;
    try {
      // Fetch recent hours entries
      const { data: hoursData } = await supabase
        .from('participant_hours')
        .select('id, hours, date, description, created_at')
        .eq('dozent_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch recent file uploads
      const { data: filesData } = await supabase
        .from('files')
        .select('id, name, created_at')
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const activities: any[] = [];

      // Add hours activities
      (hoursData || []).forEach(h => {
        activities.push({
          id: `hours-${h.id}`,
          type: 'hours',
          title: h.description || 'Stunden eingetragen',
          subtitle: `${h.hours} Stunden`,
          timestamp: h.created_at,
          icon: 'clock'
        });
      });

      // Add file activities
      (filesData || []).forEach(f => {
        activities.push({
          id: `file-${f.id}`,
          type: 'file',
          title: f.name,
          subtitle: 'Datei hochgeladen',
          timestamp: f.created_at,
          icon: 'upload'
        });
      });

      // Sort by timestamp and take top 15
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivities(activities.slice(0, 15));
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  };

  // Load activities when dropdown opens
  useEffect(() => {
    if (showActivityDropdown) {
      fetchRecentActivities();
    }
  }, [showActivityDropdown]);

  // Refetch monthly summary when month/year changes
  useEffect(() => {
    if (!user) return;
    fetchMonthlySummary(undefined, selectedYear, selectedMonth);
  }, [user, selectedMonth, selectedYear, fetchMonthlySummary]);

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
  const isProbestundenFolder = selectedFolder?.name === 'Probestunden';
  
  // Filter trial lessons for current user (dozent)
  const myTrialLessons = trialLessons.filter(t => t.dozent_id === user?.id);
  const pendingTrialLessons = myTrialLessons.filter(t => 
    ['requested', 'dozent_assigned', 'confirmed', 'scheduled'].includes(t.status)
  );
  
  // Check permissions based on role
  // Dozenten can view their own Rechnungen and Tätigkeitsbericht folders
  const canViewRechnungen = isUserAdmin || isBuchhaltung || isDozent;
  const canViewTaetigkeitsbericht = isUserAdmin || isBuchhaltung || isDozent;
  const canManageAll = isUserAdmin || isBuchhaltung;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Handle completing a trial lesson - adds hours to Tätigkeitsbericht
  const handleCompleteTrialLesson = async (lesson: typeof trialLessons[0]) => {
    try {
      // Calculate hours from duration (duration is in minutes)
      const durationMinutes = lesson.duration || 60;
      const hours = durationMinutes / 60;
      
      // Create hours entry for Tätigkeitsbericht
      const hoursData = {
        dozent_id: user?.id,
        hours: hours,
        date: lesson.scheduled_date ? new Date(lesson.scheduled_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        description: `Probestunde mit ${lesson.teilnehmer_name}`,
        legal_area: lesson.rechtsgebiet || '',
        teilnehmer_id: null
      };
      
      // Insert directly via supabase
      const { error } = await supabase.from('participant_hours').insert(hoursData);
      if (error) {
        console.error('Error adding hours for trial lesson:', error);
      }
      
      // Update trial lesson status
      await updateTrialLesson(lesson.id, { status: 'completed' });
      
      // Refresh monthly summary
      await fetchMonthlySummary();
    } catch (error) {
      console.error('Error completing trial lesson:', error);
    }
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

  const bundeslaenderList = [
    'Baden-Württemberg',
    'Bayern',
    'Berlin/Brandenburg',
    'Bremen',
    'Hamburg',
    'Hessen',
    'Mecklenburg-Vorpommern',
    'Niedersachsen',
    'Nordrhein-Westfalen',
    'Rheinland-Pfalz',
    'Saarland',
    'Sachsen',
    'Sachsen-Anhalt',
    'Schleswig-Holstein',
    'Thüringen'
  ];

  const handleToggleBundesland = (bundesland: string) => {
    setSelectedBundeslaender(prev => 
      prev.includes(bundesland)
        ? prev.filter(b => b !== bundesland)
        : [...prev, bundesland]
    );
  };

  const handleToggleAllBundeslaender = () => {
    if (selectedBundeslaender.length === bundeslaenderList.length) {
      setSelectedBundeslaender([]);
    } else {
      setSelectedBundeslaender([...bundeslaenderList]);
    }
  };

  const handleCreateBundeslaenderFolders = async () => {
    if (selectedBundeslaender.length === 0) {
      alert('Bitte wählen Sie mindestens ein Bundesland aus.');
      return;
    }

    try {
      for (const bundesland of selectedBundeslaender) {
        await createFolder(bundesland);
      }
      alert(`${selectedBundeslaender.length} Bundesländer-Ordner wurden erfolgreich erstellt!`);
      setShowBundeslaenderModal(false);
      setSelectedBundeslaender([]);
    } catch (error) {
      console.error('Failed to create Bundesländer folders:', error);
      alert('Fehler beim Erstellen der Ordner. Bitte versuchen Sie es erneut.');
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
        description: activityFormData.description,
        exam_type: activityFormData.exam_type
      });
      
      setShowActivityDialog(false);
      setActivityFormData({
        hours: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        exam_type: '1. Staatsexamen'
      });
    } catch (error) {
      console.error('Error creating activity:', error);
      alert('Fehler beim Speichern der Tätigkeit: ' + error.message);
    }
  };

  const saveDashboardHoursEntry = async (hoursData: any) => {
    const { createHours } = useHoursStore.getState();
    await createHours(hoursData);
    
    setShowHoursDialog(false);
    setHoursFormData({
      teilnehmer_id: '',
      hours: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      legal_area: '',
      lesson_type: 'einzelunterricht'
    });
    setSelectedTeilnehmerName('');
    setTeilnehmerSearch('');
    
    await fetchMonthlySummary();
    setActivityRefreshKey(prev => prev + 1);
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
      
      // Check for duplicate entries (same teilnehmer + same date + same dozent)
      const { data: existingEntries, error: checkError } = await supabase
        .from('participant_hours')
        .select('id, hours, date, description, legal_area, teilnehmer:teilnehmer!participant_hours_teilnehmer_id_fkey(name)')
        .eq('dozent_id', user.id)
        .eq('teilnehmer_id', hoursFormData.teilnehmer_id)
        .eq('date', hoursFormData.date);
      
      if (!checkError && existingEntries && existingEntries.length > 0) {
        setDuplicateWarning({
          show: true,
          existingEntries: existingEntries.map((e: any) => ({
            ...e,
            teilnehmer_name: e.teilnehmer?.name || 'Unbekannt'
          })),
          pendingData: hoursData
        });
        return;
      }
      
      await saveDashboardHoursEntry(hoursData);
    } catch (error: any) {
      console.error('Error creating hours:', error);
      alert('Fehler beim Speichern der Stunden: ' + (error?.message || 'Unbekannter Fehler'));
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
                <Logo onClick={isDozent ? () => handleSelectFolder(null) : undefined} />
                <span className="ml-2 text-xl font-semibold text-gray-900">Dozenten-Portal</span>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-2 sm:space-x-4">
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
              {/* Activity Bell */}
              <button
                onClick={() => setShowActivityDropdown(!showActivityDropdown)}
                className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
                title="Letzte Aktivitäten"
              >
                <Bell className="h-5 w-5" />
                {unreadMessages.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {unreadMessages.length > 99 ? '99+' : unreadMessages.length}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => navigate('/messages')}
                className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
                title="Nachrichten"
              >
                <MessageSquare className="h-5 w-5" />
                {unreadMessages.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {unreadMessages.length > 99 ? '99+' : unreadMessages.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition"
                title="Einstellungen"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-500 hover:text-red-700 focus:outline-none transition"
                title="Abmelden"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
            <div className="md:hidden flex items-center space-x-2">
              <button
                onClick={() => setShowActivityDropdown(!showActivityDropdown)}
                className="relative inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
              >
                <Bell className="h-6 w-6" />
                {unreadMessages.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {unreadMessages.length > 99 ? '99+' : unreadMessages.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Activity Dropdown - Works on both desktop and mobile */}
        {showActivityDropdown && (
          <div className="absolute right-2 top-16 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900 text-sm">Letzte Aktivitäten</h3>
            </div>
            <div className="overflow-y-auto max-h-80">
              {recentActivities.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  Keine Aktivitäten
                </div>
              ) : (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        activity.icon === 'clock' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {activity.icon === 'clock' && <Clock className="h-4 w-4 text-blue-600" />}
                        {activity.icon === 'upload' && <Upload className="h-4 w-4 text-green-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                        <p className="text-xs text-gray-500 truncate">{activity.subtitle}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(activity.timestamp).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {currentAvailability && (
                <button
                  onClick={() => {
                    setShowAvailabilityPopup(true);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                    currentAvailability?.status === 'available' 
                      ? 'bg-green-100 text-green-800'
                      : currentAvailability?.status === 'limited'
                      ? 'bg-yellow-100 text-yellow-800'
                      : currentAvailability?.status === 'full'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Calendar className="h-4 w-4 inline mr-2" />
                  {currentAvailability?.status === 'available' ? 'Verfügbar' 
                    : currentAvailability?.status === 'limited' ? 'Begrenzt'
                    : currentAvailability?.status === 'full' ? 'Ausgelastet'
                    : 'Verfügbarkeit'}
                </button>
              )}
              <button
                onClick={() => {
                  navigate('/messages');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <MessageSquare className="h-5 w-5 mr-2" />
                Nachrichten
                {unreadMessages.length > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {unreadMessages.length > 99 ? '99+' : unreadMessages.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  navigate('/settings');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Settings className="h-5 w-5 mr-2" />
                Einstellungen
              </button>
              <button
                onClick={() => {
                  handleSignOut();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-100 flex items-center"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Abmelden
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Ordner-Sektion für alle Benutzer - am Anfang */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {selectedFolder && isDozent && (
                  <button
                    onClick={() => handleSelectFolder(null)}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                      <path d="m15 18-6-6 6-6"/>
                    </svg>
                    Zurück
                  </button>
                )}
                <h2 className="text-lg font-medium text-gray-900">Ordner</h2>
              </div>
              <div className="flex items-center gap-2">
                {canManageAll && (
                  <button
                    onClick={() => setShowBundeslaenderModal(true)}
                    className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1">
                      <path d="M5 12h14"></path>
                      <path d="M12 5v14"></path>
                    </svg>
                    Ordner Bundesländer
                  </button>
                )}
                {selectedFolder?.name === 'Aktive Teilnehmer' && canManageAll && (
                  <button
                    onClick={() => setShowTeilnehmerManagement(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Teilnehmer verwalten
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                    onClick={() => handleSelectFolder(folder)}
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
              {/* Virtual Probestunden Folder - only for Dozenten */}
              {isDozent && (
                <div
                  className={`relative block w-full text-left ${
                    isProbestundenFolder
                      ? 'ring-2 ring-primary'
                      : 'hover:bg-gray-50'
                  } bg-white rounded-lg shadow p-4 transition-all`}
                >
                  <button
                    onClick={() => handleSelectFolder({ id: 'probestunden', name: 'Probestunden', is_system: true })}
                    className="w-full flex items-center text-left"
                  >
                    <GraduationCap className="h-6 w-6 text-primary" />
                    <span className="ml-3 font-medium text-gray-900">Probestunden</span>
                    {pendingTrialLessons.length > 0 && (
                      <span className="ml-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {pendingTrialLessons.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
              {/* Elite-Kleingruppe Folder - only for assigned Dozenten */}
              {isDozent && isEliteKleingruppeDozent && (
                <div
                  className={`relative block w-full text-left ${
                    showEliteKleingruppe
                      ? 'ring-2 ring-primary'
                      : 'hover:bg-gray-50'
                  } bg-white rounded-lg shadow p-4 transition-all`}
                >
                  <button
                    onClick={() => { setSelectedFolder(null); navigate('/dashboard/elite-kleingruppe/einheiten-materialfreigabe'); }}
                    className="w-full flex items-center text-left"
                  >
                    <Users className="h-6 w-6 text-primary" />
                    <span className="ml-3 font-medium text-gray-900">Elite-Kleingruppe</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {selectedFolder && (
            <>
              {isActiveTeilnehmerFolder ? (
                <div className="space-y-6">
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
                    studyGoal="1. Staatsexamen"
                    dozentId={user?.id}
                  />
                  {userExamTypes.includes('2. Staatsexamen') && (
                    <SecondExamHoursSection
                      teilnehmer={teilnehmer}
                      selectedMonth={selectedMonth}
                      selectedYear={selectedYear}
                      onMonthChange={setSelectedMonth}
                      onYearChange={setSelectedYear}
                      onShowTeilnehmerManagement={() => setShowTeilnehmerManagement(true)}
                      onShowHoursDialog={() => setShowHoursDialog(true)}
                      getCurrentMonthHours={getCurrentMonthHours}
                      isAdmin={canManageAll}
                      dozentId={user?.id}
                    />
                  )}
                </div>
              ) : isRechnungenFolder && canViewRechnungen ? (
                <div className="space-y-6">
                  <InvoiceManagement
                    onBack={handleBackToInvoices}
                    dozentId={user?.id}
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
                  key={activityRefreshKey}
                  selectedMonth={activityReportMonth}
                  selectedYear={activityReportYear}
                  onMonthChange={setActivityReportMonth}
                  onYearChange={setActivityReportYear}
                  onShowActivityDialog={() => setShowActivityDialog(true)}
                />
              ) : isVerfuegbarkeitFolder ? (
                <AvailabilitySection isAdmin={canManageAll} />
              ) : isProbestundenFolder ? (
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Meine Probestunden</h3>
                    <p className="mt-1 text-sm text-gray-500">Übersicht aller Probestunden-Anfragen</p>
                  </div>
                  <div className="p-4">
                    <div className="space-y-6">
                        {/* 1. Neue Anfragen - Dozent muss akzeptieren/ablehnen */}
                        <div className="bg-orange-50 rounded-lg p-4">
                          <h4 className="font-medium text-orange-800 mb-3 flex items-center">
                            <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">1</span>
                            Neue Anfragen ({myTrialLessons.filter(t => t.status === 'requested' || t.status === 'dozent_assigned').length})
                          </h4>
                          {myTrialLessons.filter(t => t.status === 'requested' || t.status === 'dozent_assigned').length === 0 ? (
                            <p className="text-sm text-orange-600 italic">Keine neuen Anfragen vorhanden</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {myTrialLessons.filter(t => t.status === 'requested' || t.status === 'dozent_assigned').map(lesson => (
                                <div key={lesson.id} className="bg-white p-3 rounded-lg border border-orange-200">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-medium text-gray-900">{lesson.teilnehmer_name}</p>
                                      <p className="text-sm text-gray-500">{lesson.teilnehmer_email}</p>
                                      {lesson.teilnehmer_phone && (
                                        <p className="text-sm text-gray-500">{lesson.teilnehmer_phone}</p>
                                      )}
                                    </div>
                                    <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">
                                      Angefragt
                                    </span>
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                                    {lesson.rechtsgebiet && (
                                      <p><span className="font-medium">Rechtsgebiet:</span> {lesson.rechtsgebiet}</p>
                                    )}
                                    {lesson.uni_standort && (
                                      <p><span className="font-medium">Uni-Standort:</span> {lesson.uni_standort}</p>
                                    )}
                                    {lesson.landesrecht && (
                                      <p><span className="font-medium">Landesrecht:</span> {lesson.landesrecht}</p>
                                    )}
                                    {lesson.duration && (
                                      <p><span className="font-medium">Dauer:</span> {lesson.duration} Min</p>
                                    )}
                                    {lesson.notes && (
                                      <p><span className="font-medium">Notizen:</span> {lesson.notes}</p>
                                    )}
                                  </div>
                                  <div className="mt-3 flex space-x-2">
                                    <button
                                      onClick={() => updateTrialLesson(lesson.id, { status: 'confirmed', dozent_confirmed: true })}
                                      className="flex-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center"
                                    >
                                      <Check className="h-3 w-3 mr-1" />
                                      Akzeptieren
                                    </button>
                                    <button
                                      onClick={() => updateTrialLesson(lesson.id, { status: 'cancelled' })}
                                      className="flex-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center"
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Ablehnen
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 2. Terminvereinbarung ausstehend - Dozent muss Termin eintragen */}
                        <div className="bg-yellow-50 rounded-lg p-4">
                          <h4 className="font-medium text-yellow-800 mb-3 flex items-center">
                            <span className="bg-yellow-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">2</span>
                            Terminvereinbarung ausstehend ({myTrialLessons.filter(t => t.status === 'confirmed' && !t.scheduled_date).length})
                          </h4>
                          {myTrialLessons.filter(t => t.status === 'confirmed' && !t.scheduled_date).length === 0 ? (
                            <p className="text-sm text-yellow-600 italic">Keine ausstehenden Terminvereinbarungen</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {myTrialLessons.filter(t => t.status === 'confirmed' && !t.scheduled_date).map(lesson => (
                                <div key={lesson.id} className="bg-white p-3 rounded-lg border border-yellow-200">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-medium text-gray-900">{lesson.teilnehmer_name}</p>
                                      <p className="text-sm text-gray-500">{lesson.teilnehmer_email}</p>
                                      {lesson.teilnehmer_phone && (
                                        <p className="text-sm text-gray-500">{lesson.teilnehmer_phone}</p>
                                      )}
                                    </div>
                                    <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                                      Akzeptiert
                                    </span>
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                                    {lesson.rechtsgebiet && (
                                      <p><span className="font-medium">Rechtsgebiet:</span> {lesson.rechtsgebiet}</p>
                                    )}
                                    {lesson.duration && (
                                      <p><span className="font-medium">Dauer:</span> {lesson.duration} Min</p>
                                    )}
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                                      <p className="font-medium flex items-center">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        Bitte vereinbaren Sie einen Termin
                                      </p>
                                      <p className="mt-1 text-blue-600">
                                        Kontaktieren Sie {lesson.teilnehmer_name} per E-Mail oder Telefon.
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <label className="block text-xs font-medium text-gray-700">
                                        Probestunde vereinbart am:
                                      </label>
                                      <div className="flex space-x-2">
                                        <input
                                          type="date"
                                          id={`date-${lesson.id}`}
                                          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                        />
                                        <input
                                          type="time"
                                          id={`time-${lesson.id}`}
                                          defaultValue="12:00"
                                          className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                        />
                                      </div>
                                      <button
                                        onClick={() => {
                                          const dateInput = document.getElementById(`date-${lesson.id}`) as HTMLInputElement;
                                          const timeInput = document.getElementById(`time-${lesson.id}`) as HTMLInputElement;
                                          if (dateInput?.value && timeInput?.value) {
                                            updateTrialLesson(lesson.id, { 
                                              scheduled_date: `${dateInput.value}T${timeInput.value}`, 
                                              status: 'scheduled' 
                                            });
                                          }
                                        }}
                                        className="w-full px-3 py-1.5 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 flex items-center justify-center"
                                      >
                                        <Check className="h-3 w-3 mr-1" />
                                        Termin speichern
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 3. Termin vereinbart */}
                        <div className="bg-green-50 rounded-lg p-4">
                          <h4 className="font-medium text-green-800 mb-3 flex items-center">
                            <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">3</span>
                            Termin vereinbart ({myTrialLessons.filter(t => (t.status === 'confirmed' || t.status === 'scheduled') && t.scheduled_date).length})
                          </h4>
                          {myTrialLessons.filter(t => (t.status === 'confirmed' || t.status === 'scheduled') && t.scheduled_date).length === 0 ? (
                            <p className="text-sm text-green-600 italic">Keine vereinbarten Termine</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {myTrialLessons.filter(t => (t.status === 'confirmed' || t.status === 'scheduled') && t.scheduled_date).map(lesson => (
                                <div key={lesson.id} className="bg-white p-3 rounded-lg border border-green-200">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-medium text-gray-900">{lesson.teilnehmer_name}</p>
                                      <p className="text-sm text-gray-500">{lesson.teilnehmer_email}</p>
                                    </div>
                                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                      Geplant
                                    </span>
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                                    {lesson.rechtsgebiet && (
                                      <p><span className="font-medium">Rechtsgebiet:</span> {lesson.rechtsgebiet}</p>
                                    )}
                                    {lesson.duration && (
                                      <p><span className="font-medium">Dauer:</span> {lesson.duration} Min</p>
                                    )}
                                  </div>
                                  <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                                    <label className="block text-xs font-medium text-green-700 mb-1">
                                      <Calendar className="h-3 w-3 inline mr-1" />
                                      Probestunde vereinbart am:
                                    </label>
                                    <div className="flex space-x-2">
                                      <input
                                        type="date"
                                        defaultValue={lesson.scheduled_date ? new Date(lesson.scheduled_date).toISOString().split('T')[0] : ''}
                                        className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            const currentTime = lesson.scheduled_date 
                                              ? new Date(lesson.scheduled_date).toTimeString().slice(0, 5) 
                                              : '12:00';
                                            updateTrialLesson(lesson.id, { scheduled_date: `${e.target.value}T${currentTime}` });
                                          }
                                        }}
                                      />
                                      <input
                                        type="time"
                                        defaultValue={lesson.scheduled_date ? new Date(lesson.scheduled_date).toTimeString().slice(0, 5) : ''}
                                        className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            const currentDate = lesson.scheduled_date 
                                              ? new Date(lesson.scheduled_date).toISOString().split('T')[0] 
                                              : new Date().toISOString().split('T')[0];
                                            updateTrialLesson(lesson.id, { scheduled_date: `${currentDate}T${e.target.value}` });
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div className="mt-3 flex space-x-2">
                                    <button
                                      onClick={() => handleCompleteTrialLesson(lesson)}
                                      className="flex-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center"
                                    >
                                      <Check className="h-3 w-3 mr-1" />
                                      Durchgeführt
                                    </button>
                                    <button
                                      onClick={() => updateTrialLesson(lesson.id, { status: 'no_show' })}
                                      className="flex-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center"
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Nicht erschienen
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 4. Abgeschlossene Probestunden */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                            <span className="bg-gray-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">4</span>
                            Abgeschlossen ({myTrialLessons.filter(t => ['completed', 'no_show', 'cancelled', 'converted'].includes(t.status)).length})
                          </h4>
                          {myTrialLessons.filter(t => ['completed', 'no_show', 'cancelled', 'converted'].includes(t.status)).length === 0 ? (
                            <p className="text-sm text-gray-500 italic">Keine abgeschlossenen Probestunden</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {myTrialLessons.filter(t => ['completed', 'no_show', 'cancelled', 'converted'].includes(t.status)).map(lesson => (
                                <div key={lesson.id} className="bg-white p-3 rounded-lg border border-gray-200">
                                  <div className="flex justify-between items-start">
                                    <p className="font-medium text-gray-900">{lesson.teilnehmer_name}</p>
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      lesson.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      lesson.status === 'converted' ? 'bg-purple-100 text-purple-800' :
                                      lesson.status === 'no_show' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {lesson.status === 'completed' ? 'Durchgeführt' :
                                       lesson.status === 'converted' ? 'Konvertiert' :
                                       lesson.status === 'no_show' ? 'Nicht erschienen' : 'Abgesagt'}
                                    </span>
                                  </div>
                                  {lesson.scheduled_date && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {new Date(lesson.scheduled_date).toLocaleDateString('de-DE')}
                                    </p>
                                  )}
                                  {lesson.status === 'completed' && lesson.duration && (
                                    <p className="text-xs text-green-600 mt-1">
                                      ✓ {lesson.duration} Min im Tätigkeitsbericht erfasst
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                  </div>
                </div>
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

          {/* DozentenDashboard für Dozenten - nur anzeigen wenn kein Ordner ausgewählt ist */}
          {isDozent && !selectedFolder && (
            <DozentenDashboard 
              showEliteKleingruppe={showEliteKleingruppe}
              ekSubTab={ekSubTab}
              onEkSubTabChange={(tab: string) => navigate(`/dashboard/elite-kleingruppe/${EK_SUB_TAB_REVERSE[tab] || 'einheiten-materialfreigabe'}`)}
              onCloseEliteKleingruppe={() => navigate('/dashboard')} 
            />
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
                      dozentId={user?.id}
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unterrichtsart
                      </label>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="lesson_type"
                            value="einzelunterricht"
                            checked={hoursFormData.lesson_type === 'einzelunterricht'}
                            onChange={(e) => setHoursFormData({ ...hoursFormData, lesson_type: e.target.value as 'einzelunterricht' | 'elite_kleingruppe' })}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                          />
                          <span className="ml-2 text-sm text-gray-700">Einzelunterricht</span>
                        </label>
                      </div>
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
                        legal_area: '',
                        lesson_type: 'einzelunterricht'
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Staatsexamen
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="exam_type"
                            value="1. Staatsexamen"
                            checked={activityFormData.exam_type === '1. Staatsexamen'}
                            onChange={(e) => setActivityFormData({ ...activityFormData, exam_type: e.target.value })}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                          />
                          <span className="ml-2 text-sm text-gray-700">1. Staatsexamen</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="exam_type"
                            value="2. Staatsexamen"
                            checked={activityFormData.exam_type === '2. Staatsexamen'}
                            onChange={(e) => setActivityFormData({ ...activityFormData, exam_type: e.target.value })}
                            className="h-4 w-4 text-amber-600 focus:ring-amber-600 border-gray-300"
                          />
                          <span className="ml-2 text-sm text-gray-700">2. Staatsexamen</span>
                        </label>
                      </div>
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
                        description: '',
                        exam_type: '1. Staatsexamen'
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

      {/* Duplicate Warning Modal */}
      {duplicateWarning.show && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setDuplicateWarning({ show: false, existingEntries: [], pendingData: null })} />
            <div className="relative inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">Mögliches Duplikat erkannt</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Für <strong>{duplicateWarning.existingEntries[0]?.teilnehmer_name}</strong> am{' '}
                      <strong>{new Date(duplicateWarning.pendingData?.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>{' '}
                      {duplicateWarning.existingEntries.length === 1 ? 'existiert bereits ein Eintrag' : `existieren bereits ${duplicateWarning.existingEntries.length} Einträge`}:
                    </p>
                    <div className="mt-3 space-y-2">
                      {duplicateWarning.existingEntries.map((entry: any, idx: number) => (
                        <div key={entry.id || idx} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                          <div className="text-sm">
                            <span className="font-medium text-gray-900">{entry.hours} Std.</span>
                            {entry.legal_area && (
                              <span className="ml-2 text-xs text-gray-500">{entry.legal_area}</span>
                            )}
                            {entry.description && (
                              <span className="ml-2 text-xs text-gray-400">— {entry.description}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                      <p className="text-xs text-gray-500 mb-1">Neuer Eintrag:</p>
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">{duplicateWarning.pendingData?.hours} Std.</span>
                        {duplicateWarning.pendingData?.legal_area && (
                          <span className="ml-2 text-xs text-gray-500">{duplicateWarning.pendingData.legal_area}</span>
                        )}
                        {duplicateWarning.pendingData?.description && (
                          <span className="ml-2 text-xs text-gray-400">— {duplicateWarning.pendingData.description}</span>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-600">
                      Möchten Sie den Eintrag trotzdem hinzufügen?
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await saveDashboardHoursEntry(duplicateWarning.pendingData);
                      setDuplicateWarning({ show: false, existingEntries: [], pendingData: null });
                    } catch (error) {
                      console.error('Error saving duplicate hours:', error);
                      alert('Fehler beim Speichern der Stunden');
                    }
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-amber-600 text-base font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 sm:w-auto sm:text-sm"
                >
                  Trotzdem eintragen
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateWarning({ show: false, existingEntries: [], pendingData: null })}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bundesländer Modal */}
      {showBundeslaenderModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowBundeslaenderModal(false)} />
            <div className="relative inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Bundesländer-Ordner erstellen</h3>
                  <button
                    onClick={() => setShowBundeslaenderModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Wählen Sie die Bundesländer aus, für die Ordner erstellt werden sollen.
                </p>
                <div className="mb-4">
                  <button
                    onClick={handleToggleAllBundeslaender}
                    className="text-sm text-primary hover:text-primary/80 font-medium"
                  >
                    {selectedBundeslaender.length === bundeslaenderList.length ? 'Alle abwählen' : 'Alle auswählen'}
                  </button>
                  <span className="ml-3 text-sm text-gray-500">
                    ({selectedBundeslaender.length} von {bundeslaenderList.length} ausgewählt)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                  {bundeslaenderList.map((bundesland) => (
                    <label
                      key={bundesland}
                      className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBundeslaender.includes(bundesland)}
                        onChange={() => handleToggleBundesland(bundesland)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">{bundesland}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  onClick={handleCreateBundeslaenderFolders}
                  disabled={selectedBundeslaender.length === 0}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedBundeslaender.length > 0 
                    ? `${selectedBundeslaender.length} Ordner erstellen` 
                    : 'Ordner erstellen'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBundeslaenderModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Abbrechen
                </button>
              </div>
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