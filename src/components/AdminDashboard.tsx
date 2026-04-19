import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageSquare, LogOut, Users, Clock, FileText, Calendar, Edit2, X, Check, Plus, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Receipt, Search, Download, Eye, Mail, Send, Trash2, Settings, TrendingUp, GraduationCap, LayoutDashboard, Zap, Bell, Upload, UserPlus } from 'lucide-react';
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
import { VertriebDashboard } from './VertriebDashboard';
import { IntegrationsTab } from './IntegrationsTab';
import { DozentenDashboard } from './DozentenDashboard';
import { EliteKleingruppe } from './EliteKleingruppe';

// Helper function to check if teilnehmer is active based on contract dates
const isContractActive = (t: any): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (t.contract_start && t.contract_end) {
    const start = new Date(t.contract_start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(t.contract_end);
    end.setHours(0, 0, 0, 0);
    // Active if today is within contract period
    return today >= start && today <= end;
  }
  // If no contract dates, fall back to status field
  return t.status === 'active';
};

// Helper function to check if teilnehmer is truly completed
// For Elite-Kleingruppe: all units must be released (100%)
// For regular teilnehmer: contract must be expired
const isTeilnehmerCompleted = (t: any): boolean => {
  // For Elite-Kleingruppe participants, check if all units are released
  if (t.is_elite_kleingruppe || t.elite_kleingruppe) {
    if (t.elite_progress && t.elite_progress.total > 0) {
      const progressPercent = Math.round((t.elite_progress.released / t.elite_progress.total) * 100);
      return progressPercent >= 100;
    }
    // If no progress data, not completed
    return false;
  }
  
  // For regular teilnehmer, check if contract is expired
  return !isContractActive(t);
};

// Helper function to calculate hours consumption percentage
const getHoursConsumption = (t: any): number => {
  if (!t.booked_hours || t.booked_hours <= 0) return 0;
  return Math.round(((t.completed_hours || 0) / t.booked_hours) * 100);
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

export function AdminDashboard({ mode = 'admin' }: { mode?: 'admin' | 'accounting' | 'verwaltung' } = {}) {
  const isAccountingMode = mode === 'accounting';
  const isVerwaltungMode = mode === 'verwaltung';
  const isRestrictedMode = isAccountingMode || isVerwaltungMode;
  const navigate = useNavigate();
  const { signOut, user, fullName } = useAuthStore();
  const { userRole, isAdmin, isBuchhaltung, isVerwaltung, isVertrieb } = useAuthStore();
  const { unreadCount, fetchUnreadCount } = useChatStore();
  const { undownloadedCount, fetchUndownloadedCount } = useFileStore();
  const { addToast } = useToastStore();
  const [dozenten, setDozenten] = useState<Profile[]>([]);
  const [teilnehmer, setTeilnehmer] = useState<any[]>([]);
  const [eliteKleingruppen, setEliteKleingruppen] = useState<{id: string; name: string}[]>([]);
  const [eliteReleases, setEliteReleases] = useState<{ total: number; released: number }>({ total: 0, released: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDozent, setSelectedDozent] = useState<Profile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedTeilnehmerForNotes, setSelectedTeilnehmerForNotes] = useState<any>(null);
  const [teilnehmerNotes, setTeilnehmerNotes] = useState<any[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isCheckingDocuments, setIsCheckingDocuments] = useReactState(false);
  const [checkResult, setCheckResult] = useReactState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const accountingTabs = ['dozenten', 'teilnehmer', 'rechnungen', 'kalender', 'elite-kleingruppe'];
  const verwaltungTabs = ['dozenten', 'teilnehmer', 'kalender', 'elite-kleingruppe'];
  const allowedTabs = isAccountingMode ? accountingTabs : isVerwaltungMode ? verwaltungTabs : null;
  const defaultTab = isRestrictedMode ? 'dozenten' : 'uebersicht';
  const storageKey = isAccountingMode ? 'accountingDashboardTab' : isVerwaltungMode ? 'verwaltungDashboardTab' : 'adminDashboardTab';

  const [activeTab, setActiveTabState] = useState<'uebersicht' | 'dozenten' | 'teilnehmer' | 'rechnungen' | 'kalender' | 'emails' | 'vertrieb' | 'integrationen' | 'dozenten-dashboard' | 'elite-kleingruppe'>(() => {
    // Check URL parameter first
    const tabParam = searchParams.get('tab');
    const allTabs = ['uebersicht', 'dozenten', 'teilnehmer', 'rechnungen', 'kalender', 'emails', 'vertrieb', 'integrationen', 'dozenten-dashboard', 'elite-kleingruppe'];
    if (tabParam && allTabs.includes(tabParam)) {
      // In restricted mode, only allow permitted tabs
      if (allowedTabs && !allowedTabs.includes(tabParam)) {
        return defaultTab as any;
      }
      return tabParam as any;
    }
    const saved = localStorage.getItem(storageKey);
    if (saved && allTabs.includes(saved)) {
      if (allowedTabs && !allowedTabs.includes(saved)) {
        return defaultTab as any;
      }
      return saved as any;
    }
    return defaultTab as any;
  });
  
  // Helper function to change tab and update URL
  const setActiveTab = useCallback((tab: typeof activeTab) => {
    setActiveTabState(tab);
    localStorage.setItem(storageKey, tab);
    setSearchParams({ tab });
  }, [setSearchParams]);

  // Helper function to display invoice period correctly (handles quarterly invoices)
  const getInvoicePeriodDisplay = (invoice: any) => {
    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    
    // Check if this is a quarterly invoice (period_start and period_end span multiple months)
    if (invoice.period_start && invoice.period_end) {
      const startDate = new Date(invoice.period_start);
      const endDate = new Date(invoice.period_end);
      
      const startMonth = startDate.getMonth() + 1;
      const endMonth = endDate.getMonth() + 1;
      
      // If it spans multiple months, display all months
      if (startMonth !== endMonth) {
        const months: string[] = [];
        for (let m = startMonth; m <= endMonth; m++) {
          months.push(monthNames[m - 1]);
        }
        return `${months.join(' & ')} ${invoice.year}`;
      }
    }
    
    // Otherwise, just show the single month
    return `${monthNames[invoice.month - 1]} ${invoice.year}`;
  };

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
  const [teilnehmerFilter, setTeilnehmerFilter] = useState<'alle' | 'aktiv' | 'abgeschlossen' | '25' | '75' | 'elite' | '2staatsexamen'>('alle');
  const [teilnehmerSearch, setTeilnehmerSearch] = useState<string>('');
  const [editingTeilnehmer, setEditingTeilnehmer] = useState<string | null>(null);
  const [editContractStart, setEditContractStart] = useState<string>('');
  const [editContractEnd, setEditContractEnd] = useState<string>('');
  const [showTeilnehmerForm, setShowTeilnehmerForm] = useState(false);
  const [selectedTeilnehmerForEdit, setSelectedTeilnehmerForEdit] = useState<any>(null);
  const [expandedTeilnehmer, setExpandedTeilnehmer] = useState<string | null>(null);
  const [showStundenzettel, setShowStundenzettel] = useState(false);
  const [selectedTeilnehmerForStundenzettel, setSelectedTeilnehmerForStundenzettel] = useState<any>(null);
  const [dozentPage, setDozentPage] = useState(1);
  const DOZENT_PER_PAGE = 10;
  const [dozentSearch, setDozentSearch] = useState('');
  const [showDozentForm, setShowDozentForm] = useState(false);
  const [selectedDozentForEdit, setSelectedDozentForEdit] = useState<any>(null);
  const [showDozentList, setShowDozentList] = useState(false);
  const [showDozentFiles, setShowDozentFiles] = useState(false);
  const [dozentAvailability, setDozentAvailability] = useState<Record<string, { status: string; notes?: string }>>({});
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
  const [calendarFilters, setCalendarFilters] = useState({
    show25: true,
    show75: true,
    showEnd: true,
    showExam: true,
    showCustom: true
  });
  const [eventListFilter, setEventListFilter] = useState<'alle' | '25' | '75' | 'end' | 'exam' | 'custom'>('alle');
  const [deleteInvoiceModal, setDeleteInvoiceModal] = useState<{ show: boolean; invoice: any | null }>({ show: false, invoice: null });
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [invoiceDeadlineDay, setInvoiceDeadlineDay] = useState<number>(5);
  const [invoiceDeadlineTemp, setInvoiceDeadlineTemp] = useState<number>(5);
  const tabNavRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [showActivityDropdown, setShowActivityDropdown] = useState(false);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const activityDropdownRef = useRef<HTMLDivElement>(null);

  const checkScrollArrows = () => {
    if (tabNavRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabNavRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabNavRef.current) {
      const scrollAmount = 200;
      tabNavRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    checkScrollArrows();
    window.addEventListener('resize', checkScrollArrows);
    return () => window.removeEventListener('resize', checkScrollArrows);
  }, []);

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

  // Fetch recent activities
  const fetchRecentActivities = async () => {
    try {
      // Fetch recent file uploads
      const { data: filesData } = await supabase
        .from('files')
        .select(`
          id, name, created_at,
          folder:folders(name),
          uploaded_by_profile:profiles!files_uploaded_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch recent invoices
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('id, month, year, status, submitted_at, dozent_id, total_amount, period_start, period_end')
        .in('status', ['submitted', 'sent', 'paid'])
        .order('submitted_at', { ascending: false })
        .limit(10);

      // Get dozent names for invoices
      const dozentIds = [...new Set((invoicesData || []).map(inv => inv.dozent_id))];
      const { data: dozentProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', dozentIds);
      
      const dozentMap = new Map((dozentProfiles || []).map(p => [p.id, p.full_name]));

      // Fetch recent teilnehmer additions
      const { data: teilnehmerData } = await supabase
        .from('teilnehmer')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

      const getInvoicePeriodDisplay = (invoice: any) => {
        // Check if this is a quarterly invoice (period_start and period_end span multiple months)
        if (invoice.period_start && invoice.period_end) {
          const startDate = new Date(invoice.period_start);
          const endDate = new Date(invoice.period_end);
          
          const startMonth = startDate.getMonth() + 1;
          const endMonth = endDate.getMonth() + 1;
          
          // If it spans multiple months, display all months
          if (startMonth !== endMonth) {
            const months: string[] = [];
            for (let m = startMonth; m <= endMonth; m++) {
              months.push(monthNames[m - 1]);
            }
            return `${months.join(' & ')} ${invoice.year}`;
          }
        }
        
        // Otherwise, just show the single month
        return `${monthNames[invoice.month - 1]} ${invoice.year}`;
      };

      const activities: any[] = [];

      // Add file activities
      (filesData || []).forEach(f => {
        activities.push({
          id: `file-${f.id}`,
          type: 'file',
          title: f.name,
          subtitle: `Hochgeladen von ${(f.uploaded_by_profile as any)?.full_name || 'Unbekannt'}`,
          timestamp: f.created_at,
          icon: 'upload'
        });
      });

      // Add invoice activities
      (invoicesData || []).forEach(inv => {
        const dozentName = dozentMap.get(inv.dozent_id) || 'Unbekannt';
        activities.push({
          id: `invoice-${inv.id}`,
          type: 'invoice',
          title: `Rechnung ${getInvoicePeriodDisplay(inv)}`,
          subtitle: `${dozentName} - ${inv.total_amount?.toFixed(2)} €`,
          timestamp: inv.submitted_at,
          icon: 'receipt',
          status: inv.status
        });
      });

      // Add teilnehmer activities
      (teilnehmerData || []).forEach(t => {
        activities.push({
          id: `teilnehmer-${t.id}`,
          type: 'teilnehmer',
          title: t.name,
          subtitle: 'Neuer Teilnehmer',
          timestamp: t.created_at,
          icon: 'user'
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

  // Load data for the active tab - always reload to ensure fresh data
  const loadTabData = useCallback((tab: string) => {
    switch (tab) {
      case 'uebersicht':
        fetchDozenten();
        fetchTeilnehmer();
        fetchSubmittedInvoices();
        break;
      case 'dozenten':
        fetchDozenten();
        break;
      case 'teilnehmer':
        fetchTeilnehmer();
        fetchEliteKleingruppen();
        break;
      case 'kalender':
        fetchCalendarEntries();
        fetchTeilnehmer(); // Needed for contract milestones in calendar
        break;
      case 'emails':
        fetchEmailTemplates();
        break;
      case 'rechnungen':
        fetchAllRechnungen();
        fetchSubmittedInvoices();
        fetchInvoiceDeadline();
        break;
    }
  }, []);

  // Initial load - only essential data
  useEffect(() => {
    fetchDozenten();
    fetchTeilnehmer();
    fetchEliteKleingruppen();
    fetchSubmittedInvoices(); // For overview KPIs
    fetchUnreadCount();
    fetchUndownloadedCount();
    
    // Setup real-time subscription for file uploads (undownloaded count)
    const { setupRealtimeSubscription, cleanupSubscription } = useFileStore.getState();
    setupRealtimeSubscription(); // No folder ID for admin dashboard
    
    // Setup real-time subscription for participant_hours to update completed hours
    const hoursChannel = supabase
      .channel('admin-participant-hours')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participant_hours'
        },
        () => {
          // Refresh teilnehmer data when hours change
          fetchTeilnehmer();
        }
      )
      .subscribe();
    
    return () => {
      cleanupSubscription();
      supabase.removeChannel(hoursChannel);
    };
  }, []);

  // Load tab data when tab changes
  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

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
      // Fetch teilnehmer with elite_kleingruppe info
      const { data: teilnehmerData, error: teilnehmerError } = await supabase
        .from('teilnehmer')
        .select(`
          *,
          elite_kleingruppe:elite_kleingruppen(id, name)
        `)
        .order('name')
        .limit(500);
      
      if (teilnehmerError) throw teilnehmerError;

      // Fetch completed hours from participant_hours table - only sum, not all records
      const { data: hoursData, error: hoursError } = await supabase
        .from('participant_hours')
        .select('teilnehmer_id, hours');

      if (hoursError) throw hoursError;

      // Fetch Elite-Kleingruppe releases for progress calculation (per group)
      const { data: releasesData, error: releasesError } = await supabase
        .from('elite_kleingruppe_releases')
        .select('id, is_released, elite_kleingruppe_id, event_type, release_date, end_time');
      
      // Calculate progress per elite_kleingruppe_id
      const progressByGroup: { [key: string]: { total: number; released: number } } = {};
      const now = new Date();
      
      if (!releasesError && releasesData) {
        releasesData.forEach(release => {
          // Only count actual units (einheit), not holidays or other events
          if (release.event_type === 'einheit' && release.elite_kleingruppe_id) {
            // Check if the unit has already passed (release_date + end_time < now)
            const releaseDate = new Date(release.release_date);
            let unitHasPassed = false;
            
            if (release.end_time) {
              // Combine date and time to check if unit has passed
              const [hours, minutes] = release.end_time.split(':').map(Number);
              const unitEndDateTime = new Date(releaseDate);
              unitEndDateTime.setHours(hours, minutes, 0, 0);
              unitHasPassed = unitEndDateTime < now;
            } else {
              // If no end_time, just check if the date has passed
              const endOfDay = new Date(releaseDate);
              endOfDay.setHours(23, 59, 59, 999);
              unitHasPassed = endOfDay < now;
            }
            
            if (!progressByGroup[release.elite_kleingruppe_id]) {
              progressByGroup[release.elite_kleingruppe_id] = { total: 0, released: 0 };
            }
            
            // Only count units that have already passed
            if (unitHasPassed) {
              progressByGroup[release.elite_kleingruppe_id].total++;
              if (release.is_released) {
                progressByGroup[release.elite_kleingruppe_id].released++;
              }
            }
          }
        });
        
        // For backward compatibility, keep global stats (will be deprecated)
        const totalReleases = releasesData.filter(r => {
          if (r.event_type !== 'einheit') return false;
          
          const releaseDate = new Date(r.release_date);
          let unitHasPassed = false;
          
          if (r.end_time) {
            const [hours, minutes] = r.end_time.split(':').map(Number);
            const unitEndDateTime = new Date(releaseDate);
            unitEndDateTime.setHours(hours, minutes, 0, 0);
            unitHasPassed = unitEndDateTime < now;
          } else {
            const endOfDay = new Date(releaseDate);
            endOfDay.setHours(23, 59, 59, 999);
            unitHasPassed = endOfDay < now;
          }
          
          return unitHasPassed;
        }).length;
        
        const releasedCount = releasesData.filter(r => {
          if (r.event_type !== 'einheit' || !r.is_released) return false;
          
          const releaseDate = new Date(r.release_date);
          let unitHasPassed = false;
          
          if (r.end_time) {
            const [hours, minutes] = r.end_time.split(':').map(Number);
            const unitEndDateTime = new Date(releaseDate);
            unitEndDateTime.setHours(hours, minutes, 0, 0);
            unitHasPassed = unitEndDateTime < now;
          } else {
            const endOfDay = new Date(releaseDate);
            endOfDay.setHours(23, 59, 59, 999);
            unitHasPassed = endOfDay < now;
          }
          
          return unitHasPassed;
        }).length;
        
        setEliteReleases({ total: totalReleases, released: releasedCount });
      }

      // Calculate total hours per teilnehmer
      const hoursMap: { [key: string]: number } = {};
      (hoursData || []).forEach((entry: { teilnehmer_id: string; hours: number }) => {
        if (!hoursMap[entry.teilnehmer_id]) {
          hoursMap[entry.teilnehmer_id] = 0;
        }
        hoursMap[entry.teilnehmer_id] += Number(entry.hours);
      });

      // Merge completed hours and elite progress into teilnehmer data
      const teilnehmerWithHours = (teilnehmerData || []).map(t => ({
        ...t,
        completed_hours: hoursMap[t.id] || 0,
        elite_progress: t.elite_kleingruppe_id && progressByGroup[t.elite_kleingruppe_id] 
          ? progressByGroup[t.elite_kleingruppe_id]
          : null
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
      // Get all invoices with status 'submitted', 'sent', or 'paid' (from dozents who have shared with admin)
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('*, profiles!invoices_dozent_id_fkey(full_name, profile_picture_url)')
        .in('status', ['submitted', 'sent', 'paid'])
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

  const fetchInvoiceDeadline = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'invoice_deadline')
        .single();
      if (!error && data) {
        const day = data.value?.day || 5;
        setInvoiceDeadlineDay(day);
        setInvoiceDeadlineTemp(day);
      }
    } catch (error) {
      console.error('Error fetching invoice deadline:', error);
    }
  };

  const saveInvoiceDeadline = async () => {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'invoice_deadline',
          value: { day: invoiceDeadlineTemp, description: 'Tag des Folgemonats, bis zu dem die Rechnung eingereicht werden muss' },
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      if (error) throw error;
      setInvoiceDeadlineDay(invoiceDeadlineTemp);
      setShowDeadlineModal(false);
      addToast('Rechnungsfrist wurde gespeichert', 'success');
    } catch (error) {
      console.error('Error saving invoice deadline:', error);
      addToast('Fehler beim Speichern der Frist', 'error');
    }
  };

  const fetchEliteKleingruppen = async () => {
    try {
      const { data, error } = await supabase
        .from('elite_kleingruppen')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setEliteKleingruppen(data || []);
    } catch (error) {
      console.error('Error fetching elite kleingruppen:', error);
    }
  };

  const fetchDozenten = async () => {
    try {
      // Fetch dozenten profiles - include both primary role and additional roles
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or('role.eq.dozent,additional_roles.cs.{dozent}')
        .order('full_name');

      if (error) throw error;
      
      // Fetch elite korrektur rates via RPC (bypasses PostgREST schema cache)
      const { data: korrekturRates } = await supabase.rpc('get_elite_korrektur_rates');
      const korrekturMap: Record<string, number> = {};
      (korrekturRates || []).forEach((r: any) => { korrekturMap[r.dozent_id] = r.rate; });
      
      // Merge korrektur rates into dozent data
      const enrichedData = (data || []).map((d: any) => ({
        ...d,
        hourly_rate_elite_korrektur: korrekturMap[d.id] ?? d.hourly_rate_elite_korrektur ?? null
      }));
      
      setDozenten(enrichedData);
      
      // Batch fetch availability for all dozenten in ONE query
      if (data && data.length > 0) {
        const dozentIds = data.map(d => d.id);
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        const { data: availabilityData } = await supabase
          .from('dozent_availability')
          .select('dozent_id, capacity_status, notes')
          .in('dozent_id', dozentIds)
          .eq('month', currentMonth)
          .eq('year', currentYear);
        
        // Create a map for quick lookup
        const availabilityMap: Record<string, { status: string; notes?: string }> = {};
        (availabilityData || []).forEach(a => {
          availabilityMap[a.dozent_id] = { status: a.capacity_status, notes: a.notes };
        });
        setDozentAvailability(availabilityMap);
      }
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
      const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`;
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ userId: dozentId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Fehler beim Löschen');
      }

      addToast('Dozent und Benutzerkonto erfolgreich gelöscht', 'success');
      fetchDozenten();
    } catch (error) {
      console.error('Error deleting dozent:', error);
      addToast('Fehler beim Löschen des Dozenten', 'error');
    }
  };

  const fetchTeilnehmerNotes = async (teilnehmerId: string) => {
    try {
      const { data, error } = await supabase
        .from('teilnehmer_notes')
        .select(`
          *,
          author:profiles!teilnehmer_notes_author_id_fkey(full_name)
        `)
        .eq('teilnehmer_id', teilnehmerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeilnehmerNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      addToast('Fehler beim Laden der Notizen', 'error');
    }
  };

  const addTeilnehmerNote = async () => {
    if (!newNoteContent.trim() || !selectedTeilnehmerForNotes) return;
    
    setIsAddingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const authorShort = profile?.full_name
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 3) || 'N/A';

      const { error } = await supabase
        .from('teilnehmer_notes')
        .insert({
          teilnehmer_id: selectedTeilnehmerForNotes.id,
          author_id: user.id,
          author_short: authorShort,
          content: newNoteContent.trim()
        });

      if (error) throw error;

      setNewNoteContent('');
      await fetchTeilnehmerNotes(selectedTeilnehmerForNotes.id);
      addToast('Notiz hinzugefügt', 'success');
    } catch (error) {
      console.error('Error adding note:', error);
      addToast('Fehler beim Hinzufügen der Notiz', 'error');
    } finally {
      setIsAddingNote(false);
    }
  };

  const deleteTeilnehmerNote = async (noteId: string) => {
    if (!confirm('Möchten Sie diese Notiz wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('teilnehmer_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      await fetchTeilnehmerNotes(selectedTeilnehmerForNotes.id);
      addToast('Notiz gelöscht', 'success');
    } catch (error) {
      console.error('Error deleting note:', error);
      addToast('Fehler beim Löschen der Notiz', 'error');
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
        .select('id, month, year, status, submitted_at, dozent_id, total_amount, period_start, period_end')
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

      const getInvoicePeriodDisplay = (invoice: any) => {
        // Check if this is a quarterly invoice (period_start and period_end span multiple months)
        if (invoice.period_start && invoice.period_end) {
          const startDate = new Date(invoice.period_start);
          const endDate = new Date(invoice.period_end);
          
          const startMonth = startDate.getMonth() + 1;
          const endMonth = endDate.getMonth() + 1;
          
          // If it spans multiple months, display all months
          if (startMonth !== endMonth) {
            const months: string[] = [];
            for (let m = startMonth; m <= endMonth; m++) {
              months.push(monthNames[m - 1]);
            }
            return `${months.join(' & ')} ${invoice.year}`;
          }
        }
        
        // Otherwise, just show the single month
        return `${monthNames[invoice.month - 1]} ${invoice.year}`;
      };
      
      const files = (filesData || []).map(f => ({
        ...f,
        type: 'file'
      }));

      const invoices = (invoicesData || []).map(inv => {
        const dozentName = dozentMap.get(inv.dozent_id) || 'Unbekannt';
        return {
          id: inv.id,
          name: `Rechnung ${getInvoicePeriodDisplay(inv)}`,
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

  const handleDeleteInvoicePdf = async (invoice: any) => {
    try {
      // Fetch invoice to get file_path
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('file_path')
        .eq('id', invoice.id)
        .single();
      
      if (invoiceData?.file_path) {
        // Delete file from storage
        const { error: storageError } = await supabase.storage
          .from('invoices')
          .remove([invoiceData.file_path]);
        
        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
        }
      }
      
      // Delete the entire invoice from database
      const { error: dbError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);
      
      if (dbError) {
        throw dbError;
      }
      
      addToast('Rechnung wurde gelöscht', 'success');
      fetchSubmittedInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      addToast('Fehler beim Löschen der Rechnung', 'error');
    } finally {
      setDeleteInvoiceModal({ show: false, invoice: null });
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
                <Logo onClick={() => { setActiveTab(isRestrictedMode ? 'dozenten' : 'uebersicht'); }} />
                <span className="ml-2 text-lg sm:text-xl font-semibold text-gray-900 hidden sm:block">Dashboard</span>
                <span className="ml-2 text-sm font-semibold text-gray-900 sm:hidden">Dashboard</span>
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
              {/* Activity Bell */}
              <div className="relative" ref={activityDropdownRef}>
                <button
                  onClick={() => setShowActivityDropdown(!showActivityDropdown)}
                  className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
                >
                  <Bell className="h-4 w-4 lg:h-5 lg:w-5" />
                </button>
                
                {showActivityDropdown && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
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
                                activity.icon === 'upload' ? 'bg-blue-100' :
                                activity.icon === 'receipt' ? 'bg-orange-100' :
                                'bg-green-100'
                              }`}>
                                {activity.icon === 'upload' && <Upload className="h-4 w-4 text-blue-600" />}
                                {activity.icon === 'receipt' && <Receipt className="h-4 w-4 text-orange-600" />}
                                {activity.icon === 'user' && <UserPlus className="h-4 w-4 text-green-600" />}
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
                              {activity.status && (
                                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                                  activity.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                                  activity.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {activity.status === 'submitted' ? 'Neu' : activity.status === 'sent' ? 'Versendet' : 'Bezahlt'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => navigate('/messages')}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
              >
                <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              
              {/* Settings icon for all users to edit their own profile */}
              <button
                onClick={() => {
                  if (isAdmin) {
                    navigate('/users');
                  } else if (user?.id) {
                    // For other roles, navigate to their own profile settings
                    navigate(`/settings`);
                  }
                }}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition"
                title={isAdmin ? 'Benutzerverwaltung' : 'Profil bearbeiten'}
              >
                <Settings className="h-4 w-4 lg:h-5 lg:w-5" />
              </button>
              
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-red-500 hover:text-red-700 focus:outline-none transition"
              >
                <LogOut className="h-4 w-4 lg:h-5 lg:w-5" />
              </button>
            </div>
          </div>
          
          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="sm:hidden">
              <div className="pt-2 pb-3 space-y-1 border-t border-gray-200">
                <button
                  onClick={() => {
                    if (isAdmin) {
                      navigate('/users');
                    } else if (user?.id) {
                      navigate(`/settings`);
                    }
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-primary hover:text-primary/80 hover:bg-gray-50"
                >
                  <Settings className="h-5 w-5 mr-3" />
                  {isAdmin ? 'Benutzerverwaltung' : 'Profil bearbeiten'}
                </button>
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
        {/* Personalized Greeting */}
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
            Guten Tag, {fullName?.split(' ')[0] || 'Benutzer'}
          </h2>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200 relative">
            {/* Left Arrow */}
            {showLeftArrow && (
              <button
                onClick={() => scrollTabs('left')}
                className="absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center w-8 bg-gradient-to-r from-white via-white to-transparent"
              >
                <ChevronLeft className="h-5 w-5 text-gray-500 hover:text-primary" />
              </button>
            )}
            {/* Right Arrow */}
            {showRightArrow && (
              <button
                onClick={() => scrollTabs('right')}
                className="absolute right-0 top-0 bottom-0 z-10 flex items-center justify-center w-8 bg-gradient-to-l from-white via-white to-transparent"
              >
                <ChevronRight className="h-5 w-5 text-gray-500 hover:text-primary" />
              </button>
            )}
            <nav 
              ref={tabNavRef}
              onScroll={checkScrollArrows}
              className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide scroll-smooth" 
              aria-label="Tabs"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {!isRestrictedMode && (
              <button
                onClick={() => { setActiveTab('uebersicht'); }}
                className={`${
                  activeTab === 'uebersicht'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <LayoutDashboard className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Übersicht</span>
              </button>
              )}
              <button
                onClick={() => { setActiveTab('dozenten'); }}
                className={`${
                  activeTab === 'dozenten'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Dozenten</span>
              </button>
              <button
                onClick={() => { setActiveTab('teilnehmer'); }}
                className={`${
                  activeTab === 'teilnehmer'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <Users className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Teilnehmer</span>
                {(() => {
                  const urgentCount = teilnehmer.filter(t => {
                    const isActive = isContractActive(t);
                    const hasHoursLeft = t.booked_hours && (t.booked_hours - (t.completed_hours || 0)) > 0;
                    const isUrgent = !isActive && hasHoursLeft;
                    const isStundenVoll = isActive && !hasHoursLeft && t.booked_hours;
                    return isUrgent || isStundenVoll;
                  }).length;
                  return urgentCount > 0 ? (
                    <span className="ml-1 sm:ml-2 bg-red-500 text-white py-0.5 px-2 rounded-full text-xs">
                      {urgentCount}
                    </span>
                  ) : null;
                })()}
              </button>
              {(isAdmin || isBuchhaltung) && (
              <button
                onClick={() => { setActiveTab('rechnungen'); }}
                className={`${
                  activeTab === 'rechnungen'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Rechnungen</span>
                {submittedInvoices.filter(i => i.status === 'submitted' || i.status === 'sent').length > 0 && (
                  <span className="ml-1 sm:ml-2 bg-red-500 text-white py-0.5 px-2 rounded-full text-xs">
                    {submittedInvoices.filter(i => i.status === 'submitted' || i.status === 'sent').length}
                  </span>
                )}
              </button>
              )}
              <button
                onClick={() => { setActiveTab('kalender'); }}
                className={`${
                  activeTab === 'kalender'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Kalender</span>
              </button>
              {!isRestrictedMode && (
              <button
                onClick={() => { setActiveTab('emails'); }}
                className={`${
                  activeTab === 'emails'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">E-Mails</span>
              </button>
              )}
              {!isRestrictedMode && (
              <button
                onClick={() => { setActiveTab('vertrieb'); }}
                className={`${
                  activeTab === 'vertrieb'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Vertrieb</span>
              </button>
              )}
              {!isRestrictedMode && (
              <button
                onClick={() => { setActiveTab('dozenten-dashboard'); }}
                className={`${
                  activeTab === 'dozenten-dashboard'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Dozenten Dashboard</span>
              </button>
              )}
              <button
                onClick={() => { setActiveTab('elite-kleingruppe'); }}
                className={`${
                  activeTab === 'elite-kleingruppe'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center`}
              >
                <Users className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Elite-Kleingruppe</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'uebersicht' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Dozenten</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{dozenten.length}</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Teilnehmer</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{teilnehmer.filter(t => isContractActive(t)).length}</p>
                    <p className="text-xs text-gray-400 mt-0.5">aktiv</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  </div>
                </div>
              </div>
              {(isAdmin || isBuchhaltung) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Offene Rechnungen</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{submittedInvoices.filter(i => i.status === 'submitted' || i.status === 'sent').length}</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-orange-100 rounded-lg">
                    <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                  </div>
                </div>
              </div>
              )}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Nachrichten</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{unreadCount}</p>
                    <p className="text-xs text-gray-400 mt-0.5">ungelesen</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
                    <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions - Kategorisiert */}
            <div className="space-y-6">
              {/* Dozenten */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="h-5 w-5 text-blue-500 mr-2" />
                  Dozenten
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  <button
                    onClick={() => { setActiveTab('dozenten'); }}
                    className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition-all group"
                  >
                    <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors mb-3">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Dozenten</span>
                    <span className="text-xs text-gray-400 mt-1">{dozenten.length} gesamt</span>
                  </button>

                  {(isAdmin || isBuchhaltung) && (
                  <button
                    onClick={() => { setActiveTab('rechnungen'); }}
                    className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition-all group"
                  >
                    <div className="p-3 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors mb-3 relative">
                      <Receipt className="h-6 w-6 text-orange-500" />
                      {submittedInvoices.filter(i => i.status === 'submitted' || i.status === 'sent').length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                          {submittedInvoices.filter(i => i.status === 'submitted' || i.status === 'sent').length}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Rechnungen</span>
                    <span className="text-xs text-gray-400 mt-1">{submittedInvoices.filter(i => i.status === 'submitted' || i.status === 'sent').length} offen</span>
                  </button>
                  )}

                  <button
                    onClick={() => navigate('/messages')}
                    className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition-all group"
                  >
                    <div className="p-3 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors mb-3 relative">
                      <MessageSquare className="h-6 w-6 text-purple-600" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Nachrichten</span>
                    <span className="text-xs text-gray-400 mt-1">{unreadCount} ungelesen</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('emails'); }}
                    className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition-all group"
                  >
                    <div className="p-3 bg-cyan-50 rounded-lg group-hover:bg-cyan-100 transition-colors mb-3">
                      <Mail className="h-6 w-6 text-cyan-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">E-Mail Vorlagen</span>
                    <span className="text-xs text-gray-400 mt-1">Vorlagen</span>
                  </button>
                </div>
              </div>

              {/* Teilnehmer */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Users className="h-5 w-5 text-green-500 mr-2" />
                  Teilnehmer
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  <button
                    onClick={() => { setActiveTab('teilnehmer'); }}
                    className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition-all group"
                  >
                    <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors mb-3 relative">
                      <Users className="h-6 w-6 text-green-600" />
                      {(() => {
                        const urgentCount = teilnehmer.filter(t => {
                          const isActive = isContractActive(t);
                          const hasHoursLeft = t.booked_hours && (t.booked_hours - (t.completed_hours || 0)) > 0;
                          return (!isActive && hasHoursLeft) || (isActive && !hasHoursLeft && t.booked_hours);
                        }).length;
                        return urgentCount > 0 ? (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                            {urgentCount}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Teilnehmer</span>
                    <span className="text-xs text-gray-400 mt-1">{teilnehmer.filter(t => isContractActive(t)).length} aktiv</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('kalender'); }}
                    className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition-all group"
                  >
                    <div className="p-3 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors mb-3">
                      <Calendar className="h-6 w-6 text-red-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Kalender</span>
                    <span className="text-xs text-gray-400 mt-1">Termine</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('elite-kleingruppe'); }}
                    className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition-all group"
                  >
                    <div className="p-3 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors mb-3">
                      <Users className="h-6 w-6 text-amber-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Elite-Kleingruppe</span>
                    <span className="text-xs text-gray-400 mt-1">{eliteReleases.released}/{eliteReleases.total} freigegeben</span>
                  </button>
                </div>
              </div>

              {/* Vertrieb */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 text-emerald-500 mr-2" />
                  Vertrieb
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  <button
                    onClick={() => { setActiveTab('vertrieb'); }}
                    className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition-all group"
                  >
                    <div className="p-3 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors mb-3">
                      <TrendingUp className="h-6 w-6 text-emerald-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Vertrieb Dashboard</span>
                    <span className="text-xs text-gray-400 mt-1">Sales & Leads</span>
                  </button>
                </div>
              </div>

              {/* Dozenten-Dashboard */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <GraduationCap className="h-5 w-5 text-indigo-500 mr-2" />
                  Dozenten-Dashboard
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  <button
                    onClick={() => { setActiveTab('dozenten-dashboard'); }}
                    className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition-all group"
                  >
                    <div className="p-3 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors mb-3">
                      <GraduationCap className="h-6 w-6 text-indigo-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">Dozenten Ansicht</span>
                    <span className="text-xs text-gray-400 mt-1">Dashboard</span>
                  </button>

                  {(isAdmin || isBuchhaltung) && (
                    <button
                      onClick={() => navigate('/users')}
                      className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition-all group"
                    >
                      <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors mb-3">
                        <Settings className="h-6 w-6 text-gray-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 text-center">Benutzerverwaltung</span>
                      <span className="text-xs text-gray-400 mt-1">Verwaltung</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity / Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Urgent Teilnehmer */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                  <Users className="h-5 w-5 text-red-500 mr-2" />
                  Handlungsbedarf Teilnehmer
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {teilnehmer.filter(t => {
                    const isActive = isContractActive(t);
                    const hasHoursLeft = t.booked_hours && (t.booked_hours - (t.completed_hours || 0)) > 0;
                    return (!isActive && hasHoursLeft) || (isActive && !hasHoursLeft && t.booked_hours);
                  }).slice(0, 5).map(t => {
                    const isActive = isContractActive(t);
                    const hasHoursLeft = t.booked_hours && (t.booked_hours - (t.completed_hours || 0)) > 0;
                    const isExpired = !isActive && hasHoursLeft;
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{t.name}</p>
                          <p className={`text-xs ${isExpired ? 'text-red-600' : 'text-orange-600'}`}>
                            {isExpired ? 'Vertrag abgelaufen - Stunden offen' : 'Stunden aufgebraucht'}
                          </p>
                        </div>
                        <button
                          onClick={() => { setActiveTab('teilnehmer'); }}
                          className="text-xs text-primary hover:underline"
                        >
                          Ansehen
                        </button>
                      </div>
                    );
                  })}
                  {teilnehmer.filter(t => {
                    const isActive = isContractActive(t);
                    const hasHoursLeft = t.booked_hours && (t.booked_hours - (t.completed_hours || 0)) > 0;
                    return (!isActive && hasHoursLeft) || (isActive && !hasHoursLeft && t.booked_hours);
                  }).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">Keine dringenden Fälle</p>
                  )}
                </div>
              </div>

              {/* Pending Invoices */}
              {(isAdmin || isBuchhaltung) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                  <Receipt className="h-5 w-5 text-orange-500 mr-2" />
                  Offene Rechnungen
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {submittedInvoices.filter(i => i.status === 'submitted' || i.status === 'sent').slice(0, 5).map(inv => (
                    <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{inv.dozent_name}</p>
                        <p className="text-xs text-gray-500">
                          {getInvoicePeriodDisplay(inv)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900 text-sm">{inv.total_amount?.toFixed(2)} €</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                          {inv.status === 'submitted' ? 'Eingereicht' : 'Versendet'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {submittedInvoices.filter(i => i.status === 'submitted' || i.status === 'sent').length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">Keine offenen Rechnungen</p>
                  )}
                </div>
              </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'dozenten' && (
          <>
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4 pt-3 pb-3 sm:pt-5 sm:pb-5">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-primary/60 mr-2" />
                  <h2 className="text-base sm:text-lg font-medium text-gray-900">Dozenten Übersicht</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDozentList(true)}
                    className="flex items-center justify-center p-2 lg:px-4 lg:py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
                    title="Liste anzeigen"
                  >
                    <Users className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">Liste anzeigen</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDozentForEdit(null);
                      setShowDozentForm(true);
                    }}
                    className="flex items-center justify-center p-2 lg:px-4 lg:py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm"
                    title="Dozent hinzufügen"
                  >
                    <Plus className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">Dozent hinzufügen</span>
                  </button>
                </div>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Dozent suchen..."
                  value={dozentSearch}
                  onChange={(e) => { setDozentSearch(e.target.value); setDozentPage(1); }}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              {(() => {
                const filteredDozenten = dozentSearch.trim()
                  ? dozenten.filter(d => d.full_name?.toLowerCase().includes(dozentSearch.toLowerCase()) || d.email?.toLowerCase().includes(dozentSearch.toLowerCase()))
                  : dozenten;
                const totalPages = Math.ceil(filteredDozenten.length / DOZENT_PER_PAGE);
                const paginatedDozenten = filteredDozenten.slice((dozentPage - 1) * DOZENT_PER_PAGE, dozentPage * DOZENT_PER_PAGE);
                return (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {isLoading ? (
                        <div className="col-span-full flex justify-center py-6 sm:py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      ) : filteredDozenten.length === 0 ? (
                        <div className="col-span-full bg-white shadow rounded-lg p-6 text-center text-gray-500">
                          Keine Dozenten vorhanden
                        </div>
                      ) : (
                        paginatedDozenten.map((dozent) => (
                          <DozentCard 
                            key={dozent.id} 
                            dozent={dozent} 
                            userRole={userRole}
                            preloadedAvailability={dozentAvailability[dozent.id] || null}
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
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6">
                        <span className="text-sm text-gray-500">
                          {(dozentPage - 1) * DOZENT_PER_PAGE + 1}–{Math.min(dozentPage * DOZENT_PER_PAGE, filteredDozenten.length)} von {filteredDozenten.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setDozentPage(p => Math.max(1, p - 1))}
                            disabled={dozentPage === 1}
                            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Zurück
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                              key={page}
                              onClick={() => setDozentPage(page)}
                              className={`px-3 py-1.5 text-sm rounded-md ${
                                page === dozentPage
                                  ? 'bg-primary text-white'
                                  : 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            onClick={() => setDozentPage(p => Math.min(totalPages, p + 1))}
                            disabled={dozentPage === totalPages}
                            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Weiter
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
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
              
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Studenten suchen (Name, Email, TN-Nummer)..."
                  value={teilnehmerSearch}
                  onChange={(e) => setTeilnehmerSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
                {teilnehmerSearch && (
                  <button
                    onClick={() => setTeilnehmerSearch('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Filter Buttons - scrollable on mobile */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setTeilnehmerFilter('alle')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    teilnehmerFilter === 'alle'
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={teilnehmerFilter === 'alle' ? { backgroundColor: '#2d84c1' } : undefined}
                >
                  Alle ({teilnehmer.length})
                </button>
                <button
                  onClick={() => setTeilnehmerFilter('aktiv')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    teilnehmerFilter === 'aktiv'
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={teilnehmerFilter === 'aktiv' ? { backgroundColor: '#2d84c1' } : undefined}
                >
                  Aktiv ({teilnehmer.filter(t => isContractActive(t)).length})
                </button>
                <button
                  onClick={() => setTeilnehmerFilter('abgeschlossen')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    teilnehmerFilter === 'abgeschlossen'
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={teilnehmerFilter === 'abgeschlossen' ? { backgroundColor: '#2d84c1' } : undefined}
                >
                  Abgeschl. ({teilnehmer.filter(t => isTeilnehmerCompleted(t)).length})
                </button>
                <div className="h-4 w-px bg-gray-300 mx-1"></div>
                <button
                  onClick={() => setTeilnehmerFilter('25')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    teilnehmerFilter === '25'
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={teilnehmerFilter === '25' ? { backgroundColor: '#2d84c1' } : undefined}
                >
                  25% ({teilnehmer.filter(t => {
                    const consumption = getHoursConsumption(t);
                    return consumption >= 25 && consumption < 75 && isContractActive(t);
                  }).length})
                </button>
                <button
                  onClick={() => setTeilnehmerFilter('75')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    teilnehmerFilter === '75'
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={teilnehmerFilter === '75' ? { backgroundColor: '#2d84c1' } : undefined}
                >
                  75% ({teilnehmer.filter(t => {
                    const consumption = getHoursConsumption(t);
                    return consumption >= 75 && isContractActive(t);
                  }).length})
                </button>
                <div className="h-4 w-px bg-gray-300 mx-1"></div>
                <button
                  onClick={() => setTeilnehmerFilter('elite')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    teilnehmerFilter === 'elite'
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={teilnehmerFilter === 'elite' ? { backgroundColor: '#2d84c1' } : undefined}
                >
                  Elite ({teilnehmer.filter(t => t.is_elite_kleingruppe).length})
                </button>
                <button
                  onClick={() => setTeilnehmerFilter('2staatsexamen')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    teilnehmerFilter === '2staatsexamen'
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={teilnehmerFilter === '2staatsexamen' ? { backgroundColor: '#2d84c1' } : undefined}
                >
                  2. Staatsexamen ({teilnehmer.filter(t => t.study_goal?.includes('2. Staatsexamen')).length})
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
                      // Search filter
                      if (teilnehmerSearch) {
                        const searchLower = teilnehmerSearch.toLowerCase();
                        const matchesName = t.name?.toLowerCase().includes(searchLower);
                        const matchesEmail = t.email?.toLowerCase().includes(searchLower);
                        const matchesTnNummer = t.tn_nummer?.toLowerCase().includes(searchLower);
                        if (!matchesName && !matchesEmail && !matchesTnNummer) return false;
                      }
                      
                      // Category filter
                      if (teilnehmerFilter === 'alle') return true;
                      if (teilnehmerFilter === 'aktiv') return isContractActive(t);
                      if (teilnehmerFilter === 'abgeschlossen') return isTeilnehmerCompleted(t);
                      if (teilnehmerFilter === '25') {
                        const consumption = getHoursConsumption(t);
                        return consumption >= 25 && consumption < 75 && isContractActive(t);
                      }
                      if (teilnehmerFilter === '75') {
                        const consumption = getHoursConsumption(t);
                        return consumption >= 75 && isContractActive(t);
                      }
                      if (teilnehmerFilter === 'elite') return t.is_elite_kleingruppe === true;
                      if (teilnehmerFilter === '2staatsexamen') return t.study_goal?.includes('2. Staatsexamen');
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
                            {t.is_elite_kleingruppe && t.elite_kleingruppe && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                  {t.elite_kleingruppe.name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        {t.elite_kleingruppe || t.is_elite_kleingruppe ? (
                          (() => {
                            // Use individual progress if available, otherwise fall back to global
                            const progress = t.elite_progress || eliteReleases;
                            const progressPercent = progress.total > 0 
                              ? Math.round((progress.released / progress.total) * 100) 
                              : 0;
                            const isComplete = progressPercent >= 100;
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                isComplete ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                              }`}>
                                {isComplete ? 'Abgeschl.' : `${progressPercent}%`}
                              </span>
                            );
                          })()
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isContractActive(t) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {isContractActive(t) ? 'Aktiv' : 'Abgeschl.'}
                          </span>
                        )}
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
                          <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                            Elite-KG
                          </th>
                          <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Aktionen
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {teilnehmer
                          .filter(t => {
                            // Search filter
                            if (teilnehmerSearch) {
                              const searchLower = teilnehmerSearch.toLowerCase();
                              const matchesName = t.name?.toLowerCase().includes(searchLower);
                              const matchesEmail = t.email?.toLowerCase().includes(searchLower);
                              const matchesTnNummer = t.tn_nummer?.toLowerCase().includes(searchLower);
                              if (!matchesName && !matchesEmail && !matchesTnNummer) return false;
                            }
                            
                            // Category filter
                            if (teilnehmerFilter === 'alle') return true;
                            if (teilnehmerFilter === 'aktiv') return isContractActive(t);
                            if (teilnehmerFilter === 'abgeschlossen') return isTeilnehmerCompleted(t);
                            if (teilnehmerFilter === '25') {
                              const consumption = getHoursConsumption(t);
                              return consumption >= 25 && consumption < 75 && isContractActive(t);
                            }
                            if (teilnehmerFilter === '75') {
                              const consumption = getHoursConsumption(t);
                              return consumption >= 75 && isContractActive(t);
                            }
                            if (teilnehmerFilter === 'elite') return t.is_elite_kleingruppe === true;
                            if (teilnehmerFilter === '2staatsexamen') return t.study_goal?.includes('2. Staatsexamen');
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
                                  {t.is_elite_kleingruppe && t.elite_kleingruppe && (
                                    <div className="mt-1">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                        {t.elite_kleingruppe.name}
                                      </span>
                                    </div>
                                  )}
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
                                  </div>
                                  {/* Progress Bar for Desktop */}
                                  {t.contract_start && t.contract_end && (() => {
                                    const progress = getContractProgress(t);
                                    const hasHoursLeft = t.booked_hours && (t.booked_hours - (t.completed_hours || 0)) > 0;
                                    const isFinishedWithHoursLeft = progress.percent >= 100 && hasHoursLeft;
                                    return (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-20 bg-gray-200 rounded-full h-1.5">
                                          <div 
                                            className={`h-1.5 rounded-full ${
                                              isFinishedWithHoursLeft ? 'bg-red-500' :
                                              progress.percent >= 100 ? 'bg-gray-400' : 
                                              progress.percent >= 75 ? 'bg-orange-500' : 
                                              'bg-primary'
                                            }`}
                                            style={{ width: `${Math.min(progress.percent, 100)}%` }}
                                          />
                                        </div>
                                        <span className={`text-xs ${
                                          isFinishedWithHoursLeft ? 'text-red-600' :
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
                            <td className="px-4 sm:px-6 py-4 hidden lg:table-cell">
                              <div className="text-xs text-gray-500 max-w-[120px] line-clamp-2">
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
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                              {t.is_elite_kleingruppe && t.elite_kleingruppe ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                                  {t.elite_kleingruppe.name}
                                </span>
                              ) : t.is_elite_kleingruppe ? (
                                <span className="text-xs text-gray-400">Nicht zugeordnet</span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              {(() => {
                                // For Elite-Kleingruppe participants, show progress based on released units
                                if (t.elite_kleingruppe || t.is_elite_kleingruppe) {
                                  // Use individual progress if available, otherwise fall back to global
                                  const progress = t.elite_progress || eliteReleases;
                                  const progressPercent = progress.total > 0 
                                    ? Math.round((progress.released / progress.total) * 100) 
                                    : 0;
                                  const isComplete = progressPercent >= 100;
                                  return (
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        isComplete ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                                      }`}>
                                        {isComplete ? 'Abgeschlossen' : `${progressPercent}% Einheiten`}
                                      </span>
                                      {progress.total > 0 && (
                                        <span className="text-xs text-gray-500">
                                          ({progress.released}/{progress.total})
                                        </span>
                                      )}
                                    </div>
                                  );
                                }
                                
                                const isActive = isContractActive(t);
                                const hasHoursLeft = t.booked_hours && (t.booked_hours - (t.completed_hours || 0)) > 0;
                                const isUrgent = !isActive && hasHoursLeft;
                                const isRunning = isActive && hasHoursLeft;
                                return (
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      isUrgent ? 'bg-red-100 text-red-800' :
                                      isRunning ? 'bg-blue-100 text-blue-800' :
                                      isActive ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {isUrgent ? 'Dringend' : isRunning ? 'Laufend' : isActive ? 'Stunden voll' : 'Abgeschlossen'}
                                    </span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    setSelectedTeilnehmerForNotes(t);
                                    fetchTeilnehmerNotes(t.id);
                                    setShowNotesModal(true);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                                  title="Notizen anzeigen"
                                >
                                  <FileText className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedTeilnehmerForEdit(t);
                                    setShowTeilnehmerForm(true);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                                  title="Teilnehmer bearbeiten"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    
                                    // Fetch all hours for this participant
                                    const { data: hoursData, error: hoursError } = await supabase
                                      .from('participant_hours')
                                      .select(`
                                        *,
                                        dozent:profiles!participant_hours_dozent_id_fkey(full_name)
                                      `)
                                      .eq('teilnehmer_id', t.id)
                                      .order('date', { ascending: false });
                                    
                                    if (hoursError) {
                                      console.error('Error fetching hours:', hoursError);
                                      return;
                                    }
                                    
                                    const { jsPDF } = await import('jspdf');
                                    const doc = new jsPDF();
                                    
                                    // Portal colors
                                    const primaryColor = { r: 44, g: 131, b: 192 }; // #2C83C0
                                    const lightBg = { r: 215, g: 229, b: 243 }; // #D7E5F3
                                    
                                    // Add logo
                                    try {
                                      const logoImg = new Image();
                                      logoImg.crossOrigin = 'anonymous';
                                      await new Promise((resolve, reject) => {
                                        logoImg.onload = resolve;
                                        logoImg.onerror = reject;
                                        logoImg.src = '/KraatzGroup_Logo_web.png';
                                      });
                                      // Logo aspect ratio ~2:1 (width:height)
                                      doc.addImage(logoImg, 'PNG', 15, 8, 40, 22);
                                    } catch (err) {
                                      console.log('Logo could not be loaded');
                                    }
                                    
                                    // Header bar
                                    doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
                                    doc.rect(0, 35, 210, 12, 'F');
                                    
                                    doc.setTextColor(255, 255, 255);
                                    doc.setFontSize(14);
                                    doc.setFont('helvetica', 'bold');
                                    doc.text('STUNDENÜBERSICHT', 105, 43, { align: 'center' });
                                    
                                    // Reset text color
                                    doc.setTextColor(0, 0, 0);
                                    
                                    // Participant info box
                                    doc.setFillColor(lightBg.r, lightBg.g, lightBg.b);
                                    doc.roundedRect(15, 52, 180, 45, 3, 3, 'F');
                                    
                                    doc.setFontSize(16);
                                    doc.setFont('helvetica', 'bold');
                                    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
                                    doc.text(t.name, 25, 65);
                                    
                                    doc.setTextColor(80, 80, 80);
                                    doc.setFontSize(10);
                                    doc.setFont('helvetica', 'normal');
                                    doc.text(`E-Mail: ${t.email || '-'}`, 25, 74);
                                    doc.text(`Studienziel: ${t.study_goal || '-'}`, 25, 81);
                                    if (t.contract_start && t.contract_end) {
                                      doc.text(`Vertragszeitraum: ${new Date(t.contract_start).toLocaleDateString('de-DE')} - ${new Date(t.contract_end).toLocaleDateString('de-DE')}`, 25, 88);
                                    }
                                    
                                    // Hours summary box
                                    doc.setFillColor(255, 255, 255);
                                    doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
                                    doc.roundedRect(120, 58, 70, 35, 2, 2, 'FD');
                                    
                                    doc.setFontSize(9);
                                    doc.setTextColor(100, 100, 100);
                                    doc.text('Gebuchte Std.:', 125, 67);
                                    doc.text('Absolviert:', 125, 76);
                                    doc.text('Ausstehend:', 125, 85);
                                    
                                    doc.setFont('helvetica', 'bold');
                                    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
                                    doc.text(`${t.booked_hours || 0}`, 175, 67, { align: 'right' });
                                    doc.setTextColor(34, 139, 34);
                                    doc.text(`${t.completed_hours || 0}`, 175, 76, { align: 'right' });
                                    const remaining = (t.booked_hours || 0) - (t.completed_hours || 0);
                                    doc.setTextColor(remaining > 0 ? 200 : 34, remaining > 0 ? 120 : 139, remaining > 0 ? 50 : 34);
                                    doc.text(`${remaining}`, 175, 85, { align: 'right' });
                                    
                                    // Dozenten section
                                    let yPos = 105;
                                    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
                                    doc.setFontSize(11);
                                    doc.setFont('helvetica', 'bold');
                                    doc.text('Zugewiesene Dozenten', 20, yPos);
                                    yPos += 2;
                                    doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
                                    doc.line(20, yPos, 80, yPos);
                                    yPos += 8;
                                    
                                    doc.setTextColor(60, 60, 60);
                                    doc.setFontSize(10);
                                    doc.setFont('helvetica', 'normal');
                                    
                                    if (t.dozent_zivilrecht_id) {
                                      const dozent = dozenten.find(d => d.id === t.dozent_zivilrecht_id);
                                      doc.text(`• Zivilrecht: ${dozent?.full_name || '-'}`, 25, yPos);
                                      yPos += 6;
                                    }
                                    if (t.dozent_strafrecht_id) {
                                      const dozent = dozenten.find(d => d.id === t.dozent_strafrecht_id);
                                      doc.text(`• Strafrecht: ${dozent?.full_name || '-'}`, 25, yPos);
                                      yPos += 6;
                                    }
                                    if (t.dozent_oeffentliches_recht_id) {
                                      const dozent = dozenten.find(d => d.id === t.dozent_oeffentliches_recht_id);
                                      doc.text(`• Öffentliches Recht: ${dozent?.full_name || '-'}`, 25, yPos);
                                      yPos += 6;
                                    }
                                    if (!t.dozent_zivilrecht_id && !t.dozent_strafrecht_id && !t.dozent_oeffentliches_recht_id) {
                                      doc.text('Keine Dozenten zugewiesen', 25, yPos);
                                      yPos += 6;
                                    }
                                    
                                    // Detailed hours entries
                                    yPos += 10;
                                    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
                                    doc.setFontSize(11);
                                    doc.setFont('helvetica', 'bold');
                                    doc.text('Stundeneinträge', 20, yPos);
                                    yPos += 2;
                                    doc.line(20, yPos, 70, yPos);
                                    yPos += 8;
                                    
                                    if (hoursData && hoursData.length > 0) {
                                      // Table header with background
                                      doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
                                      doc.rect(15, yPos - 5, 180, 8, 'F');
                                      
                                      doc.setFontSize(9);
                                      doc.setFont('helvetica', 'bold');
                                      doc.setTextColor(255, 255, 255);
                                      doc.text('Datum', 20, yPos);
                                      doc.text('Dozent', 50, yPos);
                                      doc.text('Std.', 115, yPos);
                                      doc.text('Inhalt', 130, yPos);
                                      yPos += 8;
                                      
                                      doc.setFont('helvetica', 'normal');
                                      doc.setTextColor(60, 60, 60);
                                      let totalHours = 0;
                                      let rowIndex = 0;
                                      
                                      for (const entry of hoursData) {
                                        // Check if we need a new page
                                        if (yPos > 265) {
                                          doc.addPage();
                                          yPos = 20;
                                          // Repeat table header on new page
                                          doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
                                          doc.rect(15, yPos - 5, 180, 8, 'F');
                                          doc.setFont('helvetica', 'bold');
                                          doc.setTextColor(255, 255, 255);
                                          doc.text('Datum', 20, yPos);
                                          doc.text('Dozent', 50, yPos);
                                          doc.text('Std.', 115, yPos);
                                          doc.text('Inhalt', 130, yPos);
                                          yPos += 8;
                                          doc.setFont('helvetica', 'normal');
                                          doc.setTextColor(60, 60, 60);
                                        }
                                        
                                        // Alternating row background
                                        if (rowIndex % 2 === 0) {
                                          doc.setFillColor(245, 248, 252);
                                          doc.rect(15, yPos - 4, 180, 7, 'F');
                                        }
                                        
                                        const dateStr = new Date(entry.date).toLocaleDateString('de-DE');
                                        const dozentName = entry.dozent?.full_name || '-';
                                        const hours = parseFloat(entry.hours?.toString() || '0');
                                        totalHours += hours;
                                        const description = entry.description || '-';
                                        
                                        // Truncate long descriptions
                                        const maxDescLength = 32;
                                        const truncatedDesc = description.length > maxDescLength 
                                          ? description.substring(0, maxDescLength) + '...' 
                                          : description;
                                        
                                        doc.setFontSize(9);
                                        doc.text(dateStr, 20, yPos);
                                        doc.text(dozentName.substring(0, 28), 50, yPos);
                                        doc.text(hours.toString(), 115, yPos);
                                        doc.text(truncatedDesc, 130, yPos);
                                        yPos += 7;
                                        rowIndex++;
                                      }
                                      
                                      // Total row
                                      yPos += 2;
                                      doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
                                      doc.rect(15, yPos - 4, 180, 8, 'F');
                                      doc.setFont('helvetica', 'bold');
                                      doc.setTextColor(255, 255, 255);
                                      doc.text('GESAMT:', 20, yPos);
                                      doc.text(`${totalHours} Stunden`, 115, yPos);
                                    } else {
                                      doc.setFontSize(10);
                                      doc.setTextColor(100, 100, 100);
                                      doc.text('Keine Stundeneinträge vorhanden.', 25, yPos);
                                    }
                                    
                                    // Footer
                                    doc.setFillColor(lightBg.r, lightBg.g, lightBg.b);
                                    doc.rect(0, 280, 210, 17, 'F');
                                    doc.setFont('helvetica', 'normal');
                                    doc.setFontSize(8);
                                    doc.setTextColor(100, 100, 100);
                                    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')}`, 20, 288);
                                    doc.text('info@kraatz-group.de', 190, 288, { align: 'right' });
                                    
                                    doc.save(`Stundenübersicht_${t.name.replace(/\s+/g, '_')}.pdf`);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                                  title="Stundenübersicht als PDF herunterladen"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              </div>
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
                  {submittedInvoices.filter(i => i.status === 'submitted' || i.status === 'sent').length > 0 && (
                    <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {submittedInvoices.filter(i => i.status === 'submitted' || i.status === 'sent').length} zur Bearbeitung
                    </span>
                  )}
                </h3>
                <div className="flex-shrink-0 flex gap-2">
                  <button
                    onClick={() => {
                      setInvoiceDeadlineTemp(invoiceDeadlineDay);
                      setShowDeadlineModal(true);
                    }}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    title="Rechnungsfrist einstellen"
                  >
                    <Clock className="h-4 w-4 mr-1.5 text-gray-500" />
                    <span className="hidden sm:inline">Frist:</span>
                    <span className="sm:ml-1 font-semibold text-primary">{invoiceDeadlineDay}.</span>
                  </button>
                  <select
                    value={invoiceFilterMonth}
                    onChange={(e) => setInvoiceFilterMonth(e.target.value === 'alle' ? 'alle' : parseInt(e.target.value))}
                    className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
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
                    className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
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
                // Filter invoices by month/year - only show unpaid (submitted/sent) invoices
                const unpaidInvoices = submittedInvoices.filter(i => i.status === 'submitted' || i.status === 'sent');
                const filteredInvoices = invoiceFilterMonth === 'alle'
                  ? unpaidInvoices.filter(i => i.year === invoiceFilterYear)
                  : unpaidInvoices.filter(i => {
                      // Check if invoice matches by month
                      if (i.month === invoiceFilterMonth && i.year === invoiceFilterYear) {
                        return true;
                      }
                      // Check if invoice is a quarterly invoice that covers the filtered month
                      if (i.period_start && i.period_end) {
                        const startDate = new Date(i.period_start);
                        const endDate = new Date(i.period_end);
                        const startMonth = startDate.getMonth() + 1;
                        const endMonth = endDate.getMonth() + 1;
                        const startYear = startDate.getFullYear();
                        const endYear = endDate.getFullYear();
                        
                        // Check if filtered month/year falls within the invoice period
                        if (invoiceFilterYear >= startYear && invoiceFilterYear <= endYear) {
                          if (invoiceFilterYear === startYear && invoiceFilterMonth >= startMonth) {
                            return true;
                          }
                          if (invoiceFilterYear === endYear && invoiceFilterMonth <= endMonth) {
                            return true;
                          }
                          if (invoiceFilterYear > startYear && invoiceFilterYear < endYear) {
                            return true;
                          }
                        }
                      }
                      return false;
                    });
                
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
                                  invoice.status === 'submitted' || invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {invoice.status === 'submitted' || invoice.status === 'sent' ? 'Übermittelt' : 'Bezahlt'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500">{invoice.dozent_name}</p>
                              <p className="text-xs text-gray-400">
                                {getInvoicePeriodDisplay(invoice)}
                                {' • '}Erstellt: {new Date(invoice.created_at).toLocaleDateString('de-DE')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-13 sm:ml-0">
                            {/* Preview Button */}
                            <button
                              onClick={async () => {
                                try {
                                  // Fetch invoice to get file_path
                                  const { data: invoiceData } = await supabase
                                    .from('invoices')
                                    .select('file_path')
                                    .eq('id', invoice.id)
                                    .single();
                                  
                                  if (invoiceData?.file_path) {
                                    // Download as blob to fix MIME type issue
                                    const { data: pdfData, error: downloadError } = await supabase.storage
                                      .from('invoices')
                                      .download(invoiceData.file_path);
                                    
                                    if (!downloadError && pdfData) {
                                      const pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
                                      const url = URL.createObjectURL(pdfBlob);
                                      setPdfViewerUrl(url);
                                      setPdfViewerFileName(`${invoice.invoice_number}.pdf`);
                                      setPdfViewerOpen(true);
                                      return;
                                    }
                                  }
                                  
                                  addToast('Keine PDF-Datei vorhanden', 'error');
                                } catch (error) {
                                  console.error('Error opening PDF:', error);
                                  addToast('Fehler beim Öffnen der PDF', 'error');
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
                                try {
                                  const { data: invoiceData } = await supabase
                                    .from('invoices')
                                    .select('file_path')
                                    .eq('id', invoice.id)
                                    .single();
                                  
                                  if (invoiceData?.file_path) {
                                    // Download as blob to fix MIME type issue
                                    const { data: pdfData, error: downloadError } = await supabase.storage
                                      .from('invoices')
                                      .download(invoiceData.file_path);
                                    
                                    if (!downloadError && pdfData) {
                                      const pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
                                      const url = URL.createObjectURL(pdfBlob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      const monthName = new Date(2023, invoice.month - 1).toLocaleDateString('de-DE', { month: 'long' });
                                      const dozentName = (invoice.dozent_name || '').replace(/\s+/g, '_');
                                      link.download = `${invoice.invoice_number}_${monthName}_${invoice.year}_${dozentName}.pdf`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      URL.revokeObjectURL(url);
                                      return;
                                    }
                                  }
                                  
                                  addToast('Keine PDF-Datei vorhanden', 'error');
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
                            {/* Delete PDF Button */}
                            <button
                              onClick={() => setDeleteInvoiceModal({ show: true, invoice })}
                              className="inline-flex items-center px-2 py-1.5 border border-red-300 text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                              title="PDF löschen"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            {(invoice.status === 'submitted' || invoice.status === 'sent') && (
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
              
              {/* Filter by Month/Year */}
              <div className="mb-4 flex flex-col sm:flex-row gap-4">
                <div className="flex-shrink-0 flex gap-2">
                  <select
                    value={rechnungenFilter === 'alle' ? 'alle' : rechnungenFilter.split('-')[1]}
                    onChange={(e) => {
                      if (e.target.value === 'alle') {
                        setRechnungenFilter('alle');
                      } else {
                        const year = rechnungenFilter === 'alle' ? new Date().getFullYear() : rechnungenFilter.split('-')[0];
                        setRechnungenFilter(`${year}-${e.target.value}`);
                      }
                    }}
                    className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  >
                    <option value="alle">Alle Monate</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                        {new Date(2023, i).toLocaleDateString('de-DE', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={rechnungenFilter === 'alle' ? new Date().getFullYear() : rechnungenFilter.split('-')[0]}
                    onChange={(e) => {
                      if (rechnungenFilter === 'alle') {
                        setRechnungenFilter(`${e.target.value}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
                      } else {
                        const month = rechnungenFilter.split('-')[1];
                        setRechnungenFilter(`${e.target.value}-${month}`);
                      }
                    }}
                    className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return <option key={year} value={year}>{year}</option>;
                    })}
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

                console.log('🔍 [AdminDashboard] Paid invoices filter debug:', {
                  rechnungenFilter,
                  submittedInvoicesCount: submittedInvoices.length,
                  paidInvoicesCountBefore: paidInvoices.length,
                  paidInvoicesBefore: paidInvoices.map(i => ({ id: i.id, invoice_number: i.invoice_number, month: i.month, year: i.year, period_start: i.period_start, period_end: i.period_end }))
                });

                // Filter by month
                if (rechnungenFilter !== 'alle') {
                  const [filterYear, filterMonth] = rechnungenFilter.split('-').map(Number);
                  console.log('🔍 [AdminDashboard] Filtering by:', { filterYear, filterMonth });

                  paidInvoices = paidInvoices.filter(i => {
                    // Check if invoice matches by month
                    if (i.year === filterYear && i.month === filterMonth) {
                      console.log('🔍 [AdminDashboard] Match by month/year:', i.invoice_number);
                      return true;
                    }
                    // Check if invoice is a quarterly invoice that covers the filtered month
                    if (i.period_start && i.period_end) {
                      const startDate = new Date(i.period_start);
                      const endDate = new Date(i.period_end);
                      const startMonth = startDate.getMonth() + 1;
                      const endMonth = endDate.getMonth() + 1;
                      const startYear = startDate.getFullYear();
                      const endYear = endDate.getFullYear();

                      // Only match quarterly invoices if the filter month/year is exactly within the invoice period
                      // AND the invoice's month/year doesn't match (to avoid double counting)
                      if (i.month !== filterMonth || i.year !== filterYear) {
                        if (filterYear >= startYear && filterYear <= endYear) {
                          if (filterYear === startYear && filterMonth >= startMonth && filterMonth <= endMonth) {
                            console.log('🔍 [AdminDashboard] Match by period (start year):', i.invoice_number);
                            return true;
                          }
                          if (filterYear === endYear && filterMonth <= endMonth && filterMonth >= startMonth) {
                            console.log('🔍 [AdminDashboard] Match by period (end year):', i.invoice_number);
                            return true;
                          }
                          if (filterYear > startYear && filterYear < endYear) {
                            console.log('🔍 [AdminDashboard] Match by period (middle year):', i.invoice_number);
                            return true;
                          }
                        }
                      }
                    }
                    return false;
                  });
                }

                console.log('🔍 [AdminDashboard] Paid invoices after filter:', {
                  paidInvoicesCountAfter: paidInvoices.length,
                  paidInvoicesAfter: paidInvoices.map(i => ({ id: i.id, invoice_number: i.invoice_number, month: i.month, year: i.year }))
                });
                
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
                                {getInvoicePeriodDisplay(invoice)}
                                {invoice.paid_at && (
                                  <> • Bezahlt am: {new Date(invoice.paid_at).toLocaleDateString('de-DE')}</>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-13 sm:ml-0">
                            {/* Preview Button - Paid Invoices */}
                            <button
                              onClick={async () => {
                                try {
                                  const { data: invoiceData } = await supabase
                                    .from('invoices')
                                    .select('file_path')
                                    .eq('id', invoice.id)
                                    .single();
                                  
                                  if (invoiceData?.file_path) {
                                    // Download as blob to fix MIME type issue
                                    const { data: pdfData, error: downloadError } = await supabase.storage
                                      .from('invoices')
                                      .download(invoiceData.file_path);
                                    
                                    if (!downloadError && pdfData) {
                                      const pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
                                      const url = URL.createObjectURL(pdfBlob);
                                      setPdfViewerUrl(url);
                                      setPdfViewerFileName(`${invoice.invoice_number}.pdf`);
                                      setPdfViewerOpen(true);
                                      return;
                                    }
                                  }
                                  
                                  addToast('Keine PDF-Datei vorhanden', 'error');
                                } catch (error) {
                                  console.error('Error opening PDF:', error);
                                  addToast('Fehler beim Öffnen der PDF', 'error');
                                }
                              }}
                              className="inline-flex items-center px-2 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                              title="Vorschau"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {/* Download Button - Paid Invoices */}
                            <button
                              onClick={async () => {
                                try {
                                  const { data: invoiceData } = await supabase
                                    .from('invoices')
                                    .select('file_path')
                                    .eq('id', invoice.id)
                                    .single();
                                  
                                  if (invoiceData?.file_path) {
                                    // Download as blob to fix MIME type issue
                                    const { data: pdfData, error: downloadError } = await supabase.storage
                                      .from('invoices')
                                      .download(invoiceData.file_path);
                                    
                                    if (!downloadError && pdfData) {
                                      const pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
                                      const url = URL.createObjectURL(pdfBlob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      const monthName = new Date(2023, invoice.month - 1).toLocaleDateString('de-DE', { month: 'long' });
                                      const dozentName = (invoice.dozent_name || '').replace(/\s+/g, '_');
                                      link.download = `${invoice.invoice_number}_${monthName}_${invoice.year}_${dozentName}.pdf`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      URL.revokeObjectURL(url);
                                      return;
                                    }
                                  }
                                  
                                  addToast('Keine PDF-Datei vorhanden', 'error');
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
                            {/* Delete PDF Button */}
                            <button
                              onClick={() => setDeleteInvoiceModal({ show: true, invoice })}
                              className="inline-flex items-center px-2 py-1.5 border border-red-300 text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                              title="PDF löschen"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

                    // Find exam dates for this day
                    const examDatesToday = teilnehmer.filter(t => {
                      if (!t.exam_date) return false;
                      const examDate = new Date(t.exam_date);
                      return examDate.getDate() === day && 
                             examDate.getMonth() === calendarMonth && 
                             examDate.getFullYear() === calendarYear;
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
                          {calendarFilters.show25 && milestones25.map(t => (
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
                          {calendarFilters.show75 && milestones75.map(t => (
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
                          {calendarFilters.showEnd && contractsEndingToday.map(t => (
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
                          {calendarFilters.showExam && examDatesToday.map(t => (
                            <div 
                              key={`exam-${t.id}`}
                              className="text-xs bg-purple-100 text-purple-700 px-1 py-0.5 rounded truncate cursor-pointer hover:bg-purple-200"
                              title={`Prüfungstermin: ${t.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTeilnehmer(t);
                                setPreviewType('end');
                                setShowTeilnehmerPreview(true);
                              }}
                            >
                              📝 {t.name}
                            </div>
                          ))}
                          {calendarFilters.showCustom && entriesForDay.map(entry => (
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

              {/* Legend - Clickable Filters */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Filter (klicken zum Ein-/Ausblenden)</h3>
                <div className="flex flex-wrap gap-2 sm:gap-4">
                  <button
                    onClick={() => setCalendarFilters(prev => ({ ...prev, show25: !prev.show25 }))}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-all ${
                      calendarFilters.show25 
                        ? 'border-yellow-300 bg-yellow-50' 
                        : 'border-gray-200 bg-gray-50 opacity-50'
                    }`}
                  >
                    <span className="text-sm">🔔</span>
                    <div className="w-4 h-4 bg-yellow-100 rounded"></div>
                    <span className="text-xs sm:text-sm text-gray-600">25% Vertragslaufzeit</span>
                  </button>
                  <button
                    onClick={() => setCalendarFilters(prev => ({ ...prev, show75: !prev.show75 }))}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-all ${
                      calendarFilters.show75 
                        ? 'border-orange-300 bg-orange-50' 
                        : 'border-gray-200 bg-gray-50 opacity-50'
                    }`}
                  >
                    <span className="text-sm">⏰</span>
                    <div className="w-4 h-4 bg-orange-100 rounded"></div>
                    <span className="text-xs sm:text-sm text-gray-600">75% Vertragslaufzeit</span>
                  </button>
                  <button
                    onClick={() => setCalendarFilters(prev => ({ ...prev, showEnd: !prev.showEnd }))}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-all ${
                      calendarFilters.showEnd 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-200 bg-gray-50 opacity-50'
                    }`}
                  >
                    <span className="text-sm">📋</span>
                    <div className="w-4 h-4 bg-red-100 rounded"></div>
                    <span className="text-xs sm:text-sm text-gray-600">Vertragsende</span>
                  </button>
                  <button
                    onClick={() => setCalendarFilters(prev => ({ ...prev, showExam: !prev.showExam }))}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-all ${
                      calendarFilters.showExam 
                        ? 'border-purple-300 bg-purple-50' 
                        : 'border-gray-200 bg-gray-50 opacity-50'
                    }`}
                  >
                    <span className="text-sm">📝</span>
                    <div className="w-4 h-4 bg-purple-100 rounded"></div>
                    <span className="text-xs sm:text-sm text-gray-600">Prüfungstermin</span>
                  </button>
                  <button
                    onClick={() => setCalendarFilters(prev => ({ ...prev, showCustom: !prev.showCustom }))}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-all ${
                      calendarFilters.showCustom 
                        ? 'border-blue-300 bg-blue-50' 
                        : 'border-gray-200 bg-gray-50 opacity-50'
                    }`}
                  >
                    <span className="text-sm">📅</span>
                    <div className="w-4 h-4 bg-blue-100 rounded"></div>
                    <span className="text-xs sm:text-sm text-gray-600">Eigene Einträge</span>
                  </button>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <div className="w-4 h-4 border-2 border-primary bg-primary/5 rounded"></div>
                    <span className="text-xs sm:text-sm text-gray-600">Heute</span>
                  </div>
                </div>
              </div>

              {/* All Events List */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h3 className="text-sm font-medium text-gray-700">Alle Termine</h3>
                  <select
                    value={eventListFilter}
                    onChange={(e) => setEventListFilter(e.target.value as typeof eventListFilter)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="alle">Alle Kategorien</option>
                    <option value="25">🔔 25% Vertragslaufzeit</option>
                    <option value="75">⏰ 75% Vertragslaufzeit</option>
                    <option value="end">📋 Vertragsende</option>
                    <option value="exam">📝 Prüfungstermin</option>
                    <option value="custom">📅 Eigene Einträge</option>
                  </select>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const allEvents: { date: Date; type: string; name: string; teilnehmer?: any; entry?: any }[] = [];

                    // Collect 25% milestones
                    if (eventListFilter === 'alle' || eventListFilter === '25') {
                      teilnehmer.forEach(t => {
                        if (!t.contract_start || !t.contract_end) return;
                        const start = new Date(t.contract_start);
                        const end = new Date(t.contract_end);
                        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                        const milestone25Date = new Date(start.getTime() + totalDays * 0.25 * 24 * 60 * 60 * 1000);
                        allEvents.push({ date: milestone25Date, type: '25', name: t.name, teilnehmer: t });
                      });
                    }

                    // Collect 75% milestones
                    if (eventListFilter === 'alle' || eventListFilter === '75') {
                      teilnehmer.forEach(t => {
                        if (!t.contract_start || !t.contract_end) return;
                        const start = new Date(t.contract_start);
                        const end = new Date(t.contract_end);
                        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                        const milestone75Date = new Date(start.getTime() + totalDays * 0.75 * 24 * 60 * 60 * 1000);
                        allEvents.push({ date: milestone75Date, type: '75', name: t.name, teilnehmer: t });
                      });
                    }

                    // Collect contract endings
                    if (eventListFilter === 'alle' || eventListFilter === 'end') {
                      teilnehmer.forEach(t => {
                        if (!t.contract_end) return;
                        const endDate = new Date(t.contract_end);
                        allEvents.push({ date: endDate, type: 'end', name: t.name, teilnehmer: t });
                      });
                    }

                    // Collect exam dates
                    if (eventListFilter === 'alle' || eventListFilter === 'exam') {
                      teilnehmer.forEach(t => {
                        if (!t.exam_date) return;
                        const examDate = new Date(t.exam_date);
                        allEvents.push({ date: examDate, type: 'exam', name: t.name, teilnehmer: t });
                      });
                    }

                    // Collect custom calendar entries
                    if (eventListFilter === 'alle' || eventListFilter === 'custom') {
                      calendarEntries.forEach(entry => {
                        const entryDate = new Date(entry.entry_date);
                        allEvents.push({ date: entryDate, type: 'custom', name: entry.title, entry: entry });
                      });
                    }

                    // Sort by date
                    allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

                    if (allEvents.length === 0) {
                      return (
                        <p className="text-sm text-gray-500 py-4 text-center">Keine Termine in der ausgewählten Kategorie</p>
                      );
                    }

                    const typeStyles: { [key: string]: { bg: string; text: string; icon: string; label: string } } = {
                      '25': { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '🔔', label: '25% Vertragslaufzeit' },
                      '75': { bg: 'bg-orange-100', text: 'text-orange-700', icon: '⏰', label: '75% Vertragslaufzeit' },
                      'end': { bg: 'bg-red-100', text: 'text-red-700', icon: '📋', label: 'Vertragsende' },
                      'exam': { bg: 'bg-purple-100', text: 'text-purple-700', icon: '📝', label: 'Prüfungstermin' },
                      'custom': { bg: 'bg-blue-100', text: 'text-blue-700', icon: '📅', label: 'Eigener Eintrag' }
                    };

                    return allEvents.map((event, idx) => {
                      const style = typeStyles[event.type];
                      const daysUntil = Math.ceil((event.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      
                      return (
                        <div 
                          key={`${event.type}-${idx}`}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            if (event.teilnehmer) {
                              setPreviewTeilnehmer(event.teilnehmer);
                              setPreviewType(event.type === '25' ? '25' : event.type === '75' ? '75' : 'end');
                              setShowTeilnehmerPreview(true);
                            } else if (event.entry) {
                              setSelectedCalendarDate(new Date(event.entry.entry_date));
                              setCalendarEntryTitle(event.entry.title);
                              setCalendarEntryDescription(event.entry.description || '');
                              setCalendarEntryColor(event.entry.color);
                              setEditingCalendarEntry(event.entry);
                              setShowCalendarEntryModal(true);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded text-xs ${style.bg} ${style.text}`}>
                              {style.icon} {style.label}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{event.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium ${style.text}`}>
                              {event.date.toLocaleDateString('de-DE')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {daysUntil === 0 ? 'Heute' : daysUntil === 1 ? 'Morgen' : daysUntil === -1 ? 'Gestern' : daysUntil > 0 ? `in ${daysUntil} Tagen` : `vor ${Math.abs(daysUntil)} Tagen`}
                            </p>
                          </div>
                        </div>
                      );
                    });
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

        {activeTab === 'vertrieb' && (
          <VertriebDashboard />
        )}

        {activeTab === 'dozenten-dashboard' && (
          <DozentenDashboard />
        )}

        {activeTab === 'integrationen' && (
          <IntegrationsTab />
        )}

        {activeTab === 'elite-kleingruppe' && (
          <EliteKleingruppe />
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
          onDelete={async (teilnehmer) => {
            try {
              const { error } = await supabase
                .from('teilnehmer')
                .delete()
                .eq('id', teilnehmer.id);

              if (error) throw error;

              addToast('Teilnehmer erfolgreich gelöscht', 'success');
              setShowTeilnehmerForm(false);
              setSelectedTeilnehmerForEdit(null);
              fetchTeilnehmer();
            } catch (error: any) {
              console.error('Error deleting teilnehmer:', error);
              addToast('Fehler beim Löschen des Teilnehmers: ' + error.message, 'error');
            }
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
            setShowDozentForm(false);
            setSelectedDozentForEdit(null);
          }}
          onDelete={(d) => {
            handleDeleteDozent(d.id!);
            setShowDozentForm(false);
            setSelectedDozentForEdit(null);
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
                      localStorage.setItem('adminDashboardTab', 'teilnehmer');
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

      {/* Delete Invoice PDF Confirmation Modal */}
      {deleteInvoiceModal.show && deleteInvoiceModal.invoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <X className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Rechnung löschen
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Möchten Sie die Rechnung <span className="font-semibold">{deleteInvoiceModal.invoice.invoice_number}</span> wirklich löschen?
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Diese Aktion kann nicht rückgängig gemacht werden. Die Rechnung und die zugehörige PDF werden sowohl für Sie als auch für den Dozenten gelöscht.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteInvoicePdf(deleteInvoiceModal.invoice)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
                >
                  Löschen
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteInvoiceModal({ show: false, invoice: null })}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rechnungsfrist Modal */}
      {showDeadlineModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowDeadlineModal(false)} />
            <div className="relative inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="ml-3 text-lg font-medium text-gray-900">Rechnungsfrist einstellen</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Legen Sie fest, bis zu welchem Tag des Folgemonats die Dozenten ihre Rechnung einreichen müssen.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frist: Tag des Folgemonats
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={invoiceDeadlineTemp}
                        onChange={(e) => setInvoiceDeadlineTemp(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center text-lg font-semibold"
                      />
                      <span className="text-sm text-gray-600">des Folgemonats</span>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Beispiel:</strong> Bei Frist am <strong>{invoiceDeadlineTemp}.</strong> müssen Dozenten ihre Rechnung für Januar bis zum <strong>{invoiceDeadlineTemp}. Februar</strong> einreichen.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  type="button"
                  onClick={saveInvoiceDeadline}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:w-auto sm:text-sm"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeadlineModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teilnehmer Notes Modal */}
      {showNotesModal && selectedTeilnehmerForNotes && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Notizen: {selectedTeilnehmerForNotes.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{selectedTeilnehmerForNotes.email}</p>
              </div>
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setSelectedTeilnehmerForNotes(null);
                  setTeilnehmerNotes([]);
                  setNewNoteContent('');
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {teilnehmerNotes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Noch keine Notizen vorhanden</p>
                </div>
              ) : (
                teilnehmerNotes.map((note) => (
                  <div key={note.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-medium text-sm">{note.author_short}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{note.author?.full_name || 'Unbekannt'}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(note.created_at).toLocaleString('de-DE', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTeilnehmerNote(note.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Notiz löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Note Form */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Neue Notiz hinzufügen
              </label>
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Notiz eingeben..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => {
                    setShowNotesModal(false);
                    setSelectedTeilnehmerForNotes(null);
                    setTeilnehmerNotes([]);
                    setNewNoteContent('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  Schließen
                </button>
                <button
                  onClick={addTeilnehmerNote}
                  disabled={!newNoteContent.trim() || isAddingNote}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isAddingNote ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Speichern...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Notiz hinzufügen
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}