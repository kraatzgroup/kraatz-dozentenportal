import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LogOut, Settings, Upload, FileText, PenTool, Calendar, CheckCircle, Clock, AlertCircle, Download, ChevronDown, ChevronUp, Users, ChevronLeft, ChevronRight, Lock, Unlock, BookOpen, Award, Video, FolderOpen, Menu, Info, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { Logo } from './Logo';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ScheduledRelease {
  id: string;
  release_date: string;
  title: string;
  description: string | null;
  material_ids: string[];
  folder_ids: string[];
  is_released: boolean;
  legal_area: string | null;
  unit_type: string | null;
  duration_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
  zoom_link: string | null;
  klausur_folder_id: string | null;
  solution_material_ids: string[];
  solutions_released: boolean;
  solution_release_date: string | null;
  solution_release_time: string | null;
  event_type: string;
  end_date: string | null;
}

interface TeachingMaterial {
  id: string;
  title: string;
  file_url: string;
  file_name: string;
  file_type: string;
  folder_id?: string;
}

interface MaterialFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

interface Klausur {
  id: string;
  title: string;
  legal_area: string;
  file_url: string;
  file_name: string;
  status: 'pending' | 'in_review' | 'completed';
  score?: number;
  feedback?: string;
  submitted_at: string;
  corrected_at?: string;
}

interface CourseTime {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  legal_area: string;
  description: string | null;
  meeting_link: string | null;
}

type Tab = 'dashboard' | 'kalender' | 'materialien' | 'klausuren';

export function EliteKleingruppeDashboard() {
  const { user, signOut } = useAuthStore();
  const { unreadCount, fetchUnreadCount } = useChatStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState<Tab>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['dashboard', 'kalender', 'materialien', 'klausuren'].includes(tabParam)) {
      return tabParam as Tab;
    }
    const saved = localStorage.getItem('eliteKleingruppeDashboardTab');
    return (saved as Tab) || 'dashboard';
  });
  
  // Helper function to change tab and update URL
  const setActiveTab = useCallback((tab: Tab) => {
    setActiveTabState(tab);
    localStorage.setItem('eliteKleingruppeDashboardTab', tab);
    setSearchParams({ tab });
  }, [setSearchParams]);
  
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear] = useState(new Date().getFullYear());
  const [allReleases, setAllReleases] = useState<ScheduledRelease[]>([]);
  const [releases, setReleases] = useState<ScheduledRelease[]>([]);
  const [materials, setMaterials] = useState<TeachingMaterial[]>([]);
  const [folders, setFolders] = useState<MaterialFolder[]>([]);
  const [klausuren, setKlausuren] = useState<Klausur[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRelease, setExpandedRelease] = useState<string | null>(null);
  const [selectedReleaseForDetail, setSelectedReleaseForDetail] = useState<ScheduledRelease | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadLegalArea, setUploadLegalArea] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [teilnehmerId, setTeilnehmerId] = useState<string | null>(null);
  const [teilnehmerEliteKleingruppeId, setTeilnehmerEliteKleingruppeId] = useState<string | null>(null);
  const [teilnehmerStateLaw, setTeilnehmerStateLaw] = useState<string | null>(null);
  const [dozenten, setDozenten] = useState<{id: string; name: string; email: string; profile_picture_url: string | null; legal_areas?: string[]}[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUploadingProfilePic, setIsUploadingProfilePic] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [firstName, setFirstName] = useState<string>('');
  const [examDate, setExamDate] = useState<string | null>(null);
  const [examStartDate, setExamStartDate] = useState<string | null>(null);
  const [showExamDateInput, setShowExamDateInput] = useState(false);
  const [tempExamDate, setTempExamDate] = useState('');
  const [courseTimes, setCourseTimes] = useState<CourseTime[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [zoomBackgrounds, setZoomBackgrounds] = useState<string[]>([]);
  const releasesSubscription = useRef<RealtimeChannel | null>(null);

  // Zoom links state
  const [zoomLinks, setZoomLinks] = useState<{
    Zivilrecht: { url: string; meetingId: string; passcode: string };
    Strafrecht: { url: string; meetingId: string; passcode: string };
    'Öffentliches Recht': { url: string; meetingId: string; passcode: string };
  }>({
    Zivilrecht: { url: '', meetingId: '', passcode: '' },
    Strafrecht: { url: '', meetingId: '', passcode: '' },
    'Öffentliches Recht': { url: '', meetingId: '', passcode: '' }
  });

  // Calendar filters
  const [legalAreaFilter, setLegalAreaFilter] = useState<string>('alle');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Materials search and filter
  const [materialsSearchQuery, setMaterialsSearchQuery] = useState<string>('');
  const [materialsLegalAreaFilter, setMaterialsLegalAreaFilter] = useState<string>('alle');
  
  // Upcoming units filter
  const [upcomingSearchQuery, setUpcomingSearchQuery] = useState<string>('');
  const [upcomingLegalAreaFilter, setUpcomingLegalAreaFilter] = useState<string>('alle');
  const [showAllUpcomingUnits, setShowAllUpcomingUnits] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
    fetchTeilnehmerId();
    fetchDozenten();
    fetchProfileData();
    fetchCourseTimes();
    fetchZoomLinks();
    fetchUnreadCount();

    // Cleanup function
    return () => {
      if (releasesSubscription.current) {
        console.log('🧹 Cleaning up releases subscription');
        releasesSubscription.current.unsubscribe();
        releasesSubscription.current = null;
      }
    };
  }, [user]);

  // Setup real-time subscription when group ID is available
  useEffect(() => {
    if (!teilnehmerEliteKleingruppeId) return;

    console.log('🔔 Setting up releases real-time subscription for group:', teilnehmerEliteKleingruppeId);
    
    releasesSubscription.current = supabase
      .channel(`elite-kleingruppe-releases-${teilnehmerEliteKleingruppeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'elite_kleingruppe_releases',
        filter: `elite_kleingruppe_id=eq.${teilnehmerEliteKleingruppeId}`
      }, (payload) => {
        console.log('🔔 Releases change detected:', payload);
        
        // Handle DELETE event specifically - check if the deleted unit was expanded
        if (payload.eventType === 'DELETE' && payload.old?.id) {
          console.log('🗑️ Unit deleted:', payload.old.id);
          // If the deleted unit was expanded, collapse it
          setExpandedRelease(current => {
            if (current === payload.old.id) {
              console.log('📂 Collapsing deleted unit');
              return null;
            }
            return current;
          });
        }
        
        // Refresh data for all events (INSERT, UPDATE, DELETE)
        fetchData();
      })
      .subscribe((status) => {
        console.log('🔔 Subscription status:', status);
      });

    return () => {
      if (releasesSubscription.current) {
        releasesSubscription.current.unsubscribe();
        releasesSubscription.current = null;
      }
    };
  }, [teilnehmerEliteKleingruppeId]);

  const fetchCourseTimes = async () => {
    const { data } = await supabase.from('elite_course_times').select('*').eq('is_active', true).order('weekday').order('start_time');
    setCourseTimes(data || []);
  };

  const fetchZoomLinks = async () => {
    const { data } = await supabase
      .from('elite_kleingruppe_settings')
      .select('setting_value')
      .eq('setting_key', 'zoom_links')
      .maybeSingle();
    if (data?.setting_value) {
      setZoomLinks(data.setting_value as any);
    }
  };

  const fetchProfileData = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('profile_picture_url, full_name, exam_date, exam_start_date').eq('id', user.id).single();
    if (data) {
      setProfilePictureUrl(data.profile_picture_url);
      if (data.full_name) {
        const nameParts = data.full_name.split(' ');
        setFirstName(nameParts[0]);
      }
      if (data.exam_date) {
        setExamDate(data.exam_date);
      }
      if (data.exam_start_date) {
        setExamStartDate(data.exam_start_date);
      }
    }
  };

  const saveExamDate = async () => {
    if (!user || !tempExamDate) return;
    const today = new Date().toISOString().split('T')[0];
    const updateData: { exam_date: string; exam_start_date?: string } = { exam_date: tempExamDate };
    if (!examStartDate) {
      updateData.exam_start_date = today;
    }
    const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
    if (!error) {
      setExamDate(tempExamDate);
      if (!examStartDate) {
        setExamStartDate(today);
      }
      setShowExamDateInput(false);
      setTempExamDate('');
    }
  };

  const getExamCountdown = () => {
    if (!examDate) return null;
    const exam = new Date(examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = exam.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExamProgress = () => {
    if (!examDate || !examStartDate) return 0;
    const exam = new Date(examDate);
    const start = new Date(examStartDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalDays = Math.ceil((exam.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (totalDays <= 0) return 100;
    const progress = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
    return Math.round(progress);
  };

  const fetchDozenten = async () => {
    if (!user?.id) {
      console.log('[fetchDozenten] No user ID, skipping');
      return;
    }
    
    console.log('[fetchDozenten] Starting fetch for user:', user.id);
    
    const allContacts: {id: string; name: string; email: string; profile_picture_url: string | null; legal_areas?: string[]}[] = [];
    const seenIds = new Set<string>();
    
    // Get current teilnehmer data
    const { data: teilnehmerData, error: teilnehmerError } = await supabase
      .from('teilnehmer')
      .select('dozent_zivilrecht_id, dozent_strafrecht_id, dozent_oeffentliches_recht_id, elite_kleingruppe_id')
      .eq('profile_id', user.id)
      .single();
    
    console.log('[fetchDozenten] Teilnehmer data:', teilnehmerData);
    console.log('[fetchDozenten] Teilnehmer error:', teilnehmerError);
    
    const dozentLegalAreas = new Map<string, string[]>();
    
    if (teilnehmerData) {
      // Individual dozent assignments from teilnehmer table
      if (teilnehmerData.dozent_zivilrecht_id) {
        const areas = dozentLegalAreas.get(teilnehmerData.dozent_zivilrecht_id) || [];
        areas.push('Zivilrecht');
        dozentLegalAreas.set(teilnehmerData.dozent_zivilrecht_id, areas);
        console.log('[fetchDozenten] Individual Zivilrecht dozent:', teilnehmerData.dozent_zivilrecht_id);
      }
      if (teilnehmerData.dozent_strafrecht_id) {
        const areas = dozentLegalAreas.get(teilnehmerData.dozent_strafrecht_id) || [];
        areas.push('Strafrecht');
        dozentLegalAreas.set(teilnehmerData.dozent_strafrecht_id, areas);
        console.log('[fetchDozenten] Individual Strafrecht dozent:', teilnehmerData.dozent_strafrecht_id);
      }
      if (teilnehmerData.dozent_oeffentliches_recht_id) {
        const areas = dozentLegalAreas.get(teilnehmerData.dozent_oeffentliches_recht_id) || [];
        areas.push('Öffentliches Recht');
        dozentLegalAreas.set(teilnehmerData.dozent_oeffentliches_recht_id, areas);
        console.log('[fetchDozenten] Individual Öffentliches Recht dozent:', teilnehmerData.dozent_oeffentliches_recht_id);
      }
      
      // Elite-Kleingruppe dozent assignments
      if (teilnehmerData.elite_kleingruppe_id) {
        console.log('[fetchDozenten] Elite-Kleingruppe ID:', teilnehmerData.elite_kleingruppe_id);
        
        const { data: eliteDozenten, error: eliteError } = await supabase
          .from('elite_kleingruppe_dozenten')
          .select('dozent_id, legal_area')
          .eq('elite_kleingruppe_id', teilnehmerData.elite_kleingruppe_id);
        
        console.log('[fetchDozenten] Elite-Kleingruppe dozenten query result:', eliteDozenten);
        console.log('[fetchDozenten] Elite-Kleingruppe dozenten error:', eliteError);
        
        if (eliteDozenten) {
          console.log('[fetchDozenten] Found', eliteDozenten.length, 'elite dozenten assignments');
          eliteDozenten.forEach(ed => {
            console.log('[fetchDozenten] Processing elite dozent:', ed.dozent_id, 'for', ed.legal_area);
            const areas = dozentLegalAreas.get(ed.dozent_id) || [];
            if (!areas.includes(ed.legal_area)) {
              areas.push(ed.legal_area);
            }
            dozentLegalAreas.set(ed.dozent_id, areas);
          });
        }
      } else {
        console.log('[fetchDozenten] No elite_kleingruppe_id found for teilnehmer');
      }
    } else {
      console.log('[fetchDozenten] No teilnehmer data found');
    }
    
    console.log('[fetchDozenten] Final dozentLegalAreas map:', Array.from(dozentLegalAreas.entries()));
    
    // Fetch all assigned dozenten
    const dozentIds = Array.from(dozentLegalAreas.keys());
    console.log('[fetchDozenten] Dozent IDs to fetch:', dozentIds);
    
    if (dozentIds.length > 0) {
      const { data: dozentenData, error: dozentenError } = await supabase
        .from('profiles')
        .select('id, full_name, email, profile_picture_url')
        .in('id', dozentIds);
      
      console.log('[fetchDozenten] Profiles query result:', dozentenData);
      console.log('[fetchDozenten] Profiles query error:', dozentenError);
      
      (dozentenData || []).forEach(d => {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id);
          const contact = { 
            id: d.id, 
            name: d.full_name || d.email, 
            email: d.email, 
            profile_picture_url: d.profile_picture_url,
            legal_areas: dozentLegalAreas.get(d.id) || []
          };
          console.log('[fetchDozenten] Adding dozent to list:', contact);
          allContacts.push(contact);
        }
      });
    }
    
    // Hole auch Verwaltung (nur wenn nicht bereits als Dozent hinzugefügt)
    const { data: verwaltungData } = await supabase.from('profiles').select('id, full_name, email, profile_picture_url').eq('role', 'admin');
    if (verwaltungData) {
      verwaltungData.forEach(v => {
        if (!seenIds.has(v.id)) {
          seenIds.add(v.id);
          allContacts.push({ id: v.id, name: 'Verwaltung', email: v.email, profile_picture_url: v.profile_picture_url });
        }
      });
    }
    
    console.log('[fetchDozenten] Final dozenten list:', allContacts);
    setDozenten(allContacts);
  };

  const fetchTeilnehmerId = async () => {
    if (!user) return;
    // Finde den Teilnehmer-Eintrag für diesen Benutzer basierend auf der E-Mail
    const { data } = await supabase.from('teilnehmer').select('id, elite_kleingruppe_id, state_law').eq('email', user.email).single();
    if (data) {
      setTeilnehmerId(data.id);
      setTeilnehmerEliteKleingruppeId(data.elite_kleingruppe_id);
      setTeilnehmerStateLaw(data.state_law);
      console.log('Teilnehmer geladen:', { id: data.id, state_law: data.state_law });
      fetchKlausuren(data.id);
    }
  };

  // Load missing materials when detail modal opens
  useEffect(() => {
    if (!selectedReleaseForDetail) return;
    
    const allIds = [
      ...(selectedReleaseForDetail.material_ids || []),
      ...(selectedReleaseForDetail.solution_material_ids || [])
    ];
    
    // Find IDs not in current materials state
    const missingIds = allIds.filter(id => !materials.find(m => m.id === id));
    
    if (missingIds.length === 0) return;
    
    console.log('📥 Loading missing materials:', missingIds.length, 'IDs');
    
    // Load missing materials in batches of 100 (Supabase limit workaround)
    const loadMissingMaterials = async () => {
      const newMaterials: TeachingMaterial[] = [];
      
      for (let i = 0; i < missingIds.length; i += 100) {
        const batch = missingIds.slice(i, i + 100);
        const { data } = await supabase
          .from('teaching_materials')
          .select('id, title, file_url, file_name, file_type, folder_id')
          .in('id', batch)
          .eq('is_active', true);
        
        if (data) {
          newMaterials.push(...data);
        }
      }
      
      if (newMaterials.length > 0) {
        console.log('✅ Loaded', newMaterials.length, 'missing materials');
        setMaterials(prev => [...prev, ...newMaterials]);
      }
    };
    
    loadMissingMaterials();
  }, [selectedReleaseForDetail?.id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Get the current user's elite_kleingruppe_id if not already loaded
      let groupId = teilnehmerEliteKleingruppeId;
      if (!groupId && user) {
        const { data: teilnehmerData } = await supabase
          .from('teilnehmer')
          .select('elite_kleingruppe_id, zoom_background_url')
          .eq('email', user.email)
          .single();
        if (teilnehmerData?.elite_kleingruppe_id) {
          groupId = teilnehmerData.elite_kleingruppe_id;
          setTeilnehmerEliteKleingruppeId(groupId);
        }
        // Load zoom backgrounds
        if (teilnehmerData?.zoom_background_url) {
          try {
            const urls = JSON.parse(teilnehmerData.zoom_background_url);
            setZoomBackgrounds(Array.isArray(urls) ? urls : [urls]);
          } catch {
            setZoomBackgrounds([teilnehmerData.zoom_background_url]);
          }
        }
      }

      // Load releases filtered by elite_kleingruppe_id (or all if no group assigned)
      let releasesQuery = supabase
        .from('elite_kleingruppe_releases')
        .select('*')
        .order('release_date', { ascending: true });
      
      if (groupId) {
        releasesQuery = releasesQuery.eq('elite_kleingruppe_id', groupId);
      }
      
      const { data: allReleasesData } = await releasesQuery;
      setAllReleases(allReleasesData || []);

      // Nur freigegebene Einheiten für Materialien-Tab
      const releasedData = (allReleasesData || []).filter(r => r.is_released);
      setReleases(releasedData);

      const { data: materialsData } = await supabase
        .from('teaching_materials')
        .select('id, title, file_url, file_name, file_type, folder_id')
        .eq('is_active', true);
      console.log('📚 Materials loaded:', materialsData?.length, 'First 3:', materialsData?.slice(0, 3).map(m => ({ id: m.id, title: m.title.substring(0, 30) })));
      setMaterials(materialsData || []);

      const { data: foldersData } = await supabase
        .from('material_folders')
        .select('id, name, parent_id')
        .eq('is_active', true);
      setFolders(foldersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKlausuren = async (tId: string) => {
    const { data } = await supabase
      .from('elite_kleingruppe_klausuren')
      .select('*')
      .eq('teilnehmer_id', tId)
      .order('submitted_at', { ascending: false });
    setKlausuren(data || []);
  };

  // Helper function to check if folder matches user's Bundesland
  const isFolderMatchingUserState = (folderName: string, releaseTitle?: string): boolean => {
    console.log('Filter check:', { folderName, releaseTitle, teilnehmerStateLaw });
    
    // For Klausur 14, show all materials regardless of Bundesland
    if (releaseTitle && releaseTitle.includes('Klausur 14')) {
      console.log('  -> Klausur 14, showing all');
      return true;
    }
    
    if (!teilnehmerStateLaw) {
      console.log('  -> No state_law set, showing all');
      return true; // Show all if no state is set
    }
    
    // Handle Berlin/Brandenburg special case
    if (teilnehmerStateLaw === 'Berlin' || teilnehmerStateLaw === 'Brandenburg') {
      const matches = folderName === 'Berlin/Brandenburg' || folderName === 'Berlin/ Brandenburg';
      console.log('  -> Berlin/Brandenburg check:', matches);
      return matches;
    }
    
    // Direct match
    const matches = folderName === teilnehmerStateLaw;
    console.log('  -> Direct match:', matches);
    return matches;
  };

  const handleDownloadZoomBackground = async (url: string, index: number) => {
    try {
      // Extract path from URL - support both old and new bucket
      let match = url.match(/\/storage\/v1\/object\/public\/zoom-backgrounds\/(.+)$/);
      let bucket = 'zoom-backgrounds';
      
      if (!match) {
        match = url.match(/\/storage\/v1\/object\/public\/elite-kleingruppe\/(.+)$/);
        bucket = 'elite-kleingruppe';
      }
      
      if (!match) {
        console.error('Invalid URL format');
        window.open(url, '_blank');
        return;
      }
      
      const path = match[1];
      
      // Download using Supabase storage API
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(path);
      
      if (error || !data) {
        console.error('Download error:', error);
        window.open(url, '_blank');
        return;
      }
      
      // Create download link with correct blob
      const downloadUrl = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Zoom_Hintergrund_${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      
    } catch (error) {
      console.error('Download failed:', error);
      window.open(url, '_blank');
    }
  };

  const handleDownloadMaterial = async (material: TeachingMaterial) => {
    if (!material.file_url) {
      console.error('Keine Datei-URL vorhanden');
      return;
    }
    
    try {
      // Extrahiere Bucket und Pfad aus der URL
      // URL Format: https://xxx.supabase.co/storage/v1/object/public/bucket/path
      const urlParts = material.file_url.split('/storage/v1/object/public/');
      if (urlParts.length === 2) {
        const pathParts = urlParts[1].split('/');
        const bucket = pathParts[0];
        const filePath = pathParts.slice(1).join('/');
        
        // Lade die Datei direkt über Supabase Storage
        const { data, error } = await supabase.storage
          .from(bucket)
          .download(filePath);
        
        if (error) throw error;
        
        // Erstelle eine Blob-URL
        const blobUrl = window.URL.createObjectURL(data);
        
        // Erstelle einen temporären Link zum Download
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = material.file_name || material.title || 'download.pdf';
        
        // Füge Link zum DOM hinzu, klicke und entferne ihn
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Bereinige die Blob-URL
        window.URL.revokeObjectURL(blobUrl);
        return;
      }
      
      // Fallback für andere URLs
      window.open(material.file_url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: Öffne in neuem Tab
      window.open(material.file_url, '_blank');
    }
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

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsUploadingProfilePic(true);
    setSettingsMessage(null);
    try {
      const fileName = `${user.id}/profile.${file.name.split('.').pop()}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type
        });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from('profile-pictures').getPublicUrl(fileName);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: urlData.publicUrl })
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      setProfilePictureUrl(urlData.publicUrl);
      setSettingsMessage({ type: 'success', text: 'Profilbild erfolgreich aktualisiert!' });
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setSettingsMessage({ type: 'error', text: 'Fehler beim Hochladen des Profilbilds' });
    } finally {
      setIsUploadingProfilePic(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      setSettingsMessage({ type: 'error', text: 'Bitte beide Passwortfelder ausfüllen' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSettingsMessage({ type: 'error', text: 'Passwörter stimmen nicht überein' });
      return;
    }
    if (newPassword.length < 6) {
      setSettingsMessage({ type: 'error', text: 'Passwort muss mindestens 6 Zeichen lang sein' });
      return;
    }
    
    setIsUpdatingPassword(true);
    setSettingsMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setNewPassword('');
      setConfirmPassword('');
      setSettingsMessage({ type: 'success', text: 'Passwort erfolgreich geändert!' });
    } catch (error) {
      console.error('Error updating password:', error);
      setSettingsMessage({ type: 'error', text: 'Fehler beim Ändern des Passworts' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleSubmitKlausur = async () => {
    if (!uploadFile || !uploadTitle || !uploadLegalArea || !teilnehmerId || !user) return;
    
    setIsUploading(true);
    try {
      // Upload file to Supabase Storage - use user.id for RLS policy compliance
      // Sanitize filename: remove special characters that are invalid for storage keys
      const sanitizedFileName = uploadFile.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_');
      const fileName = `${Date.now()}_${sanitizedFileName}`;
      const filePath = `klausuren/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('elite-kleingruppe')
        .upload(filePath, uploadFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('elite-kleingruppe')
        .getPublicUrl(filePath);

      // Create klausur entry
      const { error: insertError } = await supabase
        .from('elite_kleingruppe_klausuren')
        .insert({
          teilnehmer_id: teilnehmerId,
          title: uploadTitle,
          legal_area: uploadLegalArea,
          file_url: urlData.publicUrl,
          file_name: uploadFile.name,
          file_size: uploadFile.size,
          status: 'pending'
        });

      if (insertError) throw insertError;

      // Reset form and refresh
      setShowUploadModal(false);
      setUploadTitle('');
      setUploadLegalArea('');
      setUploadFile(null);
      fetchKlausuren(teilnehmerId);
    } catch (error) {
      console.error('Error uploading klausur:', error);
      alert('Fehler beim Hochladen der Klausur');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Korrigiert</span>;
      case 'in_review':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />In Bearbeitung</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><AlertCircle className="h-3 w-3 mr-1" />Ausstehend</span>;
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header im Dozenten-Portal Stil */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Logo />
                <span className="ml-2 text-xl font-semibold text-gray-900">Elite-Kleingruppe</span>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-2 sm:space-x-4">
              {/* Chat */}
              <button
                onClick={() => navigate('/messages')}
                className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
              >
                <MessageSquare className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline">Chat</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {/* Einstellungen */}
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition">
                <Settings className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline">Einstellungen</span>
              </button>
              {/* Abmelden */}
              <button 
                onClick={signOut}
                className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-500 hover:text-red-700 focus:outline-none transition"
              >
                <LogOut className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </div>
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <button
                onClick={() => {
                  navigate('/messages');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center justify-between"
              >
                <div className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  <span>Chat</span>
                </div>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {unreadCount}
                  </span>
                )}
              </button>
              {allReleases.filter(r => !r.is_released).length > 0 && (
                <button
                  onClick={() => {
                    setActiveTab('kalender');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-800 flex items-center"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {allReleases.filter(r => !r.is_released).length} Einheiten geplant
                </button>
              )}
              <button
                onClick={() => {
                  setShowSettingsModal(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Settings className="h-5 w-5 mr-2" />
                Einstellungen
              </button>
              <button
                onClick={() => {
                  signOut();
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

      {/* Welcome Banner - Hidden since content appears in dashboard below */}
      <div className="hidden bg-gradient-to-r from-primary/5 to-blue-500/5 border-b border-primary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Willkommen zurück{firstName ? `, ${firstName}` : ''}!</h2>
              <p className="text-gray-600 mt-1">Hier findest du alle Materialien und Informationen zu deiner Elite-Kleingruppe.</p>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-1">
                  <BookOpen className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-xs text-gray-500">Einheiten</p>
                <p className="text-lg font-bold text-gray-900">{releases.length}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-1">
                  <PenTool className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-xs text-gray-500">Klausuren</p>
                <p className="text-lg font-bold text-gray-900">{klausuren.length}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-xl mb-1">
                  <Award className="h-6 w-6 text-yellow-600" />
                </div>
                <p className="text-xs text-gray-500">Korrigiert</p>
                <p className="text-lg font-bold text-gray-900">{klausuren.filter(k => k.status === 'completed').length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {/* Zurück-Balken wenn nicht auf Dashboard - Hidden */}
      {false && activeTab !== 'dashboard' && (
        <div className="bg-primary border-b border-primary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="py-3 flex items-center text-sm font-medium text-white hover:text-white/80 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              Zurück zum Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Willkommen & Motivation - Above Tabs */}
      <div className="bg-white/80 backdrop-blur-sm pt-6 pb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#2e83c2] rounded-2xl p-6 text-white shadow-lg">
            <h2 className="text-2xl font-bold">Willkommen zurück{firstName ? `, ${firstName}` : ''}!</h2>
            <p className="text-white/80 mt-1">Dein Weg zum Examen – Schritt für Schritt zum Erfolg.</p>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex flex-col md:flex-row md:space-x-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-4 font-medium text-sm flex items-center rounded-t-lg transition-colors ${activeTab === 'dashboard' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <Award className="h-4 w-4 mr-2" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('kalender')}
              className={`py-4 px-4 font-medium text-sm flex items-center rounded-t-lg transition-colors ${activeTab === 'kalender' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Einheiten-Kalender
            </button>
            <button
              onClick={() => setActiveTab('materialien')}
              className={`py-4 px-4 font-medium text-sm flex items-center rounded-t-lg transition-colors ${activeTab === 'materialien' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <FileText className="h-4 w-4 mr-2" />
              Materialien
            </button>
            <button
              onClick={() => setActiveTab('klausuren')}
              className={`py-4 px-4 font-medium text-sm flex items-center rounded-t-lg transition-colors ${activeTab === 'klausuren' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <PenTool className="h-4 w-4 mr-2" />
              Meine Klausuren
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Staatsexamen Countdown */}
            {showExamDateInput ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 p-3 bg-primary/10 rounded-xl">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">Wann ist dein Staatsexamen?</p>
                      <p className="text-sm text-gray-500">Trage das Datum ein, um deinen Countdown zu starten</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="date"
                      value={tempExamDate}
                      onChange={(e) => setTempExamDate(e.target.value)}
                      className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    />
                    <button 
                      onClick={saveExamDate}
                      disabled={!tempExamDate}
                      className="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      Speichern
                    </button>
                    <button 
                      onClick={() => { setShowExamDateInput(false); setTempExamDate(''); }}
                      className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              </div>
            ) : examDate ? (
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
                
                <div className="relative z-10">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-white/60 uppercase tracking-wider">Dein Staatsexamen</span>
                      </div>
                      <p className="text-2xl font-bold text-white">
                        {new Date(examDate).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                      <button 
                        onClick={() => { setShowExamDateInput(true); setTempExamDate(examDate); }}
                        className="mt-2 text-xs text-white/40 hover:text-white/70 transition-colors"
                      >
                        Datum ändern
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="relative">
                          <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                            {getExamCountdown()}
                          </div>
                          <div className="absolute -inset-2 bg-primary/20 blur-xl rounded-full -z-10" />
                        </div>
                        <p className="text-sm text-white/60 mt-1">Tage verbleibend</p>
                      </div>
                      
                      <div className="hidden sm:block h-20 w-px bg-white/10" />
                      
                      <div className="hidden sm:flex flex-col items-center gap-2">
                        <div className="relative w-20 h-20">
                          <svg className="w-20 h-20 transform -rotate-90">
                            <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="none" className="text-white/10" />
                            <circle 
                              cx="40" cy="40" r="36" 
                              stroke="url(#progressGradient)" 
                              strokeWidth="6" 
                              fill="none" 
                              strokeLinecap="round"
                              strokeDasharray={`${(() => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const completedReleases = allReleases.filter(r => {
                                  const releaseDate = new Date(r.release_date);
                                  releaseDate.setHours(0, 0, 0, 0);
                                  return releaseDate <= today;
                                });
                                const progress = allReleases.length > 0 ? (completedReleases.length / allReleases.length) * 100 : 0;
                                return Math.round(progress * 2.26);
                              })()} 226`}
                            />
                            <defs>
                              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#2e83c2" />
                                <stop offset="100%" stopColor="#60a5fa" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold text-white">
                              {(() => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const completedReleases = allReleases.filter(r => {
                                  const releaseDate = new Date(r.release_date);
                                  releaseDate.setHours(0, 0, 0, 0);
                                  return releaseDate <= today;
                                });
                                return allReleases.length > 0 ? Math.round((completedReleases.length / allReleases.length) * 100) : 0;
                              })()}%
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-white/40">Kursfortschritt</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-6 group hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setShowExamDateInput(true)}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 p-3 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-shadow">
                      <Calendar className="h-6 w-6 text-gray-400 group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">Staatsexamen-Countdown</p>
                      <p className="text-sm text-gray-500">Trage dein Examendatum ein und starte deinen persönlichen Countdown</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-primary font-medium text-sm group-hover:translate-x-1 transition-transform">
                    <span>Jetzt eintragen</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            )}

            {/* Zoom-Links für Rechtsgebiete */}
            {(zoomLinks.Zivilrecht.url || zoomLinks.Strafrecht.url || zoomLinks['Öffentliches Recht'].url) && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                  Zoom-Links für Unterrichtseinheiten
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {zoomLinks.Zivilrecht.url && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-500 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Zivilrecht</p>
                        </div>
                      </div>
                      {zoomLinks.Zivilrecht.meetingId && (
                        <p className="text-xs text-gray-600 mb-1">Meeting ID: <span className="font-medium">{zoomLinks.Zivilrecht.meetingId}</span></p>
                      )}
                      {zoomLinks.Zivilrecht.passcode && (
                        <p className="text-xs text-gray-600 mb-3">Passcode: <span className="font-medium">{zoomLinks.Zivilrecht.passcode}</span></p>
                      )}
                      <a
                        href={zoomLinks.Zivilrecht.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                        Zoom beitreten
                      </a>
                    </div>
                  )}
                  {zoomLinks.Strafrecht.url && (
                    <div className="bg-red-50 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-red-500 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Strafrecht</p>
                        </div>
                      </div>
                      {zoomLinks.Strafrecht.meetingId && (
                        <p className="text-xs text-gray-600 mb-1">Meeting ID: <span className="font-medium">{zoomLinks.Strafrecht.meetingId}</span></p>
                      )}
                      {zoomLinks.Strafrecht.passcode && (
                        <p className="text-xs text-gray-600 mb-3">Passcode: <span className="font-medium">{zoomLinks.Strafrecht.passcode}</span></p>
                      )}
                      <a
                        href={zoomLinks.Strafrecht.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                        Zoom beitreten
                      </a>
                    </div>
                  )}
                  {zoomLinks['Öffentliches Recht'].url && (
                    <div className="bg-green-50 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-500 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Öffentliches Recht</p>
                        </div>
                      </div>
                      {zoomLinks['Öffentliches Recht'].meetingId && (
                        <p className="text-xs text-gray-600 mb-1">Meeting ID: <span className="font-medium">{zoomLinks['Öffentliches Recht'].meetingId}</span></p>
                      )}
                      {zoomLinks['Öffentliches Recht'].passcode && (
                        <p className="text-xs text-gray-600 mb-3">Passcode: <span className="font-medium">{zoomLinks['Öffentliches Recht'].passcode}</span></p>
                      )}
                      <a
                        href={zoomLinks['Öffentliches Recht'].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                        Zoom beitreten
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Kursfortschritt */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Fortschrittsübersicht */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Dein Kursfortschritt</h3>
                  <div className="group relative">
                    <Info className="h-4 w-4 text-gray-400 cursor-help" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-10">
                      <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
                        Dein Kurs besteht aus Einheiten (U) und Wiederholungseinheiten (W)
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Gesamtfortschritt - zeitbasiert */}
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  // Filter releases that have already occurred (date <= today)
                  const completedReleases = allReleases.filter(r => {
                    const releaseDate = new Date(r.release_date);
                    releaseDate.setHours(0, 0, 0, 0);
                    return releaseDate <= today;
                  });
                  
                  const totalReleases = allReleases.length;
                  const progress = totalReleases > 0 ? (completedReleases.length / totalReleases) * 100 : 0;
                  
                  return (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Gesamtfortschritt</span>
                        <span className="text-sm font-bold text-primary">
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <div className="relative w-full bg-gray-200 rounded-full h-4">
                        <div 
                          className="bg-gradient-to-r from-primary to-blue-500 h-4 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                        
                        {/* Milestone markers */}
                        {[25, 50, 75].map(milestone => (
                          <div 
                            key={milestone}
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                            style={{ left: `${milestone}%` }}
                          >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                              progress >= milestone 
                                ? 'bg-primary border-primary shadow-lg' 
                                : 'bg-white border-gray-300'
                            }`}>
                              {progress >= milestone ? (
                                <CheckCircle className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-gray-300" />
                              )}
                            </div>
                            <div className={`absolute top-7 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap transition-colors ${
                              progress >= milestone ? 'text-primary' : 'text-gray-400'
                            }`}>
                              {milestone}%
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-8">
                        {completedReleases.length} von {totalReleases} Einheiten absolviert
                      </p>
                    </div>
                  );
                })()}

                {/* Fortschritt nach Rechtsgebiet - zeitbasiert */}
                <div className="space-y-4">
                  {['Zivilrecht', 'Strafrecht', 'Öffentliches Recht'].map(area => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    const areaReleases = allReleases.filter(r => r.legal_area === area);
                    const areaCompleted = areaReleases.filter(r => {
                      const releaseDate = new Date(r.release_date);
                      releaseDate.setHours(0, 0, 0, 0);
                      return releaseDate <= today;
                    });
                    
                    // Count instruction and review units separately
                    const unterrichtReleases = areaReleases.filter(r => 
                      r.unit_type?.startsWith('unterricht_')
                    );
                    const wiederholungReleases = areaReleases.filter(r => 
                      r.unit_type?.startsWith('wiederholung_')
                    );
                    
                    const unterrichtCompleted = areaCompleted.filter(r => 
                      r.unit_type?.startsWith('unterricht_')
                    );
                    const wiederholungCompleted = areaCompleted.filter(r => 
                      r.unit_type?.startsWith('wiederholung_')
                    );
                    
                    const progress = areaReleases.length > 0 ? (areaCompleted.length / areaReleases.length) * 100 : 0;
                    const colors = area === 'Zivilrecht' ? 'from-blue-500 to-blue-600' : area === 'Strafrecht' ? 'from-red-500 to-red-600' : 'from-green-500 to-green-600';
                    
                    return (
                      <div key={area}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">{area}</span>
                          <span className="text-xs text-gray-500">
                            {areaCompleted.length}/{areaReleases.length}
                            {(unterrichtReleases.length > 0 || wiederholungReleases.length > 0) && (
                              <span className="ml-1 text-gray-400">
                                ({unterrichtCompleted.length}/{unterrichtReleases.length} U + {wiederholungCompleted.length}/{wiederholungReleases.length} W)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className={`bg-gradient-to-r ${colors} h-2 rounded-full transition-all duration-500`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Statistik-Karten */}
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 p-3 bg-green-100 rounded-xl">
                      <BookOpen className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        Freigeschaltete Einheiten
                        <span className="relative group">
                          <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                            Bei freigeschalteten Einheiten sind Sachverhalte und Zusatzmaterialien bereits verfügbar. Weitere Einheiten werden nacheinander freigeschaltet.
                            <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></span>
                          </span>
                        </span>
                      </p>
                      <p className="text-2xl font-bold text-gray-900">{releases.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 p-3 bg-blue-100 rounded-xl">
                      <PenTool className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        Eingereichte Klausuren
                        <span className="relative group">
                          <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                            Dies ist dein verfügbares Kontingent. Du kannst bis zu 60 Klausuren in Rechtsgebieten deiner Wahl einreichen.
                            <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></span>
                          </span>
                        </span>
                      </p>
                      <p className="text-2xl font-bold text-gray-900">{klausuren.length} <span className="text-sm font-normal text-gray-400">/ 60</span></p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((klausuren.length / 60) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 p-3 bg-yellow-100 rounded-xl">
                      <Award className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        Korrigierte Klausuren
                        <span className="relative group">
                          <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                            Das ist die Anzahl deiner korrigierten Klausuren.
                            <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></span>
                          </span>
                        </span>
                      </p>
                      <p className="text-2xl font-bold text-gray-900">{klausuren.filter(k => k.status === 'completed').length} <span className="text-sm font-normal text-gray-400">/ 60</span></p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                        <div 
                          className="bg-yellow-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((klausuren.filter(k => k.status === 'completed').length / 60) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Klausur-Bewertungs-Statistik */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">Klausur-Bewertungen</h3>
                  <div className="group relative">
                    <Info className="h-4 w-4 text-gray-400 cursor-help" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-10">
                      <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
                        Dies ist dein Klausuren-Kontingent. Nur kontinuierliches Üben führt zum Erfolg!
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('klausuren')}
                  className="inline-flex items-center px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium transition-colors"
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  Neue Klausur einreichen
                </button>
              </div>
              
              {/* Klausuren-Kontingent */}
              <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Klausuren-Kontingent</span>
                  <span className="text-sm font-bold text-gray-900">
                    {klausuren.length > 0 ? `${60 - klausuren.length}/60` : '60/60'}
                  </span>
                </div>
                <div className="relative w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-primary to-blue-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${klausuren.length > 0 ? ((60 - klausuren.length) / 60) * 100 : 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {klausuren.length > 0 
                    ? `${klausuren.length} Klausur${klausuren.length === 1 ? '' : 'en'} eingereicht, ${60 - klausuren.length} verbleibend`
                    : 'Noch keine Klausuren eingereicht'
                  }
                </p>
              </div>
              
              {klausuren.filter(k => k.status === 'completed' && k.score !== undefined).length > 0 ? (
                <div className="space-y-4">
                  {/* Durchschnittsnote */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-blue-500/5 rounded-xl">
                    <div>
                      <p className="text-sm text-gray-500">Durchschnittsnote</p>
                      <p className="text-3xl font-bold text-primary">
                        {(klausuren.filter(k => k.status === 'completed' && k.score !== undefined).reduce((sum, k) => sum + (k.score || 0), 0) / klausuren.filter(k => k.status === 'completed' && k.score !== undefined).length).toFixed(1)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Punkte</p>
                      <p className="text-xs text-gray-400">aus {klausuren.filter(k => k.status === 'completed' && k.score !== undefined).length} Klausuren</p>
                    </div>
                  </div>

                  {/* Punkteverlauf Diagramm - 3 separate Grafiken */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Punkteverlauf nach Rechtsgebieten</p>
                    
                    {(() => {
                      const completedKlausuren = klausuren
                        .filter(k => k.status === 'completed' && k.score !== undefined)
                        .sort((a, b) => new Date(a.corrected_at || a.submitted_at).getTime() - new Date(b.corrected_at || b.submitted_at).getTime());
                      
                      if (completedKlausuren.length === 0) {
                        return (
                          <div className="text-center py-6 text-gray-400">
                            <p className="text-sm">Noch keine korrigierten Klausuren</p>
                          </div>
                        );
                      }
                      
                      const legalAreas = [
                        { name: 'Zivilrecht', color: '#3B82F6', bgColor: 'bg-blue-50' },
                        { name: 'Strafrecht', color: '#EF4444', bgColor: 'bg-red-50' },
                        { name: 'Öffentliches Recht', color: '#22C55E', bgColor: 'bg-green-50' },
                      ];
                      
                      const chartHeight = 50;
                      const chartWidth = 100;
                      const padding = { top: 5, right: 5, bottom: 5, left: 15 };
                      const innerWidth = chartWidth - padding.left - padding.right;
                      const innerHeight = chartHeight - padding.top - padding.bottom;
                      
                      // Helper function to determine trend
                      const getTrend = (klausurenList: typeof completedKlausuren) => {
                        if (klausurenList.length < 2) return 'neutral';
                        const lastScore = klausurenList[klausurenList.length - 1].score || 0;
                        const prevScore = klausurenList[klausurenList.length - 2].score || 0;
                        if (lastScore > prevScore) return 'improved';
                        if (lastScore < prevScore) return 'declined';
                        return 'stable';
                      };
                      
                      return (
                        <div className="grid grid-cols-3 gap-2">
                          {legalAreas.map(({ name, color, bgColor }) => {
                            const areaKlausuren = completedKlausuren.filter(k => k.legal_area === name);
                            const trend = getTrend(areaKlausuren);
                            
                            const avgScore = areaKlausuren.length > 0 
                              ? Math.round(areaKlausuren.reduce((sum, k) => sum + (k.score || 0), 0) / areaKlausuren.length)
                              : 0;
                            
                            return (
                              <div key={name} className={`${bgColor} rounded-lg p-2 relative`}>
                                {/* Konfetti bei Verbesserung */}
                                {trend === 'improved' && (
                                  <div className="absolute -top-1 -right-1 animate-bounce">
                                    <span className="text-sm">🎉</span>
                                  </div>
                                )}
                                
                                {/* Header - kompakt für 3-Spalten */}
                                <div className="text-center mb-1">
                                  <div className="text-xs font-semibold" style={{ color }}>{name}</div>
                                  {areaKlausuren.length > 0 && (
                                    <div className="text-xs text-gray-600">Ø {avgScore} Pkt.</div>
                                  )}
                                  {areaKlausuren.length >= 2 && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium inline-block mt-1 ${
                                      trend === 'improved' ? 'bg-green-100 text-green-700' :
                                      trend === 'declined' ? 'bg-red-100 text-red-700' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      {trend === 'improved' ? '↑' :
                                       trend === 'declined' ? '↓' :
                                       '→'}
                                    </span>
                                  )}
                                </div>
                                
                                {areaKlausuren.length === 0 ? (
                                  <div className="h-8 flex items-center justify-center">
                                    <span className="text-xs text-gray-400">-</span>
                                  </div>
                                ) : (
                                  <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
                                    {/* Y-Achse Beschriftung */}
                                    <text x={padding.left - 2} y={padding.top + 3} fontSize="6" fill="#9CA3AF" textAnchor="end">18</text>
                                    <text x={padding.left - 2} y={padding.top + innerHeight} fontSize="6" fill="#9CA3AF" textAnchor="end">0</text>
                                    
                                    {/* Horizontale Hilfslinien */}
                                    <line x1={padding.left} y1={padding.top} x2={padding.left + innerWidth} y2={padding.top} stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="2,2" />
                                    <line x1={padding.left} y1={padding.top + innerHeight} x2={padding.left + innerWidth} y2={padding.top + innerHeight} stroke="#E5E7EB" strokeWidth="0.5" />
                                    
                                    {/* Bestehensgrenze (4 Punkte) */}
                                    <line 
                                      x1={padding.left} 
                                      y1={padding.top + innerHeight * (1 - 4/18)} 
                                      x2={padding.left + innerWidth} 
                                      y2={padding.top + innerHeight * (1 - 4/18)} 
                                      stroke="#FCD34D" 
                                      strokeWidth="0.5" 
                                      strokeDasharray="2,1" 
                                    />
                                    
                                    {/* Linie und Punkte */}
                                    {(() => {
                                      const points = areaKlausuren.map((k, i) => {
                                        const x = padding.left + (i / Math.max(areaKlausuren.length - 1, 1)) * innerWidth;
                                        const y = padding.top + innerHeight * (1 - (k.score || 0) / 18);
                                        return { x, y, score: k.score, title: k.title, id: k.id };
                                      });
                                      
                                      const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                      
                                      return (
                                        <g>
                                          {points.length > 1 && (
                                            <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                          )}
                                          {points.map((p, i) => (
                                            <g 
                                              key={i} 
                                              onClick={() => setActiveTab('klausuren')}
                                              style={{ cursor: 'pointer' }}
                                            >
                                              <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="white" strokeWidth="1.5" />
                                              <title>{p.title}: {p.score} Punkte - Klicken für Klausuren</title>
                                            </g>
                                          ))}
                                        </g>
                                      );
                                    })()}
                                  </svg>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    
                    {/* Gesamtstatistik */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Gesamt</span>
                        <span className="font-medium text-gray-900">
                          {klausuren.filter(k => k.status === 'completed').length} / {klausuren.length} Klausuren
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Letzte Bewertungen */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Letzte Bewertungen</p>
                    <div className="space-y-2">
                      {klausuren
                        .filter(k => k.status === 'completed' && k.score !== undefined)
                        .sort((a, b) => {
                          const dateA = a.corrected_at ? new Date(a.corrected_at).getTime() : 0;
                          const dateB = b.corrected_at ? new Date(b.corrected_at).getTime() : 0;
                          return dateB - dateA;
                        })
                        .slice(0, 3)
                        .map(k => (
                        <div key={k.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{k.title}</p>
                            <p className="text-xs text-gray-500">{k.legal_area}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                            k.score! >= 10 ? 'bg-green-100 text-green-800' : 
                            k.score! >= 4 ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-red-100 text-red-800'
                          }`}>
                            {k.score} Pkt.
                          </div>
                        </div>
                      ))}
                    </div>
                    {klausuren.filter(k => k.status === 'completed' && k.score !== undefined).length > 3 && (
                      <button
                        onClick={() => setActiveTab('klausuren')}
                        className="w-full mt-3 px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                      >
                        Alle Korrekturen
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Noch keine korrigierten Klausuren vorhanden</p>
                  <p className="text-xs mt-1">Deine Bewertungen erscheinen hier, sobald Klausuren korrigiert wurden.</p>
                </div>
              )}
            </div>

            {/* Nächste Einheiten & Aktionen */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Nächste Einheiten */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Nächste Einheiten</h3>
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const upcomingEinheiten = allReleases
                    .filter(r => r.event_type === 'einheit' && new Date(r.release_date) >= today)
                    .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime())
                    .slice(0, 3);
                  
                  if (upcomingEinheiten.length === 0) {
                    return <p className="text-sm text-gray-500">Keine weiteren Einheiten geplant</p>;
                  }
                  
                  return (
                    <div className="space-y-3">
                      {upcomingEinheiten.map(release => {
                        const legalAreaColor = release.legal_area === 'Zivilrecht' ? 'bg-blue-100 text-blue-700' :
                                              release.legal_area === 'Strafrecht' ? 'bg-red-100 text-red-700' :
                                              release.legal_area === 'Öffentliches Recht' ? 'bg-green-100 text-green-700' :
                                              'bg-gray-100 text-gray-700';
                        return (
                          <div 
                            key={release.id} 
                            className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                            onClick={() => setSelectedReleaseForDetail(release)}
                          >
                            <div className={`flex-shrink-0 p-2 rounded-lg ${release.is_released ? 'bg-green-100' : 'bg-yellow-100'}`}>
                              {release.is_released ? <Unlock className="h-5 w-5 text-green-600" /> : <Lock className="h-5 w-5 text-yellow-600" />}
                            </div>
                            <div className="ml-3 flex-1">
                              <p className="text-sm font-medium text-gray-900">{release.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-gray-500">
                                  {formatDate(release.release_date)}
                                  {release.start_time && ` • ${release.start_time.slice(0, 5)} Uhr`}
                                </p>
                                {release.legal_area && (
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${legalAreaColor}`}>
                                    {release.legal_area}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${release.is_released ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {release.is_released ? 'Verfügbar' : 'Geplant'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <button 
                  onClick={() => setActiveTab('kalender')}
                  className="mt-4 w-full py-2 text-sm text-primary hover:text-primary/80 font-medium"
                >
                  Alle Einheiten anzeigen →
                </button>
              </div>

              {/* Schnellaktionen */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Schnellaktionen</h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => setActiveTab('materialien')}
                    className="w-full flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex-shrink-0 p-2 bg-purple-100 rounded-lg">
                      <FileText className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="ml-3 text-left">
                      <p className="text-sm font-medium text-gray-900">Materialien durchstöbern</p>
                      <p className="text-xs text-gray-500">Skripte, Übungen und mehr</p>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => setActiveTab('klausuren')}
                    className="w-full flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex-shrink-0 p-2 bg-orange-100 rounded-lg">
                      <Upload className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="ml-3 text-left">
                      <p className="text-sm font-medium text-gray-900">Klausur einreichen</p>
                      <p className="text-xs text-gray-500">Zur Korrektur hochladen</p>
                    </div>
                  </button>
                  
                  <a 
                    href="https://member.kraatz-club.de/auth/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex-shrink-0 p-2 bg-indigo-100 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
                    </div>
                    <div className="ml-3 text-left">
                      <p className="text-sm font-medium text-gray-900">Zum Kraatz Club</p>
                      <p className="text-xs text-gray-500">Deine digitale Lernplattform</p>
                    </div>
                  </a>
                </div>
              </div>

              {/* Zoom Backgrounds */}
              {zoomBackgrounds.length > 0 && (
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Zoom-Hintergründe</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {zoomBackgrounds.length} Hintergrund{zoomBackgrounds.length > 1 ? 'e' : ''} verfügbar
                  </p>
                  <div className="space-y-2">
                    {zoomBackgrounds.map((url, index) => (
                      <button
                        key={index}
                        onClick={() => handleDownloadZoomBackground(url, index)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
                            <Video className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900">Hintergrund {index + 1}</p>
                            <p className="text-xs text-gray-500">Klicken zum Herunterladen</p>
                          </div>
                        </div>
                        <Download className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Kurszeiten mit Meeting-Links */}
            {courseTimes.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  Deine Kurszeiten
                  <span className="relative group">
                    <Info className="h-4 w-4 text-gray-400 cursor-help" />
                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      Die genauen Zeiten und Wiederholungseinheiten sind dem Kalender zu entnehmen.
                      <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></span>
                    </span>
                  </span>
                </h3>
                <div className="space-y-3">
                  {['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'].map((dayName, dayIndex) => {
                    const dayTimes = courseTimes.filter(ct => ct.weekday === dayIndex);
                    if (dayTimes.length === 0) return null;
                    return (
                      <div key={dayIndex}>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{dayName}</p>
                        <div className="space-y-2">
                          {dayTimes.map(ct => (
                            <div key={ct.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gray-50 rounded-lg p-3 gap-3">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  <span className="font-medium text-gray-900">{ct.start_time.slice(0, 5)} - {ct.end_time.slice(0, 5)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    ct.legal_area === 'Zivilrecht' ? 'bg-blue-100 text-blue-700' :
                                    ct.legal_area === 'Strafrecht' ? 'bg-red-100 text-red-700' :
                                    'bg-green-100 text-green-700'
                                  }`}>
                                    {ct.legal_area}
                                  </span>
                                  {ct.description && <span className="text-sm text-gray-500">{ct.description}</span>}
                                </div>
                              </div>
                              {ct.meeting_link && (
                                <a
                                  href={ct.meeting_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                  Meeting beitreten
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Deine Dozenten */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Deine Dozenten</h3>
              {dozenten.filter(d => d.name !== 'Verwaltung').length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dozenten.filter(d => d.name !== 'Verwaltung').map(dozent => (
                    <div 
                      key={dozent.id}
                      className="flex flex-col p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-center mb-2">
                        <div className="flex-shrink-0">
                          {dozent.profile_picture_url ? (
                            <img 
                              src={dozent.profile_picture_url} 
                              alt={dozent.name}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-semibold text-lg">
                                {dozent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{dozent.name}</p>
                          <p className="text-xs text-gray-500 truncate">{dozent.email}</p>
                        </div>
                      </div>
                      {dozent.legal_areas && dozent.legal_areas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {dozent.legal_areas.map(area => (
                            <span 
                              key={area}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Noch keine Dozenten zugewiesen</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'kalender' && (
          <div className="space-y-6">
            {/* Kalender Header */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Einheiten-Kalender</h2>
                  <p className="text-sm text-gray-500 mt-1">Übersicht aller geplanten und freigegebenen Einheiten für dich</p>
                </div>
                <div className="flex items-center space-x-4">
                  <button onClick={() => setCalendarMonth(m => m === 0 ? 11 : m - 1)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <ChevronLeft className="h-5 w-5 text-gray-600" />
                  </button>
                  <span className="text-lg font-medium min-w-[150px] text-center">
                    {new Date(calendarYear, calendarMonth).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => setCalendarMonth(m => m === 11 ? 0 : m + 1)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              </div>
              
              {/* Filter & Search */}
              <div className="px-4 py-3 bg-gray-50 border-t border-b border-gray-200">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search */}
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Einheit suchen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                      </div>
                    </div>
                  </div>
                  {/* Legal Area Filter */}
                  <div className="sm:w-48">
                    <select
                      value={legalAreaFilter}
                      onChange={(e) => setLegalAreaFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    >
                      <option value="alle">Alle Rechtsgebiete</option>
                      <option value="Zivilrecht">Zivilrecht</option>
                      <option value="Strafrecht">Strafrecht</option>
                      <option value="Öffentliches Recht">Öffentliches Recht</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Kalender Grid */}
              <div className="p-4">
                <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                    <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-500">{day}</div>
                  ))}
                  {(() => {
                    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                    const firstDay = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7;
                    const days = [];
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    
                    for (let i = 0; i < firstDay; i++) {
                      days.push(<div key={`empty-${i}`} className="bg-white h-24"></div>);
                    }
                    
                    for (let day = 1; day <= daysInMonth; day++) {
                      const date = new Date(calendarYear, calendarMonth, day);
                      // Use local date string to avoid timezone issues
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const dayStr = String(date.getDate()).padStart(2, '0');
                      const dateStr = `${year}-${month}-${dayStr}`;
                      
                      const dayReleases = allReleases.filter(r => {
                        // Check date match
                        const dateMatch = !r.end_date 
                          ? r.release_date === dateStr 
                          : dateStr >= r.release_date && dateStr <= r.end_date;
                        
                        if (!dateMatch) return false;
                        
                        // Apply legal area filter
                        if (legalAreaFilter !== 'alle' && r.legal_area !== legalAreaFilter) {
                          return false;
                        }
                        
                        // Apply search query filter
                        if (searchQuery.trim()) {
                          const query = searchQuery.toLowerCase();
                          const titleMatch = r.title.toLowerCase().includes(query);
                          const descMatch = r.description?.toLowerCase().includes(query) || false;
                          return titleMatch || descMatch;
                        }
                        
                        return true;
                      });
                      const isToday = date.getTime() === today.getTime();
                      const isPast = date < today;
                      
                      days.push(
                        <div key={day} className={`bg-white h-24 p-2 ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}>
                          <div className={`text-sm font-medium ${isToday ? 'text-primary' : isPast ? 'text-gray-400' : 'text-gray-900'}`}>{day}</div>
                          <div className="mt-1 space-y-1 overflow-y-auto max-h-16">
                            {dayReleases.map(release => {
                              const legalAreaAbbr = release.legal_area === 'Zivilrecht' ? 'ZR' : 
                                                   release.legal_area === 'Strafrecht' ? 'StR' : 
                                                   release.legal_area === 'Öffentliches Recht' ? 'ÖR' : '';
                              
                              // Color based on legal area for einheiten, otherwise use event type colors
                              let bgColor, textColor, hoverColor;
                              if (release.event_type === 'einheit') {
                                if (release.legal_area === 'Zivilrecht') {
                                  bgColor = release.is_released ? 'bg-blue-100' : 'bg-blue-50';
                                  textColor = 'text-blue-800';
                                  hoverColor = 'hover:bg-blue-200';
                                } else if (release.legal_area === 'Strafrecht') {
                                  bgColor = release.is_released ? 'bg-red-100' : 'bg-red-50';
                                  textColor = 'text-red-800';
                                  hoverColor = 'hover:bg-red-200';
                                } else if (release.legal_area === 'Öffentliches Recht') {
                                  bgColor = release.is_released ? 'bg-green-100' : 'bg-green-50';
                                  textColor = 'text-green-800';
                                  hoverColor = 'hover:bg-green-200';
                                } else {
                                  bgColor = release.is_released ? 'bg-gray-100' : 'bg-gray-50';
                                  textColor = 'text-gray-800';
                                  hoverColor = 'hover:bg-gray-200';
                                }
                              } else {
                                // Non-einheit events (ferien, etc.)
                                if (release.event_type === 'ferien') {
                                  bgColor = 'bg-orange-100';
                                  textColor = 'text-orange-800';
                                  hoverColor = 'hover:bg-orange-200';
                                } else if (release.event_type === 'dozent_verhinderung') {
                                  bgColor = 'bg-red-100';
                                  textColor = 'text-red-800';
                                  hoverColor = 'hover:bg-red-200';
                                } else {
                                  bgColor = 'bg-gray-100';
                                  textColor = 'text-gray-800';
                                  hoverColor = 'hover:bg-gray-200';
                                }
                              }
                              
                              return (
                                <button 
                                  key={release.id} 
                                  onClick={() => setSelectedReleaseForDetail(release)}
                                  className={`text-xs p-1 rounded truncate flex items-center w-full text-left cursor-pointer hover:opacity-80 transition-opacity ${bgColor} ${textColor} ${hoverColor}`}
                                  title={`${release.title} - Klicken für Details`}
                                >
                                  {release.is_released ? <Unlock className="h-3 w-3 mr-1 flex-shrink-0" /> : <Lock className="h-3 w-3 mr-1 flex-shrink-0" />}
                                  <span className="truncate">
                                    {release.event_type === 'einheit' && legalAreaAbbr && <span className="font-semibold">[{legalAreaAbbr}] </span>}
                                    {release.title}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return days;
                  })()}
                </div>
              </div>
            </div>

            {/* Legende */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Legende</h3>
              <div className="flex items-center space-x-6">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-100 rounded mr-2"></div>
                  <span className="text-sm text-gray-600 flex items-center"><Unlock className="h-3 w-3 mr-1" /> Freigegebene Einheit</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-100 rounded mr-2"></div>
                  <span className="text-sm text-gray-600 flex items-center"><Lock className="h-3 w-3 mr-1" /> Geplante Einheit</span>
                </div>
              </div>
            </div>

            {/* Kommende Einheiten Liste */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Kommende Einheiten</h3>
                {/* Filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Einheit suchen..."
                        value={upcomingSearchQuery}
                        onChange={(e) => setUpcomingSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                      </div>
                    </div>
                  </div>
                  <div className="sm:w-48">
                    <select
                      value={upcomingLegalAreaFilter}
                      onChange={(e) => setUpcomingLegalAreaFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    >
                      <option value="alle">Alle Rechtsgebiete</option>
                      <option value="Zivilrecht">Zivilrecht</option>
                      <option value="Strafrecht">Strafrecht</option>
                      <option value="Öffentliches Recht">Öffentliches Recht</option>
                    </select>
                  </div>
                </div>
              </div>
              <ul className="divide-y divide-gray-200">
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  let upcomingReleases = allReleases.filter(r => new Date(r.release_date) >= today);
                  upcomingReleases = upcomingReleases.filter(r => r.event_type === 'einheit');
                  
                  // Apply legal area filter
                  if (upcomingLegalAreaFilter !== 'alle') {
                    upcomingReleases = upcomingReleases.filter(r => r.legal_area === upcomingLegalAreaFilter);
                  }
                  
                  // Apply search filter
                  if (upcomingSearchQuery.trim()) {
                    const query = upcomingSearchQuery.toLowerCase();
                    upcomingReleases = upcomingReleases.filter(r => 
                      r.title.toLowerCase().includes(query) || 
                      r.description?.toLowerCase().includes(query)
                    );
                  }
                  
                  if (upcomingReleases.length === 0) {
                    return <li className="p-8 text-center text-gray-500">Keine kommenden Einheiten geplant</li>;
                  }
                  
                  const displayedReleases = showAllUpcomingUnits ? upcomingReleases : upcomingReleases.slice(0, 10);
                  const hasMore = upcomingReleases.length > 10;
                  
                  return (
                    <>
                      {displayedReleases.map(release => (
                        <li 
                          key={release.id} 
                          className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => setSelectedReleaseForDetail(release)}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-start sm:items-center flex-1 gap-3">
                              <div className={`h-12 w-12 flex-shrink-0 rounded-xl flex items-center justify-center ${release.is_released ? 'bg-green-100' : 'bg-gray-100'}`}>
                                {release.is_released ? <Unlock className="h-6 w-6 text-green-600" /> : <Lock className="h-6 w-6 text-gray-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h4 className="text-sm font-medium text-gray-900">{release.title}</h4>
                                  {release.legal_area && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      release.legal_area === 'Zivilrecht' ? 'bg-blue-100 text-blue-700' :
                                      release.legal_area === 'Strafrecht' ? 'bg-red-100 text-red-700' :
                                      'bg-green-100 text-green-700'
                                    }`}>
                                      {release.legal_area}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                  <p className="text-xs text-gray-500">
                                    {formatDate(release.release_date)}
                                    {release.start_time && release.end_time && (
                                      <span className="ml-2">
                                        <Clock className="h-3 w-3 inline mr-1" />
                                        {release.start_time.slice(0, 5)} - {release.end_time.slice(0, 5)} Uhr
                                      </span>
                                    )}
                                  </p>
                                  {release.duration_minutes && (
                                    <span className="text-xs text-gray-400">
                                      ({Math.floor(release.duration_minutes / 60)} Std {release.duration_minutes % 60 > 0 ? `${release.duration_minutes % 60} Min` : ''})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 sm:flex-shrink-0">
                              {release.zoom_link && release.is_released && (
                                <a
                                  href={release.zoom_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center justify-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium transition-colors w-full sm:w-auto"
                                >
                                  <Video className="h-3.5 w-3.5 mr-1.5" />
                                  Zoom beitreten
                                </a>
                              )}
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${release.is_released ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                {release.is_released ? 'Verfügbar' : 'Geplant'}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                      {hasMore && !showAllUpcomingUnits && (
                        <li className="p-4 border-t border-gray-200">
                          <button
                            onClick={() => setShowAllUpcomingUnits(true)}
                            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                          >
                            <span>Alle {upcomingReleases.length} Einheiten anzeigen</span>
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </li>
                      )}
                      {showAllUpcomingUnits && hasMore && (
                        <li className="p-4 border-t border-gray-200">
                          <button
                            onClick={() => setShowAllUpcomingUnits(false)}
                            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            <span>Weniger anzeigen</span>
                            <ChevronUp className="h-4 w-4" />
                          </button>
                        </li>
                      )}
                    </>
                  );
                })()}
              </ul>
            </div>

            {/* Sonstiges (Ferien, Verhinderungen, etc.) */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Sonstiges</h3>
                <p className="text-sm text-gray-500 mt-1">Ferien, Verhinderungen und andere Ereignisse</p>
              </div>
              <ul className="divide-y divide-gray-200">
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const upcomingReleases = allReleases.filter(r => new Date(r.release_date) >= today);
                  const upcomingSonstiges = upcomingReleases.filter(r => r.event_type !== 'einheit');
                  
                  if (upcomingSonstiges.length === 0) {
                    return <li className="p-8 text-center text-gray-500">Keine weiteren Ereignisse geplant</li>;
                  }
                  
                  return upcomingSonstiges.slice(0, 10).map(release => {
                    const eventTypeConfig = {
                      'ferien': { icon: '🌞', label: 'Ferien', color: 'bg-orange-100 text-orange-800' },
                      'dozent_verhinderung': { icon: '🚫', label: 'Dozent verhindert', color: 'bg-red-100 text-red-800' },
                      'sonstiges': { icon: '📝', label: 'Sonstiges', color: 'bg-gray-100 text-gray-800' }
                    };
                    const config = eventTypeConfig[release.event_type as keyof typeof eventTypeConfig] || eventTypeConfig['sonstiges'];
                    
                    return (
                      <li 
                        key={release.id} 
                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedReleaseForDetail(release)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-start sm:items-center flex-1 gap-3">
                            <div className={`h-12 w-12 flex-shrink-0 rounded-xl flex items-center justify-center ${config.color}`}>
                              <span className="text-2xl">{config.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h4 className="text-sm font-medium text-gray-900">{release.title}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                                  {config.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-xs text-gray-500">
                                  {release.end_date && release.end_date !== release.release_date ? (
                                    <>
                                      {formatDate(release.release_date)} - {formatDate(release.end_date)}
                                    </>
                                  ) : (
                                    formatDate(release.release_date)
                                  )}
                                </p>
                              </div>
                              {release.description && (
                                <p className="text-xs text-gray-500 mt-1">{release.description}</p>
                              )}
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap self-start sm:self-center ${release.is_released ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {release.is_released ? 'Aktiv' : 'Geplant'}
                          </span>
                        </div>
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'materialien' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">Freigegebene Einheiten</h2>
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                      Hier findest du alle für dich freigegebenen Materialien
                      <span className="relative group">
                        <Info className="h-4 w-4 text-gray-400 cursor-help" />
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                          Bei freigeschalteten Einheiten sind Sachverhalte und Zusatzmaterialien bereits verfügbar. Weitere Einheiten werden nacheinander freigeschaltet.
                          <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></span>
                        </span>
                      </span>
                    </p>
                  </div>
                  {/* Search and Filter */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:w-auto">
                    {/* Legal Area Filter */}
                    <select
                      value={materialsLegalAreaFilter}
                      onChange={(e) => setMaterialsLegalAreaFilter(e.target.value)}
                      className="w-full sm:w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    >
                      <option value="alle">Alle Rechtsgebiete</option>
                      <option value="Zivilrecht">Zivilrecht</option>
                      <option value="Strafrecht">Strafrecht</option>
                      <option value="Öffentliches Recht">Öffentliches Recht</option>
                    </select>
                    {/* Search */}
                    <div className="relative sm:w-56">
                      <input
                        type="text"
                        placeholder="Einheit suchen..."
                        value={materialsSearchQuery}
                        onChange={(e) => setMaterialsSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {(() => {
                let einheitenReleases = releases.filter(r => r.event_type === 'einheit');
                
                // Apply legal area filter
                if (materialsLegalAreaFilter !== 'alle') {
                  einheitenReleases = einheitenReleases.filter(r => r.legal_area === materialsLegalAreaFilter);
                }
                
                // Apply search filter
                if (materialsSearchQuery.trim()) {
                  const query = materialsSearchQuery.toLowerCase();
                  einheitenReleases = einheitenReleases.filter(r => 
                    r.title.toLowerCase().includes(query) || 
                    r.description?.toLowerCase().includes(query)
                  );
                }
                if (einheitenReleases.length === 0) {
                  return (
                    <div className="p-8 text-center">
                      <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Materialien verfügbar</h3>
                      <p className="text-gray-500">Sobald Materialien für dich freigegeben werden, erscheinen sie hier.</p>
                    </div>
                  );
                }
                return (
                  <ul className="divide-y divide-gray-200">
                    {einheitenReleases.map(release => (
                    <li key={release.id} className="p-4">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedRelease(expandedRelease === release.id ? null : release.id)}
                      >
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-green-600" />
                          </div>
                          <div className="ml-4">
                            <h4 className="text-sm font-medium text-gray-900">{release.title}</h4>
                            <p className="text-xs text-gray-500">
                              {formatDate(release.release_date)}
                              {release.legal_area && <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{release.legal_area}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">
                            {(() => {
                              // Ordnerpfad eines Materials ermitteln
                              const getMaterialFolderPath = (materialId: string): string[] => {
                                const material = materials.find(m => m.id === materialId);
                                if (!material?.folder_id) return [];
                                const path: string[] = [];
                                let currentFolderId: string | null = material.folder_id;
                                while (currentFolderId) {
                                  const folder = folders.find(f => f.id === currentFolderId);
                                  if (!folder) break;
                                  path.unshift(folder.name);
                                  currentFolderId = folder.parent_id;
                                }
                                return path;
                              };
                              const allBundeslandFolderNames = [
                                'Baden-Württemberg', 'BaWü', 'Bayern', 'Berlin', 'Brandenburg',
                                'Berlin/Brandenburg', 'Berlin/ Brandenburg', 'Bremen', 'Hamburg', 'Hessen',
                                'Mecklenburg-Vorpommern', 'MV', 'Niedersachsen', 'Nordrhein-Westfalen', 'NRW',
                                'Rheinland-Pfalz', 'RP', 'Saarland', 'Sachsen', 'Sachsen-Anhalt',
                                'Schleswig-Holstein', 'SH', 'Thüringen'
                              ];
                              const folderMatchesState = (folderName: string): boolean => {
                                if (!teilnehmerStateLaw) return true;
                                if (folderName === teilnehmerStateLaw) return true;
                                if ((teilnehmerStateLaw === 'Berlin' || teilnehmerStateLaw === 'Brandenburg') && 
                                    (folderName === 'Berlin/Brandenburg' || folderName === 'Berlin/ Brandenburg')) return true;
                                return false;
                              };
                              const isMaterialInValidBundesland = (materialId: string): boolean => {
                                if (!teilnehmerStateLaw) return true;
                                const path = getMaterialFolderPath(materialId);
                                const bundeslandFolderInPath = path.find(name => allBundeslandFolderNames.includes(name));
                                if (!bundeslandFolderInPath) return true;
                                return folderMatchesState(bundeslandFolderInPath);
                              };
                              
                              // Zähle nur Materialien aus gefilterten Ordnern
                              let visibleMaterialCount = 0;
                              
                              // Direkte Materialien
                              const allMaterialIds = [...new Set([...(release.material_ids || []), ...(release.solution_material_ids || [])])];
                              const nonSolutionCount = allMaterialIds.filter(id => {
                                const material = materials.find(m => m.id === id);
                                if (!material) return false;
                                const title = material.title.toLowerCase();
                                if (title.includes('lösung') || title.includes('loesung') || title.includes('musterlösung') || title.includes('musterlosung')) return false;
                                return isMaterialInValidBundesland(id);
                              }).length;
                              visibleMaterialCount += nonSolutionCount;
                              
                              // Ordner-Materialien (nur gefilterte)
                              const getAllMaterialsFromFolder = (folderId: string): string[] => {
                                const result: string[] = [];
                                const folderMaterials = materials.filter(m => m.folder_id === folderId);
                                folderMaterials.forEach(m => {
                                  if (!result.includes(m.id)) result.push(m.id);
                                });
                                const children = folders.filter(f => f.parent_id === folderId);
                                children.forEach(child => {
                                  const childMaterials = getAllMaterialsFromFolder(child.id);
                                  childMaterials.forEach(id => {
                                    if (!result.includes(id)) result.push(id);
                                  });
                                });
                                return result;
                              };
                              
                              release.folder_ids.forEach(folderId => {
                                const folder = folders.find(f => f.id === folderId);
                                if (!folder) return;
                                // Filter by user's Bundesland
                                if (!isFolderMatchingUserState(folder.name, release.title)) return;
                                
                                const folderMaterialIds = getAllMaterialsFromFolder(folderId);
                                const folderNonSolutionCount = folderMaterialIds.filter(id => {
                                  const material = materials.find(m => m.id === id);
                                  if (!material) return false;
                                  const title = material.title.toLowerCase();
                                  if (title.includes('lösung') || title.includes('loesung') || title.includes('musterlösung') || title.includes('musterlosung')) return false;
                                  return isMaterialInValidBundesland(id);
                                }).length;
                                visibleMaterialCount += folderNonSolutionCount;
                              });
                              
                              return visibleMaterialCount;
                            })()} Materialien
                          </span>
                          {expandedRelease === release.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </div>
                      </div>
                      {expandedRelease === release.id && (
                        <div className="mt-4 pl-0 sm:pl-14 space-y-4">
                          {/* Termin-Infos */}
                          {(release.start_time || release.zoom_link) && (
                            <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 rounded-lg">
                              {release.start_time && release.end_time && (
                                <div className="flex items-center text-sm text-blue-800">
                                  <Clock className="h-4 w-4 mr-1.5" />
                                  {release.start_time.slice(0, 5)} - {release.end_time.slice(0, 5)} Uhr
                                  {release.duration_minutes && (
                                    <span className="ml-1 text-blue-600">
                                      ({Math.floor(release.duration_minutes / 60)} Std {release.duration_minutes % 60 > 0 ? `${release.duration_minutes % 60} Min` : ''})
                                    </span>
                                  )}
                                </div>
                              )}
                              {release.zoom_link && (
                                <a
                                  href={release.zoom_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium transition-colors"
                                >
                                  <Video className="h-3.5 w-3.5 mr-1.5" />
                                  Zoom beitreten
                                </a>
                              )}
                            </div>
                          )}

                          {release.description && <p className="text-sm text-gray-600">{release.description}</p>}
                          
                          {/* Materialien */}
                          <div className="space-y-2">
                            <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Materialien</h5>
                            {(() => {
                              // Ordnerpfad eines Materials ermitteln
                              const getMaterialFolderPath = (materialId: string): string[] => {
                                const material = materials.find(m => m.id === materialId);
                                if (!material?.folder_id) return [];
                                const path: string[] = [];
                                let currentFolderId: string | null = material.folder_id;
                                while (currentFolderId) {
                                  const folder = folders.find(f => f.id === currentFolderId);
                                  if (!folder) break;
                                  path.unshift(folder.name);
                                  currentFolderId = folder.parent_id;
                                }
                                return path;
                              };
                              
                              const allBundeslandFolderNames = [
                                'Baden-Württemberg', 'BaWü', 'Bayern', 'Berlin', 'Brandenburg',
                                'Berlin/Brandenburg', 'Berlin/ Brandenburg', 'Bremen', 'Hamburg', 'Hessen',
                                'Mecklenburg-Vorpommern', 'MV', 'Niedersachsen', 'Nordrhein-Westfalen', 'NRW',
                                'Rheinland-Pfalz', 'RP', 'Saarland', 'Sachsen', 'Sachsen-Anhalt',
                                'Schleswig-Holstein', 'SH', 'Thüringen'
                              ];
                              
                              const folderMatchesState = (folderName: string): boolean => {
                                if (!teilnehmerStateLaw) return true;
                                if (folderName === teilnehmerStateLaw) return true;
                                if ((teilnehmerStateLaw === 'Berlin' || teilnehmerStateLaw === 'Brandenburg') && 
                                    (folderName === 'Berlin/Brandenburg' || folderName === 'Berlin/ Brandenburg')) return true;
                                return false;
                              };
                              
                              const isMaterialInValidBundesland = (materialId: string): boolean => {
                                if (!teilnehmerStateLaw) return true;
                                const path = getMaterialFolderPath(materialId);
                                const bundeslandFolderInPath = path.find(name => allBundeslandFolderNames.includes(name));
                                if (!bundeslandFolderInPath) return true;
                                return folderMatchesState(bundeslandFolderInPath);
                              };
                              
                              const allMaterialIds = [...new Set([...(release.material_ids || []), ...(release.solution_material_ids || [])])];
                              
                              const nonSolutionIds = allMaterialIds.filter(id => {
                                const material = materials.find(m => m.id === id);
                                if (!material) return false;
                                // Filtere Lösungen heraus
                                const title = material.title.toLowerCase().normalize('NFC');
                                if (title.includes('lösung') || title.includes('loesung') || title.includes('musterlösung') || title.includes('musterlosung')) return false;
                                // Filtere nach Bundesland
                                return isMaterialInValidBundesland(id);
                              });
                              
                              return nonSolutionIds.map(id => {
                                const material = materials.find(m => m.id === id);
                                if (!material) return null;
                                return (
                                  <a
                                    key={id}
                                    href={material.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors gap-3"
                                  >
                                    <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                    <span className="text-sm text-gray-900 flex-1 break-words">{material.title}</span>
                                    <Download className="h-5 w-5 text-primary flex-shrink-0" />
                                  </a>
                                );
                              });
                            })()}
                            {release.folder_ids.map(id => {
                              const folder = folders.find(f => f.id === id);
                              if (!folder) return null;
                              // Filter by user's Bundesland (allow all for Klausur 14)
                              if (!isFolderMatchingUserState(folder.name, release.title)) return null;
                              return (
                                <div key={id} className="flex items-center p-3 bg-blue-50 rounded-lg">
                                  <FolderOpen className="h-5 w-5 text-blue-500 mr-3" />
                                  <span className="text-sm text-gray-900">{folder.name}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Lösungen - nur wenn freigegeben */}
                          {release.solution_material_ids && release.solution_material_ids.length > 0 && (
                            <div className="space-y-2">
                              <h5 className="text-xs font-medium text-yellow-700 uppercase tracking-wider flex items-center">
                                <Award className="h-3.5 w-3.5 mr-1" />
                                Lösungen
                              </h5>
                              {(() => {
                                // Hilfsfunktion: Prüfe ob aktuelle Zeit (Berlin) nach der Release-Zeit ist
                                const isReleaseTimeReached = (dateStr: string, timeStr: string): boolean => {
                                  const now = new Date();
                                  const berlinNowStr = now.toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' });
                                  const [berlinDate, berlinTime] = berlinNowStr.split(' ');
                                  const [berlinHour, berlinMin] = berlinTime.split(':').map(Number);
                                  const [releaseHour, releaseMin] = timeStr.split(':').map(Number);
                                  
                                  if (dateStr !== berlinDate) {
                                    return new Date(berlinDate) >= new Date(dateStr);
                                  }
                                  if (berlinHour > releaseHour) return true;
                                  if (berlinHour < releaseHour) return false;
                                  return berlinMin >= releaseMin;
                                };
                                
                                let canShowSolutions = release.solutions_released;
                                
                                if (!canShowSolutions) {
                                  if (release.solution_release_date) {
                                    canShowSolutions = isReleaseTimeReached(
                                      release.solution_release_date,
                                      release.solution_release_time || '00:00'
                                    );
                                  } else if (release.end_time) {
                                    canShowSolutions = isReleaseTimeReached(
                                      release.release_date,
                                      release.end_time
                                    );
                                  }
                                }
                                
                                // Hilfsfunktion: Prüfe ob Material eine Lösung ist
                                const isLoesungMaterial = (m: TeachingMaterial) => {
                                  const title = m.title.toLowerCase().normalize('NFC');
                                  return title.includes('lösung') || 
                                         title.includes('loesung') || 
                                         title.includes('musterlösung') ||
                                         title.includes('musterlosung');
                                };
                                
                                // Ordnerpfad eines Materials ermitteln
                                const getMaterialFolderPath = (materialId: string): string[] => {
                                  const material = materials.find(m => m.id === materialId);
                                  if (!material?.folder_id) return [];
                                  const path: string[] = [];
                                  let currentFolderId: string | null = material.folder_id;
                                  while (currentFolderId) {
                                    const folder = folders.find(f => f.id === currentFolderId);
                                    if (!folder) break;
                                    path.unshift(folder.name);
                                    currentFolderId = folder.parent_id;
                                  }
                                  return path;
                                };
                                
                                const allBundeslandFolderNames = [
                                  'Baden-Württemberg', 'BaWü', 'Bayern', 'Berlin', 'Brandenburg',
                                  'Berlin/Brandenburg', 'Berlin/ Brandenburg', 'Bremen', 'Hamburg', 'Hessen',
                                  'Mecklenburg-Vorpommern', 'MV', 'Niedersachsen', 'Nordrhein-Westfalen', 'NRW',
                                  'Rheinland-Pfalz', 'RP', 'Saarland', 'Sachsen', 'Sachsen-Anhalt',
                                  'Schleswig-Holstein', 'SH', 'Thüringen'
                                ];
                                
                                const folderMatchesState = (folderName: string): boolean => {
                                  if (!teilnehmerStateLaw) return true;
                                  if (folderName === teilnehmerStateLaw) return true;
                                  if ((teilnehmerStateLaw === 'Berlin' || teilnehmerStateLaw === 'Brandenburg') && 
                                      (folderName === 'Berlin/Brandenburg' || folderName === 'Berlin/ Brandenburg')) return true;
                                  return false;
                                };
                                
                                const isMaterialInValidBundesland = (materialId: string): boolean => {
                                  if (!teilnehmerStateLaw) return true;
                                  const path = getMaterialFolderPath(materialId);
                                  const bundeslandFolderInPath = path.find(name => allBundeslandFolderNames.includes(name));
                                  if (!bundeslandFolderInPath) return true;
                                  return folderMatchesState(bundeslandFolderInPath);
                                };
                                    
                                // Filtere nur Lösungen aus solution_material_ids UND nach Bundesland
                                const actualSolutionIds = release.solution_material_ids.filter(id => {
                                  const material = materials.find(m => m.id === id);
                                  if (!material) return false;
                                  if (!isLoesungMaterial(material)) return false;
                                  return isMaterialInValidBundesland(id);
                                });
                                    
                                    if (actualSolutionIds.length === 0) return null;
                                    
                                    return canShowSolutions ? (
                                      actualSolutionIds.map(id => {
                                        const material = materials.find(m => m.id === id);
                                        if (!material) return null;
                                        return (
                                          <a
                                            key={id}
                                            href={material.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-start p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors border border-yellow-200 gap-3"
                                          >
                                            <FileText className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                                            <span className="text-sm text-gray-900 flex-1 break-words">{material.title}</span>
                                            <Download className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                                          </a>
                                        );
                                      })
                                    ) : (
                                      <div className="flex items-center p-3 bg-gray-100 rounded-lg text-gray-500">
                                        <Lock className="h-5 w-5 mr-3" />
                                        <span className="text-sm">Lösungen werden nach Ende des Termins freigeschaltet</span>
                                      </div>
                                    );
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === 'klausuren' && (
          <div className="space-y-6">
            {/* Upload Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                <Upload className="h-4 w-4 mr-2" />
                Klausur hochladen
              </button>
            </div>

            {/* Klausuren Liste */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Meine Klausuren</h2>
                <p className="text-sm text-gray-500 mt-1">Übersicht deiner eingereichten Klausuren und deren Korrekturstatus</p>
              </div>
              {klausuren.length === 0 ? (
                <div className="p-8 text-center">
                  <PenTool className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Klausuren eingereicht</h3>
                  <p className="text-gray-500">Lade deine erste Klausur zur Korrektur hoch.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {klausuren.map(klausur => (
                    <li key={klausur.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <PenTool className="h-5 w-5 text-primary" />
                          </div>
                          <div className="ml-4">
                            <h4 className="text-sm font-medium text-gray-900">{klausur.title}</h4>
                            <p className="text-xs text-gray-500">
                              {formatDate(klausur.submitted_at)}
                              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{klausur.legal_area}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          {getStatusBadge(klausur.status)}
                          <button onClick={() => downloadKlausur(klausur)} className="text-primary hover:text-primary/80">
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {klausur.status === 'completed' && (klausur.score !== undefined || klausur.feedback) && (
                        <div className="mt-3 ml-14 p-3 bg-green-50 rounded-lg">
                          {klausur.score !== undefined && <p className="text-sm font-medium text-green-800">Punktzahl: {klausur.score}</p>}
                          {klausur.feedback && <p className="text-sm text-green-700 mt-1">{klausur.feedback}</p>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowUploadModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Klausur hochladen</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="z.B. Klausur 1 - BGB AT"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rechtsgebiet *</label>
                  <select
                    value={uploadLegalArea}
                    onChange={(e) => setUploadLegalArea(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Bitte wähle...</option>
                    <option value="Zivilrecht">Zivilrecht</option>
                    <option value="Strafrecht">Strafrecht</option>
                    <option value="Öffentliches Recht">Öffentliches Recht</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Datei *</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {uploadFile && <p className="text-xs text-gray-500 mt-1">{uploadFile.name}</p>}
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSubmitKlausur}
                  disabled={!uploadTitle || !uploadLegalArea || !uploadFile || isUploading}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Wird hochgeladen...' : 'Hochladen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Einstellungen Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowSettingsModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">Einstellungen</h3>
              
              {/* Erfolgsmeldung / Fehlermeldung */}
              {settingsMessage && (
                <div className={`mb-4 p-3 rounded-lg ${settingsMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {settingsMessage.text}
                </div>
              )}

              {/* E-Mail Adresse */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">E-Mail Adresse</h4>
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-medium text-primary">{user?.email?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-900">{user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Passwort ändern */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Passwort ändern</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Neues Passwort</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mindestens 6 Zeichen"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Passwort bestätigen</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Passwort wiederholen"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <button
                    onClick={handlePasswordChange}
                    disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                    className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatingPassword ? 'Wird geändert...' : 'Passwort ändern'}
                  </button>
                </div>
              </div>

              {/* Schließen Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Einheit Detail Modal */}
      {selectedReleaseForDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={() => setSelectedReleaseForDetail(null)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-auto p-6 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${selectedReleaseForDetail.is_released ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {selectedReleaseForDetail.is_released ? <Unlock className="h-6 w-6 text-green-600" /> : <Lock className="h-6 w-6 text-gray-400" />}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{selectedReleaseForDetail.title}</h2>
                      <p className="text-sm text-gray-500">{formatDate(selectedReleaseForDetail.release_date)}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedReleaseForDetail(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Status & Rechtsgebiet */}
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedReleaseForDetail.is_released ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {selectedReleaseForDetail.is_released ? '✓ Freigegeben' : '🔒 Noch nicht freigegeben'}
                </span>
                {selectedReleaseForDetail.legal_area && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedReleaseForDetail.legal_area === 'Zivilrecht' ? 'bg-blue-100 text-blue-700' :
                    selectedReleaseForDetail.legal_area === 'Strafrecht' ? 'bg-red-100 text-red-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {selectedReleaseForDetail.legal_area}
                  </span>
                )}
                {selectedReleaseForDetail.unit_type && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
                    {selectedReleaseForDetail.unit_type.includes('wiederholung') ? 'Wiederholungseinheit' : 'Unterricht'}
                  </span>
                )}
              </div>

              {/* Zeit & Zoom */}
              {(selectedReleaseForDetail.start_time || selectedReleaseForDetail.zoom_link) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-medium text-blue-800 mb-3 flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Termin-Informationen
                  </h3>
                  <div className="space-y-3">
                    {selectedReleaseForDetail.start_time && selectedReleaseForDetail.end_time && (
                      <div className="flex items-center text-blue-800">
                        <span className="font-medium">Zeit:</span>
                        <span className="ml-2">{selectedReleaseForDetail.start_time.slice(0, 5)} - {selectedReleaseForDetail.end_time.slice(0, 5)} Uhr</span>
                        {selectedReleaseForDetail.duration_minutes && (
                          <span className="ml-2 text-blue-600">
                            ({Math.floor(selectedReleaseForDetail.duration_minutes / 60)} Std {selectedReleaseForDetail.duration_minutes % 60 > 0 ? `${selectedReleaseForDetail.duration_minutes % 60} Min` : ''})
                          </span>
                        )}
                      </div>
                    )}
                    {selectedReleaseForDetail.zoom_link && (
                      <a
                        href={selectedReleaseForDetail.zoom_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                      >
                        <Video className="h-4 w-4 mr-2" />
                        Zoom-Meeting beitreten
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Beschreibung */}
              {selectedReleaseForDetail.description && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Beschreibung</h3>
                  <p className="text-gray-600 bg-gray-50 rounded-lg p-3">{selectedReleaseForDetail.description}</p>
                </div>
              )}

              {/* Materialien - sofort verfügbar wenn Einheit freigegeben */}
              {selectedReleaseForDetail.is_released && (() => {
                // Hilfsfunktion um zu prüfen ob ein Material eine Lösung ist (nur nach Titel)
                const isLoesungMaterial = (m: TeachingMaterial) => {
                  // Normalize to handle different Unicode representations (e.g., combining diaeresis vs precomposed)
                  const title = m.title.toLowerCase().normalize('NFC');
                  return title.includes('lösung') || 
                         title.includes('loesung') || 
                         title.includes('musterlösung') ||
                         title.includes('musterlosung');
                };
                
                // Nur Materialien verwenden, die der Dozent explizit ausgewählt hat:
                // 1. material_ids - direkt ausgewählte Materialien
                // 2. solution_material_ids - vom Dozenten ausgewählte Dokumente aus dem Klausur-Ordner
                const directMaterials = selectedReleaseForDetail.material_ids || [];
                const selectedKlausurMaterials = selectedReleaseForDetail.solution_material_ids || [];
                
                const allSelectedMaterialIds = [...new Set([...directMaterials, ...selectedKlausurMaterials])];
                
                // Ordnerpfad eines Materials ermitteln (von unten nach oben)
                const getMaterialFolderPath = (materialId: string): string[] => {
                  const material = materials.find(m => m.id === materialId);
                  if (!material?.folder_id) return [];
                  
                  const path: string[] = [];
                  let currentFolderId: string | null = material.folder_id;
                  
                  while (currentFolderId) {
                    const folder = folders.find(f => f.id === currentFolderId);
                    if (!folder) break;
                    path.unshift(folder.name);
                    currentFolderId = folder.parent_id;
                  }
                  
                  return path;
                };
                
                // Liste aller bekannten Bundesland-Ordnernamen
                const allBundeslandFolderNames = [
                  'Baden-Württemberg', 'BaWü', 'Bayern', 'Berlin', 'Brandenburg',
                  'Berlin/Brandenburg', 'Berlin/ Brandenburg', 'Bremen', 'Hamburg', 'Hessen',
                  'Mecklenburg-Vorpommern', 'MV', 'Niedersachsen', 'Nordrhein-Westfalen', 'NRW',
                  'Rheinland-Pfalz', 'RP', 'Saarland', 'Sachsen', 'Sachsen-Anhalt',
                  'Schleswig-Holstein', 'SH', 'Thüringen'
                ];
                
                // Prüfe ob ein Ordnername zum Bundesland des Teilnehmers passt
                const folderMatchesState = (folderName: string): boolean => {
                  if (!teilnehmerStateLaw) return true;
                  if (folderName === teilnehmerStateLaw) return true;
                  // Sonderfall Berlin/Brandenburg
                  if ((teilnehmerStateLaw === 'Berlin' || teilnehmerStateLaw === 'Brandenburg') && 
                      (folderName === 'Berlin/Brandenburg' || folderName === 'Berlin/ Brandenburg')) return true;
                  return false;
                };
                
                // Prüfe ob Material im passenden Bundesland-Ordner liegt
                const isMaterialInValidBundesland = (materialId: string): boolean => {
                  if (!teilnehmerStateLaw) return true;
                  
                  const path = getMaterialFolderPath(materialId);
                  
                  // Prüfe ob irgendein Ordner im Pfad ein Bundesland-Ordner ist
                  const bundeslandFolderInPath = path.find(name => allBundeslandFolderNames.includes(name));
                  
                  // Kein Bundesland-Ordner im Pfad → allgemeines Material → anzeigen
                  if (!bundeslandFolderInPath) return true;
                  
                  // Bundesland-Ordner gefunden → nur anzeigen wenn er zum Teilnehmer passt
                  return folderMatchesState(bundeslandFolderInPath);
                };
                
                // Debug: Prüfe ID-Typen und Vergleich
                const testId = 'a6c27140-3fb1-462a-8217-a79c355350b0';
                const foundById = materials.find(m => m.id === testId);
                const foundByString = materials.find(m => String(m.id) === testId);
                const foundByLoose = materials.find(m => m.id == testId);
                
                console.log('🔬 ID-DIAGNOSE:', {
                  materialsCount: materials.length,
                  firstMaterialId: materials[0]?.id,
                  firstMaterialIdType: typeof materials[0]?.id,
                  testId,
                  testIdType: typeof testId,
                  foundById: foundById?.title || 'nicht gefunden',
                  foundByString: foundByString?.title || 'nicht gefunden',
                  foundByLoose: foundByLoose?.title || 'nicht gefunden',
                  directCompare: materials[0]?.id === testId,
                  stringCompare: String(materials[0]?.id) === testId,
                  looseCompare: materials[0]?.id == testId,
                });
                
                console.log('🔍 DETAIL-MODAL BUNDESLAND-FILTER:', {
                  releaseTitle: selectedReleaseForDetail.title,
                  releaseId: selectedReleaseForDetail.id,
                  teilnehmerStateLaw,
                  totalMaterialsInState: materials.length,
                  totalFoldersInState: folders.length,
                  directMaterialIds: selectedReleaseForDetail.material_ids,
                  solutionMaterialIds: selectedReleaseForDetail.solution_material_ids,
                  allSelectedMaterialIds,
                  sampleMaterials: allSelectedMaterialIds.slice(0, 5).map(id => {
                    const m = materials.find(x => x.id === id);
                    const path = getMaterialFolderPath(id);
                    const isLoesung = m ? isLoesungMaterial(m) : false;
                    const isValidBL = isMaterialInValidBundesland(id);
                    return { 
                      id, 
                      idType: typeof id,
                      title: m?.title, 
                      found: !!m,
                      folder_id: m?.folder_id, 
                      path,
                      isLoesung,
                      isValidBL,
                      show: m && !isLoesung && isValidBL
                    };
                  })
                });
                
                // Filtere Lösungen heraus - NUR nach Titel UND Bundesland
                const nonSolutionMaterialIds = allSelectedMaterialIds.filter(id => {
                  const material = materials.find(m => m.id === id);
                  if (!material) {
                    console.log(`  ❌ Material ${id}: nicht gefunden`);
                    return false;
                  }
                  if (isLoesungMaterial(material)) {
                    console.log(`  ❌ Material ${id}: ist Lösung (${material.title})`);
                    return false;
                  }
                  const valid = isMaterialInValidBundesland(id);
                  console.log(`  ${valid ? '✅' : '❌'} Material ${id}: ${material.title} | BL-Valid: ${valid}`);
                  return valid;
                });
                
                console.log(`📊 Ergebnis: ${nonSolutionMaterialIds.length} von ${allSelectedMaterialIds.length} Materialien werden angezeigt`);
                
                if (nonSolutionMaterialIds.length === 0) return null;
                
                return (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Materialien ({nonSolutionMaterialIds.length})
                    </h3>
                    <div className="space-y-2">
                      {nonSolutionMaterialIds.map(id => {
                        const material = materials.find(m => m.id === id);
                        if (!material) return null;
                        return (
                          <button
                            key={id}
                            onClick={() => handleDownloadMaterial(material)}
                            className="flex items-start w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 text-left gap-3"
                          >
                            <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-900 flex-1 break-words">{material.title}</span>
                            <Download className="h-5 w-5 text-primary flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Ordner - sofort verfügbar wenn Einheit freigegeben */}
              {selectedReleaseForDetail.is_released && selectedReleaseForDetail.folder_ids.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Freigegebene Ordner
                  </h3>
                  <div className="space-y-2">
                    {selectedReleaseForDetail.folder_ids.map(id => {
                      const folder = folders.find(f => f.id === id);
                      if (!folder) return null;
                      // Filter by user's Bundesland (allow all for Klausur 14)
                      if (!isFolderMatchingUserState(folder.name, selectedReleaseForDetail.title)) return null;
                      return (
                        <div key={id} className="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <FolderOpen className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0" />
                          <span className="text-sm text-gray-900">{folder.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lösungen - zeitverzögert freigegeben */}
              {selectedReleaseForDetail.is_released && (() => {
                // Hilfsfunktion um zu prüfen ob ein Material eine Lösung ist (nur nach Titel)
                const isLoesungMaterial = (m: TeachingMaterial) => {
                  // Normalize to handle different Unicode representations (e.g., combining diaeresis vs precomposed)
                  const title = m.title.toLowerCase().normalize('NFC');
                  return title.includes('lösung') || 
                         title.includes('loesung') || 
                         title.includes('musterlösung') ||
                         title.includes('musterlosung');
                };
                
                // Nur Materialien verwenden, die der Dozent explizit ausgewählt hat:
                // 1. material_ids - direkt ausgewählte Materialien
                // 2. solution_material_ids - vom Dozenten ausgewählte Dokumente aus dem Klausur-Ordner
                const directMaterials = selectedReleaseForDetail.material_ids || [];
                const selectedKlausurMaterials = selectedReleaseForDetail.solution_material_ids || [];
                
                const allSelectedMaterialIds = [...new Set([...directMaterials, ...selectedKlausurMaterials])];
                
                // Ordnerpfad eines Materials ermitteln
                const getMaterialFolderPath = (materialId: string): string[] => {
                  const material = materials.find(m => m.id === materialId);
                  if (!material?.folder_id) return [];
                  const path: string[] = [];
                  let currentFolderId: string | null = material.folder_id;
                  while (currentFolderId) {
                    const folder = folders.find(f => f.id === currentFolderId);
                    if (!folder) break;
                    path.unshift(folder.name);
                    currentFolderId = folder.parent_id;
                  }
                  return path;
                };
                
                const allBundeslandFolderNames = [
                  'Baden-Württemberg', 'BaWü', 'Bayern', 'Berlin', 'Brandenburg',
                  'Berlin/Brandenburg', 'Berlin/ Brandenburg', 'Bremen', 'Hamburg', 'Hessen',
                  'Mecklenburg-Vorpommern', 'MV', 'Niedersachsen', 'Nordrhein-Westfalen', 'NRW',
                  'Rheinland-Pfalz', 'RP', 'Saarland', 'Sachsen', 'Sachsen-Anhalt',
                  'Schleswig-Holstein', 'SH', 'Thüringen'
                ];
                
                const folderMatchesState = (folderName: string): boolean => {
                  if (!teilnehmerStateLaw) return true;
                  if (folderName === teilnehmerStateLaw) return true;
                  if ((teilnehmerStateLaw === 'Berlin' || teilnehmerStateLaw === 'Brandenburg') && 
                      (folderName === 'Berlin/Brandenburg' || folderName === 'Berlin/ Brandenburg')) return true;
                  return false;
                };
                
                const isMaterialInValidBundesland = (materialId: string): boolean => {
                  if (!teilnehmerStateLaw) return true;
                  const path = getMaterialFolderPath(materialId);
                  const bundeslandFolderInPath = path.find(name => allBundeslandFolderNames.includes(name));
                  if (!bundeslandFolderInPath) return true;
                  return folderMatchesState(bundeslandFolderInPath);
                };
                
                // Finde alle Lösungen NUR nach Titel aus den ausgewählten Materialien UND filtere nach Bundesland
                const solutionIds = allSelectedMaterialIds.filter(id => {
                  const material = materials.find(m => m.id === id);
                  if (!material) return false;
                  if (!isLoesungMaterial(material)) return false;
                  return isMaterialInValidBundesland(id);
                });
                
                if (solutionIds.length === 0) return null;
                
                // Debug-Log für Lösungsfreigabe
                const now = new Date();
                
                // Hilfsfunktion: Prüfe ob aktuelle Zeit (Berlin) nach der Release-Zeit ist
                const isReleaseTimeReached = (dateStr: string, timeStr: string): boolean => {
                  // Aktuelle Zeit in Berlin als YYYY-MM-DD HH:MM
                  const berlinNowStr = now.toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }); // "2026-03-06 18:40:15"
                  const [berlinDate, berlinTime] = berlinNowStr.split(' ');
                  const [berlinHour, berlinMin] = berlinTime.split(':').map(Number);
                  
                  // Release Zeit
                  const [releaseHour, releaseMin] = timeStr.split(':').map(Number);
                  
                  // Vergleiche Datum und Zeit
                  if (dateStr !== berlinDate) {
                    // Verschiedene Tage - prüfe ob aktuelles Datum nach Release-Datum ist
                    return new Date(berlinDate) >= new Date(dateStr);
                  }
                  
                  // Gleicher Tag - vergleiche Stunden und Minuten
                  if (berlinHour > releaseHour) return true;
                  if (berlinHour < releaseHour) return false;
                  return berlinMin >= releaseMin;
                };
                
                let canShowSolutions = selectedReleaseForDetail.solutions_released;
                
                if (!canShowSolutions) {
                  if (selectedReleaseForDetail.solution_release_date) {
                    canShowSolutions = isReleaseTimeReached(
                      selectedReleaseForDetail.solution_release_date,
                      selectedReleaseForDetail.solution_release_time || '00:00'
                    );
                  } else if (selectedReleaseForDetail.end_time) {
                    canShowSolutions = isReleaseTimeReached(
                      selectedReleaseForDetail.release_date,
                      selectedReleaseForDetail.end_time
                    );
                  }
                }
                
                // Debug-Info (deaktiviert)
                // const berlinNowStr = now.toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' });
                // console.log('[DEBUG] Solution release check:', {
                //   release_date: selectedReleaseForDetail.release_date,
                //   solutions_released: selectedReleaseForDetail.solutions_released,
                //   solution_release_date: selectedReleaseForDetail.solution_release_date,
                //   solution_release_time: selectedReleaseForDetail.solution_release_time,
                //   end_time: selectedReleaseForDetail.end_time,
                //   current_Berlin: berlinNowStr,
                //   canShowSolutions,
                //   solutionCount: solutionIds.length
                // });
                
                return (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-yellow-700 mb-3 flex items-center">
                      <Award className="h-4 w-4 mr-2" />
                      Lösungen ({solutionIds.length})
                    </h3>
                    {canShowSolutions ? (
                      <div className="space-y-2">
                        {solutionIds.map(id => {
                          const material = materials.find(m => m.id === id);
                          if (!material) return null;
                          return (
                            <button
                              key={id}
                              onClick={() => handleDownloadMaterial(material)}
                              className="flex items-start w-full p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors border border-yellow-200 text-left gap-3"
                            >
                              <FileText className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                              <span className="text-sm text-gray-900 flex-1 break-words">{material.title}</span>
                              <Download className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <Lock className="h-6 w-6 text-yellow-500 mr-3 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800 mb-1">
                              Lösungen noch nicht verfügbar
                            </p>
                            <p className="text-sm text-yellow-700">
                              {selectedReleaseForDetail.solution_release_date ? (
                                <>
                                  Die Lösungen werden am <strong>{formatDate(selectedReleaseForDetail.solution_release_date)}</strong>
                                  {selectedReleaseForDetail.solution_release_time && <> um <strong>{selectedReleaseForDetail.solution_release_time.slice(0, 5)} Uhr</strong></>} freigegeben.
                                </>
                              ) : selectedReleaseForDetail.end_time ? (
                                <>
                                  Die Lösungen werden nach Ende der Einheit um <strong>{selectedReleaseForDetail.end_time.slice(0, 5)} Uhr</strong> freigegeben.
                                </>
                              ) : (
                                <>Die Lösungen werden nach Ende der Einheit freigegeben.</>
                              )}
                            </p>
                            <div className="mt-2 text-xs text-yellow-600">
                              {solutionIds.length} Lösung(en) werden verfügbar sein
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Nicht freigegeben Hinweis - nur wenn Einheit noch nicht freigegeben */}
              {!selectedReleaseForDetail.is_released && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                  <Lock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Diese Einheit ist noch nicht freigegeben</h4>
                  <p className="text-gray-500">
                    Die Materialien werden am {formatDate(selectedReleaseForDetail.release_date)} verfügbar sein.
                  </p>
                </div>
              )}

              {/* Schließen Button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedReleaseForDetail(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
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
