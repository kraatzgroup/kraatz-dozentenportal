import { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  FileText, 
  MessageSquare, 
  Plus, 
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  PenTool,
  Send,
  Paperclip,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Unlock,
  Lock,
  Upload,
  FolderOpen,
  Download,
  Save,
  X,
  Edit2,
  Trash2,
  Info,
  HelpCircle,
  Video
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

// Helper function to get unit duration from settings
export const getUnitDurationFromSettings = (unitDurations: any, unitType: string): number => {
  const mapping: Record<string, string> = {
    'unterricht_zivilrecht': 'zivilrecht_unterricht',
    'unterricht_strafrecht': 'strafrecht_unterricht',
    'unterricht_oeffentliches_recht': 'oeffentliches_recht_unterricht',
    'wiederholung_zivilrecht': 'zivilrecht_wiederholung',
    'wiederholung_strafrecht': 'strafrecht_wiederholung',
    'wiederholung_oeffentliches_recht': 'oeffentliches_recht_wiederholung',
  };
  
  const settingsKey = mapping[unitType];
  return settingsKey && unitDurations ? unitDurations[settingsKey] || 120 : 120;
};

// Einheitstypen mit automatischer Dauer (in Minuten) - Default values
export const UNIT_TYPES = {
  'unterricht_zivilrecht': { label: 'Unterricht Zivilrecht', duration: 150, legalArea: 'Zivilrecht' },
  'unterricht_strafrecht': { label: 'Unterricht Strafrecht', duration: 120, legalArea: 'Strafrecht' },
  'unterricht_oeffentliches_recht': { label: 'Unterricht öffentliches Recht', duration: 120, legalArea: 'Öffentliches Recht' },
  'wiederholung_zivilrecht': { label: 'Wiederholungseinheit Zivilrecht', duration: 150, legalArea: 'Zivilrecht' },
  'wiederholung_strafrecht': { label: 'Wiederholungseinheit Strafrecht', duration: 100, legalArea: 'Strafrecht' },
  'wiederholung_oeffentliches_recht': { label: 'Wiederholungseinheit öffentliches Recht', duration: 70, legalArea: 'Öffentliches Recht' },
} as const;

export type UnitType = keyof typeof UNIT_TYPES;

// Event-Typen für Kalendereinträge
export const EVENT_TYPES = {
  'einheit': { label: 'Einheit', color: 'green', icon: 'calendar' },
  'ferien': { label: 'Ferien', color: 'orange', icon: 'sun' },
  'dozent_verhinderung': { label: 'Dozent verhindert', color: 'red', icon: 'alert' },
  'sonstiges': { label: 'Sonstiges', color: 'gray', icon: 'info' },
} as const;

export type EventType = keyof typeof EVENT_TYPES;

// Einheiten-Dauer nach Rechtsgebiet (in Stunden) - Legacy
export const UNIT_DURATION_HOURS: Record<string, number> = {
  'Zivilrecht': 2.5,
  'Öffentliches Recht': 2,
  'Strafrecht': 2
};

export const getUnitDurationHours = (legalArea: string): number => {
  return UNIT_DURATION_HOURS[legalArea] || 2;
};

export const formatDuration = (minutes: number): string => {
  const decimalHours = minutes / 60;
  return `${decimalHours.toFixed(2).replace('.', ',')} Std`;
};

export const formatDurationReadable = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} Min`;
  if (mins === 0) return `${hours} Std`;
  return `${hours} Std ${mins} Min`;
};

export const calculateEndTime = (startTime: string, durationMinutes: number): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMins = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
};

// Helper function to get embeddable video URL
const getEmbedUrl = (url: string): { type: 'iframe' | 'video'; embedUrl: string } => {
  // Loom
  if (url.includes('loom.com')) {
    const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (match) {
      return { type: 'iframe', embedUrl: `https://www.loom.com/embed/${match[1]}` };
    }
  }
  
  // YouTube
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let videoId = '';
    if (url.includes('youtube.com/watch')) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      videoId = urlParams.get('v') || '';
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    }
    if (videoId) {
      return { type: 'iframe', embedUrl: `https://www.youtube.com/embed/${videoId}` };
    }
  }
  
  // Vimeo
  if (url.includes('vimeo.com')) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match) {
      return { type: 'iframe', embedUrl: `https://player.vimeo.com/video/${match[1]}` };
    }
  }
  
  // Default: direct video
  return { type: 'video', embedUrl: url };
};

interface TeachingMaterial {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  category: string | null;
  folder_id: string | null;
}

interface MaterialFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

interface ScheduledRelease {
  id: string;
  release_date: string;
  title: string;
  description: string | null;
  material_ids: string[];
  folder_ids: string[];
  is_released: boolean;
  created_at: string;
  legal_area: string | null;
  unit_type: UnitType | null;
  duration_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
  zoom_link: string | null;
  klausur_folder_id: string | null;
  solution_material_ids: string[];
  solutions_released: boolean;
  solution_release_date: string | null;
  solution_release_time: string | null;
  is_recurring: boolean;
  recurrence_type: 'weekly' | 'monthly' | null;
  recurrence_end_date: string | null;
  recurrence_count: number | null;
  parent_release_id: string | null;
  dozent_id: string | null;
  event_type: EventType;
  end_date: string | null;
  is_canceled: boolean;
  canceled_at: string | null;
  canceled_reason: string | null;
  canceled_by: string | null;
  is_rescheduled: boolean;
  rescheduled_at: string | null;
  rescheduled_to_date: string | null;
  rescheduled_to_start_time: string | null;
  rescheduled_to_end_time: string | null;
  rescheduled_reason: string | null;
  rescheduled_by: string | null;
}

interface Klausur {
  id: string;
  teilnehmer_id: string;
  teilnehmer_name: string;
  title: string;
  legal_area: string;
  file_url: string;
  file_name: string;
  dozent_id: string | null;
  dozent_name?: string;
  submitted_at: string;
  status: 'pending' | 'in_review' | 'completed';
  score?: number;
  feedback?: string;
  corrected_file_url?: string;
  corrected_excel_url?: string;
  corrected_at?: string;
}

interface DozentAssignment {
  id: string;
  dozent_id: string;
  dozent_name?: string;
  legal_area: string;
  zoom_link?: string;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string;
  recipient_name: string;
  content: string;
  created_at: string;
  read: boolean;
}

interface Teilnehmer {
  id: string;
  name: string;
  email: string;
  full_name?: string;
  active_since?: string;
  contract_end?: string;
  study_goal?: string;
  state_law?: string;
  dozent_zivilrecht_name?: string;
  dozent_strafrecht_name?: string;
  dozent_oeffentliches_recht_name?: string;
  completed_hours?: number;
  elite_kleingruppe_name?: string;
  is_elite_kleingruppe?: boolean;
  zoom_background_url?: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SupportVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type SubTab = 'einheiten' | 'klausuren' | 'kommunikation' | 'kurszeiten' | 'support' | 'teilnehmer';

interface CourseTime {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  legal_area: string;
  description: string | null;
  meeting_link: string | null;
  is_active: boolean;
}

interface EliteKleingruppeProps {
  isAdmin?: boolean;
  activeSubTabProp?: string;
  onSubTabChange?: (tab: string) => void;
}

export function EliteKleingruppe({ isAdmin = true, activeSubTabProp, onSubTabChange }: EliteKleingruppeProps) {
  const { user } = useAuthStore();
  const [dozentLegalAreas, setDozentLegalAreas] = useState<string[]>([]);
  const [internalSubTab, setInternalSubTab] = useState<SubTab>('einheiten');
  const activeSubTab: SubTab = (activeSubTabProp as SubTab) || internalSubTab;
  const setActiveSubTab = (tab: SubTab) => {
    if (onSubTabChange) {
      onSubTabChange(tab);
    } else {
      setInternalSubTab(tab);
    }
  };
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [materials, setMaterials] = useState<TeachingMaterial[]>([]);
  const [folders, setFolders] = useState<MaterialFolder[]>([]);
  const [scheduledReleases, setScheduledReleases] = useState<ScheduledRelease[]>([]);
  const [klausuren, setKlausuren] = useState<Klausur[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeilnehmer, setSelectedTeilnehmer] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [expandedKlausur, setExpandedKlausur] = useState<string | null>(null);
  
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [releaseTitle, setReleaseTitle] = useState('');
  const [releaseDescription, setReleaseDescription] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [expandedRelease, setExpandedRelease] = useState<string | null>(null);
  const [folderSearchTerm, setFolderSearchTerm] = useState('');
  const [materialSearchTerm, setMaterialSearchTerm] = useState('');
  const [legalAreaFilter, setLegalAreaFilter] = useState<string>('alle');
  const [einheitenSearchQuery, setEinheitenSearchQuery] = useState<string>('');
  const [releaseLegalArea, setReleaseLegalArea] = useState<string>('');
  const [releaseUnitType, setReleaseUnitType] = useState<UnitType | ''>('');
  const [releaseStartTime, setReleaseStartTime] = useState<string>('09:00');
  const [releaseEndTime, setReleaseEndTime] = useState<string>('11:30');
  const [releaseZoomLink, setReleaseZoomLink] = useState<string>('');
  const [releaseKlausurFolderId, setReleaseKlausurFolderId] = useState<string>('');
  const [releaseSolutionMaterialIds, setReleaseSolutionMaterialIds] = useState<string[]>([]);
  const [solutionReleaseMode, setSolutionReleaseMode] = useState<'auto' | 'custom'>('auto');
  const [releaseEventType, setReleaseEventType] = useState<EventType>('einheit');
  const [isAllDay, setIsAllDay] = useState<boolean>(false);
  const [releaseEndDate, setReleaseEndDate] = useState<string>('');
  const [isDateRange, setIsDateRange] = useState<boolean>(false);
  const [customSolutionReleaseDate, setCustomSolutionReleaseDate] = useState<string>('');
  const [customSolutionReleaseTime, setCustomSolutionReleaseTime] = useState<string>('');
  const [releaseIsRecurring, setReleaseIsRecurring] = useState<boolean>(false);
  const [releaseRecurrenceType, setReleaseRecurrenceType] = useState<'weekly' | 'monthly'>('weekly');
  const [releaseRecurrenceEndDate, setReleaseRecurrenceEndDate] = useState<string>('');
  const [releaseRecurrenceCount, setReleaseRecurrenceCount] = useState<number>(4);
  const [editingZoomLink, setEditingZoomLink] = useState<string | null>(null);
  const [tempZoomLink, setTempZoomLink] = useState<string>('');
  const [additionalDocument, setAdditionalDocument] = useState<File | null>(null);
  const [additionalDocumentTitle, setAdditionalDocumentTitle] = useState<string>('');
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [editingRelease, setEditingRelease] = useState<ScheduledRelease | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [klausurenFilter, setKlausurenFilter] = useState<string>('alle');
  const [klausurenStatusFilter, setKlausurenStatusFilter] = useState<string>('alle');
  const [showKorrekturModal, setShowKorrekturModal] = useState(false);
  const [selectedKlausur, setSelectedKlausur] = useState<Klausur | null>(null);
  const [korrekturScore, setKorrekturScore] = useState<string>('');
  const [korrekturFeedback, setKorrekturFeedback] = useState('');
  const [korrekturFile, setKorrekturFile] = useState<File | null>(null);
  const [korrekturExcelFile, setKorrekturExcelFile] = useState<File | null>(null);
  const [korrekturDuration, setKorrekturDuration] = useState<string>('');
  const [isUploadingKorrektur, setIsUploadingKorrektur] = useState(false);
  const [dozentAssignments, setDozentAssignments] = useState<DozentAssignment[]>([]);
  const [showAllLegalAreas, setShowAllLegalAreas] = useState(false);
  const [showDozentModal, setShowDozentModal] = useState(false);
  const [newDozentId, setNewDozentId] = useState('');
  const [newDozentLegalArea, setNewDozentLegalArea] = useState('');
  const [allDozenten, setAllDozenten] = useState<{id: string; name: string; email: string}[]>([]);
  
  // Kurszeiten state
  const [courseTimes, setCourseTimes] = useState<CourseTime[]>([]);
  const [showCourseTimeModal, setShowCourseTimeModal] = useState(false);
  const [editingCourseTime, setEditingCourseTime] = useState<CourseTime | null>(null);
  const [courseTimeForm, setCourseTimeForm] = useState({
    weekday: 0,
    start_time: '09:00',
    end_time: '10:30',
    legal_area: 'Zivilrecht',
    description: '',
    meeting_link: ''
  });

  // Elite-Kleingruppe state
  const [eliteGroups, setEliteGroups] = useState<{id: string; name: string}[]>([]);
  const [selectedEliteGroupId, setSelectedEliteGroupId] = useState<string>('');
  
  // Unit duration settings state
  const [unitDurations, setUnitDurations] = useState({
    zivilrecht_unterricht: 150,      // 2,30 Std (2 Std 30 Min)
    strafrecht_unterricht: 120,      // 2,00 Std (2 Std 0 Min)
    oeffentliches_recht_unterricht: 120,  // 2,00 Std (2 Std 0 Min)
    zivilrecht_wiederholung: 150,    // 2,30 Std (2 Std 30 Min)
    strafrecht_wiederholung: 75,     // 1,25 Std (1 Std 15 Min)
    oeffentliches_recht_wiederholung: 105   // 1,75 Std (1 Std 45 Min)
  });
  const [showDurationSettings, setShowDurationSettings] = useState(false);

  // Zoom Links state
  const [zoomLinks, setZoomLinks] = useState({
    Zivilrecht: { url: '', meetingId: '', passcode: '' },
    Strafrecht: { url: '', meetingId: '', passcode: '' },
    'Öffentliches Recht': { url: '', meetingId: '', passcode: '' }
  });
  const [showZoomLinksSettings, setShowZoomLinksSettings] = useState(false);

  // Support state
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [videos, setVideos] = useState<SupportVideo[]>([]);
  const [supportActiveSection, setSupportActiveSection] = useState<'faq' | 'videos'>('faq');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: 'Allgemein' });
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<SupportVideo | null>(null);
  const [videoForm, setVideoForm] = useState({ title: '', description: '', video_url: '', category: 'Allgemein' });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [showZoomBgModal, setShowZoomBgModal] = useState(false);
  const [selectedTeilnehmerForBg, setSelectedTeilnehmerForBg] = useState<Teilnehmer | null>(null);
  const [zoomBgFiles, setZoomBgFiles] = useState<File[]>([]);
  const [isUploadingZoomBg, setIsUploadingZoomBg] = useState(false);
  const [showManageBgModal, setShowManageBgModal] = useState(false);
  const [existingBackgrounds, setExistingBackgrounds] = useState<string[]>([]);

  // Delete/Cancel and Reschedule state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedReleaseForAction, setSelectedReleaseForAction] = useState<ScheduledRelease | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [notifyParticipants, setNotifyParticipants] = useState(true);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');

  // Pagination state
  const [einheitenCurrentPage, setEinheitenCurrentPage] = useState(1);
  const [sonstigesCurrentPage, setSonstigesCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reschedule confirmation state (for edit modal)
  const [showRescheduleConfirmModal, setShowRescheduleConfirmModal] = useState(false);
  const [notifyParticipantsReschedule, setNotifyParticipantsReschedule] = useState(true);
  const [pendingUpdateData, setPendingUpdateData] = useState<any>(null);
  const [isSendingEmails, setIsSendingEmails] = useState(false);

  useEffect(() => {
    fetchData();
    if (!isAdmin && user) {
      fetchDozentLegalAreas();
    }
  }, [user, isAdmin]);

  // Reset pagination when search or filter changes
  useEffect(() => {
    setEinheitenCurrentPage(1);
  }, [einheitenSearchQuery, legalAreaFilter]);

  useEffect(() => {
    setSonstigesCurrentPage(1);
  }, []);

  const fetchDozentLegalAreas = async () => {
    if (!user) return;
    const areas = new Set<string>();
    
    // Check new assignments table first
    const { data: assignments } = await supabase
      .from('elite_kleingruppe_dozent_assignments')
      .select('legal_areas')
      .eq('dozent_id', user.id);
    if (assignments) {
      assignments.forEach(a => (a.legal_areas || []).forEach((la: string) => areas.add(la)));
    }
    
    // Fallback: check old table
    if (areas.size === 0) {
      const { data } = await supabase.from('elite_kleingruppe_dozenten').select('legal_area').eq('dozent_id', user.id);
      (data || []).forEach(d => areas.add(d.legal_area));
    }
    
    setDozentLegalAreas(Array.from(areas));
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch materials in batches like DozentenDashboard to get all records
      let allMaterials: any[] = [];
      let from = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('teaching_materials')
          .select('*')
          .eq('is_active', true)
          .order('title')
          .range(from, from + batchSize - 1);
        
        if (error) {
          console.error('Error fetching materials:', error);
          break;
        }
        
        if (!data || data.length === 0) break;
        
        allMaterials = [...allMaterials, ...data];
        
        if (data.length < batchSize) break;
        from += batchSize;
      }
      
      setMaterials(allMaterials);
      
      // Fetch folders in batches to get all records (Supabase default limit is 1000)
      let allFolders: any[] = [];
      let folderFrom = 0;
      
      while (true) {
        const { data: foldersData, error: folderError } = await supabase
          .from('material_folders')
          .select('*')
          .eq('is_active', true)
          .order('name')
          .range(folderFrom, folderFrom + batchSize - 1);
        
        if (folderError) {
          console.error('Error fetching folders:', folderError);
          break;
        }
        
        if (!foldersData || foldersData.length === 0) break;
        
        allFolders = [...allFolders, ...foldersData];
        
        if (foldersData.length < batchSize) break;
        folderFrom += batchSize;
      }
      
      setFolders(allFolders);
      const { data: releasesData } = await supabase.from('elite_kleingruppe_releases').select('*').order('release_date', { ascending: true });
      setScheduledReleases(releasesData || []);
      const { data: teilnehmerData } = await supabase.from('teilnehmer').select('id, name, email, state_law, zoom_background_url').eq('elite_kleingruppe', true).order('name');
      setTeilnehmer(teilnehmerData || []);
      
      // Fetch Klausuren with teilnehmer names
      const { data: klausurenData } = await supabase.from('elite_kleingruppe_klausuren').select('*').order('submitted_at', { ascending: false });
      if (klausurenData && teilnehmerData) {
        const klausurenWithNames = klausurenData.map(k => ({
          ...k,
          teilnehmer_name: teilnehmerData.find(t => t.id === k.teilnehmer_id)?.name || 'Unbekannt'
        }));
        setKlausuren(klausurenWithNames);
      }
      
      // Fetch Dozent assignments
      const { data: assignmentsData } = await supabase.from('elite_kleingruppe_dozenten').select('*');
      setDozentAssignments(assignmentsData || []);
      
      // Fetch all dozenten for assignment
      const { data: dozentenData } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'dozent');
      setAllDozenten((dozentenData || []).map(d => ({ id: d.id, name: d.full_name || d.email, email: d.email })));
      
      // Fetch course times
      const { data: courseTimesData } = await supabase.from('elite_course_times').select('*').eq('is_active', true).order('weekday').order('start_time');
      setCourseTimes(courseTimesData || []);

      // Fetch elite groups
      const { data: eliteGroupsData } = await supabase.from('elite_kleingruppen').select('id, name').eq('is_active', true).order('created_at');
      setEliteGroups(eliteGroupsData || []);
      if (eliteGroupsData?.length === 1 && !selectedEliteGroupId) {
        setSelectedEliteGroupId(eliteGroupsData[0].id);
      }
      
      // Fetch unit duration settings
      const { data: settingsData } = await supabase.from('elite_kleingruppe_settings').select('setting_value').eq('setting_key', 'unit_durations').maybeSingle();
      if (settingsData?.setting_value) {
        setUnitDurations(settingsData.setting_value as any);
      }
      
      // Fetch zoom links settings
      const { data: zoomLinksData } = await supabase.from('elite_kleingruppe_settings').select('setting_value').eq('setting_key', 'zoom_links').maybeSingle();
      if (zoomLinksData?.setting_value) {
        setZoomLinks(zoomLinksData.setting_value as any);
      }
      
      // Extract zoom links from course times if not in settings
      if (courseTimesData && courseTimesData.length > 0) {
        const extractedLinks = {
          Zivilrecht: { url: '', meetingId: '', passcode: '' },
          Strafrecht: { url: '', meetingId: '', passcode: '' },
          'Öffentliches Recht': { url: '', meetingId: '', passcode: '' }
        };
        
        courseTimesData.forEach((ct: any) => {
          if (ct.meeting_link && ct.legal_area) {
            extractedLinks[ct.legal_area as keyof typeof extractedLinks] = {
              url: ct.meeting_link,
              meetingId: '',
              passcode: ''
            };
          }
        });
        
        // Update zoomLinks with extracted links (only if not already set from settings)
        setZoomLinks(prev => ({
          Zivilrecht: prev.Zivilrecht?.url ? prev.Zivilrecht : extractedLinks.Zivilrecht,
          Strafrecht: prev.Strafrecht?.url ? prev.Strafrecht : extractedLinks.Strafrecht,
          'Öffentliches Recht': prev['Öffentliches Recht']?.url ? prev['Öffentliches Recht'] : extractedLinks['Öffentliches Recht']
        }));
      }
      
      // Fetch FAQs
      const { data: faqsData } = await supabase.from('elite_faqs').select('*').eq('is_active', true).order('order_index');
      setFaqs(faqsData || []);
      
      // Fetch Videos
      const { data: videosData } = await supabase.from('elite_support_videos').select('*').eq('is_active', true).order('order_index');
      setVideos(videosData || []);
      
      setMessages([]);
    } catch (error) {
      console.error('Error fetching Elite-Kleingruppe data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTeilnehmer) return;
    setNewMessage('');
  };

  const handleSaveUnitDurations = async () => {
    try {
      const { error } = await supabase
        .from('elite_kleingruppe_settings')
        .upsert({
          setting_key: 'unit_durations',
          setting_value: unitDurations,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });
      
      if (error) throw error;
      alert('Einheitenlängen erfolgreich gespeichert!');
      setShowDurationSettings(false);
    } catch (error) {
      console.error('Error saving unit durations:', error);
      alert('Fehler beim Speichern der Einheitenlängen');
    }
  };

  const handleSaveZoomLinks = async () => {
    try {
      const { error } = await supabase
        .from('elite_kleingruppe_settings')
        .upsert({
          setting_key: 'zoom_links',
          setting_value: zoomLinks,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });
      
      if (error) throw error;
      alert('Zoom-Links erfolgreich gespeichert!');
      setShowZoomLinksSettings(false);
    } catch (error) {
      console.error('Error saving zoom links:', error);
      alert('Fehler beim Speichern der Zoom-Links');
    }
  };

  // FAQ Functions
  const handleSaveFaq = async () => {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) return;
    try {
      if (editingFaq) {
        await supabase.from('elite_faqs').update({
          question: faqForm.question,
          answer: faqForm.answer,
          category: faqForm.category,
          updated_at: new Date().toISOString()
        }).eq('id', editingFaq.id);
      } else {
        const { data: maxOrder } = await supabase.from('elite_faqs').select('order_index').order('order_index', { ascending: false }).limit(1).maybeSingle();
        await supabase.from('elite_faqs').insert({
          question: faqForm.question,
          answer: faqForm.answer,
          category: faqForm.category,
          order_index: (maxOrder?.order_index || 0) + 1,
          is_active: true
        });
      }
      setShowFaqModal(false);
      setEditingFaq(null);
      setFaqForm({ question: '', answer: '', category: 'Allgemein' });
      fetchData();
    } catch (error) {
      console.error('Error saving FAQ:', error);
      alert('Fehler beim Speichern der FAQ');
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm('Möchten Sie diese FAQ wirklich löschen?')) return;
    try {
      await supabase.from('elite_faqs').update({ is_active: false }).eq('id', id);
      fetchData();
    } catch (error) {
      console.error('Error deleting FAQ:', error);
    }
  };

  const openEditFaqModal = (faq: FAQ) => {
    setEditingFaq(faq);
    setFaqForm({ question: faq.question, answer: faq.answer, category: faq.category });
    setShowFaqModal(true);
  };

  const openCreateFaqModal = () => {
    setEditingFaq(null);
    setFaqForm({ question: '', answer: '', category: 'Allgemein' });
    setShowFaqModal(true);
  };

  // Video Functions
  const handleSaveVideo = async () => {
    if (!videoForm.title.trim() || !videoForm.video_url.trim()) return;
    setIsUploadingVideo(true);
    try {
      let videoUrl = videoForm.video_url;
      
      // Upload video file if selected
      if (videoFile) {
        const fileExt = videoFile.name.split('.').pop();
        const fileName = `${Date.now()}_${videoForm.title.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;
        const filePath = `elite-videos/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('teaching-materials')
          .upload(filePath, videoFile);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('teaching-materials')
          .getPublicUrl(filePath);
        
        videoUrl = urlData.publicUrl;
      }
      
      if (editingVideo) {
        await supabase.from('elite_support_videos').update({
          title: videoForm.title,
          description: videoForm.description || null,
          video_url: videoUrl,
          category: videoForm.category,
          updated_at: new Date().toISOString()
        }).eq('id', editingVideo.id);
      } else {
        const { data: maxOrder } = await supabase.from('elite_support_videos').select('order_index').order('order_index', { ascending: false }).limit(1).maybeSingle();
        await supabase.from('elite_support_videos').insert({
          title: videoForm.title,
          description: videoForm.description || null,
          video_url: videoUrl,
          category: videoForm.category,
          order_index: (maxOrder?.order_index || 0) + 1,
          is_active: true
        });
      }
      setShowVideoModal(false);
      setEditingVideo(null);
      setVideoForm({ title: '', description: '', video_url: '', category: 'Allgemein' });
      setVideoFile(null);
      fetchData();
    } catch (error) {
      console.error('Error saving video:', error);
      alert('Fehler beim Speichern des Videos');
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm('Möchten Sie dieses Video wirklich löschen?')) return;
    try {
      await supabase.from('elite_support_videos').update({ is_active: false }).eq('id', id);
      fetchData();
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  const openEditVideoModal = (video: SupportVideo) => {
    setEditingVideo(video);
    setVideoForm({ title: video.title, description: video.description || '', video_url: video.video_url, category: video.category });
    setVideoFile(null);
    setShowVideoModal(true);
  };

  const openCreateVideoModal = () => {
    setEditingVideo(null);
    setVideoForm({ title: '', description: '', video_url: '', category: 'Allgemein' });
    setVideoFile(null);
    setShowVideoModal(true);
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatDateTime = (dateString: string) => new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Korrigiert</span>;
      case 'in_review': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />In Bearbeitung</span>;
      default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><AlertCircle className="h-3 w-3 mr-1" />Ausstehend</span>;
    }
  };

  // Check if a release belongs to the dozent's own legal areas (or if admin)
  const canEditRelease = (release: ScheduledRelease) => {
    if (isAdmin) return true;
    if (dozentLegalAreas.length === 0) return true;
    if (!release.legal_area) return true;
    return dozentLegalAreas.includes(release.legal_area);
  };

  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => { const day = new Date(year, month, 1).getDay(); return day === 0 ? 6 : day - 1; };
  const filteredReleases = scheduledReleases.filter(r => {
    // Filter by elite group
    if (selectedEliteGroupId && (r as any).elite_kleingruppe_id !== selectedEliteGroupId) {
      return false;
    }
    
    // Filter by dozent's assigned legal areas (non-admin only, unless showAllLegalAreas is toggled)
    if (!isAdmin && !showAllLegalAreas && dozentLegalAreas.length > 0 && r.legal_area) {
      if (!dozentLegalAreas.includes(r.legal_area)) {
        return false;
      }
    }
    
    return true;
  });

  // OPTIMIZED: Create a release lookup map for O(1) date access
  const releasesByDate = useMemo(() => {
    const map = new Map<string, ScheduledRelease[]>();
    
    // Admins should see ALL releases in calendar, non-admins see filtered releases
    const calendarReleases = isAdmin ? scheduledReleases : filteredReleases;
    
    for (const release of calendarReleases) {
      if (!release.end_date) {
        // Single day event
        const existing = map.get(release.release_date) || [];
        existing.push(release);
        map.set(release.release_date, existing);
      } else {
        // Date range - add to all dates in range
        const start = new Date(release.release_date);
        const end = new Date(release.end_date);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const existing = map.get(dateStr) || [];
          existing.push(release);
          map.set(dateStr, existing);
        }
      }
    }
    
    return map;
  }, [filteredReleases, scheduledReleases, isAdmin]);

  // Optimized getReleasesForDate using the lookup map
  const getReleasesForDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return releasesByDate.get(dateStr) || [];
  };

  const handleDateClick = (day: number) => {
    // Set time to noon to avoid timezone issues when converting to ISO string
    const date = new Date(calendarYear, calendarMonth, day, 12, 0, 0);
    setSelectedDate(date);
    setShowReleaseModal(true);
    setReleaseTitle('');
    setReleaseDescription('');
    setSelectedMaterials([]);
    setSelectedFolders([]);
    setFolderSearchTerm('');
    setMaterialSearchTerm('');
    setReleaseLegalArea('');
    setReleaseUnitType('');
    setReleaseStartTime('09:00');
    setReleaseEndTime('11:30');
    setReleaseZoomLink('');
    setReleaseKlausurFolderId('');
    setReleaseSolutionMaterialIds([]);
    setSolutionReleaseMode('auto');
    setCustomSolutionReleaseDate('');
    setCustomSolutionReleaseTime('');
    setReleaseIsRecurring(false);
    setReleaseRecurrenceType('weekly');
    setReleaseRecurrenceEndDate('');
    setReleaseRecurrenceCount(4);
    setAdditionalDocument(null);
    setAdditionalDocumentTitle('');
    setReleaseEventType('einheit');
    setIsAllDay(false);
    setReleaseEndDate('');
    setIsDateRange(false);
  };

  const handleUnitTypeChange = (unitType: UnitType | '') => {
    setReleaseUnitType(unitType);
    // Klausur-Ordner zurücksetzen wenn Einheitstyp geändert wird
    setReleaseKlausurFolderId('');
    setReleaseSolutionMaterialIds([]);
    if (unitType && UNIT_TYPES[unitType]) {
      const unitConfig = UNIT_TYPES[unitType];
      setReleaseLegalArea(unitConfig.legalArea);
      // Set default start time based on unit type
      const defaultStartTime = unitType === 'unterricht_strafrecht' ? '09:30' : '09:00';
      setReleaseStartTime(defaultStartTime);
      // Automatisch Endzeit berechnen mit konfigurierbarer Dauer
      const duration = getUnitDurationFromSettings(unitDurations, unitType);
      const endTime = calculateEndTime(defaultStartTime, duration);
      setReleaseEndTime(endTime);
      // Automatisch Zoom-Link aus den Einstellungen laden (nach Rechtsgebiet)
      const legalArea = unitConfig.legalArea as keyof typeof zoomLinks;
      if (zoomLinks[legalArea]?.url) {
        setReleaseZoomLink(zoomLinks[legalArea].url);
      }
    }
  };

  const handleStartTimeChange = (time: string) => {
    setReleaseStartTime(time);
    if (releaseUnitType && UNIT_TYPES[releaseUnitType]) {
      const duration = getUnitDurationFromSettings(unitDurations, releaseUnitType);
      const endTime = calculateEndTime(time, duration);
      setReleaseEndTime(endTime);
    }
  };

  const handleSaveZoomLink = async (assignmentId: string, zoomLink: string) => {
    try {
      await supabase.from('elite_kleingruppe_dozenten').update({ zoom_link: zoomLink }).eq('id', assignmentId);
      setEditingZoomLink(null);
      setTempZoomLink('');
      fetchData();
    } catch (error) {
      console.error('Error saving zoom link:', error);
    }
  };

  const handleCreateRelease = async () => {
    // Validation: title is always required, unit_type only for 'einheit' events
    if (!selectedDate || !releaseTitle.trim()) return;
    if (releaseEventType === 'einheit' && !releaseUnitType) return;
    setIsUploadingDocument(true);
    try {
      let additionalMaterialId: string | null = null;

      // Zusätzliches Dokument hochladen falls vorhanden
      if (additionalDocument && additionalDocumentTitle.trim()) {
        const fileExt = additionalDocument.name.split('.').pop();
        const fileName = `${Date.now()}_${additionalDocumentTitle.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;
        const filePath = `elite-kleingruppe/zusatzmaterial/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('teaching-materials')
          .upload(filePath, additionalDocument);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('teaching-materials')
          .getPublicUrl(filePath);

        // Material in der Datenbank erstellen
        const { data: newMaterial, error: materialError } = await supabase
          .from('teaching_materials')
          .insert({
            title: additionalDocumentTitle,
            description: `Zusatzmaterial für: ${releaseTitle}`,
            file_url: urlData.publicUrl,
            file_name: additionalDocument.name,
            file_type: additionalDocument.type || 'application/octet-stream',
            file_size: additionalDocument.size,
            category: 'Elite-Kleingruppe Zusatzmaterial',
            is_active: true
          })
          .select()
          .single();

        if (materialError) throw materialError;
        additionalMaterialId = newMaterial.id;
      }

      // Material-IDs zusammenführen
      const allMaterialIds = additionalMaterialId 
        ? [...selectedMaterials, additionalMaterialId]
        : selectedMaterials;

      const baseRelease = {
        release_date: selectedDate.toISOString().split('T')[0],
        title: releaseTitle,
        description: releaseDescription || null,
        material_ids: allMaterialIds,
        folder_ids: selectedFolders,
        is_released: new Date() >= selectedDate,
        legal_area: releaseLegalArea || null,
        unit_type: releaseUnitType || null,
        duration_minutes: releaseUnitType ? getUnitDurationFromSettings(unitDurations, releaseUnitType) : null,
        start_time: (releaseEventType === 'einheit' || !isAllDay) ? (releaseStartTime || null) : null,
        end_time: (releaseEventType === 'einheit' || !isAllDay) ? (releaseEndTime || null) : null,
        zoom_link: releaseZoomLink || null,
        klausur_folder_id: releaseKlausurFolderId || null,
        solution_material_ids: releaseSolutionMaterialIds,
        solutions_released: false,
        solution_release_date: solutionReleaseMode === 'custom' && customSolutionReleaseDate ? customSolutionReleaseDate : null,
        solution_release_time: solutionReleaseMode === 'custom' && customSolutionReleaseTime ? customSolutionReleaseTime : null,
        is_recurring: releaseIsRecurring,
        recurrence_type: releaseIsRecurring ? releaseRecurrenceType : null,
        recurrence_end_date: releaseIsRecurring && releaseRecurrenceEndDate ? releaseRecurrenceEndDate : null,
        recurrence_count: releaseIsRecurring ? releaseRecurrenceCount : null,
        dozent_id: user?.id || null,
        event_type: releaseEventType,
        end_date: isDateRange && releaseEndDate ? releaseEndDate : null,
        elite_kleingruppe_id: selectedEliteGroupId || (eliteGroups.length === 1 ? eliteGroups[0].id : null)
      };

      // Ersten Termin erstellen
      const { data: firstRelease, error: firstError } = await supabase
        .from('elite_kleingruppe_releases')
        .insert(baseRelease)
        .select()
        .single();

      if (firstError) throw firstError;

      // Wiederkehrende Termine erstellen
      if (releaseIsRecurring && firstRelease) {
        const recurringReleases = [];
        let currentDate = new Date(selectedDate);
        
        for (let i = 1; i < releaseRecurrenceCount; i++) {
          if (releaseRecurrenceType === 'weekly') {
            currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          } else {
            currentDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
          }

          // Prüfen ob Enddatum überschritten
          if (releaseRecurrenceEndDate && currentDate > new Date(releaseRecurrenceEndDate)) {
            break;
          }

          recurringReleases.push({
            ...baseRelease,
            release_date: currentDate.toISOString().split('T')[0],
            title: `${releaseTitle} (${i + 1})`,
            is_released: new Date() >= currentDate,
            parent_release_id: firstRelease.id
          });
        }

        if (recurringReleases.length > 0) {
          await supabase.from('elite_kleingruppe_releases').insert(recurringReleases);
        }
      }

      setShowReleaseModal(false);
      setAdditionalDocument(null);
      setAdditionalDocumentTitle('');
      fetchData();
    } catch (error) { 
      console.error('Error creating release:', error); 
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const handleToggleRelease = async (release: ScheduledRelease) => {
    try {
      await supabase.from('elite_kleingruppe_releases').update({ is_released: !release.is_released }).eq('id', release.id);
      fetchData();
    } catch (error) { console.error('Error toggling release:', error); }
  };


  const openEditReleaseModal = (release: ScheduledRelease) => {
    setEditingRelease(release);
    setSelectedDate(new Date(release.release_date));
    setReleaseTitle(release.title);
    setReleaseDescription(release.description || '');
    setReleaseLegalArea(release.legal_area || '');
    setReleaseUnitType(release.unit_type || '');
    setReleaseStartTime(release.start_time?.slice(0, 5) || '09:00');
    setReleaseEndTime(release.end_time?.slice(0, 5) || '11:30');
    setReleaseZoomLink(release.zoom_link || '');
    setReleaseKlausurFolderId(release.klausur_folder_id || '');
    setReleaseSolutionMaterialIds(release.solution_material_ids || []);
    setSelectedMaterials(release.material_ids || []);
    setSelectedFolders(release.folder_ids || []);
    setSolutionReleaseMode(release.solution_release_date ? 'custom' : 'auto');
    setCustomSolutionReleaseDate(release.solution_release_date || '');
    setCustomSolutionReleaseTime(release.solution_release_time?.slice(0, 5) || '');
    setShowEditModal(true);
  };

  const handleUpdateRelease = async () => {
    if (!editingRelease || !selectedDate) return;
    
    const newDate = selectedDate.toISOString().split('T')[0];
    const dateChanged = newDate !== editingRelease.release_date;
    const startTimeChanged = releaseStartTime !== editingRelease.start_time?.slice(0, 5);
    const endTimeChanged = releaseEndTime !== editingRelease.end_time?.slice(0, 5);
    
    const updateData = {
      release_date: newDate,
      title: releaseTitle,
      description: releaseDescription || null,
      material_ids: selectedMaterials,
      folder_ids: selectedFolders,
      legal_area: releaseLegalArea || null,
      unit_type: releaseUnitType || null,
      duration_minutes: releaseUnitType ? getUnitDurationFromSettings(unitDurations, releaseUnitType) : null,
      start_time: releaseStartTime || null,
      end_time: releaseEndTime || null,
      zoom_link: releaseZoomLink || null,
      klausur_folder_id: releaseKlausurFolderId || null,
      solution_material_ids: releaseSolutionMaterialIds,
      solution_release_date: solutionReleaseMode === 'custom' && customSolutionReleaseDate ? customSolutionReleaseDate : null,
      solution_release_time: solutionReleaseMode === 'custom' && customSolutionReleaseTime ? customSolutionReleaseTime : null,
      elite_kleingruppe_id: selectedEliteGroupId || (eliteGroups.length === 1 ? eliteGroups[0].id : null)
    };

    // If date or time changed, show reschedule confirmation modal
    if (dateChanged || startTimeChanged || endTimeChanged) {
      setPendingUpdateData(updateData);
      setNotifyParticipantsReschedule(true);
      setShowEditModal(false); // Close edit modal first
      setTimeout(() => {
        setShowRescheduleConfirmModal(true);
      }, 100); // Small delay to ensure edit modal closes first
      return;
    }

    // No date/time change, proceed with normal update
    try {
      const { error } = await supabase
        .from('elite_kleingruppe_releases')
        .update(updateData)
        .eq('id', editingRelease.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingRelease(null);
      fetchData();
    } catch (error) {
      console.error('Error updating release:', error);
    }
  };

  const confirmRescheduleUpdate = async () => {
    if (!editingRelease || !pendingUpdateData || !user) return;
    
    try {
      setIsSendingEmails(true);
      
      const rescheduleData = {
        ...pendingUpdateData,
        is_rescheduled: true,
        rescheduled_at: new Date().toISOString(),
        rescheduled_to_date: pendingUpdateData.release_date,
        rescheduled_to_start_time: pendingUpdateData.start_time,
        rescheduled_to_end_time: pendingUpdateData.end_time,
        rescheduled_reason: notifyParticipantsReschedule ? 'Terminänderung' : null,
        rescheduled_by: user.id
      };

      const { error } = await supabase
        .from('elite_kleingruppe_releases')
        .update(rescheduleData)
        .eq('id', editingRelease.id);

      if (error) throw error;

      // Send notification emails to participants if requested
      if (notifyParticipantsReschedule) {
        try {
          // Get all participants for this elite group
          const { data: participants, error: participantsError } = await supabase
            .from('teilnehmer')
            .select('email, first_name, name')
            .eq('elite_kleingruppe_id', editingRelease.elite_kleingruppe_id || selectedEliteGroupId);

          if (participantsError) throw participantsError;

          // Get dozent email if assigned
          let dozentEmail = null;
          if (editingRelease.dozent_id) {
            const { data: dozentData } = await supabase
              .from('profiles')
              .select('email, first_name, last_name')
              .eq('id', editingRelease.dozent_id)
              .single();
            dozentEmail = dozentData;
          }

          // Get admin emails
          const { data: admins } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('role', 'admin');

          // Format dates and times
          const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
          };

          const oldDate = formatDate(editingRelease.release_date);
          const newDate = formatDate(pendingUpdateData.release_date);
          const oldTime = editingRelease.start_time && editingRelease.end_time 
            ? `${editingRelease.start_time.slice(0, 5)}-${editingRelease.end_time.slice(0, 5)}`
            : '';
          const newTime = pendingUpdateData.start_time && pendingUpdateData.end_time
            ? `${pendingUpdateData.start_time.slice(0, 5)}-${pendingUpdateData.end_time.slice(0, 5)}`
            : '';

          // Combine all recipients
          const allRecipients = [
            ...(participants || []).map(p => ({ email: p.email, name: p.name || p.first_name || 'Teilnehmer' })),
            ...(dozentEmail ? [{ email: dozentEmail.email, name: `${dozentEmail.first_name} ${dozentEmail.last_name}` }] : []),
            ...(admins || []).map(a => ({ email: a.email, name: `${a.first_name} ${a.last_name}` }))
          ];

          // Send email to each recipient
          const emailPromises = allRecipients.map(recipient => 
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reschedule-event-notify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify({
                teilnehmerEmail: recipient.email,
                teilnehmerName: recipient.name,
                eventTitle: editingRelease.title,
                oldDate,
                oldTime,
                newDate,
                newTime,
                legalArea: editingRelease.legal_area || 'Allgemein',
                rescheduleReason: 'Terminänderung'
              })
            })
          );

          await Promise.all(emailPromises);
          console.log(`Reschedule notification emails sent to ${allRecipients.length} recipients (participants, dozent, admins)`);
        } catch (emailError) {
          console.error('Error sending reschedule notification emails:', emailError);
          // Don't fail the whole operation if emails fail
        }
      }

      setIsSendingEmails(false);
      setShowRescheduleConfirmModal(false);
      setShowEditModal(false);
      setEditingRelease(null);
      setPendingUpdateData(null);
      fetchData();
    } catch (error) {
      console.error('Error rescheduling release:', error);
      setIsSendingEmails(false);
    }
  };

  const openDeleteModal = (release: ScheduledRelease) => {
    setSelectedReleaseForAction(release);
    setDeleteReason('');
    setNotifyParticipants(true);
    setShowDeleteModal(true);
  };

  const handleDeleteOrCancel = async () => {
    if (!selectedReleaseForAction || !user) return;
    
    // If permanent delete (no notification) and user is admin, show confirmation
    if (!notifyParticipants && isAdmin) {
      setShowDeleteModal(false);
      setShowDeleteConfirmModal(true);
      return;
    }
    
    try {
      setIsSendingEmails(true);
      
      if (notifyParticipants) {
        // Cancel (mark as canceled, keep in database for participants to see)
        const { error } = await supabase
          .from('elite_kleingruppe_releases')
          .update({
            is_canceled: true,
            canceled_at: new Date().toISOString(),
            canceled_reason: deleteReason.trim() || null,
            canceled_by: user.id
          })
          .eq('id', selectedReleaseForAction.id);

        if (error) throw error;

        // Send notification emails to participants
        try {
          // Get all participants for this elite group
          const { data: participants, error: participantsError } = await supabase
            .from('teilnehmer')
            .select('email, first_name, name')
            .eq('elite_kleingruppe_id', selectedReleaseForAction.elite_kleingruppe_id || selectedEliteGroupId);

          if (participantsError) throw participantsError;

          // Get dozent email if assigned
          let dozentEmail = null;
          if (selectedReleaseForAction.dozent_id) {
            const { data: dozentData } = await supabase
              .from('profiles')
              .select('email, first_name, last_name')
              .eq('id', selectedReleaseForAction.dozent_id)
              .single();
            dozentEmail = dozentData;
          }

          // Get admin emails
          const { data: admins } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('role', 'admin');

          // Format date and time
          const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
          };

          const eventDate = formatDate(selectedReleaseForAction.release_date);
          const eventTime = selectedReleaseForAction.start_time && selectedReleaseForAction.end_time
            ? `${selectedReleaseForAction.start_time.slice(0, 5)}-${selectedReleaseForAction.end_time.slice(0, 5)}`
            : '';

          // Combine all recipients
          const allRecipients = [
            ...(participants || []).map(p => ({ email: p.email, name: p.name || p.first_name || 'Teilnehmer' })),
            ...(dozentEmail ? [{ email: dozentEmail.email, name: `${dozentEmail.first_name} ${dozentEmail.last_name}` }] : []),
            ...(admins || []).map(a => ({ email: a.email, name: `${a.first_name} ${a.last_name}` }))
          ];

          // Send email to each recipient
          const emailPromises = allRecipients.map(recipient => 
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-event-notify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify({
                teilnehmerEmail: recipient.email,
                teilnehmerName: recipient.name,
                eventTitle: selectedReleaseForAction.title,
                eventDate,
                eventTime,
                legalArea: selectedReleaseForAction.legal_area || 'Allgemein',
                cancelReason: deleteReason.trim() || undefined
              })
            })
          );

          await Promise.all(emailPromises);
          console.log(`Cancel notification emails sent to ${allRecipients.length} recipients (participants, dozent, admins)`);
        } catch (emailError) {
          console.error('Error sending cancel notification emails:', emailError);
          // Don't fail the whole operation if emails fail
        }
      } else {
        // Delete (remove completely from database)
        const { error } = await supabase
          .from('elite_kleingruppe_releases')
          .delete()
          .eq('id', selectedReleaseForAction.id);

        if (error) throw error;
      }

      setIsSendingEmails(false);
      setShowDeleteModal(false);
      setSelectedReleaseForAction(null);
      setDeleteReason('');
      setNotifyParticipants(true);
      setExpandedRelease(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting/canceling release:', error);
      setIsSendingEmails(false);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!selectedReleaseForAction || !user) return;
    
    try {
      setIsSendingEmails(true);
      
      // Delete (remove completely from database)
      const { error } = await supabase
        .from('elite_kleingruppe_releases')
        .delete()
        .eq('id', selectedReleaseForAction.id);

      if (error) throw error;

      setIsSendingEmails(false);
      setShowDeleteConfirmModal(false);
      setSelectedReleaseForAction(null);
      setDeleteReason('');
      setNotifyParticipants(true);
      setExpandedRelease(null);
      fetchData();
    } catch (error) {
      console.error('Error permanently deleting release:', error);
      setIsSendingEmails(false);
    }
  };

  const openRescheduleModal = (release: ScheduledRelease) => {
    setSelectedReleaseForAction(release);
    setRescheduleReason('');
    setRescheduleDate(release.release_date);
    setRescheduleStartTime(release.start_time?.slice(0, 5) || '09:00');
    setRescheduleEndTime(release.end_time?.slice(0, 5) || '11:30');
    setShowRescheduleModal(true);
  };

  const handleRescheduleRelease = async () => {
    if (!selectedReleaseForAction || !user || !rescheduleDate) return;
    
    try {
      const { error } = await supabase
        .from('elite_kleingruppe_releases')
        .update({
          is_rescheduled: true,
          rescheduled_at: new Date().toISOString(),
          rescheduled_to_date: rescheduleDate,
          rescheduled_to_start_time: rescheduleStartTime || null,
          rescheduled_to_end_time: rescheduleEndTime || null,
          rescheduled_reason: rescheduleReason.trim() || null,
          rescheduled_by: user.id,
          release_date: rescheduleDate,
          start_time: rescheduleStartTime || null,
          end_time: rescheduleEndTime || null
        })
        .eq('id', selectedReleaseForAction.id);

      if (error) throw error;

      setShowRescheduleModal(false);
      setSelectedReleaseForAction(null);
      setRescheduleReason('');
      setRescheduleDate('');
      setRescheduleStartTime('');
      setRescheduleEndTime('');
      fetchData();
    } catch (error) {
      console.error('Error rescheduling release:', error);
    }
  };

  const openKorrekturModal = (klausur: Klausur) => {
    setSelectedKlausur(klausur);
    setKorrekturScore(klausur.score?.toString() || '');
    setKorrekturFeedback(klausur.feedback || '');
    setKorrekturFile(null);
    setKorrekturExcelFile(null);
    setKorrekturDuration('0.5');
    setShowKorrekturModal(true);
  };

  const downloadKlausur = async (klausur: Klausur) => {
    try {
      const response = await fetch(klausur.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = klausur.file_name || `klausur_${klausur.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Fehler beim Herunterladen der Datei');
    }
  };

  const handleStartKorrektur = async (klausur: Klausur) => {
    try {
      await supabase.from('elite_kleingruppe_klausuren').update({ status: 'in_review' }).eq('id', klausur.id);
      fetchData();
    } catch (error) { console.error('Error starting correction:', error); }
  };

  const handleSaveKorrektur = async () => {
    if (!selectedKlausur || !user) return;
    setIsUploadingKorrektur(true);
    try {
      let correctedFileUrl = selectedKlausur.corrected_file_url || null;
      let correctedExcelUrl = selectedKlausur.corrected_excel_url || null;
      
      // Upload korrigierte PDF-Datei falls vorhanden
      if (korrekturFile) {
        const fileExt = korrekturFile.name.split('.').pop();
        const fileName = `${Date.now()}_korrektur_${selectedKlausur.title.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;
        const filePath = `korrekturen/${selectedKlausur.teilnehmer_id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('elite-kleingruppe')
          .upload(filePath, korrekturFile);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('elite-kleingruppe')
          .getPublicUrl(filePath);
        
        correctedFileUrl = urlData.publicUrl;
      }
      
      // Upload Excel-Datei falls vorhanden
      if (korrekturExcelFile) {
        const fileExt = korrekturExcelFile.name.split('.').pop();
        const fileName = `${Date.now()}_bewertung_${selectedKlausur.title.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;
        const filePath = `korrekturen/${selectedKlausur.teilnehmer_id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('elite-kleingruppe')
          .upload(filePath, korrekturExcelFile);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('elite-kleingruppe')
          .getPublicUrl(filePath);
        
        correctedExcelUrl = urlData.publicUrl;
      }
      
      // Klausur aktualisieren
      await supabase.from('elite_kleingruppe_klausuren').update({
        status: 'completed',
        score: korrekturScore ? parseInt(korrekturScore) : null,
        feedback: korrekturFeedback || null,
        corrected_file_url: correctedFileUrl,
        corrected_excel_url: correctedExcelUrl,
        corrected_at: new Date().toISOString(),
        dozent_id: user.id
      }).eq('id', selectedKlausur.id);
      
      // E-Mail-Benachrichtigung an Teilnehmer senden
      try {
        const teilnehmer = teilnehmerList.find(t => t.id === selectedKlausur.teilnehmer_id);
        if (teilnehmer?.email) {
          const { data: { session } } = await supabase.auth.getSession();
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/klausur-correction-notify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({
              teilnehmerEmail: teilnehmer.email,
              teilnehmerName: teilnehmer.name,
              klausurTitle: selectedKlausur.title,
              legalArea: selectedKlausur.legal_area,
              score: korrekturScore ? parseInt(korrekturScore) : undefined,
              feedback: korrekturFeedback || undefined
            })
          });
        }
      } catch (emailError) {
        console.error('Error sending notification email:', emailError);
      }
      
      // Tätigkeitsbericht-Eintrag erstellen falls Dauer angegeben
      if (korrekturDuration && parseFloat(korrekturDuration) > 0) {
        const { error: hoursError } = await supabase.from('dozent_hours').insert({
          dozent_id: user.id,
          date: new Date().toISOString().split('T')[0],
          hours: parseFloat(korrekturDuration),
          description: `Klausurkorrektur: ${selectedKlausur.title} (${selectedKlausur.teilnehmer_name}) - ${korrekturScore ? korrekturScore + ' Punkte' : 'ohne Bewertung'}`,
          category: 'Elite-Kleingruppe Korrektur',
          status: 'pending'
        });
        if (hoursError) {
          console.error('Error creating dozent_hours entry:', hoursError);
        }
      }
      
      setShowKorrekturModal(false);
      setSelectedKlausur(null);
      setKorrekturFile(null);
      setKorrekturExcelFile(null);
      setKorrekturDuration('');
      fetchData();
    } catch (error) { 
      console.error('Error saving correction:', error); 
    } finally {
      setIsUploadingKorrektur(false);
    }
  };

  const handleAddDozentAssignment = async () => {
    if (!newDozentId || !newDozentLegalArea) return;
    try {
      // Automatically populate Zoom link based on legal area from settings
      const legalArea = newDozentLegalArea as keyof typeof zoomLinks;
      const autoZoomLink = zoomLinks[legalArea]?.url || null;
      
      // Use selectedEliteGroupId or default to first group if only one exists
      const kleingruppe_id = selectedEliteGroupId || (eliteGroups.length === 1 ? eliteGroups[0].id : null);
      
      if (!kleingruppe_id) {
        console.error('No elite kleingruppe selected');
        return;
      }
      
      await supabase.from('elite_kleingruppe_dozenten').insert({ 
        elite_kleingruppe_id: kleingruppe_id,
        dozent_id: newDozentId, 
        legal_area: newDozentLegalArea,
        zoom_link: autoZoomLink
      });
      setShowDozentModal(false);
      setNewDozentId('');
      setNewDozentLegalArea('');
      fetchData();
    } catch (error) { console.error('Error adding dozent assignment:', error); }
  };

  const handleRemoveDozentAssignment = async (id: string) => {
    try {
      await supabase.from('elite_kleingruppe_dozenten').delete().eq('id', id);
      fetchData();
    } catch (error) { console.error('Error removing dozent assignment:', error); }
  };

  const getDozentForLegalArea = (legalArea: string) => {
    const assignment = dozentAssignments.find(a => a.legal_area === legalArea);
    if (!assignment) return null;
    const dozent = allDozenten.find(d => d.id === assignment.dozent_id);
    return dozent ? dozent.name : 'Unbekannt';
  };

  const filteredKlausuren = klausuren.filter(k => {
    // Für Dozenten: nur Klausuren aus ihren zugewiesenen Rechtsgebieten anzeigen
    if (!isAdmin && dozentLegalAreas.length > 0 && !dozentLegalAreas.includes(k.legal_area)) return false;
    if (klausurenFilter !== 'alle' && k.legal_area !== klausurenFilter) return false;
    if (klausurenStatusFilter !== 'alle' && k.status !== klausurenStatusFilter) return false;
    return true;
  });

  const toggleMaterialSelection = (id: string) => setSelectedMaterials(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  const toggleFolderSelection = (id: string) => setSelectedFolders(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  const filteredTeilnehmer = teilnehmer.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.email.toLowerCase().includes(searchTerm.toLowerCase()));

  // OPTIMIZED: Memoized calendar rendering
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);
    const days = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    
    // Empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={"empty-" + i} className="h-24 bg-gray-50"></div>);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(calendarYear, calendarMonth, day);
      const releases = getReleasesForDate(date);
      const isToday = date.getTime() === today.getTime();
      const isPast = date < today;
      
      days.push(
        <div key={day} onClick={() => handleDateClick(day)} className={"h-24 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors " + (isToday ? 'bg-primary/5 border-primary' : '')}>
          <div className={"text-sm font-medium " + (isToday ? 'text-primary' : isPast ? 'text-gray-400' : 'text-gray-900')}>{day}</div>
          <div className="mt-1 space-y-1 overflow-y-auto max-h-16">
            {releases.map(release => {
              const legalAreaAbbr = release.legal_area === 'Zivilrecht' ? 'ZR' : 
                                   release.legal_area === 'Strafrecht' ? 'StR' : 
                                   release.legal_area === 'Öffentliches Recht' ? 'ÖR' : '';
              
              // Color based on legal area for einheiten, otherwise use event type colors
              let bgColor, textColor;
              if (release.event_type === 'einheit') {
                if (release.legal_area === 'Zivilrecht') {
                  bgColor = release.is_released ? 'bg-blue-100' : 'bg-blue-50';
                  textColor = 'text-blue-800';
                } else if (release.legal_area === 'Strafrecht') {
                  bgColor = release.is_released ? 'bg-red-100' : 'bg-red-50';
                  textColor = 'text-red-800';
                } else if (release.legal_area === 'Öffentliches Recht') {
                  bgColor = release.is_released ? 'bg-green-100' : 'bg-green-50';
                  textColor = 'text-green-800';
                } else {
                  bgColor = release.is_released ? 'bg-gray-100' : 'bg-gray-50';
                  textColor = 'text-gray-800';
                }
              } else {
                // Non-einheit events (ferien, etc.)
                if (release.event_type === 'ferien') {
                  bgColor = 'bg-orange-100';
                  textColor = 'text-orange-800';
                } else if (release.event_type === 'dozent_verhinderung') {
                  bgColor = 'bg-red-100';
                  textColor = 'text-red-800';
                } else {
                  bgColor = 'bg-gray-100';
                  textColor = 'text-gray-800';
                }
              }
              
              const editable = canEditRelease(release);
              
              // Override styling for canceled or rescheduled appointments
              let finalBgColor = bgColor;
              let finalTextColor = textColor;
              let statusIcon = null;
              
              if (release.is_canceled) {
                finalBgColor = 'bg-red-100 line-through';
                finalTextColor = 'text-red-600';
                statusIcon = '❌';
              } else if (release.is_rescheduled) {
                finalBgColor = 'bg-purple-100';
                finalTextColor = 'text-purple-700';
                statusIcon = '📅';
              }
              
              return (
                <div 
                  key={release.id} 
                  onClick={(e) => { e.stopPropagation(); openEditReleaseModal(release); }}
                  className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${!editable ? 'opacity-60' : ''} ${finalBgColor} ${finalTextColor}`} 
                  title={
                    release.is_canceled ? `${release.title} (ABGESAGT${release.canceled_reason ? ': ' + release.canceled_reason : ''})` :
                    release.is_rescheduled ? `${release.title} (VERSCHOBEN auf ${release.rescheduled_to_date}${release.rescheduled_reason ? ': ' + release.rescheduled_reason : ''})` :
                    editable ? release.title : `${release.title} (nur Ansicht)`
                  }
                >
                  {statusIcon && <span className="mr-0.5">{statusIcon}</span>}
                  {!statusIcon && (release.is_released ? <Unlock className="h-3 w-3 inline mr-1" /> : <Lock className="h-3 w-3 inline mr-1" />)}
                  {release.event_type === 'einheit' && legalAreaAbbr && <span className="font-semibold">[{legalAreaAbbr}] </span>}
                  {release.title}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return days;
  }, [calendarYear, calendarMonth, releasesByDate]);

  if (isLoading) return <div className="flex justify-center items-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Elite-Kleingruppe</h2>
          <p className="text-sm text-gray-500 mt-1">Jahreskurs: Materialfreigabe nach Einheiten, Klausurenkorrekturen und Kommunikation</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Elite-Kleingruppe Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 whitespace-nowrap">Gruppe:</span>
            <select
              value={selectedEliteGroupId}
              onChange={(e) => setSelectedEliteGroupId(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="">Alle Gruppen</option>
              {eliteGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{teilnehmer.length} Teilnehmer</span>
            <span className="text-sm text-gray-500">{filteredReleases.length} Einheiten geplant</span>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-4 md:space-x-8 min-w-max md:min-w-0">
          <button onClick={() => setActiveSubTab('einheiten')} className={(activeSubTab === 'einheiten' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300') + ' whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center'}><Calendar className="h-4 w-4 mr-2" />Einheiten & Materialfreigabe</button>
          <button onClick={() => setActiveSubTab('klausuren')} className={(activeSubTab === 'klausuren' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300') + ' whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center'}><PenTool className="h-4 w-4 mr-2" />Klausurenkorrekturen</button>
          {isAdmin && (
            <button onClick={() => setActiveSubTab('teilnehmer')} className={(activeSubTab === 'teilnehmer' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300') + ' whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center'}><Users className="h-4 w-4 mr-2" />Teilnehmer</button>
          )}
          <button onClick={() => setActiveSubTab('kurszeiten')} className={(activeSubTab === 'kurszeiten' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300') + ' whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center'}><Clock className="h-4 w-4 mr-2" />Kurszeiten</button>
          {isAdmin && (
            <button onClick={() => setActiveSubTab('support')} className={(activeSubTab === 'support' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300') + ' whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center'}><HelpCircle className="h-4 w-4 mr-2" />Support</button>
          )}
        </nav>
      </div>

      {activeSubTab === 'einheiten' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
              <div className="flex items-center space-x-4">
                <button onClick={() => { if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(calendarYear - 1); } else { setCalendarMonth(calendarMonth - 1); } }} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
                <h3 className="text-lg font-semibold text-gray-900">{monthNames[calendarMonth]} {calendarYear}</h3>
                <button onClick={() => { if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1); } else { setCalendarMonth(calendarMonth + 1); } }} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="h-5 w-5" /></button>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {!isAdmin && dozentLegalAreas.length > 0 && (
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAllLegalAreas}
                      onChange={(e) => setShowAllLegalAreas(e.target.checked)}
                      className="h-3.5 w-3.5 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="ml-1.5 text-xs text-gray-600">Alle Rechtsgebiete</span>
                  </label>
                )}
                <span className="flex items-center"><span className="w-3 h-3 rounded bg-green-100 mr-1"></span>Freigegeben</span>
                <span className="flex items-center"><span className="w-3 h-3 rounded bg-yellow-100 mr-1"></span>Geplant</span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
              {dayNames.map(day => <div key={day} className="bg-gray-100 py-2 text-center text-sm font-medium text-gray-700">{day}</div>)}
              {calendarDays}
            </div>
          </div>
          {/* Geplante Einheiten */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Geplante Einheiten</h3>
                  <p className="text-sm text-gray-500 mt-1">Unterrichts- und Wiederholungseinheiten mit Materialien</p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  {/* Search */}
                  <div className="relative w-full sm:w-56">
                    <input
                      type="text"
                      placeholder="Einheit suchen..."
                      value={einheitenSearchQuery}
                      onChange={(e) => setEinheitenSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  {/* Legal Area Filter */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">Rechtsgebiet:</span>
                    <select value={legalAreaFilter} onChange={(e) => setLegalAreaFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary">
                      <option value="alle">Alle</option>
                      <option value="Zivilrecht">Zivilrecht</option>
                      <option value="Strafrecht">Strafrecht</option>
                      <option value="Öffentliches Recht">Öffentliches Recht</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            {(() => {
              // When searching with 'alle' filter, search across ALL releases, not just dozent-filtered ones
              const baseReleases = (legalAreaFilter === 'alle' || einheitenSearchQuery.trim()) ? scheduledReleases : filteredReleases;
              
              let einheitenReleases = baseReleases.filter(r => r.event_type === 'einheit' && (legalAreaFilter === 'alle' || r.legal_area === legalAreaFilter));
              
              // Apply search filter
              if (einheitenSearchQuery.trim()) {
                const query = einheitenSearchQuery.toLowerCase();
                einheitenReleases = einheitenReleases.filter(r => 
                  r.title.toLowerCase().includes(query) || 
                  r.description?.toLowerCase().includes(query)
                );
              }
              
              if (einheitenReleases.length === 0) {
                return <div className="p-8 text-center"><Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" /><h4 className="text-lg font-medium text-gray-900 mb-2">Keine Einheiten geplant</h4><p className="text-gray-500">Klicken Sie auf ein Datum im Kalender, um Materialien für eine Einheit freizugeben.</p></div>;
              }

              // Pagination logic
              const totalPages = Math.ceil(einheitenReleases.length / itemsPerPage);
              const startIndex = (einheitenCurrentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const paginatedReleases = einheitenReleases.slice(startIndex, endIndex);

              return (
                <>
                <ul className="divide-y divide-gray-200">
                  {paginatedReleases.map(release => (
                  <li key={release.id} className="p-4">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => openEditReleaseModal(release)}>
                      <div className="flex items-center">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          release.legal_area === 'Zivilrecht' ? (release.is_released ? 'bg-blue-100' : 'bg-blue-50') :
                          release.legal_area === 'Strafrecht' ? (release.is_released ? 'bg-red-100' : 'bg-red-50') :
                          release.legal_area === 'Öffentliches Recht' ? (release.is_released ? 'bg-green-100' : 'bg-green-50') :
                          (release.is_released ? 'bg-gray-100' : 'bg-gray-50')
                        }`}>
                          {release.is_released ? (
                            <Unlock className={`h-5 w-5 ${
                              release.legal_area === 'Zivilrecht' ? 'text-blue-600' :
                              release.legal_area === 'Strafrecht' ? 'text-red-600' :
                              release.legal_area === 'Öffentliches Recht' ? 'text-green-600' :
                              'text-gray-600'
                            }`} />
                          ) : (
                            <Lock className={`h-5 w-5 ${
                              release.legal_area === 'Zivilrecht' ? 'text-blue-600' :
                              release.legal_area === 'Strafrecht' ? 'text-red-600' :
                              release.legal_area === 'Öffentliches Recht' ? 'text-green-600' :
                              'text-gray-600'
                            }`} />
                          )}
                        </div>
                        <div className="ml-4">
                          <h4 className="text-sm font-medium text-gray-900">{release.title}</h4>
                          <p className="text-xs text-gray-500">
                            {formatDate(release.release_date)} 
                            {release.start_time && release.end_time && ` • ${release.start_time.slice(0,5)}-${release.end_time.slice(0,5)}`}
                            {release.unit_type && (
                              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                                release.unit_type.includes('zivilrecht') ? 'bg-blue-100 text-blue-700' :
                                release.unit_type.includes('strafrecht') ? 'bg-red-100 text-red-700' :
                                release.unit_type.includes('oeffentliches') ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {UNIT_TYPES[release.unit_type as keyof typeof UNIT_TYPES]?.label || release.unit_type}
                              </span>
                            )}
                            {release.legal_area && (
                              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                                release.legal_area === 'Zivilrecht' ? 'bg-blue-100 text-blue-700' :
                                release.legal_area === 'Strafrecht' ? 'bg-red-100 text-red-700' :
                                release.legal_area === 'Öffentliches Recht' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {release.legal_area}
                              </span>
                            )}
                            {release.klausur_folder_id && (() => {
                              const klausurFolder = folders.find(f => f.id === release.klausur_folder_id);
                              return klausurFolder ? (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700" title="Besprochene Klausur">
                                  📋 {klausurFolder.name}
                                </span>
                              ) : null;
                            })()}
                            <span className="ml-2 text-gray-400">
                              {release.material_ids.length} Materialien, {release.folder_ids.length} Ordner
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium " + (release.is_released ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800')}>{release.is_released ? 'Freigegeben' : 'Geplant'}</span>
                        {expandedRelease === release.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </div>
                    {expandedRelease === release.id && (
                      <div className="mt-4 pl-14 space-y-4">
                        {release.description && <p className="text-sm text-gray-600">{release.description}</p>}
                        <div className="flex flex-wrap gap-2">
                          {release.material_ids.map(id => { const m = materials.find(x => x.id === id); return m ? <span key={id} className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs"><FileText className="h-3 w-3 mr-1" />{m.title}</span> : null; })}
                          {release.folder_ids.map(id => { const f = folders.find(x => x.id === id); return f ? <span key={id} className="inline-flex items-center px-2 py-1 bg-blue-100 rounded text-xs"><FolderOpen className="h-3 w-3 mr-1" />{f.name}</span> : null; })}
                        </div>
                        {canEditRelease(release) && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={(e) => { e.stopPropagation(); openEditReleaseModal(release); }} className="inline-flex items-center px-3 py-1.5 rounded text-sm bg-blue-100 text-blue-700 hover:bg-blue-200">
                              <Edit2 className="h-4 w-4 mr-1" />Bearbeiten
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleToggleRelease(release); }} className={"inline-flex items-center px-3 py-1.5 rounded text-sm " + (release.is_released ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200')}>{release.is_released ? <><Lock className="h-4 w-4 mr-1" />Sperren</> : <><Unlock className="h-4 w-4 mr-1" />Jetzt freigeben</>}</button>
                            {!release.is_canceled && (
                              <button onClick={(e) => { e.stopPropagation(); openRescheduleModal(release); }} className="inline-flex items-center px-3 py-1.5 rounded text-sm bg-purple-100 text-purple-700 hover:bg-purple-200">
                                <Calendar className="h-4 w-4 mr-1" />Verschieben
                              </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); openDeleteModal(release); }} className="inline-flex items-center px-3 py-1.5 rounded text-sm bg-red-100 text-red-700 hover:bg-red-200">
                              <X className="h-4 w-4 mr-1" />Absagen
                            </button>
                          </div>
                        )}
                        {release.is_canceled && (
                          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm font-medium text-red-800">❌ Abgesagt</p>
                            {release.canceled_reason && <p className="text-xs text-red-600 mt-1">Grund: {release.canceled_reason}</p>}
                            {release.canceled_at && <p className="text-xs text-red-500 mt-1">Abgesagt am: {new Date(release.canceled_at).toLocaleString('de-DE')}</p>}
                          </div>
                        )}
                        {release.is_rescheduled && (
                          <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-sm font-medium text-purple-800">📅 Verschoben</p>
                            {release.rescheduled_to_date && <p className="text-xs text-purple-600 mt-1">Neuer Termin: {formatDate(release.rescheduled_to_date)} {release.rescheduled_to_start_time && release.rescheduled_to_end_time ? `${release.rescheduled_to_start_time} - ${release.rescheduled_to_end_time}` : ''}</p>}
                            {release.rescheduled_reason && <p className="text-xs text-purple-600 mt-1">Grund: {release.rescheduled_reason}</p>}
                            {release.rescheduled_at && <p className="text-xs text-purple-500 mt-1">Verschoben am: {new Date(release.rescheduled_at).toLocaleString('de-DE')}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                  ))}
                </ul>
                {/* Pagination Controls */}
                {(() => {
                  let einheitenReleases = filteredReleases.filter(r => r.event_type === 'einheit' && (legalAreaFilter === 'alle' || r.legal_area === legalAreaFilter));
                  if (einheitenSearchQuery.trim()) {
                    const query = einheitenSearchQuery.toLowerCase();
                    einheitenReleases = einheitenReleases.filter(r => 
                      r.title.toLowerCase().includes(query) || 
                      r.description?.toLowerCase().includes(query)
                    );
                  }
                  const totalPages = Math.ceil(einheitenReleases.length / itemsPerPage);
                  if (totalPages <= 1) return null;
                  
                  return (
                    <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        Zeige {((einheitenCurrentPage - 1) * itemsPerPage) + 1} bis {Math.min(einheitenCurrentPage * itemsPerPage, einheitenReleases.length)} von {einheitenReleases.length} Einheiten
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEinheitenCurrentPage(p => Math.max(1, p - 1))}
                          disabled={einheitenCurrentPage === 1}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Zurück
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                              key={page}
                              onClick={() => setEinheitenCurrentPage(page)}
                              className={`px-3 py-1.5 text-sm rounded-lg ${
                                page === einheitenCurrentPage
                                  ? 'bg-primary text-white'
                                  : 'border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setEinheitenCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={einheitenCurrentPage === totalPages}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Weiter
                        </button>
                      </div>
                    </div>
                  );
                })()}
                </>
              );
            })()}
          </div>

          {/* Sonstiges (Ferien, Verhinderungen, etc.) */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Sonstiges</h3>
              <p className="text-sm text-gray-500 mt-1">Ferien, Verhinderungen und andere Ereignisse</p>
            </div>
            {(() => {
              const sonstigesReleases = filteredReleases.filter(r => r.event_type !== 'einheit');
              if (sonstigesReleases.length === 0) {
                return <div className="p-8 text-center text-gray-500">Keine weiteren Ereignisse geplant</div>;
              }

              // Pagination logic
              const totalPages = Math.ceil(sonstigesReleases.length / itemsPerPage);
              const startIndex = (sonstigesCurrentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const paginatedSonstiges = sonstigesReleases.slice(startIndex, endIndex);

              return (
                <>
                <ul className="divide-y divide-gray-200">
                  {paginatedSonstiges.map(release => {
                    const eventTypeConfig = {
                      'ferien': { icon: '🌞', label: 'Ferien', color: 'bg-orange-100 text-orange-800' },
                      'dozent_verhinderung': { icon: '🚫', label: 'Dozent verhindert', color: 'bg-red-100 text-red-800' },
                      'sonstiges': { icon: '📝', label: 'Sonstiges', color: 'bg-gray-100 text-gray-800' }
                    };
                    const config = eventTypeConfig[release.event_type as keyof typeof eventTypeConfig] || eventTypeConfig['sonstiges'];
                    
                    return (
                      <li key={release.id} className="p-4">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => openEditReleaseModal(release)}>
                          <div className="flex items-center">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${config.color}`}>
                              <span className="text-xl">{config.icon}</span>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-medium text-gray-900">{release.title}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                                  {config.label}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {release.end_date && release.end_date !== release.release_date ? (
                                  <>{formatDate(release.release_date)} - {formatDate(release.end_date)}</>
                                ) : (
                                  formatDate(release.release_date)
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${release.is_released ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {release.is_released ? 'Aktiv' : 'Geplant'}
                            </span>
                            {expandedRelease === release.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                          </div>
                        </div>
                        {expandedRelease === release.id && (
                          <div className="mt-4 pl-14 space-y-4">
                            {release.description && <p className="text-sm text-gray-600">{release.description}</p>}
                            {canEditRelease(release) && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <button onClick={(e) => { e.stopPropagation(); openEditReleaseModal(release); }} className="inline-flex items-center px-3 py-1.5 rounded text-sm bg-blue-100 text-blue-700 hover:bg-blue-200">
                                  <Edit2 className="h-4 w-4 mr-1" />Bearbeiten
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleToggleRelease(release); }} className={`inline-flex items-center px-3 py-1.5 rounded text-sm ${release.is_released ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                                  {release.is_released ? <><Lock className="h-4 w-4 mr-1" />Deaktivieren</> : <><Unlock className="h-4 w-4 mr-1" />Aktivieren</>}
                                </button>
                                {!release.is_canceled && (
                                  <button onClick={(e) => { e.stopPropagation(); openRescheduleModal(release); }} className="inline-flex items-center px-3 py-1.5 rounded text-sm bg-purple-100 text-purple-700 hover:bg-purple-200">
                                    <Calendar className="h-4 w-4 mr-1" />Verschieben
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); openDeleteModal(release); }} className="inline-flex items-center px-3 py-1.5 rounded text-sm bg-red-100 text-red-700 hover:bg-red-200">
                                  <X className="h-4 w-4 mr-1" />Absagen
                                </button>
                              </div>
                            )}
                            {release.is_canceled && (
                              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm font-medium text-red-800">❌ Abgesagt</p>
                                {release.canceled_reason && <p className="text-xs text-red-600 mt-1">Grund: {release.canceled_reason}</p>}
                                {release.canceled_at && <p className="text-xs text-red-500 mt-1">Abgesagt am: {new Date(release.canceled_at).toLocaleString('de-DE')}</p>}
                              </div>
                            )}
                            {release.is_rescheduled && (
                              <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                <p className="text-sm font-medium text-purple-800">📅 Verschoben</p>
                                {release.rescheduled_to_date && <p className="text-xs text-purple-600 mt-1">Neuer Termin: {formatDate(release.rescheduled_to_date)} {release.rescheduled_to_start_time && release.rescheduled_to_end_time ? `${release.rescheduled_to_start_time} - ${release.rescheduled_to_end_time}` : ''}</p>}
                                {release.rescheduled_reason && <p className="text-xs text-purple-600 mt-1">Grund: {release.rescheduled_reason}</p>}
                                {release.rescheduled_at && <p className="text-xs text-purple-500 mt-1">Verschoben am: {new Date(release.rescheduled_at).toLocaleString('de-DE')}</p>}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {/* Pagination Controls */}
                {(() => {
                  const sonstigesReleases = filteredReleases.filter(r => r.event_type !== 'einheit');
                  const totalPages = Math.ceil(sonstigesReleases.length / itemsPerPage);
                  if (totalPages <= 1) return null;
                  
                  return (
                    <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        Zeige {((sonstigesCurrentPage - 1) * itemsPerPage) + 1} bis {Math.min(sonstigesCurrentPage * itemsPerPage, sonstigesReleases.length)} von {sonstigesReleases.length} Ereignissen
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSonstigesCurrentPage(p => Math.max(1, p - 1))}
                          disabled={sonstigesCurrentPage === 1}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Zurück
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                              key={page}
                              onClick={() => setSonstigesCurrentPage(page)}
                              className={`px-3 py-1.5 text-sm rounded-lg ${
                                page === sonstigesCurrentPage
                                  ? 'bg-primary text-white'
                                  : 'border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setSonstigesCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={sonstigesCurrentPage === totalPages}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Weiter
                        </button>
                      </div>
                    </div>
                  );
                })()}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {activeSubTab === 'klausuren' && (
        <div className="space-y-6">
          {/* Dozenten-Zuweisung - nur für Admins */}
          {isAdmin && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Dozenten-Zuweisung nach Rechtsgebiet</h3>
                    <p className="text-sm text-gray-500 mt-1">Klausuren werden automatisch dem zuständigen Dozenten zugewiesen</p>
                  </div>
                  <button onClick={() => setShowDozentModal(true)} className="inline-flex items-center px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm">
                    <Plus className="h-4 w-4 mr-1" />Dozent zuweisen
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {['Zivilrecht', 'Strafrecht', 'Öffentliches Recht'].map(area => {
                    const assignment = dozentAssignments.find(a => a.legal_area === area);
                    const dozent = assignment ? allDozenten.find(d => d.id === assignment.dozent_id) : null;
                    return (
                      <div key={area} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">{area}</h4>
                        {dozent ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Users className="h-4 w-4 text-primary" />
                                </div>
                                <span className="ml-2 text-sm text-gray-700">{dozent.name}</span>
                              </div>
                              <button onClick={() => handleRemoveDozentAssignment(assignment!.id)} className="text-red-500 hover:text-red-700">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            {/* Zoom-Link Bearbeitung */}
                            <div className="pt-2 border-t border-gray-100">
                              <label className="block text-xs font-medium text-gray-500 mb-1">Zoom-Link</label>
                              {editingZoomLink === assignment!.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="url"
                                    value={tempZoomLink}
                                    onChange={(e) => setTempZoomLink(e.target.value)}
                                    placeholder="https://zoom.us/j/..."
                                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:border-primary"
                                  />
                                  <button
                                    onClick={() => handleSaveZoomLink(assignment!.id, tempZoomLink)}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => { setEditingZoomLink(null); setTempZoomLink(''); }}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  {assignment?.zoom_link ? (
                                    <a 
                                      href={assignment.zoom_link} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline truncate max-w-[150px]"
                                    >
                                      {assignment.zoom_link}
                                    </a>
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">Nicht hinterlegt</span>
                                  )}
                                  <button
                                    onClick={() => { setEditingZoomLink(assignment!.id); setTempZoomLink(assignment?.zoom_link || ''); }}
                                    className="p-1 text-gray-400 hover:text-primary hover:bg-primary/10 rounded"
                                  >
                                    <PenTool className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Kein Dozent zugewiesen</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Dozenten-Info - nur für Dozenten */}
          {!isAdmin && dozentLegalAreas.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Ihre Rechtsgebiete:</strong> {dozentLegalAreas.join(', ')}
              </p>
              <p className="text-xs text-blue-600 mt-1">Sie sehen nur Klausuren aus Ihren zugewiesenen Rechtsgebieten.</p>
            </div>
          )}

          {/* Filter */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Rechtsgebiet:</span>
                <select value={klausurenFilter} onChange={(e) => setKlausurenFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="alle">Alle</option>
                  <option value="Zivilrecht">Zivilrecht</option>
                  <option value="Strafrecht">Strafrecht</option>
                  <option value="Öffentliches Recht">Öffentliches Recht</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Status:</span>
                <select value={klausurenStatusFilter} onChange={(e) => setKlausurenStatusFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="alle">Alle</option>
                  <option value="pending">Ausstehend</option>
                  <option value="in_review">In Bearbeitung</option>
                  <option value="completed">Korrigiert</option>
                </select>
              </div>
              <span className="text-sm text-gray-500 ml-auto">{filteredKlausuren.length} Klausuren</span>
            </div>
          </div>

          {/* Klausuren-Liste */}
          {filteredKlausuren.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <PenTool className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Klausuren zur Korrektur</h3>
              <p className="text-gray-500">Sobald Teilnehmer Klausuren einreichen, erscheinen sie hier zur Korrektur.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {filteredKlausuren.map(klausur => (
                  <li key={klausur.id} className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer gap-2" onClick={() => setExpandedKlausur(expandedKlausur === klausur.id ? null : klausur.id)}>
                      <div className="flex items-center min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <PenTool className="h-5 w-5 text-primary" />
                        </div>
                        <div className="ml-3 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">{klausur.title}</h4>
                          <p className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span>{klausur.teilnehmer_name}</span>
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{klausur.legal_area}</span>
                            {getDozentForLegalArea(klausur.legal_area) && (
                              <span className="text-gray-400">→ {getDozentForLegalArea(klausur.legal_area)}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
                        {getStatusBadge(klausur.status)}
                        <span className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(klausur.submitted_at)}</span>
                        {expandedKlausur === klausur.id ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                      </div>
                    </div>
                    {expandedKlausur === klausur.id && (
                      <div className="mt-4 pl-14 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={() => downloadKlausur(klausur)} className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
                            <Download className="h-4 w-4 mr-1" />Klausur herunterladen
                          </button>
                          {klausur.status === 'pending' && (
                            <button onClick={() => handleStartKorrektur(klausur)} className="inline-flex items-center px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-sm">
                              <Clock className="h-4 w-4 mr-1" />Korrektur starten
                            </button>
                          )}
                          {(klausur.status === 'in_review' || klausur.status === 'completed') && (
                            <button onClick={() => openKorrekturModal(klausur)} className="inline-flex items-center px-3 py-1.5 bg-primary text-white rounded hover:bg-primary/90 text-sm">
                              <PenTool className="h-4 w-4 mr-1" />{klausur.status === 'completed' ? 'Korrektur bearbeiten' : 'Korrektur abschliessen'}
                            </button>
                          )}
                        </div>
                        {klausur.status === 'completed' && (
                          <div className="bg-green-50 rounded-lg p-3">
                            {klausur.score !== undefined && <p className="text-sm font-medium text-green-800">Punktzahl: {klausur.score}</p>}
                            {klausur.feedback && <p className="text-sm text-green-700 mt-1">{klausur.feedback}</p>}
                            {klausur.corrected_at && <p className="text-xs text-green-600 mt-2">Korrigiert am {formatDateTime(klausur.corrected_at)}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'kommunikation' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200"><h3 className="font-medium text-gray-900">Teilnehmer</h3><div className="mt-2 relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" /><input type="text" placeholder="Suchen..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
            <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {filteredTeilnehmer.length === 0 ? <li className="p-4 text-center text-gray-500 text-sm">Keine Teilnehmer in der Elite-Kleingruppe</li> : filteredTeilnehmer.map(t => (
                <li key={t.id} className={"p-3 cursor-pointer hover:bg-gray-50 " + (selectedTeilnehmer === t.id ? 'bg-primary/5 border-l-2 border-primary' : '')} onClick={() => setSelectedTeilnehmer(t.id)}>
                  <div className="flex items-center"><div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><Users className="h-4 w-4 text-primary" /></div><div className="ml-3"><p className="text-sm font-medium text-gray-900">{t.name}</p><p className="text-xs text-gray-500">{t.email}</p></div></div>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-2 bg-white rounded-lg shadow flex flex-col">
            {selectedTeilnehmer ? (
              <>
                <div className="p-4 border-b border-gray-200"><div className="flex items-center"><div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div><div className="ml-3"><h3 className="font-medium text-gray-900">{teilnehmer.find(t => t.id === selectedTeilnehmer)?.name}</h3><p className="text-xs text-gray-500">{teilnehmer.find(t => t.id === selectedTeilnehmer)?.email}</p></div></div></div>
                <div className="flex-1 p-4 overflow-y-auto min-h-64 max-h-96">
                  {messages.filter(m => m.sender_id === selectedTeilnehmer || m.recipient_id === selectedTeilnehmer).length === 0 ? <div className="text-center text-gray-500 py-8"><MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" /><p className="text-sm">Noch keine Nachrichten</p></div> : (
                    <div className="space-y-4">{messages.filter(m => m.sender_id === selectedTeilnehmer || m.recipient_id === selectedTeilnehmer).map(message => (
                      <div key={message.id} className={"flex " + (message.sender_id === user?.id ? 'justify-end' : 'justify-start')}><div className={"max-w-xs lg:max-w-md px-4 py-2 rounded-lg " + (message.sender_id === user?.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-900')}><p className="text-sm">{message.content}</p><p className={"text-xs mt-1 " + (message.sender_id === user?.id ? 'text-white/70' : 'text-gray-500')}>{formatDateTime(message.created_at)}</p></div></div>
                    ))}</div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-200"><div className="flex items-center space-x-2"><button className="p-2 text-gray-400 hover:text-gray-600"><Paperclip className="h-5 w-5" /></button><input type="text" placeholder="Nachricht schreiben..." className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} /><button onClick={handleSendMessage} disabled={!newMessage.trim()} className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"><Send className="h-5 w-5" /></button></div></div>
              </>
            ) : <div className="flex-1 flex items-center justify-center text-gray-500"><div className="text-center"><MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p>Wählen Sie einen Teilnehmer aus, um die Kommunikation zu starten</p></div></div>}
          </div>
        </div>
      )}

      {showReleaseModal && selectedDate && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowReleaseModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Kalendereintrag erstellen</h3>
                  <p className="text-sm text-gray-500 mt-1">Erstellen Sie einen Eintrag für Einheiten, Ferien oder andere Ereignisse</p>
                </div>
                <button onClick={() => setShowReleaseModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Art des Eintrags - Wichtigste Auswahl zuerst */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-purple-900 mb-2">Art des Eintrags *</label>
                  <select 
                    value={releaseEventType} 
                    onChange={(e) => {
                      setReleaseEventType(e.target.value as EventType);
                      // Reset unit-specific fields when changing event type
                      if (e.target.value !== 'einheit') {
                        setReleaseUnitType('');
                        setReleaseLegalArea('');
                        setReleaseZoomLink('');
                        setReleaseKlausurFolderId('');
                        setReleaseSolutionMaterialIds([]);
                      }
                    }} 
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                  >
                    <option value="einheit">📚 Einheit (Unterricht/Wiederholung)</option>
                    <option value="ferien">🌞 Ferien</option>
                    <option value="dozent_verhinderung">🚫 Dozent verhindert</option>
                    <option value="sonstiges">📝 Sonstiges</option>
                  </select>
                  <p className="text-xs text-purple-700 mt-2">
                    {releaseEventType === 'einheit' && '📚 Unterrichtseinheit mit Materialien und Zeitplan'}
                    {releaseEventType === 'ferien' && '🌞 Ferienzeit - keine Einheiten'}
                    {releaseEventType === 'dozent_verhinderung' && '🚫 Dozent ist verhindert'}
                    {releaseEventType === 'sonstiges' && '📝 Sonstiger Kalendereintrag'}
                  </p>
                </div>

                {/* Datum und Zeitspanne */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="space-y-4">
                    {/* Zeitspannen-Checkbox */}
                    <label className="flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isDateRange} 
                        onChange={(e) => {
                          setIsDateRange(e.target.checked);
                          if (!e.target.checked) {
                            setReleaseEndDate('');
                          }
                        }} 
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" 
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Zeitspanne (Von/Bis)</span>
                    </label>

                    {/* Datumsfelder */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isDateRange ? 'Von Datum' : 'Datum'} *
                        </label>
                        <input 
                          type="date" 
                          value={selectedDate.toISOString().split('T')[0]} 
                          onChange={(e) => setSelectedDate(new Date(e.target.value))} 
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                        />
                      </div>
                      {isDateRange && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bis Datum *</label>
                          <input 
                            type="date" 
                            value={releaseEndDate} 
                            onChange={(e) => setReleaseEndDate(e.target.value)} 
                            min={selectedDate.toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Typ der Einheit - nur bei Event-Typ "Einheit" */}
                {releaseEventType === 'einheit' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-blue-900 mb-2">Typ der Einheit *</label>
                  <select 
                    value={releaseUnitType} 
                    onChange={(e) => handleUnitTypeChange(e.target.value as UnitType | '')} 
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    <option value="">Bitte wählen...</option>
                    <optgroup label="Unterricht">
                      <option value="unterricht_zivilrecht">Unterricht Zivilrecht ({formatDuration(unitDurations.zivilrecht_unterricht)})</option>
                      <option value="unterricht_strafrecht">Unterricht Strafrecht ({formatDuration(unitDurations.strafrecht_unterricht)})</option>
                      <option value="unterricht_oeffentliches_recht">Unterricht öffentliches Recht ({formatDuration(unitDurations.oeffentliches_recht_unterricht)})</option>
                    </optgroup>
                    <optgroup label="Wiederholungseinheit">
                      <option value="wiederholung_zivilrecht">Wiederholungseinheit Zivilrecht ({formatDuration(unitDurations.zivilrecht_wiederholung)})</option>
                      <option value="wiederholung_strafrecht">Wiederholungseinheit Strafrecht ({formatDuration(unitDurations.strafrecht_wiederholung)})</option>
                      <option value="wiederholung_oeffentliches_recht">Wiederholungseinheit öffentliches Recht ({formatDuration(unitDurations.oeffentliches_recht_wiederholung)})</option>
                    </optgroup>
                  </select>
                  {releaseUnitType && (
                    <p className="text-xs text-blue-700 mt-2">
                      Rechtsgebiet: <strong>{UNIT_TYPES[releaseUnitType].legalArea}</strong> | 
                      Dauer: <strong>{formatDuration(getUnitDurationFromSettings(unitDurations, releaseUnitType))}</strong>
                    </p>
                  )}
                  </div>
                )}

                {/* Titel und Beschreibung */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{releaseEventType === 'einheit' ? 'Titel der Einheit' : 'Titel'} *</label>
                    <input 
                      type="text" 
                      value={releaseTitle} 
                      onChange={(e) => setReleaseTitle(e.target.value)} 
                      placeholder={releaseEventType === 'einheit' ? 'z.B. Einheit 1 - BGB AT' : releaseEventType === 'ferien' ? 'z.B. Sommerferien 2025' : 'Titel des Eintrags'} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                    />
                  </div>
                  {releaseEventType === 'einheit' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rechtsgebiet</label>
                    <select 
                      value={releaseLegalArea} 
                      onChange={(e) => setReleaseLegalArea(e.target.value)} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      disabled={!!releaseUnitType}
                    >
                      <option value="">Bitte wählen...</option>
                      <option value="Zivilrecht">Zivilrecht</option>
                      <option value="Strafrecht">Strafrecht</option>
                      <option value="Öffentliches Recht">Öffentliches Recht</option>
                    </select>
                    </div>
                  )}
                </div>

                {/* Uhrzeit */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="space-y-4">
                    {/* Ganztägig-Checkbox */}
                    <label className="flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isAllDay} 
                        onChange={(e) => setIsAllDay(e.target.checked)} 
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" 
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Ganztägig</span>
                    </label>

                    {/* Zeitfelder - nur wenn nicht ganztägig */}
                    {!isAllDay && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Startzeit</label>
                    <input 
                      type="time" 
                      value={releaseStartTime} 
                      onChange={(e) => handleStartTimeChange(e.target.value)} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Endzeit {releaseEventType === 'einheit' ? '(automatisch)' : ''}</label>
                    <input 
                      type="time" 
                      value={releaseEndTime} 
                      onChange={(e) => releaseEventType !== 'einheit' && setReleaseEndTime(e.target.value)}
                      readOnly={releaseEventType === 'einheit'}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary ${releaseEventType === 'einheit' ? 'border-gray-200 bg-gray-50 text-gray-600' : 'border-gray-300'}`} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dauer</label>
                    <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
                      {releaseUnitType ? formatDuration(getUnitDurationFromSettings(unitDurations, releaseUnitType)) : '-'}
                    </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Beschreibung */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung (optional)</label>
                  <textarea 
                    value={releaseDescription} 
                    onChange={(e) => setReleaseDescription(e.target.value)} 
                    placeholder={releaseEventType === 'einheit' ? 'Zusätzliche Informationen zur Einheit...' : 'Zusätzliche Informationen...'} 
                    rows={2} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                  />
                </div>

                {/* Zoom Link - für alle Event-Typen */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zoom-Link / Meeting-Link (optional)</label>
                  <input 
                    type="url" 
                    value={releaseZoomLink} 
                    onChange={(e) => setReleaseZoomLink(e.target.value)} 
                    placeholder="https://zoom.us/j/... oder https://meet.google.com/..." 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                  />
                  {releaseZoomLink && releaseEventType === 'einheit' && (
                    <p className="text-xs text-green-600 mt-1">✓ Zoom-Link wird automatisch vom zugewiesenen Dozenten übernommen</p>
                  )}
                </div>

                {/* Alle folgenden Felder nur bei Einheiten */}
                {releaseEventType === 'einheit' && (
                  <>
                    {/* Wiederkehrendes Meeting */}
                    <div className="border border-gray-200 rounded-lg p-4">
                  <label className="flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={releaseIsRecurring} 
                      onChange={(e) => setReleaseIsRecurring(e.target.checked)} 
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" 
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">Wiederkehrendes Meeting</span>
                  </label>
                  
                  {releaseIsRecurring && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Wiederholung</label>
                        <select 
                          value={releaseRecurrenceType} 
                          onChange={(e) => setReleaseRecurrenceType(e.target.value as 'weekly' | 'monthly')} 
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                          <option value="weekly">Wöchentlich</option>
                          <option value="monthly">Monatlich</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Termine</label>
                        <input 
                          type="number" 
                          min="2" 
                          max="52" 
                          value={releaseRecurrenceCount} 
                          onChange={(e) => setReleaseRecurrenceCount(parseInt(e.target.value) || 4)} 
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Enddatum (optional)</label>
                        <input 
                          type="date" 
                          value={releaseRecurrenceEndDate} 
                          onChange={(e) => setReleaseRecurrenceEndDate(e.target.value)} 
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Klausur-Ordner Auswahl */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Welche Klausur wird besprochen?</label>
                  <select 
                    value={releaseKlausurFolderId} 
                    onChange={(e) => setReleaseKlausurFolderId(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    disabled={!releaseLegalArea}
                  >
                    <option value="">{releaseLegalArea ? 'Keine Klausur auswählen...' : 'Bitte zuerst Rechtsgebiet wählen...'}</option>
                    {releaseLegalArea && (() => {
                      // Finde den Rechtsgebiet-Ordner (z.B. "Zivilrecht")
                      const legalAreaFolder = folders.find(f => 
                        f.name.toLowerCase() === releaseLegalArea.toLowerCase() ||
                        f.name.toLowerCase().includes(releaseLegalArea.toLowerCase())
                      );
                      
                      // Finde Unterordner des Rechtsgebiets (z.B. "Examensklausuren")
                      const level1Folders = legalAreaFolder 
                        ? folders.filter(f => f.parent_id === legalAreaFolder.id)
                        : [];
                      
                      // Kombiniere Level-1 und Level-2 Ordner mit Gruppierung
                      const result: JSX.Element[] = [];
                      
                      level1Folders.forEach(l1Folder => {
                        const l2Children = folders.filter(f => f.parent_id === l1Folder.id);
                        
                        if (l2Children.length > 0) {
                          // Zeige als optgroup mit Unterordnern
                          result.push(
                            <optgroup key={l1Folder.id} label={l1Folder.name}>
                              {l2Children.map(l2Folder => (
                                <option key={l2Folder.id} value={l2Folder.id}>
                                  {l2Folder.name}
                                </option>
                              ))}
                            </optgroup>
                          );
                        } else {
                          // Zeige als einzelne Option wenn keine Unterordner
                          result.push(
                            <option key={l1Folder.id} value={l1Folder.id}>{l1Folder.name}</option>
                          );
                        }
                      });
                      
                      return result;
                    })()}
                  </select>
                  {releaseLegalArea && (
                    <p className="text-xs text-gray-500 mt-1">
                      Zeigt Klausuren aus dem Bereich: {releaseLegalArea}
                    </p>
                  )}
                </div>

                {/* Dokumente aus Klausur-Ordner - nur wenn Klausur-Ordner gewählt */}
                {releaseKlausurFolderId && (() => {
                  // Finde den Ordnernamen
                  const selectedFolder = folders.find(f => f.id === releaseKlausurFolderId);
                  
                  // Finde direkte Kinder der Klausur (Unterordner)
                  const uniqueFolders = folders.filter(f => f.parent_id === releaseKlausurFolderId);
                  
                  // Materialien direkt im gewählten Ordner
                  const directMaterials = materials.filter(m => m.folder_id === releaseKlausurFolderId);
                  
                  // Rekursive Funktion um alle verschachtelten Unterordner zu finden
                  const getAllSubFolders = (parentId: string): MaterialFolder[] => {
                    const directChildren = folders.filter(f => f.parent_id === parentId);
                    let allSubFolders: MaterialFolder[] = [...directChildren];
                    
                    for (const child of directChildren) {
                      const nestedChildren = getAllSubFolders(child.id);
                      allSubFolders = [...allSubFolders, ...nestedChildren];
                    }
                    
                    return allSubFolders;
                  };
                  
                  // Rekursive Funktion um alle Materialien aus einem Ordner und seinen Unterordnern zu holen
                  const getAllMaterialsFromFolder = (folderId: string): { material: TeachingMaterial; path: string[] }[] => {
                    const result: { material: TeachingMaterial; path: string[] }[] = [];
                    const folder = folders.find(f => f.id === folderId);
                    const folderName = folder?.name || 'Unbekannt';
                    
                    // Direkte Materialien
                    const direct = materials.filter(m => m.folder_id === folderId);
                    direct.forEach(m => result.push({ material: m, path: [folderName] }));
                    
                    // Rekursiv Unterordner
                    const children = folders.filter(f => f.parent_id === folderId);
                    for (const child of children) {
                      const childMaterials = getAllMaterialsFromFolder(child.id);
                      childMaterials.forEach(({ material, path }) => {
                        result.push({ material, path: [folderName, ...path] });
                      });
                    }
                    
                    return result;
                  };
                  
                  // Hole alle Materialien mit ihrem Pfad
                  const allNestedMaterials = getAllMaterialsFromFolder(releaseKlausurFolderId);
                  
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        📁 Dokumente aus: {selectedFolder?.name || 'Gewählter Ordner'}
                      </label>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-blue-600">
                          Wählen Sie die Dokumente aus, die Sie mit den Studenten teilen möchten.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              // Alle Materialien auswählen (direkte + aus Unterordnern)
                              const allMaterialIds: string[] = [];
                              
                              // Direkte Materialien
                              directMaterials.forEach(m => allMaterialIds.push(m.id));
                              
                              // Rekursive Funktion um alle Materialien aus Unterordnern zu holen
                              const getAllMaterialsFromFolder = (folderId: string): void => {
                                const folderMaterials = materials.filter(m => m.folder_id === folderId);
                                folderMaterials.forEach(m => {
                                  if (!allMaterialIds.includes(m.id)) {
                                    allMaterialIds.push(m.id);
                                  }
                                });
                                const children = folders.filter(f => f.parent_id === folderId);
                                children.forEach(child => getAllMaterialsFromFolder(child.id));
                              };
                              
                              uniqueFolders.forEach(folder => getAllMaterialsFromFolder(folder.id));
                              
                              setReleaseSolutionMaterialIds(allMaterialIds);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                          >
                            Alle auswählen
                          </button>
                          <button
                            type="button"
                            onClick={() => setReleaseSolutionMaterialIds([])}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            Alle abwählen
                          </button>
                        </div>
                      </div>
                      
                      {/* Direkte Materialien im Ordner */}
                      {directMaterials.length > 0 && (
                        <div className="border border-blue-200 rounded-lg max-h-48 overflow-y-auto bg-white mb-3">
                          {directMaterials.map(material => {
                            const isLoesung = material.title.toLowerCase().normalize('NFC').includes('lösung') || 
                                             material.title.toLowerCase().normalize('NFC').includes('loesung') ||
                                             material.title.toLowerCase().normalize('NFC').includes('musterlösung');
                            return (
                              <label key={material.id} className={`flex items-center p-3 hover:bg-blue-50 cursor-pointer border-b border-blue-100 last:border-0 ${isLoesung ? 'bg-yellow-50' : ''}`}>
                                <input 
                                  type="checkbox" 
                                  checked={releaseSolutionMaterialIds.includes(material.id)} 
                                  onChange={() => setReleaseSolutionMaterialIds(prev => 
                                    prev.includes(material.id) ? prev.filter(id => id !== material.id) : [...prev, material.id]
                                  )} 
                                  className={`h-4 w-4 ${isLoesung ? 'text-yellow-600 focus:ring-yellow-500' : 'text-blue-600 focus:ring-blue-500'} border-gray-300 rounded`}
                                />
                                <FileText className={`h-4 w-4 ml-3 ${isLoesung ? 'text-yellow-600' : 'text-blue-500'}`} />
                                <span className="ml-2 text-sm text-gray-900 flex-1">{material.title}</span>
                                {isLoesung && (
                                  <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">Lösung</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Unterordner mit Materialien (auch verschachtelte) */}
                      {(() => {
                        if (uniqueFolders.length === 0) return null;
                        
                        // Rekursive Funktion um alle Materialien aus einem Ordner zu holen
                        const getAllMaterialsFromFolder = (folderId: string): TeachingMaterial[] => {
                          const result: TeachingMaterial[] = [];
                          // Direkte Materialien
                          const direct = materials.filter(m => m.folder_id === folderId);
                          result.push(...direct);
                          // Rekursiv Unterordner
                          const children = folders.filter(f => f.parent_id === folderId);
                          for (const child of children) {
                            result.push(...getAllMaterialsFromFolder(child.id));
                          }
                          return result;
                        };
                        
                        return (
                          <div className="space-y-2">
                            {uniqueFolders.map((subFolder) => {
                              const folderMats = getAllMaterialsFromFolder(subFolder.id);
                              
                              return (
                                <div key={subFolder.id} className="border border-green-200 rounded-lg bg-green-50">
                                  <div className="p-2 border-b border-green-200 bg-green-100 rounded-t-lg">
                                    <div className="flex items-center">
                                      <FolderOpen className="h-4 w-4 text-green-600 mr-2" />
                                      <span className="text-sm font-medium text-green-800">{subFolder.name}</span>
                                      <span className="ml-2 text-xs text-green-600">({folderMats.length} Dateien)</span>
                                    </div>
                                  </div>
                                  {folderMats.length > 0 && (
                                    <div className="max-h-32 overflow-y-auto">
                                      {folderMats.map(material => (
                                        <label key={material.id} className="flex items-center p-2 hover:bg-green-100 cursor-pointer border-b border-green-100 last:border-0">
                                          <input 
                                            type="checkbox" 
                                            checked={releaseSolutionMaterialIds.includes(material.id)} 
                                            onChange={() => setReleaseSolutionMaterialIds(prev => 
                                              prev.includes(material.id) ? prev.filter(id => id !== material.id) : [...prev, material.id]
                                            )} 
                                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                          />
                                          <FileText className="h-4 w-4 ml-3 text-green-500" />
                                          <span className="ml-2 text-sm text-gray-900">{material.title}</span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                      
                      {directMaterials.length === 0 && uniqueFolders.length === 0 && (
                        <p className="p-3 text-sm text-gray-500 bg-white rounded-lg border border-blue-200">
                          Keine Dokumente in diesem Ordner vorhanden.
                        </p>
                      )}
                      
                      {releaseSolutionMaterialIds.length > 0 && (
                        <p className="text-xs text-blue-700 mt-2">
                          ✓ {releaseSolutionMaterialIds.length} Dokument(e) ausgewählt
                        </p>
                      )}
                      
                      {/* Freigabetermin für Lösungen */}
                      {releaseSolutionMaterialIds.length > 0 && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <label className="block text-sm font-medium text-yellow-800 mb-2">
                            Freigabetermin für Lösungen
                          </label>
                          <div className="space-y-2">
                            <label className="flex items-center cursor-pointer">
                              <input 
                                type="radio" 
                                name="solutionReleaseMode" 
                                checked={solutionReleaseMode === 'auto'} 
                                onChange={() => setSolutionReleaseMode('auto')} 
                                className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                Automatisch nach Ende der Einheit ({releaseEndTime} Uhr)
                              </span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                              <input 
                                type="radio" 
                                name="solutionReleaseMode" 
                                checked={solutionReleaseMode === 'custom'} 
                                onChange={() => {
                                  setSolutionReleaseMode('custom');
                                  // Setze Standardwerte wenn noch nicht gesetzt
                                  if (!customSolutionReleaseDate && selectedDate) {
                                    setCustomSolutionReleaseDate(selectedDate.toISOString().split('T')[0]);
                                  }
                                  if (!customSolutionReleaseTime) {
                                    setCustomSolutionReleaseTime(releaseEndTime);
                                  }
                                }} 
                                className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                Alternativer Freigabetermin
                              </span>
                            </label>
                            
                            {solutionReleaseMode === 'custom' && (
                              <div className="ml-6 mt-2 grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Datum</label>
                                  <input 
                                    type="date" 
                                    value={customSolutionReleaseDate} 
                                    onChange={(e) => setCustomSolutionReleaseDate(e.target.value)} 
                                    className="w-full px-2 py-1.5 text-sm border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Uhrzeit</label>
                                  <input 
                                    type="time" 
                                    value={customSolutionReleaseTime} 
                                    onChange={(e) => setCustomSolutionReleaseTime(e.target.value)} 
                                    className="w-full px-2 py-1.5 text-sm border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {releaseSolutionMaterialIds.length === 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                          Wählen Sie Dokumente aus, um einen Freigabetermin festzulegen.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Beschreibung */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung (optional)</label>
                  <textarea 
                    value={releaseDescription} 
                    onChange={(e) => setReleaseDescription(e.target.value)} 
                    placeholder="Zusätzliche Informationen zur Einheit..." 
                    rows={2} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                  />
                </div>

                {/* Zusätzliches Dokument hochladen */}
                <div className="border border-dashed border-gray-300 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Upload className="h-4 w-4 inline mr-1" />
                    Zusätzliches Dokument hochladen (optional)
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Hier können Sie ein Dokument hochladen, das noch nicht im Materialkatalog enthalten ist.
                  </p>
                  
                  {additionalDocument ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-green-600 mr-2" />
                          <div>
                            <p className="text-sm font-medium text-green-800">{additionalDocument.name}</p>
                            <p className="text-xs text-green-600">{(additionalDocument.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAdditionalDocument(null);
                            setAdditionalDocumentTitle('');
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-green-700 mb-1">Titel des Dokuments</label>
                        <input
                          type="text"
                          value={additionalDocumentTitle}
                          onChange={(e) => setAdditionalDocumentTitle(e.target.value)}
                          placeholder="z.B. Zusatzmaterial zur Einheit"
                          className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-200 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-2 pb-3">
                        <Upload className="h-6 w-6 text-gray-400 mb-1" />
                        <p className="text-sm text-gray-500">Datei auswählen</p>
                        <p className="text-xs text-gray-400">PDF, Word, Excel, etc.</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setAdditionalDocument(file);
                            setAdditionalDocumentTitle(file.name.replace(/\.[^/.]+$/, ''));
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Zusammenfassung */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Zusammenfassung</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>Typ: <strong>{releaseUnitType ? UNIT_TYPES[releaseUnitType].label : '-'}</strong></div>
                    <div>Rechtsgebiet: <strong>{releaseLegalArea || '-'}</strong></div>
                    <div>Zeit: <strong>{releaseStartTime} - {releaseEndTime}</strong></div>
                    <div>Dauer: <strong>{releaseUnitType ? formatDuration(getUnitDurationFromSettings(unitDurations, releaseUnitType)) : '-'}</strong></div>
                    {releaseKlausurFolderId && <div className="col-span-2">Klausur: <strong>{folders.find(f => f.id === releaseKlausurFolderId)?.name || '-'}</strong></div>}
                    {releaseIsRecurring && <div className="col-span-2">Wiederholung: <strong>{releaseRecurrenceType === 'weekly' ? 'Wöchentlich' : 'Monatlich'}, {releaseRecurrenceCount} Termine</strong></div>}
                    {releaseSolutionMaterialIds.length > 0 && <div className="col-span-2">Lösungen (nach Termin): <strong>{releaseSolutionMaterialIds.length} Dateien</strong></div>}
                    {additionalDocument && <div className="col-span-2 text-green-700">Zusatzdokument: <strong>{additionalDocumentTitle || additionalDocument.name}</strong></div>}
                  </div>
                </div>
                  </>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setShowReleaseModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Abbrechen
                </button>
                <button 
                  onClick={handleCreateRelease} 
                  disabled={!releaseTitle.trim() || (releaseEventType === 'einheit' && !releaseUnitType) || isUploadingDocument} 
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingDocument ? (
                    <>
                      <span className="inline-block h-4 w-4 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Wird gespeichert...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 inline mr-1" />
                      {releaseEventType === 'einheit' 
                        ? (releaseIsRecurring ? `${releaseRecurrenceCount} Einheiten planen` : 'Einheit planen')
                        : 'Eintrag erstellen'
                      }
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Korrektur Modal */}
      {showKorrekturModal && selectedKlausur && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowKorrekturModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Klausur korrigieren</h3>
                <button onClick={() => setShowKorrekturModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{selectedKlausur.title}</p>
                <p className="text-xs text-gray-500">{selectedKlausur.teilnehmer_name} - {selectedKlausur.legal_area}</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Punktzahl</label>
                    <input type="number" min="0" max="18" value={korrekturScore} onChange={(e) => setKorrekturScore(e.target.value)} placeholder="z.B. 12" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Korrekturzeit (Stunden)</label>
                    <input type="number" min="0" step="0.25" value={korrekturDuration} onChange={(e) => setKorrekturDuration(e.target.value)} placeholder="z.B. 1.5" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    <p className="text-xs text-gray-400 mt-1">Wird im Tätigkeitsbericht erfasst</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Korrigierte Klausur (PDF)</label>
                    {korrekturFile ? (
                      <div className="flex items-center p-3 bg-primary/5 border border-primary/20 rounded-lg">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="ml-2 text-sm text-gray-700 truncate flex-1" title={korrekturFile.name}>
                          {korrekturFile.name}
                        </span>
                        <button 
                          onClick={() => setKorrekturFile(null)} 
                          className="ml-2 p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : selectedKlausur.corrected_file_url ? (
                      <div className="space-y-2">
                        <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                          <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <span className="ml-2 text-sm text-gray-700 flex-1">Bereits hochgeladen</span>
                          <button 
                            onClick={async () => {
                              try {
                                const urlParts = selectedKlausur.corrected_file_url!.split('/object/public/elite-kleingruppe/');
                                const filePath = urlParts[1];
                                const { data, error } = await supabase.storage.from('elite-kleingruppe').download(filePath);
                                if (error) throw error;
                                const url = window.URL.createObjectURL(data);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${selectedKlausur.title}_Korrektur.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              } catch (error) {
                                console.error('Error downloading file:', error);
                                alert('Fehler beim Herunterladen der Datei');
                              }
                            }}
                            className="ml-2 p-1 text-primary hover:bg-primary/10 rounded flex-shrink-0"
                            title="Datei herunterladen"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                        <label className="cursor-pointer block">
                          <div className="flex items-center justify-center px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary/50 transition-colors">
                            <Upload className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-500">Neue PDF hochladen</span>
                          </div>
                          <input 
                            type="file" 
                            accept=".pdf" 
                            className="hidden" 
                            onChange={(e) => setKorrekturFile(e.target.files?.[0] || null)} 
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div className="flex items-center justify-center px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary/50 transition-colors">
                          <Upload className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-500">PDF auswählen</span>
                        </div>
                        <input 
                          type="file" 
                          accept=".pdf" 
                          className="hidden" 
                          onChange={(e) => setKorrekturFile(e.target.files?.[0] || null)} 
                        />
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bewertungstabelle (Excel)</label>
                    {korrekturExcelFile ? (
                      <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                        <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <span className="ml-2 text-sm text-gray-700 truncate flex-1" title={korrekturExcelFile.name}>
                          {korrekturExcelFile.name}
                        </span>
                        <button 
                          onClick={() => setKorrekturExcelFile(null)} 
                          className="ml-2 p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : selectedKlausur.corrected_excel_url ? (
                      <div className="space-y-2">
                        <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                          <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <span className="ml-2 text-sm text-gray-700 flex-1">Bereits hochgeladen</span>
                          <button 
                            onClick={async () => {
                              try {
                                const urlParts = selectedKlausur.corrected_excel_url!.split('/object/public/elite-kleingruppe/');
                                const filePath = urlParts[1];
                                const { data, error } = await supabase.storage.from('elite-kleingruppe').download(filePath);
                                if (error) throw error;
                                const url = window.URL.createObjectURL(data);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${selectedKlausur.title}_Bewertung.xlsx`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              } catch (error) {
                                console.error('Error downloading file:', error);
                                alert('Fehler beim Herunterladen der Datei');
                              }
                            }}
                            className="ml-2 p-1 text-primary hover:bg-primary/10 rounded flex-shrink-0"
                            title="Datei herunterladen"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                        <label className="cursor-pointer block">
                          <div className="flex items-center justify-center px-3 py-2 border-2 border-dashed border-green-300 rounded-lg hover:border-green-500/50 transition-colors bg-green-50/30">
                            <Upload className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-sm text-gray-500">Neue Excel hochladen</span>
                          </div>
                          <input 
                            type="file" 
                            accept=".xlsx,.xls,.csv" 
                            className="hidden" 
                            onChange={(e) => setKorrekturExcelFile(e.target.files?.[0] || null)} 
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div className="flex items-center justify-center px-3 py-3 border-2 border-dashed border-green-300 rounded-lg hover:border-green-500/50 transition-colors bg-green-50/30">
                          <Upload className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-500">Excel auswählen</span>
                        </div>
                        <input 
                          type="file" 
                          accept=".xlsx,.xls,.csv" 
                          className="hidden" 
                          onChange={(e) => setKorrekturExcelFile(e.target.files?.[0] || null)} 
                        />
                      </label>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Feedback / Anmerkungen</label>
                  <textarea value={korrekturFeedback} onChange={(e) => setKorrekturFeedback(e.target.value)} placeholder="Feedback zur Klausur..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setShowKorrekturModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Abbrechen</button>
                <button onClick={handleSaveKorrektur} disabled={isUploadingKorrektur} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                  {isUploadingKorrektur ? (
                    <><span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Wird gespeichert...</>
                  ) : (
                    <><Save className="h-4 w-4 inline mr-1" />Korrektur speichern</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete/Cancel Modal */}
      {showDeleteModal && selectedReleaseForAction && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Termin löschen</h3>
                <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{selectedReleaseForAction.title}</p>
                <p className="text-xs text-gray-500">{formatDate(selectedReleaseForAction.release_date)} {selectedReleaseForAction.start_time && selectedReleaseForAction.end_time ? `${selectedReleaseForAction.start_time} - ${selectedReleaseForAction.end_time}` : ''}</p>
              </div>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyParticipants}
                      onChange={(e) => setNotifyParticipants(e.target.checked)}
                      className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                      disabled={!isAdmin}
                    />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">Teilnehmer benachrichtigen</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {notifyParticipants 
                          ? 'Der Termin wird als abgesagt markiert und bleibt für Teilnehmer sichtbar im Kalender.'
                          : 'Der Termin wird komplett gelöscht und ist nicht mehr sichtbar.'}
                      </p>
                      {!isAdmin && (
                        <p className="text-xs text-orange-600 mt-1 font-medium">⚠️ Nur Admins können Termine permanent löschen</p>
                      )}
                    </div>
                  </label>
                </div>
                {notifyParticipants && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grund für die Absage (optional)</label>
                    <textarea 
                      value={deleteReason} 
                      onChange={(e) => setDeleteReason(e.target.value)} 
                      placeholder="z.B. Krankheit, Feiertag, etc." 
                      rows={3} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                    />
                  </div>
                )}
                {!notifyParticipants && isAdmin && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">⚠️ Der Termin wird permanent gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.</p>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button 
                  onClick={() => setShowDeleteModal(false)} 
                  disabled={isSendingEmails}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={handleDeleteOrCancel} 
                  disabled={isSendingEmails}
                  className={`px-4 py-2 text-white rounded-lg flex items-center disabled:opacity-50 disabled:cursor-not-allowed ${notifyParticipants ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {isSendingEmails ? (
                    <>
                      <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                      E-Mails werden versendet...
                    </>
                  ) : (
                    notifyParticipants ? 'Termin absagen' : 'Termin löschen'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {showDeleteConfirmModal && selectedReleaseForAction && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteConfirmModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-red-900">⚠️ Permanentes Löschen bestätigen</h3>
                <button onClick={() => setShowDeleteConfirmModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{selectedReleaseForAction.title}</p>
                <p className="text-xs text-gray-500">{formatDate(selectedReleaseForAction.release_date)} {selectedReleaseForAction.start_time && selectedReleaseForAction.end_time ? `${selectedReleaseForAction.start_time} - ${selectedReleaseForAction.end_time}` : ''}</p>
              </div>
              <div className="space-y-4">
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Achtung: Diese Aktion ist unwiderruflich!</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <ul className="list-disc list-inside space-y-1">
                          <li>Die Einheit wird <strong>permanent aus der Datenbank gelöscht</strong></li>
                          <li>Sie wird für <strong>alle Benutzergruppen unsichtbar</strong> (Studenten, Dozenten, Admins)</li>
                          <li>Alle zugehörigen Materialien bleiben erhalten, sind aber nicht mehr verknüpft</li>
                          <li><strong>Keine E-Mail-Benachrichtigungen</strong> werden versendet</li>
                          <li>Diese Aktion <strong>kann nicht rückgängig gemacht werden</strong></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    💡 <strong>Tipp:</strong> Wenn Sie Teilnehmer informieren möchten, verwenden Sie stattdessen die Option "Termin absagen" (mit Benachrichtigung).
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button 
                  onClick={() => {
                    setShowDeleteConfirmModal(false);
                    setShowDeleteModal(true);
                  }} 
                  disabled={isSendingEmails}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Zurück
                </button>
                <button 
                  onClick={confirmPermanentDelete} 
                  disabled={isSendingEmails}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingEmails ? (
                    <>
                      <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                      Wird gelöscht...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                      Ja, permanent löschen
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Confirmation Modal (for Edit Modal date/time changes) */}
      {showRescheduleConfirmModal && editingRelease && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowRescheduleConfirmModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Terminänderung bestätigen</h3>
                <button onClick={() => setShowRescheduleConfirmModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{editingRelease.title}</p>
                <p className="text-xs text-gray-500">
                  Alt: {formatDate(editingRelease.release_date)} {editingRelease.start_time && editingRelease.end_time ? `${editingRelease.start_time.slice(0, 5)} - ${editingRelease.end_time.slice(0, 5)}` : ''}
                </p>
                {pendingUpdateData && (
                  <p className="text-xs text-purple-600 mt-1">
                    Neu: {formatDate(pendingUpdateData.release_date)} {pendingUpdateData.start_time && pendingUpdateData.end_time ? `${pendingUpdateData.start_time.slice(0, 5)} - ${pendingUpdateData.end_time.slice(0, 5)}` : ''}
                  </p>
                )}
              </div>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyParticipantsReschedule}
                      onChange={(e) => setNotifyParticipantsReschedule(e.target.checked)}
                      className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">Teilnehmer über Terminänderung benachrichtigen</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {notifyParticipantsReschedule 
                          ? 'Die Terminänderung wird als Verschiebung markiert und Teilnehmer werden informiert.'
                          : 'Die Änderung wird ohne Benachrichtigung gespeichert.'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button 
                  onClick={() => setShowRescheduleConfirmModal(false)} 
                  disabled={isSendingEmails}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={confirmRescheduleUpdate} 
                  disabled={isSendingEmails}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isSendingEmails ? (
                    <>
                      <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                      E-Mails werden versendet...
                    </>
                  ) : (
                    'Änderung speichern'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedReleaseForAction && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowRescheduleModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Termin verschieben</h3>
                <button onClick={() => setShowRescheduleModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{selectedReleaseForAction.title}</p>
                <p className="text-xs text-gray-500">Aktuell: {formatDate(selectedReleaseForAction.release_date)} {selectedReleaseForAction.start_time && selectedReleaseForAction.end_time ? `${selectedReleaseForAction.start_time} - ${selectedReleaseForAction.end_time}` : ''}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Neues Datum</label>
                  <input 
                    type="date" 
                    value={rescheduleDate} 
                    onChange={(e) => setRescheduleDate(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Startzeit</label>
                    <input 
                      type="time" 
                      value={rescheduleStartTime} 
                      onChange={(e) => setRescheduleStartTime(e.target.value)} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Endzeit</label>
                    <input 
                      type="time" 
                      value={rescheduleEndTime} 
                      onChange={(e) => setRescheduleEndTime(e.target.value)} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grund für die Verschiebung (optional)</label>
                  <textarea 
                    value={rescheduleReason} 
                    onChange={(e) => setRescheduleReason(e.target.value)} 
                    placeholder="z.B. Terminkonflikt, Raumänderung, etc." 
                    rows={3} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                  />
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-sm text-purple-800">📅 Der Termin wird auf das neue Datum verschoben. Die Verschiebung wird im Kalender angezeigt.</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setShowRescheduleModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Zurück
                </button>
                <button onClick={handleRescheduleRelease} disabled={!rescheduleDate} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  Termin verschieben
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kurszeiten Tab */}
      {activeSubTab === 'kurszeiten' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  Reguläre Kurszeiten
                  <span className="relative group">
                    <Info className="h-4 w-4 text-gray-400 cursor-help" />
                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-72 p-3 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      Änderungen und Wiederholungseinheiten sind dem Kurskalender zu entnehmen
                      <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></span>
                    </span>
                  </span>
                </h3>
                <p className="text-sm text-gray-500 mt-1">Wöchentliche Termine für die Elite-Kleingruppe</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingCourseTime(null);
                    setCourseTimeForm({ weekday: 0, start_time: '09:00', end_time: '10:30', legal_area: 'Zivilrecht', description: '', meeting_link: '' });
                    setShowCourseTimeModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Kurszeit hinzufügen
                </button>
              )}
            </div>
            
            {courseTimes.length === 0 ? (
              <div className="p-8 text-center">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Keine Kurszeiten hinterlegt</h4>
                <p className="text-gray-500">Fügen Sie reguläre Kurszeiten hinzu, damit Teilnehmer wissen, wann der Unterricht stattfindet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'].map((dayName, dayIndex) => {
                  const dayTimes = courseTimes.filter(ct => ct.weekday === dayIndex);
                  if (dayTimes.length === 0) return null;
                  return (
                    <div key={dayIndex} className="p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">{dayName}</h4>
                      <div className="space-y-2">
                        {dayTimes.map(ct => (
                          <div key={ct.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-gray-400" />
                                <span className="font-medium text-gray-900">{ct.start_time.slice(0, 5)} - {ct.end_time.slice(0, 5)}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                ct.legal_area === 'Zivilrecht' ? 'bg-blue-100 text-blue-700' :
                                ct.legal_area === 'Strafrecht' ? 'bg-red-100 text-red-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {ct.legal_area}
                              </span>
                              {ct.description && <span className="text-sm text-gray-500">{ct.description}</span>}
                              {ct.meeting_link && (
                                <a
                                  href={ct.meeting_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                  Meeting
                                </a>
                              )}
                            </div>
                            {isAdmin && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingCourseTime(ct);
                                    setCourseTimeForm({
                                      weekday: ct.weekday,
                                      start_time: ct.start_time.slice(0, 5),
                                      end_time: ct.end_time.slice(0, 5),
                                      legal_area: ct.legal_area,
                                      description: ct.description || '',
                                      meeting_link: ct.meeting_link || ''
                                    });
                                    setShowCourseTimeModal(true);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded"
                                >
                                  <PenTool className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm('Kurszeit wirklich löschen?')) {
                                      await supabase.from('elite_course_times').delete().eq('id', ct.id);
                                      fetchData();
                                    }
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unit Duration Settings */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Einheitenlängen</h3>
                <p className="text-sm text-gray-500 mt-1">Standard-Dauern für Unterrichts- und Wiederholungseinheiten</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowDurationSettings(!showDurationSettings)}
                  className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  {showDurationSettings ? 'Schließen' : 'Bearbeiten'}
                </button>
              )}
            </div>
            
            {showDurationSettings ? (
              <div className="p-6">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Unterrichtseinheiten</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            Zivilrecht
                          </span>
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                value={Math.floor(unitDurations.zivilrecht_unterricht / 60)}
                                onChange={(e) => {
                                  const hours = parseInt(e.target.value) || 0;
                                  const mins = unitDurations.zivilrecht_unterricht % 60;
                                  setUnitDurations({ ...unitDurations, zivilrecht_unterricht: hours * 60 + mins });
                                }}
                                className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                min="0"
                                max="24"
                              />
                              <span className="text-sm text-gray-500">Std</span>
                            </div>
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                value={unitDurations.zivilrecht_unterricht % 60}
                                onChange={(e) => {
                                  const hours = Math.floor(unitDurations.zivilrecht_unterricht / 60);
                                  const mins = parseInt(e.target.value) || 0;
                                  setUnitDurations({ ...unitDurations, zivilrecht_unterricht: hours * 60 + Math.min(59, Math.max(0, mins)) });
                                }}
                                className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                min="0"
                                max="59"
                                step="5"
                              />
                              <span className="text-sm text-gray-500">Min</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 text-center">= {(unitDurations.zivilrecht_unterricht / 60).toFixed(2).replace('.', ',')} Std</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                            Strafrecht
                          </span>
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                value={Math.floor(unitDurations.strafrecht_unterricht / 60)}
                                onChange={(e) => {
                                  const hours = parseInt(e.target.value) || 0;
                                  const mins = unitDurations.strafrecht_unterricht % 60;
                                  setUnitDurations({ ...unitDurations, strafrecht_unterricht: hours * 60 + mins });
                                }}
                                className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                min="0"
                                max="24"
                              />
                              <span className="text-sm text-gray-500">Std</span>
                            </div>
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                value={unitDurations.strafrecht_unterricht % 60}
                                onChange={(e) => {
                                  const hours = Math.floor(unitDurations.strafrecht_unterricht / 60);
                                  const mins = parseInt(e.target.value) || 0;
                                  setUnitDurations({ ...unitDurations, strafrecht_unterricht: hours * 60 + Math.min(59, Math.max(0, mins)) });
                                }}
                                className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                min="0"
                                max="59"
                                step="5"
                              />
                              <span className="text-sm text-gray-500">Min</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 text-center">= {(unitDurations.strafrecht_unterricht / 60).toFixed(2).replace('.', ',')} Std</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span>
                            Öffentliches Recht
                          </span>
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                value={Math.floor(unitDurations.oeffentliches_recht_unterricht / 60)}
                                onChange={(e) => {
                                  const hours = parseInt(e.target.value) || 0;
                                  const mins = unitDurations.oeffentliches_recht_unterricht % 60;
                                  setUnitDurations({ ...unitDurations, oeffentliches_recht_unterricht: hours * 60 + mins });
                                }}
                                className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                min="0"
                                max="24"
                              />
                              <span className="text-sm text-gray-500">Std</span>
                            </div>
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                value={unitDurations.oeffentliches_recht_unterricht % 60}
                                onChange={(e) => {
                                  const hours = Math.floor(unitDurations.oeffentliches_recht_unterricht / 60);
                                  const mins = parseInt(e.target.value) || 0;
                                  setUnitDurations({ ...unitDurations, oeffentliches_recht_unterricht: hours * 60 + Math.min(59, Math.max(0, mins)) });
                                }}
                                className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                min="0"
                                max="59"
                                step="5"
                              />
                              <span className="text-sm text-gray-500">Min</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 text-center">= {(unitDurations.oeffentliches_recht_unterricht / 60).toFixed(2).replace('.', ',')} Std</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Wiederholungseinheiten</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            Zivilrecht
                          </span>
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                value={Math.floor(unitDurations.zivilrecht_wiederholung / 60)}
                                onChange={(e) => {
                                  const hours = parseInt(e.target.value) || 0;
                                  const mins = unitDurations.zivilrecht_wiederholung % 60;
                                  setUnitDurations({ ...unitDurations, zivilrecht_wiederholung: hours * 60 + mins });
                                }}
                                className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                min="0"
                                max="24"
                              />
                              <span className="text-sm text-gray-500">Std</span>
                            </div>
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                value={unitDurations.zivilrecht_wiederholung % 60}
                                onChange={(e) => {
                                  const hours = Math.floor(unitDurations.zivilrecht_wiederholung / 60);
                                  const mins = parseInt(e.target.value) || 0;
                                  setUnitDurations({ ...unitDurations, zivilrecht_wiederholung: hours * 60 + Math.min(59, Math.max(0, mins)) });
                                }}
                                className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                min="0"
                                max="59"
                                step="5"
                              />
                              <span className="text-sm text-gray-500">Min</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 text-center">= {(unitDurations.zivilrecht_wiederholung / 60).toFixed(2).replace('.', ',')} Std</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                            Strafrecht
                          </span>
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                value={Math.floor(unitDurations.strafrecht_wiederholung / 60)}
                                onChange={(e) => {
                                  const hours = parseInt(e.target.value) || 0;
                                  const mins = unitDurations.strafrecht_wiederholung % 60;
                                  setUnitDurations({ ...unitDurations, strafrecht_wiederholung: hours * 60 + mins });
                                }}
                                className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                min="0"
                                max="24"
                              />
                              <span className="text-sm text-gray-500">Std</span>
                            </div>
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                value={unitDurations.strafrecht_wiederholung % 60}
                                onChange={(e) => {
                                  const hours = Math.floor(unitDurations.strafrecht_wiederholung / 60);
                                  const mins = parseInt(e.target.value) || 0;
                                  setUnitDurations({ ...unitDurations, strafrecht_wiederholung: hours * 60 + Math.min(59, Math.max(0, mins)) });
                                }}
                                className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                min="0"
                                max="59"
                                step="5"
                              />
                              <span className="text-sm text-gray-500">Min</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 text-center">= {(unitDurations.strafrecht_wiederholung / 60).toFixed(2).replace('.', ',')} Std</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span>
                            Öffentliches Recht
                          </span>
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                value={Math.floor(unitDurations.oeffentliches_recht_wiederholung / 60)}
                                onChange={(e) => {
                                  const hours = parseInt(e.target.value) || 0;
                                  const mins = unitDurations.oeffentliches_recht_wiederholung % 60;
                                  setUnitDurations({ ...unitDurations, oeffentliches_recht_wiederholung: hours * 60 + mins });
                                }}
                                className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                min="0"
                                max="24"
                              />
                              <span className="text-sm text-gray-500">Std</span>
                            </div>
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                value={unitDurations.oeffentliches_recht_wiederholung % 60}
                                onChange={(e) => {
                                  const hours = Math.floor(unitDurations.oeffentliches_recht_wiederholung / 60);
                                  const mins = parseInt(e.target.value) || 0;
                                  setUnitDurations({ ...unitDurations, oeffentliches_recht_wiederholung: hours * 60 + Math.min(59, Math.max(0, mins)) });
                                }}
                                className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                min="0"
                                max="59"
                                step="5"
                              />
                              <span className="text-sm text-gray-500">Min</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 text-center">= {(unitDurations.oeffentliches_recht_wiederholung / 60).toFixed(2).replace('.', ',')} Std</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      onClick={() => setShowDurationSettings(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleSaveUnitDurations}
                      className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Unterrichtseinheiten</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                        <span className="text-sm font-medium text-gray-900">Zivilrecht</span>
                        <span className="text-sm text-gray-600">{formatDurationReadable(unitDurations.zivilrecht_unterricht)}</span>
                      </div>
                      <div className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                        <span className="text-sm font-medium text-gray-900">Strafrecht</span>
                        <span className="text-sm text-gray-600">{formatDurationReadable(unitDurations.strafrecht_unterricht)}</span>
                      </div>
                      <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                        <span className="text-sm font-medium text-gray-900">Öffentliches Recht</span>
                        <span className="text-sm text-gray-600">{formatDurationReadable(unitDurations.oeffentliches_recht_unterricht)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Wiederholungseinheiten</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                        <span className="text-sm font-medium text-gray-900">Zivilrecht</span>
                        <span className="text-sm text-gray-600">{formatDurationReadable(unitDurations.zivilrecht_wiederholung)}</span>
                      </div>
                      <div className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                        <span className="text-sm font-medium text-gray-900">Strafrecht</span>
                        <span className="text-sm text-gray-600">{formatDurationReadable(unitDurations.strafrecht_wiederholung)}</span>
                      </div>
                      <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                        <span className="text-sm font-medium text-gray-900">Öffentliches Recht</span>
                        <span className="text-sm text-gray-600">{formatDurationReadable(unitDurations.oeffentliches_recht_wiederholung)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Zoom Links Settings */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Zoom-Links für Rechtsgebiete</h3>
                <p className="text-sm text-gray-500 mt-1">Permanente Meeting-Links für die 3 Rechtsgebiete</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowZoomLinksSettings(!showZoomLinksSettings)}
                  className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  {showZoomLinksSettings ? 'Schließen' : 'Bearbeiten'}
                </button>
              )}
            </div>
            
            {showZoomLinksSettings ? (
              <div className="p-6">
                <div className="space-y-6">
                  {/* Zivilrecht */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        Zivilrecht
                      </span>
                    </label>
                    <div className="space-y-3">
                      <input
                        type="url"
                        value={zoomLinks.Zivilrecht.url}
                        onChange={(e) => setZoomLinks({ ...zoomLinks, Zivilrecht: { ...zoomLinks.Zivilrecht, url: e.target.value } })}
                        placeholder="https://zoom.us/j/..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={zoomLinks.Zivilrecht.meetingId}
                          onChange={(e) => setZoomLinks({ ...zoomLinks, Zivilrecht: { ...zoomLinks.Zivilrecht, meetingId: e.target.value } })}
                          placeholder="Meeting ID"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                        />
                        <input
                          type="text"
                          value={zoomLinks.Zivilrecht.passcode}
                          onChange={(e) => setZoomLinks({ ...zoomLinks, Zivilrecht: { ...zoomLinks.Zivilrecht, passcode: e.target.value } })}
                          placeholder="Passcode"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Strafrecht */}
                  <div className="bg-red-50 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        Strafrecht
                      </span>
                    </label>
                    <div className="space-y-3">
                      <input
                        type="url"
                        value={zoomLinks.Strafrecht.url}
                        onChange={(e) => setZoomLinks({ ...zoomLinks, Strafrecht: { ...zoomLinks.Strafrecht, url: e.target.value } })}
                        placeholder="https://zoom.us/j/..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={zoomLinks.Strafrecht.meetingId}
                          onChange={(e) => setZoomLinks({ ...zoomLinks, Strafrecht: { ...zoomLinks.Strafrecht, meetingId: e.target.value } })}
                          placeholder="Meeting ID"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                        />
                        <input
                          type="text"
                          value={zoomLinks.Strafrecht.passcode}
                          onChange={(e) => setZoomLinks({ ...zoomLinks, Strafrecht: { ...zoomLinks.Strafrecht, passcode: e.target.value } })}
                          placeholder="Passcode"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Öffentliches Recht */}
                  <div className="bg-green-50 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500"></span>
                        Öffentliches Recht
                      </span>
                    </label>
                    <div className="space-y-3">
                      <input
                        type="url"
                        value={zoomLinks['Öffentliches Recht'].url}
                        onChange={(e) => setZoomLinks({ ...zoomLinks, 'Öffentliches Recht': { ...zoomLinks['Öffentliches Recht'], url: e.target.value } })}
                        placeholder="https://zoom.us/j/..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={zoomLinks['Öffentliches Recht'].meetingId}
                          onChange={(e) => setZoomLinks({ ...zoomLinks, 'Öffentliches Recht': { ...zoomLinks['Öffentliches Recht'], meetingId: e.target.value } })}
                          placeholder="Meeting ID"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                        />
                        <input
                          type="text"
                          value={zoomLinks['Öffentliches Recht'].passcode}
                          onChange={(e) => setZoomLinks({ ...zoomLinks, 'Öffentliches Recht': { ...zoomLinks['Öffentliches Recht'], passcode: e.target.value } })}
                          placeholder="Passcode"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      onClick={() => setShowZoomLinksSettings(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleSaveZoomLinks}
                      className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">Zivilrecht</span>
                      {(zoomLinks.Zivilrecht?.url || (typeof zoomLinks.Zivilrecht === 'string' && zoomLinks.Zivilrecht)) && (
                        <a
                          href={zoomLinks.Zivilrecht?.url || (typeof zoomLinks.Zivilrecht === 'string' ? zoomLinks.Zivilrecht : '#')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                          Zoom
                        </a>
                      )}
                    </div>
                    {zoomLinks.Zivilrecht?.meetingId && (
                      <p className="text-xs text-gray-600">ID: {zoomLinks.Zivilrecht.meetingId}</p>
                    )}
                    {zoomLinks.Zivilrecht?.passcode && (
                      <p className="text-xs text-gray-600">Code: {zoomLinks.Zivilrecht.passcode}</p>
                    )}
                    {!zoomLinks.Zivilrecht?.url && !(typeof zoomLinks.Zivilrecht === 'string' && zoomLinks.Zivilrecht) && !zoomLinks.Zivilrecht?.meetingId && (
                      <span className="text-xs text-gray-400">Kein Link</span>
                    )}
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">Strafrecht</span>
                      {(zoomLinks.Strafrecht?.url || (typeof zoomLinks.Strafrecht === 'string' && zoomLinks.Strafrecht)) && (
                        <a
                          href={zoomLinks.Strafrecht?.url || (typeof zoomLinks.Strafrecht === 'string' ? zoomLinks.Strafrecht : '#')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                          Zoom
                        </a>
                      )}
                    </div>
                    {zoomLinks.Strafrecht?.meetingId && (
                      <p className="text-xs text-gray-600">ID: {zoomLinks.Strafrecht.meetingId}</p>
                    )}
                    {zoomLinks.Strafrecht?.passcode && (
                      <p className="text-xs text-gray-600">Code: {zoomLinks.Strafrecht.passcode}</p>
                    )}
                    {!zoomLinks.Strafrecht?.url && !(typeof zoomLinks.Strafrecht === 'string' && zoomLinks.Strafrecht) && !zoomLinks.Strafrecht?.meetingId && (
                      <span className="text-xs text-gray-400">Kein Link</span>
                    )}
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">Öffentliches Recht</span>
                      {(zoomLinks['Öffentliches Recht']?.url || (typeof zoomLinks['Öffentliches Recht'] === 'string' && zoomLinks['Öffentliches Recht'])) && (
                        <a
                          href={zoomLinks['Öffentliches Recht']?.url || (typeof zoomLinks['Öffentliches Recht'] === 'string' ? zoomLinks['Öffentliches Recht'] : '#')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                          Zoom
                        </a>
                      )}
                    </div>
                    {zoomLinks['Öffentliches Recht']?.meetingId && (
                      <p className="text-xs text-gray-600">ID: {zoomLinks['Öffentliches Recht'].meetingId}</p>
                    )}
                    {zoomLinks['Öffentliches Recht']?.passcode && (
                      <p className="text-xs text-gray-600">Code: {zoomLinks['Öffentliches Recht'].passcode}</p>
                    )}
                    {!zoomLinks['Öffentliches Recht']?.url && !(typeof zoomLinks['Öffentliches Recht'] === 'string' && zoomLinks['Öffentliches Recht']) && !zoomLinks['Öffentliches Recht']?.meetingId && (
                      <span className="text-xs text-gray-400">Kein Link</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kurszeit Modal */}
      {showCourseTimeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowCourseTimeModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingCourseTime ? 'Kurszeit bearbeiten' : 'Neue Kurszeit'}
                </h3>
                <button onClick={() => setShowCourseTimeModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wochentag</label>
                  <select
                    value={courseTimeForm.weekday}
                    onChange={(e) => setCourseTimeForm({ ...courseTimeForm, weekday: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value={0}>Montag</option>
                    <option value={1}>Dienstag</option>
                    <option value={2}>Mittwoch</option>
                    <option value={3}>Donnerstag</option>
                    <option value={4}>Freitag</option>
                    <option value={5}>Samstag</option>
                    <option value={6}>Sonntag</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Startzeit</label>
                    <input
                      type="time"
                      value={courseTimeForm.start_time}
                      onChange={(e) => setCourseTimeForm({ ...courseTimeForm, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Endzeit</label>
                    <input
                      type="time"
                      value={courseTimeForm.end_time}
                      onChange={(e) => setCourseTimeForm({ ...courseTimeForm, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rechtsgebiet</label>
                  <select
                    value={courseTimeForm.legal_area}
                    onChange={(e) => setCourseTimeForm({ ...courseTimeForm, legal_area: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="Zivilrecht">Zivilrecht</option>
                    <option value="Strafrecht">Strafrecht</option>
                    <option value="Öffentliches Recht">Öffentliches Recht</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung (optional)</label>
                  <input
                    type="text"
                    value={courseTimeForm.description}
                    onChange={(e) => setCourseTimeForm({ ...courseTimeForm, description: e.target.value })}
                    placeholder="z.B. Klausurenkurs, Grundkurs..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting-Link (optional)</label>
                  <input
                    type="url"
                    value={courseTimeForm.meeting_link}
                    onChange={(e) => setCourseTimeForm({ ...courseTimeForm, meeting_link: e.target.value })}
                    placeholder="https://zoom.us/j/... oder https://meet.google.com/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setShowCourseTimeModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Abbrechen
                </button>
                <button
                  onClick={async () => {
                    const data = {
                      weekday: courseTimeForm.weekday,
                      start_time: courseTimeForm.start_time,
                      end_time: courseTimeForm.end_time,
                      legal_area: courseTimeForm.legal_area,
                      description: courseTimeForm.description || null,
                      meeting_link: courseTimeForm.meeting_link || null
                    };
                    if (editingCourseTime) {
                      await supabase.from('elite_course_times').update(data).eq('id', editingCourseTime.id);
                    } else {
                      await supabase.from('elite_course_times').insert(data);
                    }
                    setShowCourseTimeModal(false);
                    fetchData();
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  <Save className="h-4 w-4 inline mr-1" />
                  {editingCourseTime ? 'Speichern' : 'Hinzufügen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dozent Zuweisung Modal */}
      {showDozentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDozentModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Dozent zuweisen</h3>
                <button onClick={() => setShowDozentModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rechtsgebiet</label>
                  <select value={newDozentLegalArea} onChange={(e) => setNewDozentLegalArea(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    <option value="">Bitte wählen...</option>
                    <option value="Zivilrecht">Zivilrecht</option>
                    <option value="Strafrecht">Strafrecht</option>
                    <option value="Öffentliches Recht">Öffentliches Recht</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dozent</label>
                  <select value={newDozentId} onChange={(e) => setNewDozentId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    <option value="">Bitte wählen...</option>
                    {allDozenten.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.email})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setShowDozentModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Abbrechen</button>
                <button onClick={handleAddDozentAssignment} disabled={!newDozentId || !newDozentLegalArea} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Plus className="h-4 w-4 inline mr-1" />Zuweisen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Einheit Bearbeiten Modal */}
      {showEditModal && editingRelease && (
        (() => {
        const isReadOnly = !canEditRelease(editingRelease);
        return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div className="fixed inset-0 bg-black/50" onClick={() => { setShowEditModal(false); setEditingRelease(null); }} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{isReadOnly ? 'Einheit ansehen (nur Lesezugriff)' : 'Einheit bearbeiten'}</h3>
                  <p className="text-sm text-gray-500 mt-1">{isReadOnly ? 'Details der' : 'Bearbeiten Sie die'} Unterrichtseinheit vom {editingRelease ? formatDate(editingRelease.release_date) : ''}</p>
                  <p className="text-xs text-gray-400 mt-0.5">ID: {editingRelease.id}</p>
                  {isReadOnly && <p className="text-xs text-orange-600 mt-1 font-medium">⚠️ Diese Einheit gehört nicht zu Ihren zugewiesenen Rechtsgebieten</p>}
                </div>
                <button onClick={() => { setShowEditModal(false); setEditingRelease(null); }} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className={`space-y-6 ${isReadOnly ? 'pointer-events-none opacity-60' : ''}`}>
                {/* Typ der Einheit */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-blue-900 mb-2">Typ der Einheit *</label>
                  <select 
                    value={releaseUnitType} 
                    onChange={(e) => handleUnitTypeChange(e.target.value as UnitType | '')} 
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    <option value="">Bitte wählen...</option>
                    <optgroup label="Unterricht">
                      <option value="unterricht_zivilrecht">Unterricht Zivilrecht ({formatDuration(unitDurations.zivilrecht_unterricht)})</option>
                      <option value="unterricht_strafrecht">Unterricht Strafrecht ({formatDuration(unitDurations.strafrecht_unterricht)})</option>
                      <option value="unterricht_oeffentliches_recht">Unterricht öffentliches Recht ({formatDuration(unitDurations.oeffentliches_recht_unterricht)})</option>
                    </optgroup>
                    <optgroup label="Wiederholungseinheit">
                      <option value="wiederholung_zivilrecht">Wiederholungseinheit Zivilrecht ({formatDuration(unitDurations.zivilrecht_wiederholung)})</option>
                      <option value="wiederholung_strafrecht">Wiederholungseinheit Strafrecht ({formatDuration(unitDurations.strafrecht_wiederholung)})</option>
                      <option value="wiederholung_oeffentliches_recht">Wiederholungseinheit öffentliches Recht ({formatDuration(unitDurations.oeffentliches_recht_wiederholung)})</option>
                    </optgroup>
                  </select>
                  {releaseUnitType && (
                    <p className="text-xs text-blue-700 mt-2">
                      Rechtsgebiet: <strong>{UNIT_TYPES[releaseUnitType].legalArea}</strong> | 
                      Dauer: <strong>{formatDuration(getUnitDurationFromSettings(unitDurations, releaseUnitType))}</strong>
                    </p>
                  )}
                </div>

                {/* Titel und Rechtsgebiet */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Titel der Einheit *</label>
                    <input 
                      type="text" 
                      value={releaseTitle} 
                      onChange={(e) => setReleaseTitle(e.target.value)} 
                      placeholder="z.B. Einheit 1 - BGB AT" 
                      disabled={isReadOnly}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                    <input 
                      type="date" 
                      value={selectedDate && !isNaN(selectedDate.getTime()) ? selectedDate.toISOString().split('T')[0] : editingRelease?.release_date || ''} 
                      onChange={(e) => setSelectedDate(new Date(e.target.value))} 
                      disabled={isReadOnly}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed" 
                    />
                  </div>
                </div>

                {/* Uhrzeit */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Startzeit</label>
                    <input 
                      type="time" 
                      value={releaseStartTime} 
                      onChange={(e) => handleStartTimeChange(e.target.value)} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Endzeit (automatisch)</label>
                    <input 
                      type="time" 
                      value={releaseEndTime} 
                      readOnly
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dauer</label>
                    <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
                      {releaseUnitType ? formatDuration(getUnitDurationFromSettings(unitDurations, releaseUnitType)) : '-'}
                    </div>
                  </div>
                </div>

                {/* Zoom Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zoom-Link</label>
                  <input 
                    type="url" 
                    value={releaseZoomLink} 
                    onChange={(e) => setReleaseZoomLink(e.target.value)} 
                    placeholder="https://zoom.us/j/..." 
                    disabled={isReadOnly}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed" 
                  />
                </div>

                {/* Klausur-Ordner Auswahl */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Welche Klausur wird besprochen?</label>
                  <select 
                    value={releaseKlausurFolderId} 
                    onChange={(e) => setReleaseKlausurFolderId(e.target.value)} 
                    disabled={isReadOnly || !releaseLegalArea}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">{releaseLegalArea ? 'Keine Klausur auswählen...' : 'Bitte zuerst Einheitstyp wählen...'}</option>
                    {releaseLegalArea && (() => {
                      const legalAreaFolder = folders.find(f => 
                        f.name.toLowerCase() === releaseLegalArea.toLowerCase() ||
                        f.name.toLowerCase().includes(releaseLegalArea.toLowerCase())
                      );
                      const level1Folders = legalAreaFolder 
                        ? folders.filter(f => f.parent_id === legalAreaFolder.id)
                        : [];
                      const result: JSX.Element[] = [];
                      level1Folders.forEach(l1Folder => {
                        const l2Children = folders.filter(f => f.parent_id === l1Folder.id);
                        if (l2Children.length > 0) {
                          result.push(
                            <optgroup key={l1Folder.id} label={l1Folder.name}>
                              {l2Children.map(l2Folder => (
                                <option key={l2Folder.id} value={l2Folder.id}>{l2Folder.name}</option>
                              ))}
                            </optgroup>
                          );
                        } else {
                          result.push(<option key={l1Folder.id} value={l1Folder.id}>{l1Folder.name}</option>);
                        }
                      });
                      return result;
                    })()}
                  </select>
                </div>

                {/* Dokumente aus Klausur-Ordner */}
                {releaseKlausurFolderId && (() => {
                  const directMaterials = materials.filter(m => m.folder_id === releaseKlausurFolderId);
                  const selectedFolder = folders.find(f => f.id === releaseKlausurFolderId);
                  
                  // Rekursive Funktion um alle Materialien aus einem Ordner und seinen Unterordnern zu holen
                  const getAllMaterialsFromFolder = (folderId: string): { material: TeachingMaterial; path: string[] }[] => {
                    const result: { material: TeachingMaterial; path: string[] }[] = [];
                    const folder = folders.find(f => f.id === folderId);
                    const folderName = folder?.name || 'Unbekannt';
                    
                    // Direkte Materialien
                    const direct = materials.filter(m => m.folder_id === folderId);
                    direct.forEach(m => result.push({ material: m, path: [folderName] }));
                    
                    // Rekursiv Unterordner
                    const children = folders.filter(f => f.parent_id === folderId);
                    for (const child of children) {
                      const childMaterials = getAllMaterialsFromFolder(child.id);
                      childMaterials.forEach(({ material, path }) => {
                        result.push({ material, path: [folderName, ...path] });
                      });
                    }
                    
                    return result;
                  };
                  
                  // Hole alle Materialien mit ihrem Pfad
                  const allNestedMaterials = getAllMaterialsFromFolder(releaseKlausurFolderId);
                  
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        📁 Dokumente aus: {selectedFolder?.name || 'Gewählter Ordner'}
                      </label>
                      <p className="text-xs text-blue-600 mb-3">
                        Wählen Sie die Dokumente aus, die Sie mit den Studenten teilen möchten.
                      </p>
                      
                      {directMaterials.length > 0 && (
                        <div className="border border-blue-200 rounded-lg max-h-48 overflow-y-auto bg-white mb-3">
                          {directMaterials.map(material => {
                            const isLoesung = material.title.toLowerCase().normalize('NFC').includes('lösung') || 
                                             material.title.toLowerCase().normalize('NFC').includes('loesung') ||
                                             material.title.toLowerCase().normalize('NFC').includes('musterlösung');
                            return (
                              <label key={material.id} className={`flex items-center p-3 hover:bg-blue-50 cursor-pointer border-b border-blue-100 last:border-0 ${isLoesung ? 'bg-yellow-50' : ''}`}>
                                <input 
                                  type="checkbox" 
                                  checked={releaseSolutionMaterialIds.includes(material.id)} 
                                  onChange={() => setReleaseSolutionMaterialIds(prev => 
                                    prev.includes(material.id) ? prev.filter(id => id !== material.id) : [...prev, material.id]
                                  )} 
                                  className={`h-4 w-4 ${isLoesung ? 'text-yellow-600 focus:ring-yellow-500' : 'text-blue-600 focus:ring-blue-500'} border-gray-300 rounded`}
                                />
                                <FileText className={`h-4 w-4 ml-3 ${isLoesung ? 'text-yellow-600' : 'text-blue-500'}`} />
                                <span className="ml-2 text-sm text-gray-900 flex-1">{material.title}</span>
                                {isLoesung && <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">Lösung</span>}
                              </label>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Unterordner mit Materialien (auch verschachtelte) */}
                      {(() => {
                        // Gruppiere Materialien nach ihrem direkten Unterordner (erster Pfad-Teil nach dem Hauptordner)
                        const subFolderGroups = new Map<string, { material: TeachingMaterial; path: string[] }[]>();
                        
                        allNestedMaterials.forEach(({ material, path }) => {
                          if (path.length > 1) {
                            // Dies ist ein Material aus einem Unterordner
                            const subFolderName = path[1]; // Erster Unterordner
                            if (!subFolderGroups.has(subFolderName)) {
                              subFolderGroups.set(subFolderName, []);
                            }
                            subFolderGroups.get(subFolderName)!.push({ material, path });
                          }
                        });
                        
                        if (subFolderGroups.size === 0) return null;
                        
                        return (
                          <div className="space-y-2">
                            {Array.from(subFolderGroups.entries()).map(([folderName, items]) => (
                              <div key={folderName} className="border border-green-200 rounded-lg bg-green-50">
                                <div className="p-2 border-b border-green-200 bg-green-100 rounded-t-lg">
                                  <div className="flex items-center">
                                    <FolderOpen className="h-4 w-4 text-green-600 mr-2" />
                                    <span className="text-sm font-medium text-green-800">{folderName}</span>
                                    <span className="ml-2 text-xs text-green-600">({items.length} Dateien)</span>
                                  </div>
                                </div>
                                <div className="max-h-32 overflow-y-auto">
                                  {items.map(({ material }) => (
                                    <label key={material.id} className="flex items-center p-2 hover:bg-green-100 cursor-pointer border-b border-green-100 last:border-0">
                                      <input 
                                        type="checkbox" 
                                        checked={releaseSolutionMaterialIds.includes(material.id)} 
                                        onChange={() => setReleaseSolutionMaterialIds(prev => 
                                          prev.includes(material.id) ? prev.filter(id => id !== material.id) : [...prev, material.id]
                                        )} 
                                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                      />
                                      <FileText className="h-4 w-4 ml-3 text-green-500" />
                                      <span className="ml-2 text-sm text-gray-900">{material.title}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      
                      {directMaterials.length === 0 && allNestedMaterials.filter(m => m.path.length > 1).length === 0 && (
                        <p className="p-3 text-sm text-gray-500 bg-white rounded-lg border border-blue-200">
                          Keine Dokumente in diesem Ordner vorhanden.
                        </p>
                      )}
                      
                      {releaseSolutionMaterialIds.length > 0 && (
                        <p className="text-xs text-blue-700 mt-2">✓ {releaseSolutionMaterialIds.length} Dokument(e) ausgewählt</p>
                      )}
                      
                      {/* Freigabetermin für Lösungen */}
                      {releaseSolutionMaterialIds.length > 0 && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <label className="block text-sm font-medium text-yellow-800 mb-2">Freigabetermin für Lösungen</label>
                          <div className="space-y-2">
                            <label className="flex items-center cursor-pointer">
                              <input 
                                type="radio" 
                                name="editSolutionReleaseMode" 
                                checked={solutionReleaseMode === 'auto'} 
                                onChange={() => setSolutionReleaseMode('auto')} 
                                className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300"
                              />
                              <span className="ml-2 text-sm text-gray-700">Automatisch nach Ende der Einheit ({releaseEndTime} Uhr)</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                              <input 
                                type="radio" 
                                name="editSolutionReleaseMode" 
                                checked={solutionReleaseMode === 'custom'} 
                                onChange={() => {
                                  setSolutionReleaseMode('custom');
                                  if (!customSolutionReleaseDate && selectedDate) {
                                    setCustomSolutionReleaseDate(selectedDate.toISOString().split('T')[0]);
                                  }
                                  if (!customSolutionReleaseTime) {
                                    setCustomSolutionReleaseTime(releaseEndTime);
                                  }
                                }} 
                                className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300"
                              />
                              <span className="ml-2 text-sm text-gray-700">Alternativer Freigabetermin</span>
                            </label>
                            
                            {solutionReleaseMode === 'custom' && (
                              <div className="ml-6 mt-2 grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Datum</label>
                                  <input 
                                    type="date" 
                                    value={customSolutionReleaseDate} 
                                    onChange={(e) => setCustomSolutionReleaseDate(e.target.value)} 
                                    className="w-full px-2 py-1.5 text-sm border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Uhrzeit</label>
                                  <input 
                                    type="time" 
                                    value={customSolutionReleaseTime} 
                                    onChange={(e) => setCustomSolutionReleaseTime(e.target.value)} 
                                    className="w-full px-2 py-1.5 text-sm border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Beschreibung */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung (optional)</label>
                  <textarea 
                    value={releaseDescription} 
                    onChange={(e) => setReleaseDescription(e.target.value)} 
                    placeholder="Zusätzliche Informationen zur Einheit..." 
                    rows={2} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                  />
                </div>

                {/* Zusammenfassung */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Zusammenfassung</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>Typ: <strong>{releaseUnitType ? UNIT_TYPES[releaseUnitType].label : '-'}</strong></div>
                    <div>Rechtsgebiet: <strong>{releaseLegalArea || '-'}</strong></div>
                    <div>Zeit: <strong>{releaseStartTime} - {releaseEndTime}</strong></div>
                    <div>Dauer: <strong>{releaseUnitType ? formatDuration(getUnitDurationFromSettings(unitDurations, releaseUnitType)) : '-'}</strong></div>
                    {releaseKlausurFolderId && <div className="col-span-2">Klausur: <strong>{folders.find(f => f.id === releaseKlausurFolderId)?.name || '-'}</strong></div>}
                    {releaseSolutionMaterialIds.length > 0 && <div className="col-span-2">Lösungen (nach Termin): <strong>{releaseSolutionMaterialIds.length} Dateien</strong></div>}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-3">
                {!isReadOnly && (
                  <button 
                    onClick={() => {
                      if (editingRelease) {
                        setShowEditModal(false);
                        if (isAdmin) {
                          openDeleteModal(editingRelease);
                        } else {
                          openRescheduleModal(editingRelease);
                        }
                      }
                    }} 
                    className={`px-4 py-2 rounded-lg flex items-center justify-center ${isAdmin ? 'text-red-700 bg-red-100 hover:bg-red-200' : 'text-orange-700 bg-orange-100 hover:bg-orange-200'}`}
                  >
                    {isAdmin ? (
                      <>
                        <X className="h-4 w-4 mr-1" />
                        Absagen / Löschen
                      </>
                    ) : (
                      <>
                        <Calendar className="h-4 w-4 mr-1" />
                        Verschieben
                      </>
                    )}
                  </button>
                )}
                {isReadOnly && <div></div>}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => { setShowEditModal(false); setEditingRelease(null); }} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                    {isReadOnly ? 'Schließen' : 'Abbrechen'}
                  </button>
                  {!isReadOnly && (
                    <button 
                      onClick={handleUpdateRelease} 
                      disabled={!releaseTitle.trim() || !releaseUnitType} 
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="h-4 w-4 inline mr-1" />
                      Änderungen speichern
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        );
        })()
      )}

      {/* Support Tab */}
      {activeSubTab === 'support' && (
        <div className="space-y-6">
          {/* Admin Dropdown für FAQ/Videos */}
          {isAdmin && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Support-Bereich verwalten</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={supportActiveSection}
                    onChange={(e) => setSupportActiveSection(e.target.value as 'faq' | 'videos')}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                  >
                    <option value="faq">FAQ bearbeiten</option>
                    <option value="videos">Videos bearbeiten</option>
                  </select>
                  <button
                    onClick={supportActiveSection === 'faq' ? openCreateFaqModal : openCreateVideoModal}
                    className="inline-flex items-center px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {supportActiveSection === 'faq' ? 'FAQ hinzufügen' : 'Video hinzufügen'}
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Wählen Sie aus dem Dropdown, ob Sie Fragen & Antworten oder Videos verwalten möchten.
              </p>
            </div>
          )}

          {/* FAQ Section */}
          {supportActiveSection === 'faq' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  Häufig gestellte Fragen
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Antworten auf die wichtigsten Fragen zur Elite-Kleingruppe
                </p>
              </div>
              {faqs.length === 0 ? (
                <div className="p-8 text-center">
                  <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Noch keine FAQs vorhanden</h4>
                  <p className="text-gray-500">
                    {isAdmin 
                      ? 'Fügen Sie FAQs hinzu, um Teilnehmern schnell Antworten zu geben.'
                      : 'Der Support-Bereich wird bald mit Inhalten gefüllt.'
                    }
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {faqs.map((faq) => (
                    <div key={faq.id} className="p-4">
                      <button
                        onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                        className="w-full flex items-start justify-between text-left"
                      >
                        <div className="flex-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 mb-2">
                            {faq.category}
                          </span>
                          <h4 className="text-sm font-medium text-gray-900">{faq.question}</h4>
                        </div>
                        {expandedFaq === faq.id ? (
                          <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                        )}
                      </button>
                      {expandedFaq === faq.id && (
                        <div className="mt-3 pl-0">
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{faq.answer}</p>
                          {isAdmin && (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={() => openEditFaqModal(faq)}
                                className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                <Edit2 className="h-3 w-3 mr-1" />
                                Bearbeiten
                              </button>
                              <button
                                onClick={() => handleDeleteFaq(faq.id)}
                                className="inline-flex items-center px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Löschen
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Videos Section */}
          {supportActiveSection === 'videos' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  Hilfsvideos
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Videos mit Anleitungen und Erklärungen für die Elite-Kleingruppe
                </p>
              </div>
              {videos.length === 0 ? (
                <div className="p-8 text-center">
                  <Video className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Noch keine Videos vorhanden</h4>
                  <p className="text-gray-500">
                    {isAdmin 
                      ? 'Fügen Sie Videos hinzu, um Teilnehmern visuelle Anleitungen zu geben.'
                      : 'Der Video-Bereich wird bald mit Inhalten gefüllt.'
                    }
                  </p>
                </div>
              ) : (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map((video) => {
                    const { type, embedUrl } = getEmbedUrl(video.video_url);
                    return (
                      <div key={video.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                        <div className="aspect-video bg-gray-900 relative">
                          {type === 'iframe' ? (
                            <iframe
                              src={embedUrl}
                              className="w-full h-full"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : (
                            <video
                              src={embedUrl}
                              className="w-full h-full object-contain"
                              controls
                              preload="metadata"
                            />
                          )}
                        </div>
                        <div className="p-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 mb-2">
                            {video.category}
                          </span>
                          <h4 className="text-sm font-medium text-gray-900 mb-1">{video.title}</h4>
                          {video.description && (
                            <p className="text-xs text-gray-500 line-clamp-2">{video.description}</p>
                          )}
                          {isAdmin && (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={() => openEditVideoModal(video)}
                                className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                <Edit2 className="h-3 w-3 mr-1" />
                                Bearbeiten
                              </button>
                              <button
                                onClick={() => handleDeleteVideo(video.id)}
                                className="inline-flex items-center px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Löschen
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FAQ Modal */}
      {showFaqModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowFaqModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingFaq ? 'FAQ bearbeiten' : 'Neue FAQ hinzufügen'}
                </h3>
                <button onClick={() => setShowFaqModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                  <select
                    value={faqForm.category}
                    onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="Allgemein">Allgemein</option>
                    <option value="Einheiten">Einheiten</option>
                    <option value="Klausuren">Klausuren</option>
                    <option value="Materialien">Materialien</option>
                    <option value="Technisch">Technisch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frage *</label>
                  <input
                    type="text"
                    value={faqForm.question}
                    onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                    placeholder="z.B. Wie melde ich mich zu einer Einheit an?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Antwort *</label>
                  <textarea
                    value={faqForm.answer}
                    onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                    placeholder="Antwort auf die Frage..."
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setShowFaqModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveFaq}
                  disabled={!faqForm.question.trim() || !faqForm.answer.trim()}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 inline mr-1" />
                  {editingFaq ? 'Aktualisieren' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowVideoModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingVideo ? 'Video bearbeiten' : 'Neues Video hinzufügen'}
                </h3>
                <button onClick={() => setShowVideoModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                  <select
                    value={videoForm.category}
                    onChange={(e) => setVideoForm({ ...videoForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="Allgemein">Allgemein</option>
                    <option value="Einheiten">Einheiten</option>
                    <option value="Klausuren">Klausuren</option>
                    <option value="Materialien">Materialien</option>
                    <option value="Technisch">Technisch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                  <input
                    type="text"
                    value={videoForm.title}
                    onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                    placeholder="z.B. So funktioniert die Klausurenkorrektur"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                  <textarea
                    value={videoForm.description}
                    onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                    placeholder="Kurze Beschreibung des Videos..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {videoFile ? 'Video-Datei hochladen' : 'Video-URL oder Datei hochladen *'}
                  </label>
                  {videoFile ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Video className="h-5 w-5 text-green-600 mr-2" />
                          <span className="text-sm text-green-800">{videoFile.name}</span>
                        </div>
                        <button
                          onClick={() => setVideoFile(null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="url"
                        value={videoForm.video_url}
                        onChange={(e) => setVideoForm({ ...videoForm, video_url: e.target.value })}
                        placeholder="https://... oder Video-Datei auswählen"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <label className="flex items-center justify-center w-full h-24 border-2 border-gray-200 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex flex-col items-center justify-center">
                          <Upload className="h-6 w-6 text-gray-400 mb-1" />
                          <span className="text-sm text-gray-500">Video-Datei hochladen</span>
                          <span className="text-xs text-gray-400">MP4, WebM, etc.</span>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="video/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setVideoFile(file);
                              if (!videoForm.title) {
                                setVideoForm({ ...videoForm, title: file.name.replace(/\.[^/.]+$/, '') });
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => { setShowVideoModal(false); setVideoFile(null); }} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveVideo}
                  disabled={(!videoForm.video_url.trim() && !videoFile) || !videoForm.title.trim() || isUploadingVideo}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {isUploadingVideo ? (
                    <>
                      <span className="inline-block h-4 w-4 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Wird hochgeladen...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 inline mr-1" />
                      {editingVideo ? 'Aktualisieren' : 'Speichern'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teilnehmer Tab */}
      {activeSubTab === 'teilnehmer' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Teilnehmerübersicht
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Alle Teilnehmer der Elite-Kleingruppe mit ihren wichtigsten Informationen
              </p>
            </div>
            
            {teilnehmer.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Keine Teilnehmer vorhanden</h4>
                <p className="text-gray-500">
                  Es wurden noch keine Teilnehmer für diese Elite-Kleingruppe registriert.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        E-Mail
                      </th>
                      <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Landesrecht
                      </th>
                      {isAdmin && (
                        <th scope="col" className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Aktionen
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {teilnehmer.map((t) => {
                      const initials = t.full_name
                        ? t.full_name.split(' ')
                            .map((n: string) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)
                        : (t.name
                            ? t.name.split(' ')
                                .map((n: string) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)
                            : '??');

                      return (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-primary font-medium">{initials}</span>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {t.full_name || t.name || 'Unbekannt'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{t.email}</div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {t.state_law || '-'}
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                {t.zoom_background_url && (() => {
                                  try {
                                    const urls = JSON.parse(t.zoom_background_url);
                                    const count = Array.isArray(urls) ? urls.length : 1;
                                    return (
                                      <button
                                        onClick={() => {
                                          setSelectedTeilnehmerForBg(t);
                                          setExistingBackgrounds(Array.isArray(urls) ? urls : [urls]);
                                          setShowManageBgModal(true);
                                        }}
                                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors cursor-pointer"
                                      >
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        {count} Hintergrund{count > 1 ? 'e' : ''}
                                      </button>
                                    );
                                  } catch {
                                    return (
                                      <button
                                        onClick={() => {
                                          setSelectedTeilnehmerForBg(t);
                                          setExistingBackgrounds(t.zoom_background_url ? [t.zoom_background_url] : []);
                                          setShowManageBgModal(true);
                                        }}
                                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors cursor-pointer"
                                      >
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        1 Hintergrund
                                      </button>
                                    );
                                  }
                                })()}
                                <button
                                  onClick={() => {
                                    setSelectedTeilnehmerForBg(t);
                                    setShowZoomBgModal(true);
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                                  title="Zoom-Hintergrund hochladen"
                                >
                                  <Upload className="h-4 w-4 mr-1" />
                                  {t.zoom_background_url ? 'Weitere hinzufügen' : 'Zoom-Hintergrund'}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zoom Background Upload Modal */}
      {showZoomBgModal && selectedTeilnehmerForBg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Zoom-Hintergrund hochladen
                </h3>
                <button
                  onClick={() => {
                    setShowZoomBgModal(false);
                    setZoomBgFiles([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">
                  {selectedTeilnehmerForBg.full_name || selectedTeilnehmerForBg.name}
                </p>
                <p className="text-xs text-gray-500">{selectedTeilnehmerForBg.email}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hintergrundbilder auswählen (mehrere möglich)
                  </label>
                  
                  {/* File Upload Area */}
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-200 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors mb-4">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      <p className="mb-1 text-sm text-gray-500">
                        <span className="font-semibold">Klicken zum Hochladen</span> oder Drag & Drop
                      </p>
                      <p className="text-xs text-gray-400">PNG, JPG oder JPEG (max. 10MB pro Datei)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg,image/jpg"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const validFiles = files.filter(file => {
                          if (file.size > 10 * 1024 * 1024) {
                            alert(`${file.name} ist zu groß. Maximal 10MB erlaubt.`);
                            return false;
                          }
                          return true;
                        });
                        setZoomBgFiles(prev => [...prev, ...validFiles]);
                      }}
                    />
                  </label>

                  {/* Preview of selected files */}
                  {zoomBgFiles.length > 0 && (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {zoomBgFiles.map((file, index) => (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-green-600 mr-2" />
                              <span className="text-sm text-green-800">{file.name}</span>
                            </div>
                            <button
                              onClick={() => setZoomBgFiles(prev => prev.filter((_, i) => i !== index))}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {file.type.startsWith('image/') && (
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Vorschau ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <Info className="h-4 w-4 inline mr-1" />
                    Die Zoom-Hintergründe werden nur diesem Teilnehmer in seinem Dashboard angezeigt.
                  </p>
                  {zoomBgFiles.length > 0 && (
                    <p className="text-xs text-blue-800 mt-1">
                      {zoomBgFiles.length} Datei(en) ausgewählt
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowZoomBgModal(false);
                    setZoomBgFiles([]);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Abbrechen
                </button>
                <button
                  onClick={async () => {
                    if (zoomBgFiles.length === 0 || !selectedTeilnehmerForBg) return;
                    
                    setIsUploadingZoomBg(true);
                    try {
                      const uploadedUrls: string[] = [];

                      // Upload all files
                      for (const file of zoomBgFiles) {
                        console.log('📤 Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
                        
                        const fileExt = file.name.split('.').pop()?.toLowerCase();
                        const fileName = `zoom_bg_${selectedTeilnehmerForBg.id}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                        const filePath = fileName;

                        // Determine correct content type from file extension
                        let contentType = 'image/png';
                        if (fileExt === 'jpg' || fileExt === 'jpeg') {
                          contentType = 'image/jpeg';
                        } else if (fileExt === 'png') {
                          contentType = 'image/png';
                        } else if (fileExt === 'webp') {
                          contentType = 'image/webp';
                        }

                        console.log('📁 Upload path:', filePath, 'Content-Type:', contentType);

                        // Get auth token
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) {
                          throw new Error('No active session');
                        }

                        // Upload directly via REST API to avoid multipart form data corruption
                        const uploadUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/zoom-backgrounds/${filePath}`;
                        console.log('📡 Uploading via REST API to:', uploadUrl);

                        const uploadResponse = await fetch(uploadUrl, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${session.access_token}`,
                            'Content-Type': contentType,
                            'x-upsert': 'false'
                          },
                          body: file
                        });

                        if (!uploadResponse.ok) {
                          const errorText = await uploadResponse.text();
                          console.error('❌ Upload error:', uploadResponse.status, errorText);
                          throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
                        }

                        const uploadData = await uploadResponse.json();
                        console.log('✅ Upload successful:', uploadData);

                        const { data: { publicUrl } } = supabase.storage
                          .from('zoom-backgrounds')
                          .getPublicUrl(filePath);

                        console.log('🔗 Public URL:', publicUrl);
                        uploadedUrls.push(publicUrl);
                      }

                      // Get existing URLs and append new ones
                      console.log('📋 Fetching existing URLs for teilnehmer:', selectedTeilnehmerForBg.id);
                      const { data: existingData } = await supabase
                        .from('teilnehmer')
                        .select('zoom_background_url')
                        .eq('id', selectedTeilnehmerForBg.id)
                        .single();

                      console.log('📋 Existing data:', existingData);

                      let allUrls = uploadedUrls;
                      if (existingData?.zoom_background_url) {
                        try {
                          const existing = JSON.parse(existingData.zoom_background_url);
                          if (Array.isArray(existing)) {
                            allUrls = [...existing, ...uploadedUrls];
                          }
                        } catch {
                          // If it's a single URL string, convert to array
                          allUrls = [existingData.zoom_background_url, ...uploadedUrls];
                        }
                      }

                      console.log('💾 Saving URLs to database:', allUrls);
                      console.log('💾 JSON stringified:', JSON.stringify(allUrls));

                      const { error: updateError } = await supabase
                        .from('teilnehmer')
                        .update({ zoom_background_url: JSON.stringify(allUrls) })
                        .eq('id', selectedTeilnehmerForBg.id);

                      if (updateError) {
                        console.error('❌ Database update error:', updateError);
                        throw updateError;
                      }

                      console.log('✅ Database updated successfully!');

                      alert(`${zoomBgFiles.length} Zoom-Hintergrund(e) erfolgreich hochgeladen!`);
                      setShowZoomBgModal(false);
                      setZoomBgFiles([]);
                      await fetchData();
                    } catch (error: any) {
                      console.error('Error uploading zoom backgrounds:', error);
                      alert('Fehler beim Hochladen: ' + error.message);
                    } finally {
                      setIsUploadingZoomBg(false);
                    }
                  }}
                  disabled={zoomBgFiles.length === 0 || isUploadingZoomBg}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {isUploadingZoomBg ? (
                    <>
                      <span className="inline-block h-4 w-4 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Wird hochgeladen...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 inline mr-1" />
                      Hochladen
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Existing Backgrounds Modal */}
      {showManageBgModal && selectedTeilnehmerForBg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Zoom-Hintergründe verwalten
                </h3>
                <button
                  onClick={() => setShowManageBgModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">
                  {selectedTeilnehmerForBg.full_name || selectedTeilnehmerForBg.name}
                </p>
                <p className="text-xs text-gray-500">{selectedTeilnehmerForBg.email}</p>
              </div>

              {existingBackgrounds.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Keine Hintergründe vorhanden</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    {existingBackgrounds.length} Hintergrund{existingBackgrounds.length > 1 ? 'e' : ''} hochgeladen
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {existingBackgrounds.map((url, index) => (
                      <div key={index} className="relative group">
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center min-h-[192px]">
                          <div className="text-center p-4">
                            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600 font-medium mb-1">Zoom-Hintergrund {index + 1}</p>
                            <p className="text-xs text-gray-500 break-all">{url.split('/').pop()}</p>
                          </div>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 text-sm flex items-center gap-1"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </a>
                            <button
                              onClick={async () => {
                                if (!confirm('Möchten Sie diesen Hintergrund wirklich löschen?')) return;
                                
                                try {
                                  const updatedBackgrounds = existingBackgrounds.filter((_, i) => i !== index);
                                  
                                  const { error } = await supabase
                                    .from('teilnehmer')
                                    .update({ 
                                      zoom_background_url: updatedBackgrounds.length > 0 
                                        ? JSON.stringify(updatedBackgrounds) 
                                        : null 
                                    })
                                    .eq('id', selectedTeilnehmerForBg.id);

                                  if (error) throw error;

                                  setExistingBackgrounds(updatedBackgrounds);
                                  await fetchData();
                                  
                                  if (updatedBackgrounds.length === 0) {
                                    setShowManageBgModal(false);
                                  }
                                  
                                  alert('Hintergrund erfolgreich gelöscht!');
                                } catch (error: any) {
                                  console.error('Error deleting background:', error);
                                  alert('Fehler beim Löschen: ' + error.message);
                                }
                              }}
                              className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm flex items-center gap-1"
                            >
                              <Trash2 className="h-4 w-4" />
                              Löschen
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-center">
                          Hintergrund {index + 1}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => {
                    setShowManageBgModal(false);
                    setShowZoomBgModal(true);
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 inline mr-1" />
                  Weitere hinzufügen
                </button>
                <button
                  onClick={() => setShowManageBgModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
