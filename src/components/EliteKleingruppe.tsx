import { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

// Einheitstypen mit automatischer Dauer (in Minuten)
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
}

type SubTab = 'einheiten' | 'klausuren' | 'kommunikation' | 'kurszeiten';

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
}

export function EliteKleingruppe({ isAdmin = true }: EliteKleingruppeProps) {
  const { user } = useAuthStore();
  const [dozentLegalAreas, setDozentLegalAreas] = useState<string[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('einheiten');
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

  useEffect(() => {
    fetchData();
    if (!isAdmin && user) {
      fetchDozentLegalAreas();
    }
  }, [user, isAdmin]);

  const fetchDozentLegalAreas = async () => {
    if (!user) return;
    const { data } = await supabase.from('elite_kleingruppe_dozenten').select('legal_area').eq('dozent_id', user.id);
    setDozentLegalAreas((data || []).map(d => d.legal_area));
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: materialsData } = await supabase.from('teaching_materials').select('*').eq('is_active', true).order('title');
      setMaterials(materialsData || []);
      const { data: foldersData } = await supabase.from('material_folders').select('*').eq('is_active', true).order('name');
      setFolders(foldersData || []);
      const { data: releasesData } = await supabase.from('elite_kleingruppe_releases').select('*').order('release_date', { ascending: true });
      setScheduledReleases(releasesData || []);
      const { data: teilnehmerData } = await supabase.from('teilnehmer').select('id, name, email').eq('elite_kleingruppe', true).order('name');
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

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatDateTime = (dateString: string) => new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Korrigiert</span>;
      case 'in_review': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />In Bearbeitung</span>;
      default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><AlertCircle className="h-3 w-3 mr-1" />Ausstehend</span>;
    }
  };

  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => { const day = new Date(year, month, 1).getDay(); return day === 0 ? 6 : day - 1; };
  const getReleasesForDate = (date: Date) => { 
    // Use local date string to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return scheduledReleases.filter(r => {
      // Exact match for single-day entries
      if (!r.end_date) {
        return r.release_date === dateStr;
      }
      // For date ranges, check if date falls within the range (inclusive)
      return dateStr >= r.release_date && dateStr <= r.end_date;
    }); 
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
      // Automatisch Endzeit berechnen
      const endTime = calculateEndTime(releaseStartTime, unitConfig.duration);
      setReleaseEndTime(endTime);
      // Automatisch Zoom-Link des zugewiesenen Dozenten laden
      const assignment = dozentAssignments.find(a => a.legal_area === unitConfig.legalArea);
      if (assignment?.zoom_link) {
        setReleaseZoomLink(assignment.zoom_link);
      }
    }
  };

  const handleStartTimeChange = (time: string) => {
    setReleaseStartTime(time);
    if (releaseUnitType && UNIT_TYPES[releaseUnitType]) {
      const endTime = calculateEndTime(time, UNIT_TYPES[releaseUnitType].duration);
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
        duration_minutes: releaseUnitType ? UNIT_TYPES[releaseUnitType].duration : null,
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
        end_date: isDateRange && releaseEndDate ? releaseEndDate : null
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

  const handleDeleteRelease = async (release: ScheduledRelease) => {
    if (!confirm(`Möchten Sie die Einheit "${release.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    try {
      await supabase.from('elite_kleingruppe_releases').delete().eq('id', release.id);
      setExpandedRelease(null);
      fetchData();
    } catch (error) { console.error('Error deleting release:', error); }
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
    
    try {
      const updateData = {
        release_date: selectedDate.toISOString().split('T')[0],
        title: releaseTitle,
        description: releaseDescription || null,
        material_ids: selectedMaterials,
        folder_ids: selectedFolders,
        legal_area: releaseLegalArea || null,
        unit_type: releaseUnitType || null,
        duration_minutes: releaseUnitType ? UNIT_TYPES[releaseUnitType as UnitType]?.duration : null,
        start_time: releaseStartTime || null,
        end_time: releaseEndTime || null,
        zoom_link: releaseZoomLink || null,
        klausur_folder_id: releaseKlausurFolderId || null,
        solution_material_ids: releaseSolutionMaterialIds,
        solution_release_date: solutionReleaseMode === 'custom' && customSolutionReleaseDate ? customSolutionReleaseDate : null,
        solution_release_time: solutionReleaseMode === 'custom' && customSolutionReleaseTime ? customSolutionReleaseTime : null,
      };

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

  const openKorrekturModal = (klausur: Klausur) => {
    setSelectedKlausur(klausur);
    setKorrekturScore(klausur.score?.toString() || '');
    setKorrekturFeedback(klausur.feedback || '');
    setKorrekturFile(null);
    setKorrekturExcelFile(null);
    setKorrekturDuration('0.5');
    setShowKorrekturModal(true);
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
      await supabase.from('elite_kleingruppe_dozenten').insert({ dozent_id: newDozentId, legal_area: newDozentLegalArea });
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

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);
    const days = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < firstDay; i++) days.push(<div key={"empty-" + i} className="h-24 bg-gray-50"></div>);
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
              
              return (
                <div key={release.id} className={`text-xs px-1.5 py-0.5 rounded truncate ${bgColor} ${textColor}`} title={release.title}>
                  {release.is_released ? <Unlock className="h-3 w-3 inline mr-1" /> : <Lock className="h-3 w-3 inline mr-1" />}
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
  };

  if (isLoading) return <div className="flex justify-center items-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Elite-Kleingruppe</h2>
          <p className="text-sm text-gray-500 mt-1">Jahreskurs: Materialfreigabe nach Einheiten, Klausurenkorrekturen und Kommunikation</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{teilnehmer.length} Teilnehmer</span>
          <span className="text-sm text-gray-500">{scheduledReleases.length} Einheiten geplant</span>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setActiveSubTab('einheiten')} className={(activeSubTab === 'einheiten' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300') + ' whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center'}><Calendar className="h-4 w-4 mr-2" />Einheiten & Materialfreigabe</button>
          <button onClick={() => setActiveSubTab('klausuren')} className={(activeSubTab === 'klausuren' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300') + ' whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center'}><PenTool className="h-4 w-4 mr-2" />Klausurenkorrekturen</button>
          <button onClick={() => setActiveSubTab('kommunikation')} className={(activeSubTab === 'kommunikation' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300') + ' whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center'}><MessageSquare className="h-4 w-4 mr-2" />Kommunikation</button>
          <button onClick={() => setActiveSubTab('kurszeiten')} className={(activeSubTab === 'kurszeiten' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300') + ' whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center'}><Clock className="h-4 w-4 mr-2" />Kurszeiten</button>
        </nav>
      </div>

      {activeSubTab === 'einheiten' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <button onClick={() => { if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(calendarYear - 1); } else { setCalendarMonth(calendarMonth - 1); } }} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
                <h3 className="text-lg font-semibold text-gray-900">{monthNames[calendarMonth]} {calendarYear}</h3>
                <button onClick={() => { if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1); } else { setCalendarMonth(calendarMonth + 1); } }} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="h-5 w-5" /></button>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="flex items-center"><span className="w-3 h-3 rounded bg-green-100 mr-1"></span>Freigegeben</span>
                <span className="flex items-center"><span className="w-3 h-3 rounded bg-yellow-100 mr-1"></span>Geplant</span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
              {dayNames.map(day => <div key={day} className="bg-gray-100 py-2 text-center text-sm font-medium text-gray-700">{day}</div>)}
              {renderCalendar()}
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
            {(() => {
              const einheitenReleases = scheduledReleases.filter(r => r.event_type === 'einheit' && (legalAreaFilter === 'alle' || r.legal_area === legalAreaFilter));
              if (einheitenReleases.length === 0) {
                return <div className="p-8 text-center"><Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" /><h4 className="text-lg font-medium text-gray-900 mb-2">Keine Einheiten geplant</h4><p className="text-gray-500">Klicken Sie auf ein Datum im Kalender, um Materialien für eine Einheit freizugeben.</p></div>;
              }
              return (
                <ul className="divide-y divide-gray-200">
                  {einheitenReleases.map(release => (
                  <li key={release.id} className="p-4">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedRelease(expandedRelease === release.id ? null : release.id)}>
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
                        <div className="ml-4"><h4 className="text-sm font-medium text-gray-900">{release.title}</h4><p className="text-xs text-gray-500">{formatDate(release.release_date)} - {release.material_ids.length} Materialien, {release.folder_ids.length} Ordner{release.legal_area && <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                          release.legal_area === 'Zivilrecht' ? 'bg-blue-100 text-blue-700' :
                          release.legal_area === 'Strafrecht' ? 'bg-red-100 text-red-700' :
                          release.legal_area === 'Öffentliches Recht' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{release.legal_area}</span>}</p></div>
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
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); openEditReleaseModal(release); }} className="inline-flex items-center px-3 py-1.5 rounded text-sm bg-blue-100 text-blue-700 hover:bg-blue-200">
                            <Edit2 className="h-4 w-4 mr-1" />Bearbeiten
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleToggleRelease(release); }} className={"inline-flex items-center px-3 py-1.5 rounded text-sm " + (release.is_released ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200')}>{release.is_released ? <><Lock className="h-4 w-4 mr-1" />Sperren</> : <><Unlock className="h-4 w-4 mr-1" />Jetzt freigeben</>}</button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteRelease(release); }} className="inline-flex items-center px-3 py-1.5 rounded text-sm bg-red-100 text-red-700 hover:bg-red-200">
                            <Trash2 className="h-4 w-4 mr-1" />Löschen
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                  ))}
                </ul>
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
              const sonstigesReleases = scheduledReleases.filter(r => r.event_type !== 'einheit');
              if (sonstigesReleases.length === 0) {
                return <div className="p-8 text-center text-gray-500">Keine weiteren Ereignisse geplant</div>;
              }
              return (
                <ul className="divide-y divide-gray-200">
                  {sonstigesReleases.map(release => {
                    const eventTypeConfig = {
                      'ferien': { icon: '🌞', label: 'Ferien', color: 'bg-orange-100 text-orange-800' },
                      'dozent_verhinderung': { icon: '🚫', label: 'Dozent verhindert', color: 'bg-red-100 text-red-800' },
                      'sonstiges': { icon: '📝', label: 'Sonstiges', color: 'bg-gray-100 text-gray-800' }
                    };
                    const config = eventTypeConfig[release.event_type as keyof typeof eventTypeConfig] || eventTypeConfig['sonstiges'];
                    
                    return (
                      <li key={release.id} className="p-4">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedRelease(expandedRelease === release.id ? null : release.id)}>
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
                            <div className="flex items-center gap-2">
                              <button onClick={(e) => { e.stopPropagation(); openEditReleaseModal(release); }} className="inline-flex items-center px-3 py-1.5 rounded text-sm bg-blue-100 text-blue-700 hover:bg-blue-200">
                                <Edit2 className="h-4 w-4 mr-1" />Bearbeiten
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleToggleRelease(release); }} className={`inline-flex items-center px-3 py-1.5 rounded text-sm ${release.is_released ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                                {release.is_released ? <><Lock className="h-4 w-4 mr-1" />Deaktivieren</> : <><Unlock className="h-4 w-4 mr-1" />Aktivieren</>}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteRelease(release); }} className="inline-flex items-center px-3 py-1.5 rounded text-sm bg-red-100 text-red-700 hover:bg-red-200">
                                <Trash2 className="h-4 w-4 mr-1" />Löschen
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
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
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedKlausur(expandedKlausur === klausur.id ? null : klausur.id)}>
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <PenTool className="h-5 w-5 text-primary" />
                        </div>
                        <div className="ml-4">
                          <h4 className="text-sm font-medium text-gray-900">{klausur.title}</h4>
                          <p className="text-xs text-gray-500">
                            {klausur.teilnehmer_name}
                            <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{klausur.legal_area}</span>
                            {getDozentForLegalArea(klausur.legal_area) && (
                              <span className="ml-2 text-gray-400">→ {getDozentForLegalArea(klausur.legal_area)}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {getStatusBadge(klausur.status)}
                        <span className="text-xs text-gray-500">{formatDateTime(klausur.submitted_at)}</span>
                        {expandedKlausur === klausur.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </div>
                    {expandedKlausur === klausur.id && (
                      <div className="mt-4 pl-14 space-y-4">
                        <div className="flex items-center space-x-4">
                          <a href={klausur.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
                            <Download className="h-4 w-4 mr-1" />Klausur herunterladen
                          </a>
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
                      <option value="unterricht_zivilrecht">Unterricht Zivilrecht (2 Std 30 Min)</option>
                      <option value="unterricht_strafrecht">Unterricht Strafrecht (2 Std)</option>
                      <option value="unterricht_oeffentliches_recht">Unterricht öffentliches Recht (2 Std)</option>
                    </optgroup>
                    <optgroup label="Wiederholungseinheit">
                      <option value="wiederholung_zivilrecht">Wiederholungseinheit Zivilrecht (2 Std 30 Min)</option>
                      <option value="wiederholung_strafrecht">Wiederholungseinheit Strafrecht (1 Std 40 Min)</option>
                      <option value="wiederholung_oeffentliches_recht">Wiederholungseinheit öffentliches Recht (1 Std 10 Min)</option>
                    </optgroup>
                  </select>
                  {releaseUnitType && (
                    <p className="text-xs text-blue-700 mt-2">
                      Rechtsgebiet: <strong>{UNIT_TYPES[releaseUnitType].legalArea}</strong> | 
                      Dauer: <strong>{formatDuration(UNIT_TYPES[releaseUnitType].duration)}</strong>
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
                      {releaseUnitType ? formatDuration(UNIT_TYPES[releaseUnitType].duration) : '-'}
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

                {/* Alle folgenden Felder nur bei Einheiten */}
                {releaseEventType === 'einheit' && (
                  <>
                    {/* Zoom Link */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Zoom-Link</label>
                      <input 
                        type="url" 
                        value={releaseZoomLink} 
                        onChange={(e) => setReleaseZoomLink(e.target.value)} 
                        placeholder="https://zoom.us/j/..." 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                      />
                      {releaseZoomLink && (
                        <p className="text-xs text-green-600 mt-1">✓ Zoom-Link wird automatisch vom zugewiesenen Dozenten übernommen</p>
                      )}
                    </div>

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
                  // Materialien direkt im gewählten Ordner
                  const directMaterials = materials.filter(m => m.folder_id === releaseKlausurFolderId);
                  // Finde den Ordnernamen
                  const selectedFolder = folders.find(f => f.id === releaseKlausurFolderId);
                  
                  // Finde Unterordner (z.B. "Zusatzmaterial") und deren Materialien
                  const subFolders = folders.filter(f => f.parent_id === releaseKlausurFolderId);
                  const subFolderMaterials = subFolders.flatMap(sf => 
                    materials.filter(m => m.folder_id === sf.id).map(m => ({ ...m, folderName: sf.name }))
                  );
                  
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        📁 Dokumente aus: {selectedFolder?.name || 'Gewählter Ordner'}
                      </label>
                      <p className="text-xs text-blue-600 mb-3">
                        Wählen Sie die Dokumente aus, die Sie mit den Studenten teilen möchten.
                      </p>
                      
                      {/* Direkte Materialien im Ordner */}
                      {directMaterials.length > 0 && (
                        <div className="border border-blue-200 rounded-lg max-h-48 overflow-y-auto bg-white mb-3">
                          {directMaterials.map(material => {
                            const isLoesung = material.title.toLowerCase().includes('lösung') || 
                                             material.title.toLowerCase().includes('loesung') ||
                                             material.title.toLowerCase().includes('musterlösung');
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
                      
                      {/* Unterordner mit Materialien (z.B. Zusatzmaterial) */}
                      {subFolders.length > 0 && (
                        <div className="space-y-2">
                          {subFolders.map(subFolder => {
                            const folderMats = materials.filter(m => m.folder_id === subFolder.id);
                            if (folderMats.length === 0) return null;
                            return (
                              <div key={subFolder.id} className="border border-green-200 rounded-lg bg-green-50">
                                <div className="p-2 border-b border-green-200 bg-green-100 rounded-t-lg">
                                  <div className="flex items-center">
                                    <FolderOpen className="h-4 w-4 text-green-600 mr-2" />
                                    <span className="text-sm font-medium text-green-800">{subFolder.name}</span>
                                    <span className="ml-2 text-xs text-green-600">({folderMats.length} Dateien)</span>
                                  </div>
                                </div>
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
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {directMaterials.length === 0 && subFolderMaterials.length === 0 && (
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

                {/* Ordner auswählen */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ordner freigeben</label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Ordner suchen..." 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                      value={folderSearchTerm} 
                      onChange={(e) => setFolderSearchTerm(e.target.value)} 
                    />
                  </div>
                  <div className="border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                    {folders.length === 0 ? (
                      <p className="p-3 text-sm text-gray-500">Keine Ordner vorhanden</p>
                    ) : folders.filter(f => f.name.toLowerCase().includes(folderSearchTerm.toLowerCase())).length === 0 ? (
                      <p className="p-3 text-sm text-gray-500">Keine Ordner gefunden</p>
                    ) : (
                      folders.filter(f => f.name.toLowerCase().includes(folderSearchTerm.toLowerCase())).map(folder => (
                        <label key={folder.id} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
                          <input 
                            type="checkbox" 
                            checked={selectedFolders.includes(folder.id)} 
                            onChange={() => toggleFolderSelection(folder.id)} 
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" 
                          />
                          <FolderOpen className="h-4 w-4 ml-3 text-blue-500" />
                          <span className="ml-2 text-sm text-gray-900">{folder.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Materialien auswählen */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Einzelne Materialien freigeben</label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Materialien suchen..." 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                      value={materialSearchTerm} 
                      onChange={(e) => setMaterialSearchTerm(e.target.value)} 
                    />
                  </div>
                  <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                    {materials.length === 0 ? (
                      <p className="p-3 text-sm text-gray-500">Keine Materialien vorhanden</p>
                    ) : materials.filter(m => m.title.toLowerCase().includes(materialSearchTerm.toLowerCase())).length === 0 ? (
                      <p className="p-3 text-sm text-gray-500">Keine Materialien gefunden</p>
                    ) : (
                      materials.filter(m => m.title.toLowerCase().includes(materialSearchTerm.toLowerCase())).map(material => (
                        <label key={material.id} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
                          <input 
                            type="checkbox" 
                            checked={selectedMaterials.includes(material.id)} 
                            onChange={() => toggleMaterialSelection(material.id)} 
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" 
                          />
                          <FileText className="h-4 w-4 ml-3 text-gray-400" />
                          <span className="ml-2 text-sm text-gray-900">{material.title}</span>
                        </label>
                      ))
                    )}
                  </div>
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
                    <div>Dauer: <strong>{releaseUnitType ? formatDuration(UNIT_TYPES[releaseUnitType].duration) : '-'}</strong></div>
                    <div>Ordner: <strong>{selectedFolders.length}</strong></div>
                    <div>Materialien: <strong>{selectedMaterials.length}{additionalDocument ? ' + 1 Upload' : ''}</strong></div>
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

      {/* Kurszeiten Tab */}
      {activeSubTab === 'kurszeiten' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Reguläre Kurszeiten</h3>
                <p className="text-sm text-gray-500 mt-1">Wöchentliche Termine für die Elite-Kleingruppe</p>
              </div>
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
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div className="fixed inset-0 bg-black/50" onClick={() => { setShowEditModal(false); setEditingRelease(null); }} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Einheit bearbeiten</h3>
                  <p className="text-sm text-gray-500 mt-1">Bearbeiten Sie die Unterrichtseinheit vom {selectedDate ? formatDate(selectedDate.toISOString()) : ''}</p>
                </div>
                <button onClick={() => { setShowEditModal(false); setEditingRelease(null); }} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-6">
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
                      <option value="unterricht_zivilrecht">Unterricht Zivilrecht (2 Std 30 Min)</option>
                      <option value="unterricht_strafrecht">Unterricht Strafrecht (2 Std)</option>
                      <option value="unterricht_oeffentliches_recht">Unterricht öffentliches Recht (2 Std)</option>
                    </optgroup>
                    <optgroup label="Wiederholungseinheit">
                      <option value="wiederholung_zivilrecht">Wiederholungseinheit Zivilrecht (2 Std 30 Min)</option>
                      <option value="wiederholung_strafrecht">Wiederholungseinheit Strafrecht (1 Std 40 Min)</option>
                      <option value="wiederholung_oeffentliches_recht">Wiederholungseinheit öffentliches Recht (1 Std 10 Min)</option>
                    </optgroup>
                  </select>
                  {releaseUnitType && (
                    <p className="text-xs text-blue-700 mt-2">
                      Rechtsgebiet: <strong>{UNIT_TYPES[releaseUnitType].legalArea}</strong> | 
                      Dauer: <strong>{formatDuration(UNIT_TYPES[releaseUnitType].duration)}</strong>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                    <input 
                      type="date" 
                      value={selectedDate?.toISOString().split('T')[0] || ''} 
                      onChange={(e) => setSelectedDate(new Date(e.target.value))} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
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
                      {releaseUnitType ? formatDuration(UNIT_TYPES[releaseUnitType].duration) : '-'}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                  />
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
                  const subFolders = folders.filter(f => f.parent_id === releaseKlausurFolderId);
                  const subFolderMaterials = subFolders.flatMap(sf => 
                    materials.filter(m => m.folder_id === sf.id).map(m => ({ ...m, folderName: sf.name }))
                  );
                  
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
                            const isLoesung = material.title.toLowerCase().includes('lösung') || 
                                             material.title.toLowerCase().includes('loesung') ||
                                             material.title.toLowerCase().includes('musterlösung');
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
                      
                      {subFolders.length > 0 && (
                        <div className="space-y-2">
                          {subFolders.map(subFolder => {
                            const folderMats = materials.filter(m => m.folder_id === subFolder.id);
                            if (folderMats.length === 0) return null;
                            return (
                              <div key={subFolder.id} className="border border-green-200 rounded-lg bg-green-50">
                                <div className="p-2 border-b border-green-200 bg-green-100 rounded-t-lg">
                                  <div className="flex items-center">
                                    <FolderOpen className="h-4 w-4 text-green-600 mr-2" />
                                    <span className="text-sm font-medium text-green-800">{subFolder.name}</span>
                                    <span className="ml-2 text-xs text-green-600">({folderMats.length} Dateien)</span>
                                  </div>
                                </div>
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
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {directMaterials.length === 0 && subFolderMaterials.length === 0 && (
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

                {/* Ordner auswählen */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ordner freigeben</label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Ordner suchen..." 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                      value={folderSearchTerm} 
                      onChange={(e) => setFolderSearchTerm(e.target.value)} 
                    />
                  </div>
                  <div className="border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                    {folders.filter(f => f.name.toLowerCase().includes(folderSearchTerm.toLowerCase())).map(folder => (
                      <label key={folder.id} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
                        <input 
                          type="checkbox" 
                          checked={selectedFolders.includes(folder.id)} 
                          onChange={() => toggleFolderSelection(folder.id)} 
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" 
                        />
                        <FolderOpen className="h-4 w-4 ml-3 text-blue-500" />
                        <span className="ml-2 text-sm text-gray-900">{folder.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Materialien auswählen */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Einzelne Materialien freigeben</label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Materialien suchen..." 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                      value={materialSearchTerm} 
                      onChange={(e) => setMaterialSearchTerm(e.target.value)} 
                    />
                  </div>
                  <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                    {materials.filter(m => m.title.toLowerCase().includes(materialSearchTerm.toLowerCase())).map(material => (
                      <label key={material.id} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
                        <input 
                          type="checkbox" 
                          checked={selectedMaterials.includes(material.id)} 
                          onChange={() => toggleMaterialSelection(material.id)} 
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" 
                        />
                        <FileText className="h-4 w-4 ml-3 text-gray-400" />
                        <span className="ml-2 text-sm text-gray-900">{material.title}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Zusammenfassung */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Zusammenfassung</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>Typ: <strong>{releaseUnitType ? UNIT_TYPES[releaseUnitType].label : '-'}</strong></div>
                    <div>Rechtsgebiet: <strong>{releaseLegalArea || '-'}</strong></div>
                    <div>Zeit: <strong>{releaseStartTime} - {releaseEndTime}</strong></div>
                    <div>Dauer: <strong>{releaseUnitType ? formatDuration(UNIT_TYPES[releaseUnitType].duration) : '-'}</strong></div>
                    <div>Ordner: <strong>{selectedFolders.length}</strong></div>
                    <div>Materialien: <strong>{selectedMaterials.length}</strong></div>
                    {releaseSolutionMaterialIds.length > 0 && <div className="col-span-2">Lösungen (nach Termin): <strong>{releaseSolutionMaterialIds.length} Dateien</strong></div>}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => { setShowEditModal(false); setEditingRelease(null); }} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Abbrechen
                </button>
                <button 
                  onClick={handleUpdateRelease} 
                  disabled={!releaseTitle.trim() || !releaseUnitType} 
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4 inline mr-1" />
                  Änderungen speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
