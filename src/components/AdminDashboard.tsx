import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, LogOut, Users, Clock, FileText, Calendar, Edit2, X, Check, Plus, ChevronDown, ChevronUp, Receipt, Search, Download, Eye, Mail, Send } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useFileStore } from '../store/fileStore';
import { useToastStore } from '../store/toastStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { supabase } from '../lib/supabase';
import { PDFViewerModal } from './PDFViewerModal';
import { useState as useReactState } from 'react';
import { DozentCard } from './DozentCard';
import { RecentUploads } from './RecentUploads';
import { DozentPreviewModal } from './DozentPreviewModal';
import { Logo } from './Logo';
import { Chat } from './Chat';
import { TeilnehmerForm } from './TeilnehmerForm';
import { TeilnehmerDetailView } from './TeilnehmerDetailView';
import { DozentForm } from './DozentForm';
import { DozentListModal } from './DozentListModal';
import { DozentFilesModal } from './DozentFilesModal';
import { DozentTaetigkeitsberichtModal } from './DozentTaetigkeitsberichtModal';
import { DozentTeilnehmerModal } from './DozentTeilnehmerModal';

// Helper function to check if teilnehmer is active based on contract dates
const isContractActive = (t: any): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (t.contract_start && t.contract_end) {
    const start = new Date(t.contract_start);
    const end = new Date(t.contract_end);
    return today >= start && today <= end;
  }
  // If no contract dates, fall back to status field
  return t.status === 'active';
};

// Helper function to calculate contract progress percentage
const getContractProgress = (t: any): { percent: number; daysLeft: number; totalDays: number } => {
  if (!t.contract_start || !t.contract_end) {
    return { percent: 0, daysLeft: 0, totalDays: 0 };
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(t.contract_start);
  start.setHours(0, 0, 0, 0);
  const end = new Date(t.contract_end);
  end.setHours(0, 0, 0, 0);
  
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysPassed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Before contract starts
  if (today < start) {
    return { percent: 0, daysLeft: totalDays, totalDays };
  }
  
  // After contract ends
  if (today > end) {
    return { percent: 100, daysLeft: 0, totalDays };
  }
  
  // During contract
  const percent = Math.min(100, Math.max(0, Math.round((daysPassed / totalDays) * 100)));
  return { percent, daysLeft, totalDays };
};

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const { userRole, isAdmin, isBuchhaltung, isVerwaltung, isVertrieb } = useAuthStore();
  const { unreadCount, fetchUnreadCount } = useChatStore();
  const { undownloadedCount, fetchUndownloadedCount } = useFileStore();
  const { addToast } = useToastStore();
  const [dozenten, setDozenten] = useState<Profile[]>([]);
  const [teilnehmer, setTeilnehmer] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDozent, setSelectedDozent] = useState<Profile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isCheckingDocuments, setIsCheckingDocuments] = useReactState(false);
  const [checkResult, setCheckResult] = useReactState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dozenten' | 'teilnehmer' | 'nachrichten' | 'rechnungen' | 'kalender' | 'emails'>('dozenten');
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarEntries, setCalendarEntries] = useState<any[]>([]);
  const [showCalendarEntryModal, setShowCalendarEntryModal] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [calendarEntryTitle, setCalendarEntryTitle] = useState('');
  const [calendarEntryDescription, setCalendarEntryDescription] = useState('');
  const [calendarEntryColor, setCalendarEntryColor] = useState('blue');
  const [editingCalendarEntry, setEditingCalendarEntry] = useState<any>(null);
  const [showTeilnehmerPreview, setShowTeilnehmerPreview] = useState(false);
  const [previewTeilnehmer, setPreviewTeilnehmer] = useState<any>(null);
  const [previewType, setPreviewType] = useState<'25' | '75' | 'end'>('end');
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<string>('');
  const [selectedEmailRecipients, setSelectedEmailRecipients] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [allRechnungen, setAllRechnungen] = useState<any[]>([]);
  const [submittedInvoices, setSubmittedInvoices] = useState<any[]>([]);
  const [rechnungenFilter, setRechnungenFilter] = useState<string>('alle');
  const [rechnungenSearch, setRechnungenSearch] = useState<string>('');
  const [invoiceFilterMonth, setInvoiceFilterMonth] = useState<number | 'alle'>('alle');
  const [invoiceFilterYear, setInvoiceFilterYear] = useState<number>(new Date().getFullYear());
  const [teilnehmerFilter, setTeilnehmerFilter] = useState<'alle' | 'aktiv' | 'abgeschlossen' | '25' | '75'>('alle');
  const [editingTeilnehmer, setEditingTeilnehmer] = useState<string | null>(null);
  const [editContractStart, setEditContractStart] = useState<string>('');
  const [editContractEnd, setEditContractEnd] = useState<string>('');
  const [showTeilnehmerForm, setShowTeilnehmerForm] = useState(false);
  const [selectedTeilnehmerForEdit, setSelectedTeilnehmerForEdit] = useState<any>(null);
  const [expandedTeilnehmer, setExpandedTeilnehmer] = useState<string | null>(null);
  const [showStundenzettel, setShowStundenzettel] = useState(false);
  const [selectedTeilnehmerForStundenzettel, setSelectedTeilnehmerForStundenzettel] = useState<any>(null);
  const [showDozentForm, setShowDozentForm] = useState(false);
  const [selectedDozentForEdit, setSelectedDozentForEdit] = useState<any>(null);
  const [showDozentList, setShowDozentList] = useState(false);
  const [showDozentFiles, setShowDozentFiles] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activityLogData, setActivityLogData] = useState<any[]>([]);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoicePreviewData, setInvoicePreviewData] = useState<any>(null);
  const [invoicePreviewItems, setInvoicePreviewItems] = useState<any[]>([]);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState('');
  const [pdfViewerFileName, setPdfViewerFileName] = useState('');
  const [selectedDozentForFiles, setSelectedDozentForFiles] = useState<any>(null);
  const [selectedFolderType, setSelectedFolderType] = useState<string>('');
  const [showDozentTaetigkeitsbericht, setShowDozentTaetigkeitsbericht] = useState(false);
  const [showDozentTeilnehmer, setShowDozentTeilnehmer] = useState(false);

  useEffect(() => {
    fetchDozenten();
    fetchTeilnehmer();
    fetchCalendarEntries();
    fetchEmailTemplates();
    fetchUnreadCount();
    fetchUndownloadedCount();
    fetchAllRechnungen();
    fetchSubmittedInvoices();
    
    // Setup real-time subscription for file uploads (undownloaded count)
    const { setupRealtimeSubscription, cleanupSubscription } = useFileStore.getState();
    setupRealtimeSubscription(); // No folder ID for admin dashboard
    
    return () => {
      cleanupSubscription();
    };
  }, []);

  const fetchCalendarEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_entries')
        .select('*')
        .order('entry_date');
      
      if (error) throw error;
      setCalendarEntries(data || []);
    } catch (error) {
      console.error('Error fetching calendar entries:', error);
    }
  };

  const handleSaveCalendarEntry = async () => {
    if (!selectedCalendarDate || !calendarEntryTitle.trim()) return;
    
    try {
      const entryData = {
        title: calendarEntryTitle.trim(),
        description: calendarEntryDescription.trim() || null,
        entry_date: selectedCalendarDate.toISOString().split('T')[0],
        color: calendarEntryColor
      };

      if (editingCalendarEntry) {
        const { error } = await supabase
          .from('calendar_entries')
          .update(entryData)
          .eq('id', editingCalendarEntry.id);
        
        if (error) throw error;
        addToast('Eintrag aktualisiert', 'success');
      } else {
        const { error } = await supabase
          .from('calendar_entries')
          .insert(entryData);
        
        if (error) throw error;
        addToast('Eintrag erstellt', 'success');
      }

      setShowCalendarEntryModal(false);
      setCalendarEntryTitle('');
      setCalendarEntryDescription('');
      setCalendarEntryColor('blue');
      setSelectedCalendarDate(null);
      setEditingCalendarEntry(null);
      fetchCalendarEntries();
    } catch (error) {
      console.error('Error saving calendar entry:', error);
      addToast('Fehler beim Speichern', 'error');
    }
  };

  const handleDeleteCalendarEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('calendar_entries')
        .delete()
        .eq('id', entryId);
      
      if (error) throw error;
      addToast('Eintrag gelöscht', 'success');
      fetchCalendarEntries();
    } catch (error) {
      console.error('Error deleting calendar entry:', error);
      addToast('Fehler beim Löschen', 'error');
    }
  };

  const fetchEmailTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('id');
      
      if (error) throw error;
      setEmailTemplates(data || []);
    } catch (error) {
      console.error('Error fetching email templates:', error);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    
    try {
      const { error } = await supabase
        .from('email_templates')
        .upsert({
          id: editingTemplate,
          title: emailTemplates.find(t => t.id === editingTemplate)?.title || editingTemplate,
          icon: emailTemplates.find(t => t.id === editingTemplate)?.icon || '✉️',
          description: emailTemplates.find(t => t.id === editingTemplate)?.description || '',
          subject: emailSubject,
          body: emailBody,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      addToast('Vorlage gespeichert', 'success');
      fetchEmailTemplates();
      setShowTemplateEditor(false);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
      addToast('Fehler beim Speichern', 'error');
    }
  };

  const fetchTeilnehmer = async () => {
    try {
      // Fetch teilnehmer
      const { data: teilnehmerData, error: teilnehmerError } = await supabase
        .from('teilnehmer')
        .select('*')
        .order('name');
      
      if (teilnehmerError) throw teilnehmerError;

      // Fetch completed hours from participant_hours table
      const { data: hoursData, error: hoursError } = await supabase
        .from('participant_hours')
        .select('teilnehmer_id, hours');

      if (hoursError) throw hoursError;

      // Calculate total hours per teilnehmer
      const hoursMap: { [key: string]: number } = {};
      (hoursData || []).forEach((entry: { teilnehmer_id: string; hours: number }) => {
        if (!hoursMap[entry.teilnehmer_id]) {
          hoursMap[entry.teilnehmer_id] = 0;
        }
        hoursMap[entry.teilnehmer_id] += Number(entry.hours);
      });

      // Merge completed hours into teilnehmer data
      const teilnehmerWithHours = (teilnehmerData || []).map(t => ({
        ...t,
        completed_hours: hoursMap[t.id] || 0
      }));

      setTeilnehmer(teilnehmerWithHours);
    } catch (error) {
      console.error('Error fetching teilnehmer:', error);
    }
  };

  const fetchAllRechnungen = async () => {
    try {
      // Get all folders named "Rechnungen"
      const { data: folders, error: foldersError } = await supabase
        .from('folders')
        .select('id, user_id')
        .eq('name', 'Rechnungen');

      if (foldersError) throw foldersError;

      if (!folders || folders.length === 0) {
        setAllRechnungen([]);
        return;
      }

      // Get all files from these folders
      const folderIds = folders.map(f => f.id);
      const { data: files, error: filesError } = await supabase
        .from('files')
        .select('*')
        .in('folder_id', folderIds)
        .order('created_at', { ascending: false });

      if (filesError) throw filesError;

      // Map folder_id to user_id for dozent lookup
      const folderToUser = folders.reduce((acc, f) => {
        acc[f.id] = f.user_id;
        return acc;
      }, {} as Record<string, string>);

      // Get dozent names
      const userIds = [...new Set(folders.map(f => f.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const userToName = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p.full_name;
        return acc;
      }, {} as Record<string, string>);

      // Combine data
      const rechnungenWithDozent = (files || []).map(file => ({
        ...file,
        dozent_id: folderToUser[file.folder_id],
        dozent_name: userToName[folderToUser[file.folder_id]] || 'Unbekannt'
      }));

      setAllRechnungen(rechnungenWithDozent);
    } catch (error) {
      console.error('Error fetching rechnungen:', error);
      setAllRechnungen([]);
    }
  };

  const fetchSubmittedInvoices = async () => {
    try {
      // Get all invoices with status 'submitted' (from dozents who have submitted for admin review)
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('*, profiles!invoices_dozent_id_fkey(full_name, profile_picture_url)')
        .in('status', ['submitted', 'paid'])
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      // Transform data to include dozent_name and profile_picture_url
      const invoicesWithDozent = (invoices || []).map(inv => ({
        ...inv,
        dozent_name: inv.profiles?.full_name || 'Unbekannt',
        profile_picture_url: inv.profiles?.profile_picture_url || null
      }));

      setSubmittedInvoices(invoicesWithDozent);
    } catch (error) {
      console.error('Error fetching submitted invoices:', error);
      setSubmittedInvoices([]);
    }
  };

  const fetchDozenten = async () => {
    try {
      console.log('Fetching dozenten...');
      
      let query = supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      
      // Filter based on role
      if (isVertrieb) {
        // Vertrieb can see dozenten
        query = query.eq('role', 'dozent');
      } else if (isVerwaltung) {
        // Verwaltung can see dozenten (but with restricted folder access)
        query = query.eq('role', 'dozent');
      } else {
        // Admin and Buchhaltung can see all dozenten
        query = query.eq('role', 'dozent');
      }

      const { data, error } = await query;

      if (error) throw error;
      console.log('Dozenten fetched:', data?.length || 0);
      setDozenten(data || []);
    } catch (error) {
      console.error('Error fetching dozenten:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const startEditingContract = (t: any) => {
    setEditingTeilnehmer(t.id);
    setEditContractStart(t.contract_start || '');
    setEditContractEnd(t.contract_end || '');
  };

  const cancelEditingContract = () => {
    setEditingTeilnehmer(null);
    setEditContractStart('');
    setEditContractEnd('');
  };

  const saveContract = async (teilnehmerId: string) => {
    try {
      const { error } = await supabase
        .from('teilnehmer')
        .update({
          contract_start: editContractStart || null,
          contract_end: editContractEnd || null
        })
        .eq('id', teilnehmerId);

      if (error) throw error;

      // Refresh teilnehmer list
      await fetchTeilnehmer();
      cancelEditingContract();
      addToast('Vertragslaufzeit wurde gespeichert', 'success');
    } catch (error) {
      console.error('Error saving contract:', error);
      addToast('Fehler beim Speichern der Vertragslaufzeit', 'error');
    }
  };

  const handleDeleteDozent = async (dozentId: string) => {
    try {
      // Delete the dozent profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', dozentId);

      if (error) throw error;

      addToast('Dozent erfolgreich gelöscht', 'success');
      fetchDozenten();
    } catch (error) {
      console.error('Error deleting dozent:', error);
      addToast('Fehler beim Löschen des Dozenten', 'error');
    }
  };

  const fetchActivityLog = async () => {
    try {
      // Fetch files
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select(`
          id, name, file_path, created_at, downloaded_at,
          folder:folders(name),
          uploaded_by_profile:profiles!files_uploaded_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filesError) {
        console.error('Error fetching files:', filesError);
      }
      console.log('Files fetched:', filesData?.length || 0);

      // Fetch invoices - simplified query without join first
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, month, year, status, submitted_at, dozent_id, total_amount')
        .in('status', ['submitted', 'paid'])
        .order('submitted_at', { ascending: false })
        .limit(50);

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
      }
      console.log('Invoices fetched:', invoicesData?.length || 0, invoicesData);

      // Fetch dozent names separately
      const dozentIds = [...new Set((invoicesData || []).map(inv => inv.dozent_id))];
      const { data: dozentProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', dozentIds);
      
      const dozentMap = new Map((dozentProfiles || []).map(p => [p.id, p.full_name]));

      const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
      
      const files = (filesData || []).map(f => ({
        ...f,
        type: 'file'
      }));

      const invoices = (invoicesData || []).map(inv => {
        const dozentName = dozentMap.get(inv.dozent_id) || 'Unbekannt';
        return {
          id: inv.id,
          name: `Rechnung ${monthNames[inv.month - 1]} ${inv.year}`,
          file_path: '',
          created_at: inv.submitted_at || new Date().toISOString(),
          downloaded_at: null,
          folder: { name: 'Rechnungen' },
          uploaded_by_profile: { full_name: dozentName },
          type: 'invoice',
          invoice_data: {
            dozent_id: inv.dozent_id,
            month: inv.month,
            year: inv.year,
            total_amount: inv.total_amount,
            dozent_name: dozentName
          }
        };
      });

      const combined = [...files, ...invoices]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setActivityLogData(combined);
    } catch (error) {
      console.error('Error fetching activity log:', error);
    }
  };

  const handleMonthlyDocumentCheck = async () => {
    setIsCheckingDocuments(true);
    setCheckResult(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-monthly-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          forceCheck: true,
          manualExecution: true
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setCheckResult({
          success: true,
          data: result
        });
      } else {
        throw new Error(result.error || 'Fehler beim Ausführen der Dokumentenprüfung');
      }
    } catch (error) {
      console.error('Error running document check:', error);
      setCheckResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    } finally {
      setIsCheckingDocuments(false);
    }
  };
  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Logo />
                <span className="ml-2 text-lg sm:text-xl font-semibold text-gray-900 hidden sm:block">Admin Dashboard</span>
                <span className="ml-2 text-sm font-semibold text-gray-900 sm:hidden">Admin</span>
              </div>
            </div>
            
            {/* Mobile menu button */}
            <div className="sm:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
              >
                <span className="sr-only">Open main menu</span>
                {!isMobileMenuOpen ? (
                  <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : (
                  <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Desktop menu */}
            <div className="hidden sm:flex items-center space-x-2 lg:space-x-4">
              {(isAdmin || isBuchhaltung) && (
              <button
                onClick={() => navigate('/users')}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition"
              >
                <Users className="h-4 w-4 lg:h-5 lg:w-5 mr-1 lg:mr-2" />
                <span className="hidden lg:inline">Benutzerverwaltung</span>
              </button>
              )}
              <button
                onClick={() => navigate('/messages')}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
              >
                <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5 mr-1 lg:mr-2" />
                <span className="hidden lg:inline">Nachrichten</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 lg:h-5 lg:w-5 flex items-center justify-center font-bold text-xs">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-red-500 hover:text-red-700 focus:outline-none transition"
              >
                <LogOut className="h-4 w-4 lg:h-5 lg:w-5 mr-1 lg:mr-2" />
                <span className="hidden lg:inline">Abmelden</span>
              </button>
            </div>
          </div>
          
          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="sm:hidden">
              <div className="pt-2 pb-3 space-y-1 border-t border-gray-200">
                {(isAdmin || isBuchhaltung) && (
                <button
                  onClick={() => {
                    navigate('/users');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-primary hover:text-primary/80 hover:bg-gray-50"
                >
                  <Users className="h-5 w-5 mr-3" />
                  Benutzerverwaltung
                </button>
                )}
                <button
                  onClick={() => {
                    navigate('/messages');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-primary hover:text-primary/80 hover:bg-gray-50 relative"
                >
                  <MessageSquare className="h-5 w-5 mr-3" />
                  Nachrichten
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    handleSignOut();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-red-500 hover:text-red-700 hover:bg-gray-50"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Abmelden
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-4 sm:py-6 px-2 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('dozenten')}
                className={`${
                  activeTab === 'dozenten'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Dozenten</span>
                <span className="ml-1 sm:ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {dozenten.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('teilnehmer')}
                className={`${
                  activeTab === 'teilnehmer'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <Users className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Teilnehmer</span>
                <span className="ml-1 sm:ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {teilnehmer.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('rechnungen')}
                className={`${
                  activeTab === 'rechnungen'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Rechnungen</span>
                <span className="ml-1 sm:ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {allRechnungen.length + submittedInvoices.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('nachrichten')}
                className={`${
                  activeTab === 'nachrichten'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center relative`}
              >
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Nachrichten</span>
                {unreadCount > 0 && (
                  <span className="ml-1 sm:ml-2 bg-red-500 text-white py-0.5 px-2 rounded-full text-xs">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('kalender')}
                className={`${
                  activeTab === 'kalender'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Kalender</span>
              </button>
              <button
                onClick={() => setActiveTab('emails')}
                className={`${
                  activeTab === 'emails'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">E-Mails</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'dozenten' && (
          <>
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4 pt-3 pb-3 sm:pt-5 sm:pb-5">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-primary/60 mr-2" />
                  <h2 className="text-base sm:text-lg font-medium text-gray-900">Letzte Uploads</h2>
                  {undownloadedCount > 0 && (
                    <span className="ml-2 sm:ml-3 inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {undownloadedCount} neue
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    fetchActivityLog();
                    setShowActivityLog(true);
                  }}
                  className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
                >
                  <Clock className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Aktivitätsprotokoll</span>
                  <span className="sm:hidden">Alle</span>
                </button>
              </div>
              <RecentUploads />
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-4 pt-3 pb-3 sm:pt-5 sm:pb-5">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-primary/60 mr-2" />
                  <h2 className="text-base sm:text-lg font-medium text-gray-900">Dozenten Übersicht</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDozentList(true)}
                    className="flex items-center px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
                  >
                    <Users className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Liste anzeigen</span>
                    <span className="sm:hidden">Liste</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDozentForEdit(null);
                      setShowDozentForm(true);
                    }}
                    className="flex items-center px-3 py-1.5 sm:px-4 sm:py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm"
                  >
                    <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Dozent hinzufügen</span>
                    <span className="sm:hidden">Hinzufügen</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                  <div className="col-span-full flex justify-center py-6 sm:py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : dozenten.length === 0 ? (
                  <div className="col-span-full bg-white shadow rounded-lg p-6 text-center text-gray-500">
                    Keine Dozenten vorhanden
                  </div>
                ) : (
                  dozenten.map((dozent) => (
                    <DozentCard 
                      key={dozent.id} 
                      dozent={dozent} 
                      userRole={userRole}
                      onEdit={(d) => {
                        setSelectedDozentForEdit(d);
                        setShowDozentForm(true);
                      }}
                      onDelete={(d) => {
                        if (window.confirm(`Möchten Sie "${d.full_name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
                          handleDeleteDozent(d.id);
                        }
                      }}
                      onFolderClick={(d, folderType) => {
                        setSelectedDozentForFiles(d);
                        setSelectedFolderType(folderType);
                        if (folderType === 'Tätigkeitsbericht') {
                          setShowDozentTaetigkeitsbericht(true);
                        } else if (folderType === 'Aktive Teilnehmer') {
                          setShowDozentTeilnehmer(true);
                        } else {
                          setShowDozentFiles(true);
                        }
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'teilnehmer' && (
          <div className="mb-8">
            <div className="flex flex-col gap-3 mb-4 pt-3 pb-3 sm:pt-5 sm:pb-5">
              {/* Header with Add Button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-primary/60 mr-2" />
                  <h2 className="text-base sm:text-lg font-medium text-gray-900">Teilnehmer Übersicht</h2>
                </div>
                <button
                  onClick={() => {
                    setSelectedTeilnehmerForEdit(null);
                    setShowTeilnehmerForm(true);
                  }}
                  className="flex items-center px-3 py-1.5 sm:px-4 sm:py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm"
                >
                  <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Teilnehmer hinzufügen</span>
                  <span className="sm:hidden">Hinzufügen</span>
                </button>
              </div>
              {/* Filter Buttons - scrollable on mobile */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setTeilnehmerFilter('alle')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    teilnehmerFilter === 'alle'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Alle ({teilnehmer.length})
                </button>
                <button
                  onClick={() => setTeilnehmerFilter('aktiv')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    teilnehmerFilter === 'aktiv'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Aktiv ({teilnehmer.filter(t => isContractActive(t)).length})
                </button>
                <button
                  onClick={() => setTeilnehmerFilter('abgeschlossen')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    teilnehmerFilter === 'abgeschlossen'
                      ? 'bg-gray-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Abgeschl. ({teilnehmer.filter(t => !isContractActive(t)).length})
                </button>
                <div className="h-4 w-px bg-gray-300 mx-1"></div>
                <button
                  onClick={() => setTeilnehmerFilter('25')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    teilnehmerFilter === '25'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  25% ({teilnehmer.filter(t => {
                    const progress = getContractProgress(t);
                    return progress.percent >= 20 && progress.percent <= 30 && isContractActive(t);
                  }).length})
                </button>
                <button
                  onClick={() => setTeilnehmerFilter('75')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    teilnehmerFilter === '75'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  75% ({teilnehmer.filter(t => {
                    const progress = getContractProgress(t);
                    return progress.percent >= 70 && progress.percent <= 80 && isContractActive(t);
                  }).length})
                </button>
              </div>
            </div>
            
            {teilnehmer.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
                Keine Teilnehmer vorhanden
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3">
                  {teilnehmer
                    .filter(t => {
                      if (teilnehmerFilter === 'alle') return true;
                      if (teilnehmerFilter === 'aktiv') return isContractActive(t);
                      if (teilnehmerFilter === 'abgeschlossen') return !isContractActive(t);
                      if (teilnehmerFilter === '25') {
                        const progress = getContractProgress(t);
                        return progress.percent >= 20 && progress.percent <= 30 && isContractActive(t);
                      }
                      if (teilnehmerFilter === '75') {
                        const progress = getContractProgress(t);
                        return progress.percent >= 70 && progress.percent <= 80 && isContractActive(t);
                      }
                      return true;
                    })
                    .map((t) => (
                    <div key={t.id} className="bg-white shadow rounded-lg p-4">
                      {/* Always visible: Name, Status */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-medium">
                              {t.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{t.name}</div>
                            <div className="text-xs text-gray-500">{t.email}</div>
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isContractActive(t) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {isContractActive(t) ? 'Aktiv' : 'Abgeschl.'}
                        </span>
                      </div>
                      
                      {/* Always visible: Vertrag & Dozenten */}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Vertrag:</span>
                          <span className="text-gray-900">
                            {t.contract_start && t.contract_end ? (
                              <>
                                {new Date(t.contract_start).toLocaleDateString('de-DE')} - {new Date(t.contract_end).toLocaleDateString('de-DE')}
                              </>
                            ) : (
                              <span className="text-gray-400">Nicht festgelegt</span>
                            )}
                          </span>
                        </div>

                        {/* Contract Progress Bar */}
                        {t.contract_start && t.contract_end && (() => {
                          const progress = getContractProgress(t);
                          return (
                            <div className="pt-1">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-500">Fortschritt</span>
                                <span className={`font-medium ${progress.percent >= 100 ? 'text-gray-500' : progress.percent >= 75 ? 'text-orange-600' : 'text-primary'}`}>
                                  {progress.percent}%
                                  {progress.daysLeft > 0 && progress.percent < 100 && (
                                    <span className="text-gray-400 font-normal ml-1">({progress.daysLeft} Tage übrig)</span>
                                  )}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all ${
                                    progress.percent >= 100 ? 'bg-gray-400' : 
                                    progress.percent >= 75 ? 'bg-orange-500' : 
                                    'bg-primary'
                                  }`}
                                  style={{ width: `${progress.percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Dozenten - always visible */}
                        {t.dozent_zivilrecht_id && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Dozent ZR:</span>
                            <span className="text-gray-900">{dozenten.find(d => d.id === t.dozent_zivilrecht_id)?.full_name || '-'}</span>
                          </div>
                        )}
                        {t.dozent_strafrecht_id && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Dozent SR:</span>
                            <span className="text-gray-900">{dozenten.find(d => d.id === t.dozent_strafrecht_id)?.full_name || '-'}</span>
                          </div>
                        )}
                        {t.dozent_oeffentliches_recht_id && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Dozent ÖR:</span>
                            <span className="text-gray-900">{dozenten.find(d => d.id === t.dozent_oeffentliches_recht_id)?.full_name || '-'}</span>
                          </div>
                        )}

                        {/* Expandable section */}
                        {(t.study_goal || (t.legal_areas && t.legal_areas.length > 0) || t.booked_hours) && (
                          <>
                            <button
                              onClick={() => setExpandedTeilnehmer(expandedTeilnehmer === t.id ? null : t.id)}
                              className="w-full flex items-center justify-center py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              {expandedTeilnehmer === t.id ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-1" />
                                  Weniger anzeigen
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                  Mehr anzeigen
                                </>
                              )}
                            </button>

                            {expandedTeilnehmer === t.id && (
                              <div className="space-y-2 pt-2 border-t">
                                {/* Studienziel */}
                                {t.study_goal && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">Studienziel:</span>
                                    <span className="text-gray-900 text-right">{t.study_goal}</span>
                                  </div>
                                )}

                                {/* Rechtsgebiete */}
                                {t.legal_areas && t.legal_areas.length > 0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">Rechtsgebiete:</span>
                                    <span className="text-gray-900 text-right">{t.legal_areas.join(', ')}</span>
                                  </div>
                                )}

                                {/* Stundenpaket with progress */}
                                {t.booked_hours && (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-500">Stunden:</span>
                                      <span className="text-gray-900">
                                        <span className="text-green-600 font-medium">{t.completed_hours || 0}</span>
                                        <span className="text-gray-400"> / </span>
                                        <span>{t.booked_hours}</span>
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-500">Abgehalten:</span>
                                      <span className="text-green-600">{t.completed_hours || 0} Std.</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-500">Ausstehend:</span>
                                      <span className={`${(t.booked_hours - (t.completed_hours || 0)) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                        {t.booked_hours - (t.completed_hours || 0)} Std.
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setSelectedTeilnehmerForStundenzettel(t);
                                        setShowStundenzettel(true);
                                      }}
                                      className="w-full mt-2 px-2 py-1 text-xs text-primary bg-primary/10 rounded hover:bg-primary/20 transition-colors"
                                    >
                                      Stundenzettel anzeigen →
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* Edit Button */}
                        <div className="pt-2 border-t mt-2">
                          <button
                            onClick={() => {
                              setSelectedTeilnehmerForEdit(t);
                              setShowTeilnehmerForm(true);
                            }}
                            className="w-full flex items-center justify-center px-3 py-1.5 text-sm text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors"
                          >
                            <Edit2 className="h-3 w-3 mr-1.5" />
                            Bearbeiten
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block bg-white shadow rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Vertragslaufzeit
                          </th>
                          <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                            Studienziel
                          </th>
                          <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                            Dozenten
                          </th>
                          <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                            Stunden
                          </th>
                          <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {teilnehmer
                          .filter(t => {
                            if (teilnehmerFilter === 'alle') return true;
                            if (teilnehmerFilter === 'aktiv') return isContractActive(t);
                            if (teilnehmerFilter === 'abgeschlossen') return !isContractActive(t);
                            if (teilnehmerFilter === '25') {
                              const progress = getContractProgress(t);
                              return progress.percent >= 20 && progress.percent <= 30 && isContractActive(t);
                            }
                            if (teilnehmerFilter === '75') {
                              const progress = getContractProgress(t);
                              return progress.percent >= 70 && progress.percent <= 80 && isContractActive(t);
                            }
                            return true;
                          })
                          .map((t) => (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setSelectedTeilnehmerForEdit(t);
                                  setShowTeilnehmerForm(true);
                                }}
                                className="flex items-center text-left hover:bg-gray-100 rounded-lg p-1 -m-1 transition-colors"
                              >
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <span className="text-primary font-medium text-sm">
                                    {t.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                                  </span>
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-gray-900 hover:text-primary">{t.name}</div>
                                  <div className="text-xs text-gray-500">{t.email}</div>
                                </div>
                              </button>
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              {editingTeilnehmer === t.id ? (
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="date"
                                    value={editContractStart}
                                    onChange={(e) => setEditContractStart(e.target.value)}
                                    className="text-xs border border-gray-300 rounded px-2 py-1 w-28"
                                  />
                                  <span className="text-gray-400">-</span>
                                  <input
                                    type="date"
                                    value={editContractEnd}
                                    onChange={(e) => setEditContractEnd(e.target.value)}
                                    className="text-xs border border-gray-300 rounded px-2 py-1 w-28"
                                  />
                                  <button
                                    onClick={() => saveContract(t.id)}
                                    className="p-1 text-green-600 hover:text-green-800"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={cancelEditingContract}
                                    className="p-1 text-red-600 hover:text-red-800"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <div className="text-sm text-gray-500">
                                      {t.contract_start && t.contract_end ? (
                                        <>
                                          <Calendar className="h-3 w-3 inline mr-1" />
                                          {new Date(t.contract_start).toLocaleDateString('de-DE')} - {new Date(t.contract_end).toLocaleDateString('de-DE')}
                                        </>
                                      ) : (
                                        <span className="text-gray-400">Nicht festgelegt</span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => startEditingContract(t)}
                                      className="p-1 text-gray-400 hover:text-primary"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                  {/* Progress Bar for Desktop */}
                                  {t.contract_start && t.contract_end && (() => {
                                    const progress = getContractProgress(t);
                                    return (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-20 bg-gray-200 rounded-full h-1.5">
                                          <div 
                                            className={`h-1.5 rounded-full ${
                                              progress.percent >= 100 ? 'bg-gray-400' : 
                                              progress.percent >= 75 ? 'bg-orange-500' : 
                                              'bg-primary'
                                            }`}
                                            style={{ width: `${progress.percent}%` }}
                                          />
                                        </div>
                                        <span className={`text-xs ${
                                          progress.percent >= 100 ? 'text-gray-500' : 
                                          progress.percent >= 75 ? 'text-orange-600' : 
                                          'text-primary'
                                        }`}>
                                          {progress.percent}%
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="text-sm text-gray-500">
                                {t.study_goal || '-'}
                              </div>
                            </td>
                            <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                              <div className="text-xs text-gray-500 space-y-0.5">
                                {t.dozent_zivilrecht_id && (
                                  <div><span className="text-gray-400">ZR:</span> {dozenten.find(d => d.id === t.dozent_zivilrecht_id)?.full_name}</div>
                                )}
                                {t.dozent_strafrecht_id && (
                                  <div><span className="text-gray-400">SR:</span> {dozenten.find(d => d.id === t.dozent_strafrecht_id)?.full_name}</div>
                                )}
                                {t.dozent_oeffentliches_recht_id && (
                                  <div><span className="text-gray-400">ÖR:</span> {dozenten.find(d => d.id === t.dozent_oeffentliches_recht_id)?.full_name}</div>
                                )}
                                {!t.dozent_zivilrecht_id && !t.dozent_strafrecht_id && !t.dozent_oeffentliches_recht_id && '-'}
                              </div>
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              {t.booked_hours ? (
                                <button
                                  onClick={() => {
                                    setSelectedTeilnehmerForStundenzettel(t);
                                    setShowStundenzettel(true);
                                  }}
                                  className="text-xs text-left hover:bg-gray-100 rounded p-1 -m-1 transition-colors w-24"
                                >
                                  <div className="flex items-center space-x-1">
                                    <span className="text-green-600 font-medium">{t.completed_hours || 0}</span>
                                    <span className="text-gray-400">/</span>
                                    <span className="text-gray-600">{t.booked_hours}</span>
                                  </div>
                                  {/* Hours Progress Bar */}
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                    <div 
                                      className={`h-1.5 rounded-full transition-all ${
                                        (t.completed_hours || 0) >= t.booked_hours ? 'bg-green-500' : 
                                        (t.completed_hours || 0) / t.booked_hours >= 0.75 ? 'bg-orange-500' : 
                                        'bg-primary'
                                      }`}
                                      style={{ width: `${Math.min(100, ((t.completed_hours || 0) / t.booked_hours) * 100)}%` }}
                                    />
                                  </div>
                                  <div className="text-gray-400 mt-0.5 hover:text-primary">
                                    {t.booked_hours - (t.completed_hours || 0) > 0 
                                      ? `${t.booked_hours - (t.completed_hours || 0)} ausstehend`
                                      : 'Abgeschlossen'}
                                  </div>
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                isContractActive(t) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {isContractActive(t) ? 'Aktiv' : 'Abgeschlossen'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'rechnungen' && (
          <div className="mb-8 space-y-8">
            {/* Submitted Invoices Section */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <FileText className="h-5 w-5 text-primary mr-2" />
                  Übermittelte Rechnungen
                  {submittedInvoices.filter(i => i.status === 'submitted').length > 0 && (
                    <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {submittedInvoices.filter(i => i.status === 'submitted').length} zur Bearbeitung
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <select
                    value={invoiceFilterMonth}
                    onChange={(e) => setInvoiceFilterMonth(e.target.value === 'alle' ? 'alle' : parseInt(e.target.value))}
                    className="text-sm rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                  >
                    <option value="alle">Alle Monate</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2023, i).toLocaleDateString('de-DE', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={invoiceFilterYear}
                    onChange={(e) => setInvoiceFilterYear(parseInt(e.target.value))}
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
              
              {(() => {
                // Filter invoices by month/year
                const filteredInvoices = invoiceFilterMonth === 'alle'
                  ? submittedInvoices.filter(i => i.year === invoiceFilterYear)
                  : submittedInvoices.filter(i => i.month === invoiceFilterMonth && i.year === invoiceFilterYear);
                
                if (filteredInvoices.length === 0) {
                  return (
                    <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
                      <FileText className="mx-auto h-10 w-10 text-gray-300" />
                      <p className="mt-2 text-gray-500">Keine übermittelten Rechnungen für diesen Zeitraum</p>
                    </div>
                  );
                }
                
                return (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="divide-y divide-gray-200">
                      {filteredInvoices.map((invoice: any) => (
                        <div key={invoice.id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-gray-50">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {invoice.profile_picture_url ? (
                                <img 
                                  src={invoice.profile_picture_url} 
                                  alt={invoice.dozent_name}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-primary font-medium text-lg">
                                  {invoice.dozent_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                                </span>
                              )}
                            </div>
                            <div className="ml-3">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  invoice.status === 'submitted' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {invoice.status === 'submitted' ? 'Übermittelt' : 'Bezahlt'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500">{invoice.dozent_name}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(2023, invoice.month - 1).toLocaleDateString('de-DE', { month: 'long' })} {invoice.year}
                                {' • '}Erstellt: {new Date(invoice.created_at).toLocaleDateString('de-DE')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-13 sm:ml-0">
                            {/* Preview Button */}
                            <button
                              onClick={async () => {
                                const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
                                try {
                                  // Fetch full invoice data
                                  const { data: invoiceData } = await supabase
                                    .from('invoices')
                                    .select(`
                                      *,
                                      dozent:profiles!invoices_dozent_id_fkey(full_name, email, phone, tax_id, bank_name, iban, bic, street, house_number, postal_code, city)
                                    `)
                                    .eq('id', invoice.id)
                                    .single();
                                  
                                  if (!invoiceData) {
                                    addToast('Rechnung nicht gefunden', 'error');
                                    return;
                                  }

                                  // If file_path exists, show uploaded PDF
                                  if (invoiceData.file_path) {
                                    const { data: urlData } = supabase.storage
                                      .from('invoices')
                                      .getPublicUrl(invoiceData.file_path);

                                    if (urlData?.publicUrl) {
                                      setPdfViewerUrl(urlData.publicUrl);
                                      setPdfViewerFileName(`Rechnung_${monthNames[invoice.month - 1]}_${invoice.year}_${invoice.dozent_name}.pdf`);
                                      setPdfViewerOpen(true);
                                      return;
                                    }
                                  }

                                  // Otherwise generate PDF from data
                                  const { data: participantHours } = await supabase
                                    .from('participant_hours')
                                    .select(`
                                      date, hours, description, legal_area,
                                      teilnehmer:teilnehmer(name)
                                    `)
                                    .eq('dozent_id', invoiceData.dozent_id)
                                    .gte('date', invoiceData.period_start)
                                    .lte('date', invoiceData.period_end)
                                    .order('date', { ascending: true });

                                  const { data: dozentHours } = await supabase
                                    .from('dozent_hours')
                                    .select('date, hours, description')
                                    .eq('dozent_id', invoiceData.dozent_id)
                                    .gte('date', invoiceData.period_start)
                                    .lte('date', invoiceData.period_end)
                                    .order('date', { ascending: true });

                                  const { generateInvoicePDFBlob } = await import('../utils/invoicePDFGenerator');
                                  
                                  const pdfBlob = await generateInvoicePDFBlob({
                                    invoice: { ...invoiceData, dozent: invoiceData.dozent },
                                    participantHours: (participantHours || []) as any,
                                    dozentHours: (dozentHours || []) as any
                                  });

                                  const pdfUrl = URL.createObjectURL(pdfBlob);
                                  setPdfViewerUrl(pdfUrl);
                                  setPdfViewerFileName(`Rechnung_${monthNames[invoice.month - 1]}_${invoice.year}_${invoice.dozent_name}.pdf`);
                                  setPdfViewerOpen(true);
                                } catch (error) {
                                  console.error('Error loading PDF:', error);
                                  addToast('Fehler beim Laden der PDF-Vorschau', 'error');
                                }
                              }}
                              className="inline-flex items-center px-2 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                              title="Vorschau"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {/* Download Button */}
                            <button
                              onClick={async () => {
                                const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
                                try {
                                  // Fetch full invoice data
                                  const { data: invoiceData } = await supabase
                                    .from('invoices')
                                    .select(`
                                      *,
                                      dozent:profiles!invoices_dozent_id_fkey(full_name, email, phone, tax_id, bank_name, iban, bic, street, house_number, postal_code, city)
                                    `)
                                    .eq('id', invoice.id)
                                    .single();
                                  
                                  if (!invoiceData) {
                                    addToast('Rechnung nicht gefunden', 'error');
                                    return;
                                  }

                                  // If file_path exists, download uploaded PDF
                                  if (invoiceData.file_path) {
                                    const { data: urlData } = supabase.storage
                                      .from('invoices')
                                      .getPublicUrl(invoiceData.file_path);

                                    if (urlData?.publicUrl) {
                                      const link = document.createElement('a');
                                      link.href = urlData.publicUrl;
                                      link.download = `Rechnung_${monthNames[invoice.month - 1]}_${invoice.year}_${invoice.dozent_name}.pdf`;
                                      link.target = '_blank';
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      return;
                                    }
                                  }

                                  // Otherwise generate and download PDF
                                  const { data: participantHours } = await supabase
                                    .from('participant_hours')
                                    .select(`
                                      date, hours, description, legal_area,
                                      teilnehmer:teilnehmer(name)
                                    `)
                                    .eq('dozent_id', invoiceData.dozent_id)
                                    .gte('date', invoiceData.period_start)
                                    .lte('date', invoiceData.period_end)
                                    .order('date', { ascending: true });

                                  const { data: dozentHours } = await supabase
                                    .from('dozent_hours')
                                    .select('date, hours, description')
                                    .eq('dozent_id', invoiceData.dozent_id)
                                    .gte('date', invoiceData.period_start)
                                    .lte('date', invoiceData.period_end)
                                    .order('date', { ascending: true });

                                  const { generateInvoicePDF } = await import('../utils/invoicePDFGenerator');
                                  
                                  await generateInvoicePDF({
                                    invoice: { ...invoiceData, dozent: invoiceData.dozent },
                                    participantHours: (participantHours || []) as any,
                                    dozentHours: (dozentHours || []) as any
                                  });
                                } catch (error) {
                                  console.error('Error downloading PDF:', error);
                                  addToast('Fehler beim Herunterladen der PDF', 'error');
                                }
                              }}
                              className="inline-flex items-center px-2 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                              title="Herunterladen"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            {invoice.status === 'submitted' && (
                              <button
                                onClick={async () => {
                                  try {
                                    await supabase
                                      .from('invoices')
                                      .update({ status: 'paid', paid_at: new Date().toISOString() })
                                      .eq('id', invoice.id);
                                    addToast('Rechnung als bezahlt markiert', 'success');
                                    fetchSubmittedInvoices();
                                  } catch (error) {
                                    console.error('Error updating invoice:', error);
                                    addToast('Fehler beim Aktualisieren', 'error');
                                  }
                                }}
                                className="inline-flex items-center px-3 py-1.5 border border-green-300 text-xs font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100"
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Als bezahlt markieren
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Paid Invoices Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Check className="h-5 w-5 text-green-600 mr-2" />
                Bezahlte Rechnungen
                {submittedInvoices.filter(i => i.status === 'paid').length > 0 && (
                  <span className="ml-2 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {submittedInvoices.filter(i => i.status === 'paid').length}
                  </span>
                )}
              </h3>
              
              {/* Filter by Month */}
              <div className="mb-4 flex flex-col sm:flex-row gap-4">
                <div className="flex-shrink-0">
                  <select
                    value={rechnungenFilter}
                    onChange={(e) => setRechnungenFilter(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="alle">Alle Monate</option>
                    {(() => {
                      // Generate last 12 months
                      const months = [];
                      const now = new Date();
                      for (let i = 0; i < 12; i++) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        const label = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
                        months.push(<option key={value} value={value}>{label}</option>);
                      }
                      return months;
                    })()}
                  </select>
                </div>
                
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Nach Dozent suchen..."
                    value={rechnungenSearch}
                    onChange={(e) => setRechnungenSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {/* Paid Invoices List */}
              {(() => {
                // Filter paid invoices
                let paidInvoices = submittedInvoices.filter(i => i.status === 'paid');
                
                // Filter by month
                if (rechnungenFilter !== 'alle') {
                  const [filterYear, filterMonth] = rechnungenFilter.split('-').map(Number);
                  paidInvoices = paidInvoices.filter(i => i.year === filterYear && i.month === filterMonth);
                }
                
                // Filter by search
                if (rechnungenSearch.trim()) {
                  const search = rechnungenSearch.toLowerCase();
                  paidInvoices = paidInvoices.filter(i => 
                    i.dozent_name?.toLowerCase().includes(search) ||
                    i.invoice_number?.toLowerCase().includes(search)
                  );
                }

                if (paidInvoices.length === 0) {
                  return (
                    <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                      <Check className="mx-auto h-12 w-12 text-gray-300" />
                      <p className="mt-3 text-gray-500">Keine bezahlten Rechnungen gefunden</p>
                    </div>
                  );
                }

                return (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="divide-y divide-gray-200">
                      {paidInvoices.map((invoice: any) => (
                        <div key={invoice.id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-gray-50">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {invoice.profile_picture_url ? (
                                <img 
                                  src={invoice.profile_picture_url} 
                                  alt={invoice.dozent_name}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-green-600 font-medium text-lg">
                                  {invoice.dozent_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                                </span>
                              )}
                            </div>
                            <div className="ml-3">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Bezahlt
                                </span>
                              </div>
                              <p className="text-sm text-gray-500">{invoice.dozent_name}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(2023, invoice.month - 1).toLocaleDateString('de-DE', { month: 'long' })} {invoice.year}
                                {invoice.paid_at && (
                                  <> • Bezahlt am: {new Date(invoice.paid_at).toLocaleDateString('de-DE')}</>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-13 sm:ml-0">
                            {/* Preview Button */}
                            <button
                              onClick={async () => {
                                const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
                                try {
                                  // Fetch full invoice data
                                  const { data: invoiceData } = await supabase
                                    .from('invoices')
                                    .select(`
                                      *,
                                      dozent:profiles!invoices_dozent_id_fkey(full_name, email, phone, tax_id, bank_name, iban, bic, street, house_number, postal_code, city)
                                    `)
                                    .eq('id', invoice.id)
                                    .single();
                                  
                                  if (!invoiceData) {
                                    addToast('Rechnung nicht gefunden', 'error');
                                    return;
                                  }

                                  // If file_path exists, show uploaded PDF
                                  if (invoiceData.file_path) {
                                    const { data: urlData } = supabase.storage
                                      .from('invoices')
                                      .getPublicUrl(invoiceData.file_path);

                                    if (urlData?.publicUrl) {
                                      setPdfViewerUrl(urlData.publicUrl);
                                      setPdfViewerFileName(`${invoice.invoice_number}.pdf`);
                                      setPdfViewerOpen(true);
                                      return;
                                    }
                                  }

                                  // Generate simple PDF preview
                                  const { jsPDF } = await import('jspdf');
                                  const doc = new jsPDF();
                                  
                                  // Header
                                  doc.setFontSize(20);
                                  doc.text('RECHNUNG', 105, 20, { align: 'center' });
                                  
                                  doc.setFontSize(10);
                                  doc.text(invoiceData.dozent?.full_name || '', 20, 40);
                                  if (invoiceData.dozent?.street) {
                                    doc.text(`${invoiceData.dozent.street} ${invoiceData.dozent.house_number || ''}`, 20, 45);
                                  }
                                  if (invoiceData.dozent?.postal_code) {
                                    doc.text(`${invoiceData.dozent.postal_code} ${invoiceData.dozent.city || ''}`, 20, 50);
                                  }
                                  
                                  doc.text(`Rechnungsnummer: ${invoiceData.invoice_number}`, 140, 40);
                                  doc.text(`Datum: ${new Date(invoiceData.created_at).toLocaleDateString('de-DE')}`, 140, 45);
                                  doc.text(`Zeitraum: ${monthNames[invoiceData.month - 1]} ${invoiceData.year}`, 140, 50);
                                  
                                  // Total
                                  let y = 80;
                                  doc.setFont('helvetica', 'bold');
                                  doc.text('Gesamtbetrag:', 20, y);
                                  doc.text(`${(invoiceData.total_amount || 0).toFixed(2)} €`, 80, y);
                                  
                                  // Status
                                  y += 15;
                                  doc.setFont('helvetica', 'normal');
                                  doc.text(`Status: ${invoiceData.status === 'paid' ? 'Bezahlt' : 'Übermittelt'}`, 20, y);
                                  if (invoiceData.paid_at) {
                                    doc.text(`Bezahlt am: ${new Date(invoiceData.paid_at).toLocaleDateString('de-DE')}`, 20, y + 8);
                                  }
                                  
                                  // Bank details
                                  y += 30;
                                  doc.setFontSize(9);
                                  if (invoiceData.dozent?.bank_name) {
                                    doc.text('Bankverbindung:', 20, y);
                                    doc.text(`Bank: ${invoiceData.dozent.bank_name}`, 20, y + 5);
                                    doc.text(`IBAN: ${invoiceData.dozent.iban || ''}`, 20, y + 10);
                                    doc.text(`BIC: ${invoiceData.dozent.bic || ''}`, 20, y + 15);
                                  }
                                  
                                  const pdfBlob = doc.output('blob');
                                  const pdfUrl = URL.createObjectURL(pdfBlob);
                                  setPdfViewerUrl(pdfUrl);
                                  setPdfViewerFileName(`${invoice.invoice_number}.pdf`);
                                  setPdfViewerOpen(true);
                                } catch (error) {
                                  console.error('Error generating preview:', error);
                                  addToast('Fehler beim Laden der Vorschau', 'error');
                                }
                              }}
                              className="inline-flex items-center px-2 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                              title="Vorschau"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {/* Download Button */}
                            <button
                              onClick={() => {
                                addToast('Bitte nutzen Sie die Vorschau zum Herunterladen', 'success');
                              }}
                              className="inline-flex items-center px-2 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                              title="Herunterladen"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === 'nachrichten' && (
          <div className="mb-8">
            <Chat />
          </div>
        )}

        {activeTab === 'kalender' && (
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => {
                    if (calendarMonth === 0) {
                      setCalendarMonth(11);
                      setCalendarYear(calendarYear - 1);
                    } else {
                      setCalendarMonth(calendarMonth - 1);
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <ChevronUp className="h-5 w-5 text-gray-600 rotate-[-90deg]" />
                </button>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {new Date(calendarYear, calendarMonth).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                </h2>
                <button
                  onClick={() => {
                    if (calendarMonth === 11) {
                      setCalendarMonth(0);
                      setCalendarYear(calendarYear + 1);
                    } else {
                      setCalendarMonth(calendarMonth + 1);
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <ChevronUp className="h-5 w-5 text-gray-600 rotate-90" />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                  <div key={day} className="text-center text-xs sm:text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const firstDay = new Date(calendarYear, calendarMonth, 1);
                  const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
                  const daysInMonth = lastDay.getDate();
                  let startDay = firstDay.getDay() - 1;
                  if (startDay < 0) startDay = 6;

                  const days = [];
                  
                  // Empty cells for days before the first of the month
                  for (let i = 0; i < startDay; i++) {
                    days.push(<div key={`empty-${i}`} className="h-20 sm:h-24"></div>);
                  }

                  // Days of the month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const currentDate = new Date(calendarYear, calendarMonth, day);
                    const isToday = new Date().toDateString() === currentDate.toDateString();
                    
                    // Find contracts ending on this day
                    const contractsEndingToday = teilnehmer.filter(t => {
                      if (!t.contract_end) return false;
                      const endDate = new Date(t.contract_end);
                      return endDate.getDate() === day && 
                             endDate.getMonth() === calendarMonth && 
                             endDate.getFullYear() === calendarYear;
                    });

                    // Find 25% milestones for this day
                    const milestones25 = teilnehmer.filter(t => {
                      if (!t.contract_start || !t.contract_end) return false;
                      const start = new Date(t.contract_start);
                      const end = new Date(t.contract_end);
                      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                      const milestone25Date = new Date(start.getTime() + totalDays * 0.25 * 24 * 60 * 60 * 1000);
                      return milestone25Date.getDate() === day && 
                             milestone25Date.getMonth() === calendarMonth && 
                             milestone25Date.getFullYear() === calendarYear;
                    });

                    // Find 75% milestones for this day
                    const milestones75 = teilnehmer.filter(t => {
                      if (!t.contract_start || !t.contract_end) return false;
                      const start = new Date(t.contract_start);
                      const end = new Date(t.contract_end);
                      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                      const milestone75Date = new Date(start.getTime() + totalDays * 0.75 * 24 * 60 * 60 * 1000);
                      return milestone75Date.getDate() === day && 
                             milestone75Date.getMonth() === calendarMonth && 
                             milestone75Date.getFullYear() === calendarYear;
                    });

                    // Find custom calendar entries for this day
                    const entriesForDay = calendarEntries.filter(e => {
                      const entryDate = new Date(e.entry_date);
                      return entryDate.getDate() === day && 
                             entryDate.getMonth() === calendarMonth && 
                             entryDate.getFullYear() === calendarYear;
                    });

                    const colorClasses: { [key: string]: string } = {
                      blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                      green: 'bg-green-100 text-green-700 hover:bg-green-200',
                      yellow: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
                      purple: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
                      orange: 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    };

                    days.push(
                      <div 
                        key={day} 
                        className={`h-20 sm:h-24 border rounded-lg p-1 cursor-pointer hover:bg-gray-50 ${
                          isToday ? 'border-primary bg-primary/5' : 'border-gray-200'
                        } overflow-hidden`}
                        onDoubleClick={() => {
                          setSelectedCalendarDate(new Date(calendarYear, calendarMonth, day));
                          setCalendarEntryTitle('');
                          setCalendarEntryDescription('');
                          setCalendarEntryColor('blue');
                          setEditingCalendarEntry(null);
                          setShowCalendarEntryModal(true);
                        }}
                      >
                        <div className={`text-xs sm:text-sm font-medium mb-1 ${
                          isToday ? 'text-primary' : 'text-gray-700'
                        }`}>
                          {day}
                        </div>
                        <div className="space-y-0.5 overflow-y-auto max-h-14 sm:max-h-16">
                          {milestones25.map(t => (
                            <div 
                              key={`25-${t.id}`}
                              className="text-xs bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded truncate cursor-pointer hover:bg-yellow-200"
                              title={`25% Vertragslaufzeit: ${t.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTeilnehmer(t);
                                setPreviewType('25');
                                setShowTeilnehmerPreview(true);
                              }}
                            >
                              🔔 25% {t.name}
                            </div>
                          ))}
                          {milestones75.map(t => (
                            <div 
                              key={`75-${t.id}`}
                              className="text-xs bg-orange-100 text-orange-700 px-1 py-0.5 rounded truncate cursor-pointer hover:bg-orange-200"
                              title={`75% Vertragslaufzeit: ${t.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTeilnehmer(t);
                                setPreviewType('75');
                                setShowTeilnehmerPreview(true);
                              }}
                            >
                              ⏰ 75% {t.name}
                            </div>
                          ))}
                          {contractsEndingToday.map(t => (
                            <div 
                              key={t.id}
                              className="text-xs bg-red-100 text-red-700 px-1 py-0.5 rounded truncate cursor-pointer hover:bg-red-200"
                              title={`Vertragsende: ${t.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTeilnehmer(t);
                                setPreviewType('end');
                                setShowTeilnehmerPreview(true);
                              }}
                            >
                              📋 {t.name}
                            </div>
                          ))}
                          {entriesForDay.map(entry => (
                            <div 
                              key={entry.id}
                              className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer ${colorClasses[entry.color] || colorClasses.blue}`}
                              title={entry.description || entry.title}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCalendarDate(new Date(entry.entry_date));
                                setCalendarEntryTitle(entry.title);
                                setCalendarEntryDescription(entry.description || '');
                                setCalendarEntryColor(entry.color);
                                setEditingCalendarEntry(entry);
                                setShowCalendarEntryModal(true);
                              }}
                            >
                              {entry.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return days;
                })()}
              </div>

              {/* Legend */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Legende</h3>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🔔</span>
                    <div className="w-4 h-4 bg-yellow-100 rounded"></div>
                    <span className="text-sm text-gray-600">25% Vertragslaufzeit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">⏰</span>
                    <div className="w-4 h-4 bg-orange-100 rounded"></div>
                    <span className="text-sm text-gray-600">75% Vertragslaufzeit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📋</span>
                    <div className="w-4 h-4 bg-red-100 rounded"></div>
                    <span className="text-sm text-gray-600">Vertragsende</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary bg-primary/5 rounded"></div>
                    <span className="text-sm text-gray-600">Heute</span>
                  </div>
                </div>
              </div>

              {/* Upcoming Contract Endings */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Anstehende Vertragsenden (nächste 30 Tage)</h3>
                <div className="space-y-2">
                  {(() => {
                    const today = new Date();
                    const in30Days = new Date();
                    in30Days.setDate(today.getDate() + 30);
                    
                    const upcomingEndings = teilnehmer
                      .filter(t => {
                        if (!t.contract_end) return false;
                        const endDate = new Date(t.contract_end);
                        return endDate >= today && endDate <= in30Days;
                      })
                      .sort((a, b) => new Date(a.contract_end).getTime() - new Date(b.contract_end).getTime());

                    if (upcomingEndings.length === 0) {
                      return (
                        <p className="text-sm text-gray-500">Keine Vertragsenden in den nächsten 30 Tagen</p>
                      );
                    }

                    return upcomingEndings.map(t => (
                      <div 
                        key={t.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setPreviewTeilnehmer(t);
                          setPreviewType('end');
                          setShowTeilnehmerPreview(true);
                        }}
                      >
                        <div>
                          <p className="font-medium text-gray-900">{t.name}</p>
                          <p className="text-sm text-gray-500">
                            {t.dozent_name && `Dozent: ${t.dozent_name}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-red-600">
                            {new Date(t.contract_end).toLocaleDateString('de-DE')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {Math.ceil((new Date(t.contract_end).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))} Tage
                          </p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'emails' && (
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-6">Standard E-Mails an Teilnehmer</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Email Templates */}
                  <div className="lg:col-span-1">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Vorlagen</h3>
                    <div className="space-y-2">
                      {(emailTemplates.length > 0 ? emailTemplates : [
                        { id: 'welcome', title: 'Willkommen', icon: '👋', description: 'Begrüßung neuer Teilnehmer', subject: '', body: '', is_html: false },
                        { id: '25percent', title: '25% Meilenstein', icon: '🔔', description: 'Erinnerung bei 25% Vertragslaufzeit', subject: '', body: '', is_html: false },
                        { id: '75percent', title: '75% Meilenstein', icon: '⏰', description: 'Erinnerung bei 75% Vertragslaufzeit', subject: '', body: '', is_html: false },
                        { id: 'reminder', title: 'Erinnerung', icon: '📝', description: 'Allgemeine Erinnerung', subject: '', body: '', is_html: false },
                        { id: 'contract_end', title: 'Vertragsende', icon: '📋', description: 'Info zum Vertragsende', subject: '', body: '', is_html: false }
                      ]).map(template => (
                        <div key={template.id} className="relative group">
                          <button
                            onClick={() => {
                              setSelectedEmailTemplate(template.id);
                              setEmailSubject(template.subject || '');
                              setEmailBody(template.body || '');
                            }}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              selectedEmailTemplate === template.id
                                ? 'border-primary bg-primary/5'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{template.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900">{template.title}</p>
                                <p className="text-xs text-gray-500 truncate">{template.description}</p>
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTemplate(template.id);
                              setEmailSubject(template.subject || '');
                              setEmailBody(template.body || '');
                              setShowTemplateEditor(true);
                            }}
                            className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded shadow-sm"
                            title="Vorlage bearbeiten"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {/* Custom message option */}
                      <button
                        onClick={() => {
                          setSelectedEmailTemplate('custom');
                          setEmailSubject('');
                          setEmailBody('');
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedEmailTemplate === 'custom'
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">✉️</span>
                          <div>
                            <p className="font-medium text-gray-900">Eigene Nachricht</p>
                            <p className="text-xs text-gray-500">Freie Texteingabe</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Email Form */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Recipients */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Empfänger auswählen</label>
                      <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                        {teilnehmer.filter(t => t.email).length === 0 ? (
                          <p className="p-3 text-sm text-gray-500">Keine Teilnehmer mit E-Mail-Adresse vorhanden</p>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            <label className="flex items-center p-3 hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedEmailRecipients.length === teilnehmer.filter(t => t.email).length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedEmailRecipients(teilnehmer.filter(t => t.email).map(t => t.id));
                                  } else {
                                    setSelectedEmailRecipients([]);
                                  }
                                }}
                                className="h-4 w-4 text-primary rounded border-gray-300"
                              />
                              <span className="ml-3 text-sm font-medium text-gray-700">Alle auswählen</span>
                            </label>
                            {teilnehmer.filter(t => t.email).map(t => (
                              <label key={t.id} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedEmailRecipients.includes(t.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedEmailRecipients([...selectedEmailRecipients, t.id]);
                                    } else {
                                      setSelectedEmailRecipients(selectedEmailRecipients.filter(id => id !== t.id));
                                    }
                                  }}
                                  className="h-4 w-4 text-primary rounded border-gray-300"
                                />
                                <div className="ml-3">
                                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                                  <p className="text-xs text-gray-500">{t.email}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedEmailRecipients.length > 0 && (
                        <p className="mt-2 text-sm text-gray-500">{selectedEmailRecipients.length} Empfänger ausgewählt</p>
                      )}
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Betreff</label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="E-Mail Betreff..."
                      />
                    </div>

                    {/* Body */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nachricht</label>
                      <textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        rows={10}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="E-Mail Text..."
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Platzhalter: [Name], [Startdatum], [Enddatum], [Dozent]
                      </p>
                    </div>

                    {/* Send Button */}
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => {
                          setSelectedEmailTemplate('');
                          setSelectedEmailRecipients([]);
                          setEmailSubject('');
                          setEmailBody('');
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Zurücksetzen
                      </button>
                      <button
                        onClick={() => {
                          if (selectedEmailRecipients.length === 0) {
                            addToast('Bitte wählen Sie mindestens einen Empfänger aus', 'error');
                            return;
                          }
                          if (!emailSubject.trim()) {
                            addToast('Bitte geben Sie einen Betreff ein', 'error');
                            return;
                          }
                          if (!emailBody.trim()) {
                            addToast('Bitte geben Sie eine Nachricht ein', 'error');
                            return;
                          }
                          
                          // Generate mailto links for each recipient
                          const recipients = teilnehmer.filter(t => selectedEmailRecipients.includes(t.id));
                          recipients.forEach(recipient => {
                            let body = emailBody
                              .replace(/\[Name\]/g, recipient.name || '')
                              .replace(/\[Startdatum\]/g, recipient.contract_start ? new Date(recipient.contract_start).toLocaleDateString('de-DE') : '')
                              .replace(/\[Enddatum\]/g, recipient.contract_end ? new Date(recipient.contract_end).toLocaleDateString('de-DE') : '')
                              .replace(/\[Dozent\]/g, recipient.dozent_name || '');
                            
                            const mailtoLink = `mailto:${recipient.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(body)}`;
                            window.open(mailtoLink, '_blank');
                          });
                          
                          addToast(`E-Mail-Fenster für ${recipients.length} Empfänger geöffnet`, 'success');
                        }}
                        disabled={selectedEmailRecipients.length === 0 || !emailSubject.trim() || !emailBody.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Send className="h-4 w-4" />
                        E-Mail senden ({selectedEmailRecipients.length})
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {showPreview && selectedDozent && (
        <DozentPreviewModal
          dozentId={selectedDozent.id}
          onClose={() => {
            setShowPreview(false);
            setSelectedDozent(null);
          }}
        />
      )}

      {showTeilnehmerForm && (
        <TeilnehmerForm
          teilnehmer={selectedTeilnehmerForEdit}
          onClose={() => {
            setShowTeilnehmerForm(false);
            setSelectedTeilnehmerForEdit(null);
          }}
          onSaved={() => {
            fetchTeilnehmer();
          }}
          dozenten={dozenten}
        />
      )}

      {showStundenzettel && selectedTeilnehmerForStundenzettel && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowStundenzettel(false);
            setSelectedTeilnehmerForStundenzettel(null);
            fetchTeilnehmer();
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <TeilnehmerDetailView
              teilnehmerId={selectedTeilnehmerForStundenzettel.id}
              teilnehmerName={selectedTeilnehmerForStundenzettel.name}
              onBack={() => {
                setShowStundenzettel(false);
                setSelectedTeilnehmerForStundenzettel(null);
                fetchTeilnehmer(); // Refresh to update completed hours
              }}
              isAdmin={true}
            />
          </div>
        </div>
      )}

      {showDozentForm && (
        <DozentForm
          dozent={selectedDozentForEdit}
          onClose={() => {
            setShowDozentForm(false);
            setSelectedDozentForEdit(null);
          }}
          onSaved={() => {
            fetchDozenten();
          }}
        />
      )}

      {showDozentList && (
        <DozentListModal
          dozenten={dozenten}
          onClose={() => setShowDozentList(false)}
          onEdit={(d) => {
            setShowDozentList(false);
            setSelectedDozentForEdit(d);
            setShowDozentForm(true);
          }}
        />
      )}

      {showDozentFiles && selectedDozentForFiles && (
        <DozentFilesModal
          dozentId={selectedDozentForFiles.id}
          dozentName={selectedDozentForFiles.full_name}
          folderType={selectedFolderType}
          onClose={() => {
            setShowDozentFiles(false);
            setSelectedDozentForFiles(null);
            setSelectedFolderType('');
          }}
        />
      )}

      {showDozentTaetigkeitsbericht && selectedDozentForFiles && (
        <DozentTaetigkeitsberichtModal
          dozentId={selectedDozentForFiles.id}
          dozentName={selectedDozentForFiles.full_name}
          onClose={() => {
            setShowDozentTaetigkeitsbericht(false);
            setSelectedDozentForFiles(null);
          }}
        />
      )}

      {showDozentTeilnehmer && selectedDozentForFiles && (
        <DozentTeilnehmerModal
          dozentId={selectedDozentForFiles.id}
          dozentName={selectedDozentForFiles.full_name}
          onClose={() => {
            setShowDozentTeilnehmer(false);
            setSelectedDozentForFiles(null);
          }}
        />
      )}

      {/* Activity Log Modal */}
      {showActivityLog && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowActivityLog(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full relative">
              <div className="bg-white">
                <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-medium text-gray-900">Aktivitätsprotokoll</h3>
                    <span className="text-sm text-gray-500">({activityLogData.length} Einträge)</span>
                  </div>
                  <button
                    onClick={() => setShowActivityLog(false)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  {activityLogData.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      Keine Aktivitäten vorhanden
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {activityLogData.map((item: any) => (
                        <div
                          key={item.id}
                          className="px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              {item.type === 'invoice' ? (
                                <Receipt className="h-5 w-5 text-green-600" />
                              ) : (
                                <FileText className="h-5 w-5 text-primary/60" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium truncate ${
                                item.type === 'invoice' ? 'text-green-700' : 'text-gray-900'
                              }`}>
                                {item.name}
                                {item.type === 'invoice' && (
                                  <span className="ml-2 text-xs text-green-600 font-normal">Eingereicht</span>
                                )}
                              </div>
                              <div className="flex items-center text-xs text-gray-500 mt-0.5 gap-2">
                                <span>{item.uploaded_by_profile?.full_name || 'Unbekannt'}</span>
                                <span>•</span>
                                <span>{item.folder?.name || 'Unbekannt'}</span>
                                <span>•</span>
                                <span>
                                  {new Date(item.created_at).toLocaleDateString('de-DE', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                            {item.type === 'invoice' && item.invoice_data && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    // Show uploaded PDF or generate one if not available
                                    const inv = item.invoice_data;
                                    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
                                    
                                    try {
                                      // Fetch invoice to get file_path
                                      const { data: invoiceData } = await supabase
                                        .from('invoices')
                                        .select(`
                                          *,
                                          dozent:profiles!invoices_dozent_id_fkey(full_name, email, phone, tax_id, bank_name, iban, bic, street, house_number, postal_code, city)
                                        `)
                                        .eq('id', item.id)
                                        .single();
                                      
                                      if (!invoiceData) {
                                        addToast('Rechnung nicht gefunden', 'error');
                                        return;
                                      }

                                      // If file_path exists, show uploaded PDF
                                      if (invoiceData.file_path) {
                                        const { data: urlData } = supabase.storage
                                          .from('invoices')
                                          .getPublicUrl(invoiceData.file_path);

                                        if (urlData?.publicUrl) {
                                          setPdfViewerUrl(urlData.publicUrl);
                                          setPdfViewerFileName(`Rechnung_${monthNames[inv.month - 1]}_${inv.year}_${inv.dozent_name}.pdf`);
                                          setPdfViewerOpen(true);
                                          return;
                                        }
                                      }

                                      // Otherwise generate PDF from data
                                      const { data: participantHours } = await supabase
                                        .from('participant_hours')
                                        .select(`
                                          date, hours, description, legal_area,
                                          teilnehmer:teilnehmer(name)
                                        `)
                                        .eq('dozent_id', invoiceData.dozent_id)
                                        .gte('date', invoiceData.period_start)
                                        .lte('date', invoiceData.period_end)
                                        .order('date', { ascending: true });

                                      const { data: dozentHours } = await supabase
                                        .from('dozent_hours')
                                        .select('date, hours, description')
                                        .eq('dozent_id', invoiceData.dozent_id)
                                        .gte('date', invoiceData.period_start)
                                        .lte('date', invoiceData.period_end)
                                        .order('date', { ascending: true });

                                      const { generateInvoicePDFBlob } = await import('../utils/invoicePDFGenerator');
                                      
                                      const pdfBlob = await generateInvoicePDFBlob({
                                        invoice: { ...invoiceData, dozent: invoiceData.dozent },
                                        participantHours: (participantHours || []) as any,
                                        dozentHours: (dozentHours || []) as any
                                      });

                                      const pdfUrl = URL.createObjectURL(pdfBlob);
                                      setPdfViewerUrl(pdfUrl);
                                      setPdfViewerFileName(`Rechnung_${monthNames[inv.month - 1]}_${inv.year}_${inv.dozent_name}.pdf`);
                                      setPdfViewerOpen(true);
                                    } catch (error) {
                                      console.error('Error loading PDF:', error);
                                      addToast('Fehler beim Laden der PDF-Vorschau', 'error');
                                    }
                                  }}
                                  className="flex-shrink-0 text-green-600 hover:text-green-800"
                                  title="Rechnung anzeigen"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    // Generate and download invoice as text/CSV
                                    const inv = item.invoice_data;
                                    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
                                    const content = `Rechnung ${monthNames[inv.month - 1]} ${inv.year}\n\nDozent: ${inv.dozent_name}\nBetrag: ${inv.total_amount ? Number(inv.total_amount).toFixed(2) + ' €' : 'Nicht berechnet'}`;
                                    const blob = new Blob([content], { type: 'text/plain' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `Rechnung_${inv.dozent_name.replace(/\s/g, '_')}_${monthNames[inv.month - 1]}_${inv.year}.txt`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                  }}
                                  className="flex-shrink-0 text-green-600 hover:text-green-800"
                                  title="Rechnung herunterladen"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                            {item.type !== 'invoice' && item.file_path && (
                              <button
                                onClick={async () => {
                                  const { data } = supabase.storage.from('files').getPublicUrl(item.file_path);
                                  window.open(data.publicUrl, '_blank');
                                }}
                                className="flex-shrink-0 text-primary/60 hover:text-primary"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {showInvoicePreview && invoicePreviewData && (
        <div className="fixed z-[60] inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowInvoicePreview(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full relative">
              <div className="bg-white">
                <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between bg-green-50">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-green-600" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Rechnung {['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][invoicePreviewData.month - 1]} {invoicePreviewData.year}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowInvoicePreview(false)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="p-4 sm:p-6">
                  {/* Invoice Header */}
                  <div className="mb-6 pb-4 border-b border-gray-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Dozent</p>
                        <p className="font-medium">{invoicePreviewData.dozent_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Gesamtbetrag</p>
                        <p className="text-2xl font-bold text-green-600">
                          {invoicePreviewData.total_amount ? Number(invoicePreviewData.total_amount).toFixed(2) + ' €' : '0,00 €'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Items */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Stundenübersicht</h4>
                    {invoicePreviewItems.length === 0 ? (
                      <p className="text-gray-500 text-sm">Keine Stundeneinträge vorhanden</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teilnehmer</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Beschreibung</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stunden</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Satz</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Betrag</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {invoicePreviewItems.map((item: any) => (
                              <tr key={item.id}>
                                <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                                  {new Date(item.date).toLocaleDateString('de-DE')}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900">
                                  {(item.teilnehmer as any)?.name || '-'}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500 max-w-xs truncate">
                                  {item.description || '-'}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right whitespace-nowrap">
                                  {item.hours}h
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right whitespace-nowrap">
                                  {item.rate ? Number(item.rate).toFixed(2) + ' €' : '-'}
                                </td>
                                <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right whitespace-nowrap">
                                  {item.amount ? Number(item.amount).toFixed(2) + ' €' : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr>
                              <td colSpan={3} className="px-3 py-2 text-sm font-medium text-gray-900">Gesamt</td>
                              <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                                {invoicePreviewItems.reduce((sum: number, item: any) => sum + (Number(item.hours) || 0), 0)}h
                              </td>
                              <td className="px-3 py-2"></td>
                              <td className="px-3 py-2 text-sm font-bold text-green-600 text-right">
                                {invoicePreviewData.total_amount ? Number(invoicePreviewData.total_amount).toFixed(2) + ' €' : '0,00 €'}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 bg-gray-50 flex justify-end gap-2">
                  <button
                    onClick={() => setShowInvoicePreview(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      <PDFViewerModal
        isOpen={pdfViewerOpen}
        onClose={() => {
          setPdfViewerOpen(false);
          if (pdfViewerUrl) {
            URL.revokeObjectURL(pdfViewerUrl);
            setPdfViewerUrl('');
          }
        }}
        fileUrl={pdfViewerUrl}
        fileName={pdfViewerFileName}
      />

      {/* Calendar Entry Modal */}
      {showCalendarEntryModal && selectedCalendarDate && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowCalendarEntryModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full relative">
              <div className="bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingCalendarEntry ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
                  </h3>
                  <button
                    onClick={() => setShowCalendarEntryModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <p className="text-sm text-gray-500 mb-4">
                  {selectedCalendarDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                    <input
                      type="text"
                      value={calendarEntryTitle}
                      onChange={(e) => setCalendarEntryTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="z.B. Meeting, Termin, Erinnerung..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                    <textarea
                      value={calendarEntryDescription}
                      onChange={(e) => setCalendarEntryDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Optionale Beschreibung..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Farbe</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'blue', bg: 'bg-blue-500' },
                        { value: 'green', bg: 'bg-green-500' },
                        { value: 'yellow', bg: 'bg-yellow-500' },
                        { value: 'purple', bg: 'bg-purple-500' },
                        { value: 'orange', bg: 'bg-orange-500' }
                      ].map(color => (
                        <button
                          key={color.value}
                          onClick={() => setCalendarEntryColor(color.value)}
                          className={`w-8 h-8 rounded-full ${color.bg} ${
                            calendarEntryColor === color.value ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-between">
                  {editingCalendarEntry && (
                    <button
                      onClick={() => {
                        if (confirm('Eintrag wirklich löschen?')) {
                          handleDeleteCalendarEntry(editingCalendarEntry.id);
                          setShowCalendarEntryModal(false);
                          setEditingCalendarEntry(null);
                        }
                      }}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Löschen
                    </button>
                  )}
                  <div className={`flex gap-3 ${editingCalendarEntry ? '' : 'ml-auto'}`}>
                    <button
                      onClick={() => setShowCalendarEntryModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleSaveCalendarEntry}
                      disabled={!calendarEntryTitle.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teilnehmer Preview Modal */}
      {showTeilnehmerPreview && previewTeilnehmer && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowTeilnehmerPreview(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full relative">
              <div className="bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      previewType === '25' ? 'bg-yellow-100' : 
                      previewType === '75' ? 'bg-orange-100' : 'bg-red-100'
                    }`}>
                      <span className="text-lg">
                        {previewType === '25' ? '🔔' : previewType === '75' ? '⏰' : '📋'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {previewType === '25' ? '25% Vertragslaufzeit' : 
                         previewType === '75' ? '75% Vertragslaufzeit' : 'Vertragsende'}
                      </h3>
                      <p className="text-sm text-gray-500">{previewTeilnehmer.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTeilnehmerPreview(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  {previewTeilnehmer.contract_start && previewTeilnehmer.contract_end && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Vertragsstart:</span>
                        <span className="font-medium">{new Date(previewTeilnehmer.contract_start).toLocaleDateString('de-DE')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Vertragsende:</span>
                        <span className="font-medium">{new Date(previewTeilnehmer.contract_end).toLocaleDateString('de-DE')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Fortschritt:</span>
                        <span className="font-medium">{Math.round(getContractProgress(previewTeilnehmer).percent)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            previewType === '25' ? 'bg-yellow-500' : 
                            previewType === '75' ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, getContractProgress(previewTeilnehmer).percent)}%` }}
                        ></div>
                      </div>
                    </>
                  )}
                  {previewTeilnehmer.dozent_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Dozent:</span>
                      <span className="font-medium">{previewTeilnehmer.dozent_name}</span>
                    </div>
                  )}
                  {previewTeilnehmer.exam_type && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Prüfung:</span>
                      <span className="font-medium">{previewTeilnehmer.exam_type}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowTeilnehmerPreview(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Schließen
                  </button>
                  <button
                    onClick={() => {
                      setShowTeilnehmerPreview(false);
                      setActiveTab('teilnehmer');
                      setExpandedTeilnehmer(previewTeilnehmer.id);
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
                  >
                    Zum Teilnehmer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {showTemplateEditor && editingTemplate && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowTemplateEditor(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full relative">
              <div className="bg-white">
                <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{emailTemplates.find(t => t.id === editingTemplate)?.icon || '✉️'}</span>
                    <h3 className="text-lg font-medium text-gray-900">
                      Vorlage bearbeiten: {emailTemplates.find(t => t.id === editingTemplate)?.title || editingTemplate}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowTemplateEditor(false);
                      setEditingTemplate(null);
                    }}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Betreff</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="E-Mail Betreff..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nachricht</label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={15}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="E-Mail Text..."
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Platzhalter: [Name], [Startdatum], [Enddatum], [Dozent]
                    </p>
                  </div>
                </div>
                <div className="px-4 py-3 bg-gray-50 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowTemplateEditor(false);
                      setEditingTemplate(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!emailSubject.trim() || !emailBody.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Vorlage speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}