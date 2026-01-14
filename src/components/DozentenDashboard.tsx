import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { GraduationCap, Plus, Edit2, Trash2, ChevronDown, ChevronUp, X, Play, FileText, ExternalLink, Info, Pin, AlertTriangle, Clock, Upload, Eye, GripVertical, LayoutGrid, Download, Search } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverEvent, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Chapter { id: string; title: string; description: string | null; thumbnail_url: string | null; position: number; is_published: boolean; lessons?: Lesson[]; }
interface Lesson { id: string; chapter_id: string; title: string; description: string | null; video_url: string | null; thumbnail_url: string | null; position: number; is_published: boolean; attachments?: Attachment[]; }
interface Attachment { id: string; lesson_id: string; name: string; type: string; url: string; file_path: string | null; position: number; }
interface BulletinPost { id: string; title: string; content: string; priority: 'low' | 'normal' | 'high' | 'urgent'; is_pinned: boolean; image_url: string | null; link_url: string | null; link_text: string | null; custom_color: string | null; created_at: string; }
interface DashboardWidget { id: string; title: string; description: string | null; image_url: string | null; link_url: string | null; size: 'small' | 'large'; image_height: 'small' | 'medium' | 'large'; position: number; is_active: boolean; section_id: string | null; html_content?: string | null; widget_type?: 'default' | 'html' | 'youtube' | 'link'; youtube_channel_id?: string | null; youtube_video_count?: number; link_preview_url?: string | null; }
interface YouTubeVideo { id: string; title: string; thumbnail: string; publishedAt: string; }
interface LinkPreview { title: string; description: string; image: string; url: string; siteName: string; }
interface DashboardSection { id: string; title: string | null; columns: number; position: number; is_active: boolean; }
interface TeachingMaterial { id: string; title: string; description: string | null; file_url: string; file_name: string; file_type: string; file_size: number | null; category: string | null; position: number; is_active: boolean; folder_id: string | null; updated_at?: string; created_at?: string; }
interface MaterialFolder { id: string; name: string; parent_id: string | null; position: number; is_active: boolean; }

function SortableWidget({ id, children, isEditMode }: { id: string; children: React.ReactNode; isEditMode: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {isEditMode && (
        <div {...attributes} {...listeners} className="absolute top-2 left-2 z-20 p-2 bg-white/95 rounded-lg cursor-grab active:cursor-grabbing shadow-md border border-gray-200 hover:bg-primary hover:text-white transition-colors">
          <GripVertical className="h-5 w-5" />
        </div>
      )}
      {children}
    </div>
  );
}

function DroppableSection({ id, children, isOver }: { id: string; children: React.ReactNode; isOver?: boolean }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-h-[100px] rounded-lg transition-colors ${isOver ? 'bg-primary/10 border-2 border-dashed border-primary' : ''}`}>
      {children}
    </div>
  );
}

function YouTubeChannelWidget({ widget, isEditMode, onEdit, onDelete, cache, setCache }: { 
  widget: DashboardWidget; 
  isEditMode: boolean; 
  onEdit: () => void; 
  onDelete: () => void;
  cache: Record<string, YouTubeVideo[]>;
  setCache: React.Dispatch<React.SetStateAction<Record<string, YouTubeVideo[]>>>;
}) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const channelId = widget.youtube_channel_id;
  const videoCount = widget.youtube_video_count || 3;

  useEffect(() => {
    if (!channelId) return;
    
    // Check cache first
    if (cache[channelId]) {
      setVideos(cache[channelId].slice(0, videoCount));
      setLoading(false);
      return;
    }

    // Fetch from YouTube RSS feed (no API key needed)
    const fetchVideos = async () => {
      try {
        const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
        const data = await response.json();
        if (data.items) {
          const fetchedVideos: YouTubeVideo[] = data.items.slice(0, 10).map((item: any) => ({
            id: item.link.split('v=')[1],
            title: item.title,
            thumbnail: item.thumbnail || `https://img.youtube.com/vi/${item.link.split('v=')[1]}/mqdefault.jpg`,
            publishedAt: item.pubDate
          }));
          setCache(prev => ({ ...prev, [channelId]: fetchedVideos }));
          setVideos(fetchedVideos.slice(0, videoCount));
        }
      } catch (err) {
        console.error('Error fetching YouTube videos:', err);
      }
      setLoading(false);
    };
    fetchVideos();
  }, [channelId, videoCount, cache, setCache]);

  return (
    <div className="group bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 p-4 w-full h-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
        </div>
        <span className="text-lg font-semibold" style={{ color: '#2d84c1' }}>{widget.title}</span>
        {isEditMode && (
          <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
            <button onClick={onEdit} className="p-1 bg-gray-100 rounded"><Edit2 className="h-3 w-3 text-gray-600" /></button>
            <button onClick={onDelete} className="p-1 bg-gray-100 rounded"><Trash2 className="h-3 w-3 text-red-500" /></button>
          </div>
        )}
      </div>
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
        </div>
      ) : videos.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">Keine Videos gefunden</p>
      ) : (
        <div className="space-y-3">
          {videos.map((video, index) => (
            <a 
              key={video.id || `video-${index}`} 
              href={`https://www.youtube.com/watch?v=${video.id}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex gap-3 hover:bg-gray-50 rounded-lg p-1 -mx-1 transition-colors"
            >
              <img 
                src={video.thumbnail} 
                alt={video.title} 
                className="w-24 h-14 object-cover rounded-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{video.title}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(video.publishedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}, {new Date(video.publishedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkPreviewWidget({ widget, isEditMode, onEdit, onDelete, cache, setCache }: { 
  widget: DashboardWidget; 
  isEditMode: boolean; 
  onEdit: () => void; 
  onDelete: () => void;
  cache: Record<string, LinkPreview>;
  setCache: React.Dispatch<React.SetStateAction<Record<string, LinkPreview>>>;
}) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const url = widget.link_preview_url;

  useEffect(() => {
    if (!url) return;
    
    // Check cache first
    if (cache[url]) {
      setPreview(cache[url]);
      setLoading(false);
      return;
    }

    // Fetch Open Graph data via a proxy service
    const fetchPreview = async () => {
      try {
        // Using a free OG scraper API
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          const fetchedPreview: LinkPreview = {
            title: data.data.title || widget.title || 'Link',
            description: data.data.description || '',
            image: data.data.image?.url || data.data.logo?.url || '',
            url: url,
            siteName: data.data.publisher || new URL(url).hostname
          };
          setCache(prev => ({ ...prev, [url]: fetchedPreview }));
          setPreview(fetchedPreview);
        }
      } catch (err) {
        console.error('Error fetching link preview:', err);
        // Fallback preview
        setPreview({
          title: widget.title || 'Link',
          description: widget.description || '',
          image: '',
          url: url,
          siteName: new URL(url).hostname
        });
      }
      setLoading(false);
    };
    fetchPreview();
  }, [url, cache, setCache, widget.title, widget.description]);

  return (
    <div className="group bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden w-full h-full relative">
      {loading ? (
        <div className="flex justify-center items-center h-full min-h-[200px]">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        </div>
      ) : preview ? (
        <div className="flex flex-col h-full">
          {preview.image && (
            <div className="relative h-48 bg-gray-900 flex-shrink-0">
              <img 
                src={preview.image} 
                alt={preview.title} 
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <div className="p-4 flex-1 flex flex-col bg-gray-50">
            <h4 className="font-bold text-lg text-gray-900 mb-4">{preview.title}</h4>
            <a 
              href={url || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 bg-[#2d84c1] text-white rounded-lg hover:bg-[#2574ab] transition-colors"
            >
              <div className="flex items-center gap-3">
                <ExternalLink className="h-5 w-5" />
                <span className="font-medium">Jetzt anhören</span>
              </div>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {isEditMode && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100">
              <button onClick={onEdit} className="p-1.5 bg-white/90 rounded-lg shadow"><Edit2 className="h-4 w-4 text-gray-600" /></button>
              <button onClick={onDelete} className="p-1.5 bg-white/90 rounded-lg shadow"><Trash2 className="h-4 w-4 text-red-500" /></button>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 text-center text-gray-500">Vorschau nicht verfügbar</div>
      )}
    </div>
  );
}

export function DozentenDashboard() {
  const { isAdmin, isBuchhaltung } = useAuthStore();
  const { addToast } = useToastStore();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());
  const [showMasterclassView, setShowMasterclassView] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterDescription, setChapterDescription] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonVideoUrl, setLessonVideoUrl] = useState('');
  const [bulletinPosts, setBulletinPosts] = useState<BulletinPost[]>([]);
  const [showBulletinModal, setShowBulletinModal] = useState(false);
  const [editingBulletin, setEditingBulletin] = useState<BulletinPost | null>(null);
  const [bulletinTitle, setBulletinTitle] = useState('');
  const [bulletinContent, setBulletinContent] = useState('');
  const [bulletinPriority, setBulletinPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [bulletinPinned, setBulletinPinned] = useState(false);
  const [bulletinImage, setBulletinImage] = useState<string | null>(null);
  const [bulletinLinkUrl, setBulletinLinkUrl] = useState('');
  const [bulletinLinkText, setBulletinLinkText] = useState('');
  const [bulletinCustomColor, setBulletinCustomColor] = useState('');
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const [widgetTitle, setWidgetTitle] = useState('');
  const [widgetDescription, setWidgetDescription] = useState('');
  const [widgetImage, setWidgetImage] = useState<string | null>(null);
  const [widgetLinkUrl, setWidgetLinkUrl] = useState('');
  const [widgetSize, setWidgetSize] = useState<'small' | 'large'>('small');
  const [widgetImageHeight, setWidgetImageHeight] = useState<'small' | 'medium' | 'large'>('medium');
  const [widgetType, setWidgetType] = useState<'default' | 'html' | 'youtube' | 'link'>('default');
  const [widgetHtmlContent, setWidgetHtmlContent] = useState('');
  const [widgetYoutubeChannelId, setWidgetYoutubeChannelId] = useState('');
  const [widgetYoutubeVideoCount, setWidgetYoutubeVideoCount] = useState(3);
  const [widgetLinkPreviewUrl, setWidgetLinkPreviewUrl] = useState('');
  const [youtubeVideosCache, setYoutubeVideosCache] = useState<Record<string, YouTubeVideo[]>>({});
  const [linkPreviewCache, setLinkPreviewCache] = useState<Record<string, LinkPreview>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [sections, setSections] = useState<DashboardSection[]>([]);
  const [activeOverSection, setActiveOverSection] = useState<string | null>(null);
  const [showMaterialsView, setShowMaterialsView] = useState(false);
  const [materials, setMaterials] = useState<TeachingMaterial[]>([]);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<TeachingMaterial | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [materialFile, setMaterialFile] = useState<string | null>(null);
  const [materialFileName, setMaterialFileName] = useState('');
  const [materialFileType, setMaterialFileType] = useState('');
  const [materialCategory, setMaterialCategory] = useState('');
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [folders, setFolders] = useState<MaterialFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<MaterialFolder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [materialFolderId, setMaterialFolderId] = useState<string | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<TeachingMaterial | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const canEdit = isAdmin || isBuchhaltung;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over && over.id.toString().startsWith('section-')) {
      setActiveOverSection(over.id.toString().replace('section-', ''));
    } else if (over) {
      // Check if over a widget, get its section
      const overWidget = widgets.find(w => w.id === over.id);
      if (overWidget) {
        setActiveOverSection(overWidget.section_id);
      }
    } else {
      setActiveOverSection(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOverSection(null);
    
    if (!over) return;

    const activeWidget = widgets.find(w => w.id === active.id);
    if (!activeWidget) return;

    // Check if dropped on a section
    if (over.id.toString().startsWith('section-')) {
      const newSectionId = over.id.toString().replace('section-', '');
      if (activeWidget.section_id !== newSectionId) {
        await moveWidgetToSection(activeWidget.id, newSectionId);
      }
      return;
    }

    // Check if dropped on another widget
    const overWidget = widgets.find(w => w.id === over.id);
    if (overWidget) {
      // If different sections, move to that section
      if (activeWidget.section_id !== overWidget.section_id) {
        await moveWidgetToSection(activeWidget.id, overWidget.section_id);
      }
      
      // Reorder within section
      const sectionWidgets = widgets.filter(w => w.section_id === overWidget.section_id);
      const oldIndex = sectionWidgets.findIndex(w => w.id === active.id);
      const newIndex = sectionWidgets.findIndex(w => w.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reorderedSection = arrayMove(sectionWidgets, oldIndex, newIndex);
        const newWidgets = widgets.map(w => {
          const idx = reorderedSection.findIndex(sw => sw.id === w.id);
          if (idx !== -1) return { ...w, position: idx };
          return w;
        });
        setWidgets(newWidgets);
        
        for (let i = 0; i < reorderedSection.length; i++) {
          await supabase.from('dashboard_widgets').update({ position: i }).eq('id', reorderedSection[i].id);
        }
      }
    }
  };

  useEffect(() => { 
    // Alle wichtigen Daten beim Start laden
    fetchChapters();
    fetchBulletinPosts(); 
    fetchWidgets(); 
    fetchSections();
    fetchMaterials();
    fetchFolders();
  }, []);

  const fetchChapters = async () => {
    try {
      setIsLoading(true);
      const { data: chaptersData } = await supabase.from('masterclass_chapters').select('*').order('position');
      const { data: lessonsData } = await supabase.from('masterclass_lessons').select('*').order('position');
      const { data: attachmentsData } = await supabase.from('masterclass_attachments').select('*').order('position');
      const chaptersWithLessons = (chaptersData || []).map(chapter => ({
        ...chapter,
        lessons: (lessonsData || []).filter(l => l.chapter_id === chapter.id).map(lesson => ({
          ...lesson, attachments: (attachmentsData || []).filter(a => a.lesson_id === lesson.id)
        }))
      }));
      setChapters(chaptersWithLessons);
    } catch (error) { console.error('Error:', error); } finally { setIsLoading(false); }
  };

  const fetchBulletinPosts = async () => {
    const { data } = await supabase.from('bulletin_board').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    setBulletinPosts(data || []);
  };

  const fetchWidgets = async () => {
    const { data } = await supabase.from('dashboard_widgets').select('*').eq('is_active', true).order('position');
    setWidgets(data || []);
  };

  const fetchSections = async () => {
    const { data } = await supabase.from('dashboard_sections').select('*').eq('is_active', true).order('position');
    setSections(data || []);
  };

  const fetchMaterials = async () => {
    const { data } = await supabase.from('teaching_materials').select('*').eq('is_active', true).order('position');
    setMaterials(data || []);
  };

  const fetchFolders = async () => {
    const { data } = await supabase.from('material_folders').select('*').eq('is_active', true).order('position');
    setFolders(data || []);
  };

  const openMaterialModal = (m?: TeachingMaterial) => {
    setEditingMaterial(m || null);
    setMaterialTitle(m?.title || '');
    setMaterialDescription(m?.description || '');
    setMaterialFile(m?.file_url || null);
    setMaterialFileName(m?.file_name || '');
    setMaterialFileType(m?.file_type || '');
    setMaterialCategory(m?.category || '');
    setMaterialFolderId(m?.folder_id || currentFolderId);
    setShowMaterialModal(true);
  };

  const openFolderModal = (f?: MaterialFolder) => {
    setEditingFolder(f || null);
    setFolderName(f?.name || '');
    setShowFolderModal(true);
  };

  const saveFolder = async () => {
    if (!folderName.trim()) return addToast('Name erforderlich', 'error');
    const data = { name: folderName, parent_id: currentFolderId };
    if (editingFolder) {
      await supabase.from('material_folders').update({ name: folderName }).eq('id', editingFolder.id);
    } else {
      await supabase.from('material_folders').insert({ ...data, position: folders.filter(f => f.parent_id === currentFolderId).length });
    }
    setShowFolderModal(false);
    fetchFolders();
    addToast('Gespeichert', 'success');
  };

  const deleteFolder = async (id: string) => {
    if (!confirm('Ordner und alle Inhalte löschen?')) return;
    await supabase.from('material_folders').delete().eq('id', id);
    fetchFolders();
    fetchMaterials();
    addToast('Gelöscht', 'success');
  };

  const getBreadcrumbs = () => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Materialien' }];
    let current = currentFolderId;
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      const folder = folders.find(f => f.id === current);
      if (folder) {
        crumbs.splice(1, 0, { id: folder.id, name: folder.name });
        current = folder.parent_id;
      } else break;
    }
    return crumbs;
  };

  const handleMaterialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingMaterial(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}.${fileExt}`;
    const { error } = await supabase.storage.from('masterclass').upload(`materials/${fileName}`, file, {
      contentType: file.type,
      cacheControl: '3600'
    });
    if (!error) {
      const { data: urlData } = supabase.storage.from('masterclass').getPublicUrl(`materials/${fileName}`);
      setMaterialFile(urlData.publicUrl);
      setMaterialFileName(file.name);
      setMaterialFileType(file.type);
      // Auto-fill title from filename (without extension)
      const titleFromFile = file.name.replace(/\.[^/.]+$/, '');
      if (!materialTitle) setMaterialTitle(titleFromFile);
    }
    setIsUploadingMaterial(false);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setBulkUploadProgress({ current: 0, total: files.length });
    const currentPosition = materials.filter(m => m.folder_id === currentFolderId).length;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBulkUploadProgress({ current: i + 1, total: files.length });
      
      const fileExt = file.name.split('.').pop();
      const storageFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}.${fileExt}`;
      const { error } = await supabase.storage.from('masterclass').upload(`materials/${storageFileName}`, file, {
        contentType: file.type,
        cacheControl: '3600'
      });
      
      if (!error) {
        const { data: urlData } = supabase.storage.from('masterclass').getPublicUrl(`materials/${storageFileName}`);
        const titleFromFile = file.name.replace(/\.[^/.]+$/, '');
        
        await supabase.from('teaching_materials').insert({
          title: titleFromFile,
          description: null,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          category: null,
          folder_id: currentFolderId,
          position: currentPosition + i
        });
      }
    }
    
    setBulkUploadProgress(null);
    fetchMaterials();
    addToast(`${files.length} Dateien hochgeladen`, 'success');
    e.target.value = '';
  };

  const downloadFolderAsZip = async (folderId: string | null, folderName: string) => {
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      
      // Rekursive Funktion um alle Materialien und Unterordner zu sammeln
      const addFolderToZip = async (parentId: string | null, zipFolder: JSZip, path: string) => {
        // Materialien im aktuellen Ordner
        const folderMaterials = materials.filter(m => m.folder_id === parentId);
        for (const material of folderMaterials) {
          try {
            const response = await fetch(material.file_url);
            const blob = await response.blob();
            zipFolder.file(material.file_name, blob);
          } catch (err) {
            console.error(`Fehler beim Laden von ${material.file_name}:`, err);
          }
        }
        
        // Unterordner
        const subFolders = folders.filter(f => f.parent_id === parentId);
        for (const subFolder of subFolders) {
          const subZipFolder = zipFolder.folder(subFolder.name);
          if (subZipFolder) {
            await addFolderToZip(subFolder.id, subZipFolder, `${path}/${subFolder.name}`);
          }
        }
      };
      
      await addFolderToZip(folderId, zip, '');
      
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${folderName}.zip`);
      addToast('ZIP-Download gestartet', 'success');
    } catch (err) {
      console.error('ZIP-Fehler:', err);
      addToast('Fehler beim Erstellen der ZIP-Datei', 'error');
    }
    setIsDownloadingZip(false);
  };

  const saveMaterial = async () => {
    if (!materialTitle.trim() || !materialFile) return addToast('Titel und Datei erforderlich', 'error');
    const data = { title: materialTitle, description: materialDescription || null, file_url: materialFile, file_name: materialFileName, file_type: materialFileType, category: materialCategory || null, folder_id: materialFolderId };
    if (editingMaterial) {
      await supabase.from('teaching_materials').update(data).eq('id', editingMaterial.id);
    } else {
      await supabase.from('teaching_materials').insert({ ...data, position: materials.filter(m => m.folder_id === materialFolderId).length });
    }
    setShowMaterialModal(false);
    fetchMaterials();
    addToast('Gespeichert', 'success');
  };

  const deleteMaterial = async (id: string) => {
    if (!confirm('Material löschen?')) return;
    await supabase.from('teaching_materials').delete().eq('id', id);
    fetchMaterials();
    addToast('Gelöscht', 'success');
  };

  const openFilePreview = async (material: TeachingMaterial) => {
    try {
      const response = await fetch(material.file_url);
      const blob = await response.blob();
      const correctBlob = new Blob([blob], { type: material.file_type });
      const blobUrl = URL.createObjectURL(correctBlob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Error opening file:', err);
      window.open(material.file_url, '_blank');
    }
  };

  const downloadFile = async (material: TeachingMaterial) => {
    try {
      const response = await fetch(material.file_url);
      const blob = await response.blob();
      const correctBlob = new Blob([blob], { type: material.file_type });
      saveAs(correctBlob, material.file_name);
    } catch (err) {
      console.error('Error downloading file:', err);
      addToast('Fehler beim Download', 'error');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️';
    return '📁';
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addSection = async () => {
    const newPosition = sections.length;
    const { data, error } = await supabase.from('dashboard_sections').insert({ title: null, columns: 2, position: newPosition }).select().single();
    if (!error && data) {
      setSections([...sections, data]);
    }
  };

  const updateSectionColumns = async (sectionId: string, columns: number) => {
    await supabase.from('dashboard_sections').update({ columns }).eq('id', sectionId);
    setSections(sections.map(s => s.id === sectionId ? { ...s, columns } : s));
  };

  const deleteSection = async (sectionId: string) => {
    // Move widgets from this section to null (unassigned)
    await supabase.from('dashboard_widgets').update({ section_id: null }).eq('section_id', sectionId);
    await supabase.from('dashboard_sections').delete().eq('id', sectionId);
    setSections(sections.filter(s => s.id !== sectionId));
    fetchWidgets();
  };

  const moveWidgetToSection = async (widgetId: string, sectionId: string | null) => {
    await supabase.from('dashboard_widgets').update({ section_id: sectionId }).eq('id', widgetId);
    setWidgets(widgets.map(w => w.id === widgetId ? { ...w, section_id: sectionId } : w));
  };

  const toggleChapter = (id: string) => setExpandedChapters(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleLesson = (id: string) => setExpandedLessons(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const openChapterModal = (c?: Chapter) => { setEditingChapter(c || null); setChapterTitle(c?.title || ''); setChapterDescription(c?.description || ''); setShowChapterModal(true); };
  const saveChapter = async () => {
    if (!chapterTitle.trim()) return addToast('Titel eingeben', 'error');
    if (editingChapter) await supabase.from('masterclass_chapters').update({ title: chapterTitle, description: chapterDescription || null }).eq('id', editingChapter.id);
    else await supabase.from('masterclass_chapters').insert({ title: chapterTitle, description: chapterDescription || null, position: chapters.length, is_published: true });
    setShowChapterModal(false); fetchChapters(); addToast('Gespeichert', 'success');
  };
  const deleteChapter = async (id: string) => { if (confirm('Löschen?')) { await supabase.from('masterclass_chapters').delete().eq('id', id); fetchChapters(); } };

  const openLessonModal = (chapterId: string, l?: Lesson) => { setSelectedChapterId(chapterId); setEditingLesson(l || null); setLessonTitle(l?.title || ''); setLessonDescription(l?.description || ''); setLessonVideoUrl(l?.video_url || ''); setShowLessonModal(true); };
  const saveLesson = async () => {
    if (!lessonTitle.trim() || !selectedChapterId) return addToast('Titel eingeben', 'error');
    if (editingLesson) await supabase.from('masterclass_lessons').update({ title: lessonTitle, description: lessonDescription || null, video_url: lessonVideoUrl || null }).eq('id', editingLesson.id);
    else await supabase.from('masterclass_lessons').insert({ chapter_id: selectedChapterId, title: lessonTitle, description: lessonDescription || null, video_url: lessonVideoUrl || null, position: chapters.find(c => c.id === selectedChapterId)?.lessons?.length || 0, is_published: true });
    setShowLessonModal(false); fetchChapters(); addToast('Gespeichert', 'success');
  };
  const deleteLesson = async (id: string) => { if (confirm('Löschen?')) { await supabase.from('masterclass_lessons').delete().eq('id', id); fetchChapters(); } };

  const openBulletinModal = (p?: BulletinPost) => { setEditingBulletin(p || null); setBulletinTitle(p?.title || ''); setBulletinContent(p?.content || ''); setBulletinPriority(p?.priority || 'normal'); setBulletinPinned(p?.is_pinned || false); setBulletinImage(p?.image_url || null); setBulletinLinkUrl(p?.link_url || ''); setBulletinLinkText(p?.link_text || ''); setBulletinCustomColor(p?.custom_color || ''); setShowBulletinModal(true); };
  const saveBulletin = async () => {
    if (!bulletinTitle.trim() || !bulletinContent.trim()) return addToast('Titel und Inhalt eingeben', 'error');
    const data = { title: bulletinTitle, content: bulletinContent, priority: bulletinPriority, is_pinned: bulletinPinned, image_url: bulletinImage, link_url: bulletinLinkUrl || null, link_text: bulletinLinkText || null, custom_color: bulletinCustomColor || null };
    if (editingBulletin) await supabase.from('bulletin_board').update(data).eq('id', editingBulletin.id);
    else await supabase.from('bulletin_board').insert(data);
    setShowBulletinModal(false); fetchBulletinPosts(); addToast('Gespeichert', 'success');
  };
  const deleteBulletin = async (id: string) => { if (confirm('Löschen?')) { await supabase.from('bulletin_board').delete().eq('id', id); fetchBulletinPosts(); } };

  const openWidgetModal = (w?: DashboardWidget, type?: 'default' | 'html' | 'youtube' | 'link') => { 
    setEditingWidget(w || null); 
    setWidgetTitle(w?.title || (type === 'youtube' ? 'Aktuelle YouTube Videos' : '')); 
    setWidgetDescription(w?.description || ''); 
    setWidgetImage(w?.image_url || null); 
    setWidgetLinkUrl(w?.link_url || ''); 
    setWidgetSize(w?.size || 'small'); 
    setWidgetImageHeight(w?.image_height || 'medium'); 
    setWidgetType(type || w?.widget_type || 'default');
    setWidgetHtmlContent(w?.html_content || '');
    setWidgetYoutubeChannelId(w?.youtube_channel_id || '');
    setWidgetYoutubeVideoCount(w?.youtube_video_count || 3);
    setWidgetLinkPreviewUrl(w?.link_preview_url || '');
    setShowWidgetModal(true); 
  };
  const saveWidget = async () => {
    if (widgetType === 'link') {
      if (!widgetLinkPreviewUrl.trim()) return addToast('Link URL eingeben', 'error');
      const data = { title: widgetTitle || 'Link', description: widgetDescription || null, image_url: null, link_url: null, size: widgetSize, image_height: widgetImageHeight, widget_type: 'link', html_content: null, link_preview_url: widgetLinkPreviewUrl };
      if (editingWidget) await supabase.from('dashboard_widgets').update(data).eq('id', editingWidget.id);
      else await supabase.from('dashboard_widgets').insert({ ...data, position: widgets.length });
    } else if (widgetType === 'youtube') {
      if (!widgetTitle.trim() || !widgetYoutubeChannelId.trim()) return addToast('Titel und YouTube Channel ID eingeben', 'error');
      const data = { title: widgetTitle, description: widgetDescription || null, image_url: null, link_url: null, size: widgetSize, image_height: widgetImageHeight, widget_type: 'youtube', html_content: null, youtube_channel_id: widgetYoutubeChannelId, youtube_video_count: widgetYoutubeVideoCount };
      if (editingWidget) await supabase.from('dashboard_widgets').update(data).eq('id', editingWidget.id);
      else await supabase.from('dashboard_widgets').insert({ ...data, position: widgets.length });
    } else if (widgetType === 'html') {
      if (!widgetTitle.trim() || !widgetHtmlContent.trim()) return addToast('Titel und HTML-Code eingeben', 'error');
      const data = { title: widgetTitle, description: widgetDescription || null, image_url: null, link_url: null, size: widgetSize, image_height: widgetImageHeight, widget_type: 'html', html_content: widgetHtmlContent };
      if (editingWidget) await supabase.from('dashboard_widgets').update(data).eq('id', editingWidget.id);
      else await supabase.from('dashboard_widgets').insert({ ...data, position: widgets.length });
    } else {
      if (!widgetTitle.trim()) return addToast('Titel eingeben', 'error');
      const data = { title: widgetTitle, description: widgetDescription || null, image_url: widgetImage, link_url: widgetLinkUrl || null, size: widgetSize, image_height: widgetImageHeight, widget_type: 'default', html_content: null };
      if (editingWidget) await supabase.from('dashboard_widgets').update(data).eq('id', editingWidget.id);
      else await supabase.from('dashboard_widgets').insert({ ...data, position: widgets.length });
    }
    setShowWidgetModal(false); fetchWidgets(); addToast('Gespeichert', 'success');
  };
  const deleteWidget = async (id: string) => { if (confirm('Löschen?')) { await supabase.from('dashboard_widgets').delete().eq('id', id); fetchWidgets(); } };

  const getPriorityColor = (p: string) => p === 'urgent' ? 'bg-red-100 border-red-300 text-red-800' : p === 'high' ? 'bg-orange-100 border-orange-300 text-orange-800' : p === 'normal' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-gray-100 border-gray-300 text-gray-800';
  const getEmbedUrl = (url: string) => { if (!url) return null; const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/); if (yt) return `https://www.youtube.com/embed/${yt[1]}`; const vm = url.match(/vimeo\.com\/(\d+)/); if (vm) return `https://player.vimeo.com/video/${vm[1]}`; return url; };

  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  if (showMaterialsView) {
    const currentFolders = searchQuery ? [] : folders.filter(f => f.parent_id === currentFolderId);
    const currentMaterials = searchQuery 
      ? materials.filter(m => m.file_name.toLowerCase().includes(searchQuery.toLowerCase()) || m.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : materials.filter(m => m.folder_id === currentFolderId);
    const breadcrumbs = getBreadcrumbs();
    
    return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => { if (currentFolderId) { const parent = folders.find(f => f.id === currentFolderId); setCurrentFolderId(parent?.parent_id || null); } else { setShowMaterialsView(false); } }} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronDown className="h-5 w-5 rotate-90" /></button>
          <FileText className="h-6 w-6 text-primary" /><h1 className="text-lg font-semibold">Unterrichtsmaterialien</h1>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => openFolderModal()} className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm"><Plus className="h-4 w-4 mr-1" />Ordner</button>
            <button onClick={() => openMaterialModal()} className="flex items-center px-3 py-2 bg-primary text-white rounded-lg text-sm"><Plus className="h-4 w-4 mr-1" />Material</button>
            <label className="flex items-center px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm cursor-pointer">
              <Upload className="h-4 w-4 mr-1" />Massenupload
              <input type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={handleBulkUpload} />
            </label>
          </div>
        )}
        {bulkUploadProgress && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            Hochladen: {bulkUploadProgress.current} / {bulkUploadProgress.total}
          </div>
        )}
      </div>
      
      {/* Breadcrumbs - Dropbox Style */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Home/Root Button */}
            <button 
              onClick={() => { setCurrentFolderId(null); setSearchQuery(''); }} 
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${!currentFolderId && !searchQuery ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              <FileText className="h-4 w-4" />
              Alle Materialien
            </button>
          
          {/* Breadcrumb Trail */}
          {breadcrumbs.slice(1).map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-2">
              <ChevronDown className="h-4 w-4 text-gray-300 -rotate-90" />
              <button 
                onClick={() => setCurrentFolderId(crumb.id)} 
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${i === breadcrumbs.length - 2 ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                📁 {crumb.name}
              </button>
            </span>
          ))}
          
          {/* Back Button (wenn in einem Unterordner) */}
          {currentFolderId && (
            <button 
              onClick={() => { const parent = folders.find(f => f.id === currentFolderId); setCurrentFolderId(parent?.parent_id || null); }}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
              Zurück
            </button>
          )}
          </div>
          
          {/* Suchleiste */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Datei suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"><p className="text-sm text-yellow-800">⚠️ Bitte verwenden Sie immer die aktuellsten Versionen der Unterlagen und stellen Sie regelmäßig sicher, dass Sie die richtigen Unterlagen im Unterricht verwenden!</p></div>
      
      {currentFolders.length === 0 && currentMaterials.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{currentFolderId ? 'Dieser Ordner ist leer' : 'Keine Materialien vorhanden'}</p>
          {canEdit && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => openFolderModal()} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">Ordner erstellen</button>
              <button onClick={() => openMaterialModal()} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">Material hinzufügen</button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Download-Bereich */}
          {currentFolders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {currentFolders.map(f => (
                  <div key={f.id} onClick={() => setCurrentFolderId(f.id)} className="group bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                    <div className="flex flex-col items-center text-center">
                      <div className="text-4xl mb-2">📁</div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-primary">{f.name}</span>
                    </div>
                    <div className="flex justify-center gap-1 mt-2 opacity-0 group-hover:opacity-100">
                      <button 
                        onClick={e => { e.stopPropagation(); downloadFolderAsZip(f.id, f.name); }} 
                        disabled={isDownloadingZip}
                        className="p-1 bg-blue-100 rounded hover:bg-blue-200" 
                        title="Als ZIP herunterladen"
                      >
                        <Download className="h-3 w-3 text-blue-600" />
                      </button>
                      {canEdit && (
                        <>
                          <button onClick={e => { e.stopPropagation(); openFolderModal(f); }} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Edit2 className="h-3 w-3 text-gray-600" /></button>
                          <button onClick={e => { e.stopPropagation(); deleteFolder(f.id); }} className="p-1 bg-gray-100 rounded hover:bg-red-100"><Trash2 className="h-3 w-3 text-red-500" /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Upload-Bereich / Materialien */}
          {currentMaterials.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentMaterials.map(m => (
                <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow flex flex-col h-full">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="text-3xl flex-shrink-0">{getFileIcon(m.file_type)}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{m.title}</h3>
                      {m.description && <p className="text-sm text-gray-500 mt-1">{m.description}</p>}
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 break-all">
                        <span className="line-clamp-2">{m.file_name}</span>
                        {m.file_size && <span>• {formatFileSize(m.file_size)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-2 border-t border-gray-50">
                    <button onClick={() => openFilePreview(m)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Ansehen">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button onClick={() => downloadFile(m)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
                      <Download className="h-4 w-4" />Download
                    </button>
                    <button 
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg group relative" 
                      title={`Zuletzt bearbeitet: ${m.updated_at ? new Date(m.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unbekannt'}`}
                    >
                      <Info className="h-4 w-4" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Zuletzt bearbeitet: {m.updated_at ? new Date(m.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unbekannt'}
                      </div>
                    </button>
                    {canEdit && (
                      <>
                        <button onClick={() => openMaterialModal(m)} className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => deleteMaterial(m.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}
        </div>
      )}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">{editingMaterial ? 'Material bearbeiten' : 'Neues Material'}</h3>
              <button onClick={() => setShowMaterialModal(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                <input value={materialTitle} onChange={e => setMaterialTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="z.B. Kursunterlagen Modul 1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea value={materialDescription} onChange={e => setMaterialDescription(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Optionale Beschreibung" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                <input value={materialCategory} onChange={e => setMaterialCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="z.B. PDF, Word, Excel" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datei *</label>
                {materialFile ? (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <span className="text-2xl">{getFileIcon(materialFileType)}</span>
                    <span className="flex-1 text-sm truncate">{materialFileName}</span>
                    <button onClick={() => { setMaterialFile(null); setMaterialFileName(''); setMaterialFileType(''); }} className="p-1 text-red-500 hover:bg-red-50 rounded"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary">
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">{isUploadingMaterial ? 'Wird hochgeladen...' : 'Datei auswählen (PDF, Word, Excel)'}</span>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={handleMaterialUpload} disabled={isUploadingMaterial} />
                  </label>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowMaterialModal(false)} className="px-4 py-2 text-gray-700">Abbrechen</button>
              <button onClick={saveMaterial} disabled={!materialTitle || !materialFile} className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50">Speichern</button>
            </div>
          </div>
        </div>
      )}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">{editingFolder ? 'Ordner bearbeiten' : 'Neuer Ordner'}</h3>
              <button onClick={() => setShowFolderModal(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordnername *</label>
              <input value={folderName} onChange={e => setFolderName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="z.B. Modul 1" autoFocus />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowFolderModal(false)} className="px-4 py-2 text-gray-700">Abbrechen</button>
              <button onClick={saveFolder} disabled={!folderName.trim()} className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50">Speichern</button>
            </div>
          </div>
        </div>
      )}
      {/* Vorschau-Modal */}
      {previewMaterial && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setPreviewMaterial(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getFileIcon(previewMaterial.file_type)}</span>
                <div>
                  <h3 className="font-semibold">{previewMaterial.title}</h3>
                  <p className="text-xs text-gray-500">{previewMaterial.file_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={previewMaterial.file_url} target="_blank" download className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
                  <Download className="h-4 w-4" />Download
                </a>
                <button onClick={() => setPreviewMaterial(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              {previewMaterial.file_type.includes('image') ? (
                <img src={previewMaterial.file_url} className="max-w-full max-h-[70vh] mx-auto rounded-lg shadow" alt={previewMaterial.title} />
              ) : (
                <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500 bg-white rounded-lg border">
                  <span className="text-8xl mb-6">{getFileIcon(previewMaterial.file_type)}</span>
                  <p className="text-xl font-medium text-gray-700">{previewMaterial.title}</p>
                  <p className="text-sm text-gray-400 mt-2">{previewMaterial.file_name}</p>
                  {previewMaterial.description && <p className="text-sm text-gray-500 mt-3 max-w-md text-center">{previewMaterial.description}</p>}
                  <div className="flex gap-3 mt-6">
                    <a href={previewMaterial.file_url} target="_blank" className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90">
                      <Eye className="h-5 w-5" />Im Browser öffnen
                    </a>
                    <a href={previewMaterial.file_url} download className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                      <Download className="h-5 w-5" />Herunterladen
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
  }

  if (showMasterclassView) return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowMasterclassView(false)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronDown className="h-5 w-5 rotate-90" /></button>
          <GraduationCap className="h-6 w-6 text-primary" /><h1 className="text-lg font-semibold">Dozenten Masterclass</h1>
        </div>
        {canEdit && <button onClick={() => openChapterModal()} className="flex items-center px-3 py-2 bg-primary text-white rounded-lg text-sm"><Plus className="h-4 w-4 mr-1" />Kapitel</button>}
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4"><p className="text-sm text-blue-800">Willkommen zur Dozenten Masterclass!</p></div>
      {chapters.length === 0 ? <div className="bg-white rounded-xl p-8 text-center"><GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Keine Kapitel</p></div> : (
        <div className="space-y-4">{chapters.map(ch => (
          <div key={ch.id} className="bg-white rounded-xl shadow-md border-2 border-primary/20 overflow-hidden">
            <div className="flex items-center gap-5 p-5 cursor-pointer hover:bg-primary/5" onClick={() => toggleChapter(ch.id)}>
              <div className="w-36 h-20 rounded-lg bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">{ch.thumbnail_url ? <img src={ch.thumbnail_url} className="w-full h-full object-cover rounded-lg" /> : <GraduationCap className="h-8 w-8 text-white/80" />}</div>
              <div className="flex-1"><h3 className="font-semibold">{ch.title}</h3>{ch.description && <p className="text-sm text-gray-500 mt-1">{ch.description}</p>}<p className="text-xs text-gray-400 mt-2">{ch.lessons?.length || 0} Lektionen</p></div>
              <div className="flex items-center gap-2">{canEdit && <><button onClick={e => { e.stopPropagation(); openChapterModal(ch); }} className="p-2 text-gray-400 hover:text-primary"><Edit2 className="h-4 w-4" /></button><button onClick={e => { e.stopPropagation(); deleteChapter(ch.id); }} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></>}{expandedChapters.has(ch.id) ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}</div>
            </div>
            {expandedChapters.has(ch.id) && <div className="border-t px-5 py-3 bg-gray-50/50">
              {ch.lessons?.map((l, i) => <div key={l.id} className={i > 0 ? 'border-t border-gray-100' : ''}>
                <div className="flex items-center gap-4 py-3 cursor-pointer hover:bg-gray-100/50 rounded-lg" onClick={() => toggleLesson(l.id)}>
                  <div className="w-28 h-16 rounded-lg bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">{l.thumbnail_url ? <img src={l.thumbnail_url} className="w-full h-full object-cover rounded-lg" /> : <Play className="h-6 w-6 text-white/60" />}</div>
                  <div className="flex-1"><h4 className="text-sm font-medium">{l.title}</h4>{l.description && <p className="text-xs text-gray-500">{l.description}</p>}</div>
                  <div className="flex items-center gap-1">{canEdit && <><button onClick={e => { e.stopPropagation(); openLessonModal(ch.id, l); }} className="p-1.5 text-gray-400 hover:text-primary"><Edit2 className="h-4 w-4" /></button><button onClick={e => { e.stopPropagation(); deleteLesson(l.id); }} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></>}{expandedLessons.has(l.id) ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}</div>
                </div>
                {expandedLessons.has(l.id) && <div className="ml-32 mb-4 bg-white rounded-xl p-4 shadow-sm">{l.video_url && <div className="aspect-video bg-black rounded-lg overflow-hidden"><iframe src={getEmbedUrl(l.video_url) || ''} className="w-full h-full" allowFullScreen /></div>}{l.description && <p className="text-sm text-gray-600 mt-4">{l.description}</p>}{l.attachments?.map(a => <a key={a.id} href={a.url} target="_blank" className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg mt-2 hover:bg-gray-100"><FileText className="h-4 w-4 text-gray-400" /><span className="text-sm">{a.name}</span><ExternalLink className="h-3.5 w-3.5 text-gray-400" /></a>)}</div>}
              </div>)}
              {canEdit && <button onClick={() => openLessonModal(ch.id)} className="flex items-center gap-2 py-3 text-sm text-gray-500 hover:text-primary"><Plus className="h-4 w-4" />Lektion hinzufügen</button>}
            </div>}
          </div>
        ))}</div>
      )}
      {showChapterModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-md"><div className="flex items-center justify-between p-4 border-b"><h3 className="font-semibold">{editingChapter ? 'Bearbeiten' : 'Neues Kapitel'}</h3><button onClick={() => setShowChapterModal(false)}><X className="h-5 w-5" /></button></div><div className="p-4 space-y-4"><input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Titel" /><textarea value={chapterDescription} onChange={e => setChapterDescription(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Beschreibung" rows={3} /></div><div className="flex justify-end gap-2 p-4 border-t"><button onClick={() => setShowChapterModal(false)} className="px-4 py-2 text-gray-700">Abbrechen</button><button onClick={saveChapter} className="px-4 py-2 bg-primary text-white rounded-lg">Speichern</button></div></div></div>}
      {showLessonModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-md"><div className="flex items-center justify-between p-4 border-b"><h3 className="font-semibold">{editingLesson ? 'Bearbeiten' : 'Neue Lektion'}</h3><button onClick={() => setShowLessonModal(false)}><X className="h-5 w-5" /></button></div><div className="p-4 space-y-4"><input value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Titel" /><input value={lessonVideoUrl} onChange={e => setLessonVideoUrl(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Video URL" /><textarea value={lessonDescription} onChange={e => setLessonDescription(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Beschreibung" rows={3} /></div><div className="flex justify-end gap-2 p-4 border-t"><button onClick={() => setShowLessonModal(false)} className="px-4 py-2 text-gray-700">Abbrechen</button><button onClick={saveLesson} className="px-4 py-2 bg-primary text-white rounded-lg">Speichern</button></div></div></div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3"><Info className="h-7 w-7 text-yellow-400" /><h3 className="text-lg font-semibold text-white">Aktuelle Informationen</h3></div>{isEditMode && <button onClick={() => openBulletinModal()} className="flex items-center gap-1 px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm"><Plus className="h-4 w-4" />Nachricht</button>}</div>
        {bulletinPosts.length === 0 ? <div className="text-center py-6 text-gray-400"><Info className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Keine Nachrichten</p></div> : <div className="space-y-3">{bulletinPosts.map(p => <div key={p.id} className={`rounded-lg p-4 border ${p.custom_color ? '' : getPriorityColor(p.priority)}`} style={p.custom_color ? { backgroundColor: p.custom_color } : {}}>
          <div className="flex items-start gap-3">{p.image_url && <img src={p.image_url} className="w-10 h-10 rounded-lg object-cover" />}<div className="flex-1"><div className="flex items-center gap-2">{p.is_pinned && <Pin className="h-3.5 w-3.5" />}{p.priority === 'urgent' && <AlertTriangle className="h-3.5 w-3.5" />}<h4 className="font-medium">{p.title}</h4></div><p className="text-sm mt-1 opacity-90">{p.content}</p>{p.link_url && <a href={p.link_url} target="_blank" className="inline-flex items-center gap-1 mt-2 text-sm text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" />{p.link_text || 'Link'}</a>}<div className="flex items-center gap-2 mt-2 text-xs opacity-70"><Clock className="h-3 w-3" />{new Date(p.created_at).toLocaleDateString('de-DE')}</div></div>{isEditMode && <div className="flex gap-1"><button onClick={() => openBulletinModal(p)} className="p-1.5 hover:bg-black/10 rounded"><Edit2 className="h-3.5 w-3.5" /></button><button onClick={() => deleteBulletin(p.id)} className="p-1.5 hover:bg-black/10 rounded text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div>}</div>
        </div>)}</div>}
      </div>
      {(widgets.length > 0 || canEdit) && <div>
        {canEdit && (
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${isEditMode ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {isEditMode ? <><Edit2 className="h-4 w-4" />Bearbeitungsmodus</> : <><Eye className="h-4 w-4" />Live-Ansicht</>}
              </button>
            </div>
            {isEditMode && (
              <div className="flex items-center gap-2">
                <button onClick={addSection} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-sm">
                  <Plus className="h-4 w-4" />Sektion
                </button>
                <button onClick={() => openWidgetModal()} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm">
                  <Plus className="h-4 w-4" />Widget
                </button>
                <button onClick={() => openWidgetModal(undefined, 'html')} className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">
                  <Plus className="h-4 w-4" />HTML-Widget
                </button>
                <button onClick={() => openWidgetModal(undefined, 'youtube')} className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">
                  <Plus className="h-4 w-4" />YouTube
                </button>
                <button onClick={() => openWidgetModal(undefined, 'link')} className="flex items-center gap-1 px-3 py-1.5 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600">
                  <Plus className="h-4 w-4" />Link-Vorschau
                </button>
              </div>
            )}
          </div>
        )}
        
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
            {/* Sektionen mit Widgets */}
            {sections.map(section => {
              const sectionWidgets = widgets.filter(w => w.section_id === section.id);
              return (
                <div key={section.id} className="mb-6">
                  {isEditMode && (
                    <div className="flex items-center justify-between mb-2 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Sektion</span>
                        <div className="flex gap-1 ml-2">
                          {[1, 2, 3, 4, 5].map(cols => (
                            <button
                              key={cols}
                              onClick={() => updateSectionColumns(section.id, cols)}
                              className={`w-6 h-6 rounded text-xs font-medium ${section.columns === cols ? 'bg-primary text-white' : 'bg-white border border-gray-200 hover:border-gray-300'}`}
                            >
                              {cols}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => deleteSection(section.id)} className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <DroppableSection id={`section-${section.id}`} isOver={activeOverSection === section.id}>
                    <div className="grid gap-4 items-stretch" style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}>
                    {sectionWidgets.map(w => {
                      const isOnboarding = w.title.toLowerCase().includes('onboarding');
                      const isHtmlWidget = w.widget_type === 'html';
                      const isYoutubeWidget = w.widget_type === 'youtube';
                      const isLinkWidget = w.widget_type === 'link';
                      return (
                        <SortableWidget key={w.id} id={w.id} isEditMode={isEditMode}>
                          {isLinkWidget ? (
                            <LinkPreviewWidget 
                              widget={w} 
                              isEditMode={isEditMode} 
                              onEdit={() => openWidgetModal(w)} 
                              onDelete={() => deleteWidget(w.id)}
                              cache={linkPreviewCache}
                              setCache={setLinkPreviewCache}
                            />
                          ) : isYoutubeWidget ? (
                            <YouTubeChannelWidget 
                              widget={w} 
                              isEditMode={isEditMode} 
                              onEdit={() => openWidgetModal(w)} 
                              onDelete={() => deleteWidget(w.id)}
                              cache={youtubeVideosCache}
                              setCache={setYoutubeVideosCache}
                            />
                          ) : isHtmlWidget ? (
                            <div className="group bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 p-4 w-full h-full">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold" style={{ color: '#2d84c1' }}>{w.title}</span>
                                {isEditMode && (
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                    <button onClick={() => openWidgetModal(w)} className="p-1 bg-gray-100 rounded"><Edit2 className="h-3 w-3 text-gray-600" /></button>
                                    <button onClick={() => deleteWidget(w.id)} className="p-1 bg-gray-100 rounded"><Trash2 className="h-3 w-3 text-red-500" /></button>
                                  </div>
                                )}
                              </div>
                              {w.description && <p className="text-xs text-gray-500 mb-2">{w.description}</p>}
                              <div dangerouslySetInnerHTML={{ __html: w.html_content || '' }} className="w-full" />
                            </div>
                          ) : isOnboarding ? (
                            <div onClick={() => setShowMasterclassView(true)} className={`group relative block rounded-xl overflow-hidden shadow-lg hover:shadow-xl cursor-pointer w-full ${w.image_height === 'small' ? 'h-32' : w.image_height === 'large' ? 'h-64' : 'h-48'}`}>
                              {w.image_url ? <img src={w.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-primary/80 to-primary" />}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                                <h3 className="text-xl font-bold">{w.title}</h3>
                                {w.description && <p className="text-sm text-white/80">{w.description}</p>}
                              </div>
                              {isEditMode && (
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100">
                                  <button onClick={e => { e.stopPropagation(); openWidgetModal(w); }} className="p-1.5 bg-white/90 rounded-lg"><Edit2 className="h-4 w-4 text-gray-700" /></button>
                                  <button onClick={e => { e.stopPropagation(); deleteWidget(w.id); }} className="p-1.5 bg-white/90 rounded-lg"><Trash2 className="h-4 w-4 text-red-500" /></button>
                                </div>
                              )}
                            </div>
                          ) : w.size === 'large' ? (
                            <a href={w.link_url || '#'} target="_blank" className={`group relative block rounded-xl overflow-hidden shadow-lg hover:shadow-xl w-full ${w.image_height === 'small' ? 'h-32' : w.image_height === 'large' ? 'h-64' : 'h-48'}`}>
                              {w.image_url ? <img src={w.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-primary/80 to-primary" />}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                                <h3 className="text-xl font-bold">{w.title}</h3>
                                {w.description && <p className="text-sm text-white/80">{w.description}</p>}
                              </div>
                              {isEditMode && (
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100">
                                  <button onClick={e => { e.preventDefault(); openWidgetModal(w); }} className="p-1.5 bg-white/90 rounded-lg"><Edit2 className="h-4 w-4 text-gray-700" /></button>
                                  <button onClick={e => { e.preventDefault(); deleteWidget(w.id); }} className="p-1.5 bg-white/90 rounded-lg"><Trash2 className="h-4 w-4 text-red-500" /></button>
                                </div>
                              )}
                            </a>
                          ) : w.title.toLowerCase().includes('materialien') ? (
                            <div onClick={() => setShowMaterialsView(true)} className="group flex flex-col items-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 text-center w-full h-full cursor-pointer">
                              <div className="w-12 h-12 mb-2 flex-shrink-0">
                                {w.image_url ? <img src={w.image_url} className="w-full h-full object-contain" /> : <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center"><FileText className="h-6 w-6 text-primary" /></div>}
                              </div>
                              <span className="text-sm font-semibold group-hover:text-primary" style={{ color: '#2d84c1' }}>{w.title}</span>
                              {w.description && <span className="text-xs text-gray-500 mt-1">{w.description}</span>}
                              {isEditMode && (
                                <div className="flex gap-1 mt-auto pt-2 opacity-0 group-hover:opacity-100">
                                  <button onClick={e => { e.stopPropagation(); openWidgetModal(w); }} className="p-1 bg-gray-100 rounded"><Edit2 className="h-3 w-3 text-gray-600" /></button>
                                  <button onClick={e => { e.stopPropagation(); deleteWidget(w.id); }} className="p-1 bg-gray-100 rounded"><Trash2 className="h-3 w-3 text-red-500" /></button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <a href={w.link_url || '#'} target="_blank" className="group flex flex-col items-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 text-center w-full h-full">
                              <div className="w-12 h-12 mb-2 flex-shrink-0">
                                {w.image_url ? <img src={w.image_url} className="w-full h-full object-contain" /> : <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center"><FileText className="h-6 w-6 text-primary" /></div>}
                              </div>
                              <span className="text-sm font-semibold group-hover:text-primary" style={{ color: '#2d84c1' }}>{w.title}</span>
                              {w.description && <span className="text-xs text-gray-500 mt-1">{w.description}</span>}
                              {isEditMode && (
                                <div className="flex gap-1 mt-auto pt-2 opacity-0 group-hover:opacity-100">
                                  <button onClick={e => { e.preventDefault(); openWidgetModal(w); }} className="p-1 bg-gray-100 rounded"><Edit2 className="h-3 w-3 text-gray-600" /></button>
                                  <button onClick={e => { e.preventDefault(); deleteWidget(w.id); }} className="p-1 bg-gray-100 rounded"><Trash2 className="h-3 w-3 text-red-500" /></button>
                                </div>
                              )}
                            </a>
                          )}
                        </SortableWidget>
                      );
                    })}
                    </div>
                  </DroppableSection>
                </div>
              );
            })}
            
            {/* Widgets ohne Sektion */}
            {widgets.filter(w => !w.section_id).length > 0 && (
              <div className="mb-6">
                {isEditMode && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-yellow-50 rounded-lg border border-dashed border-yellow-300">
                    <span className="text-sm text-yellow-700">Nicht zugeordnete Widgets - Ziehen Sie diese in eine Sektion</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {widgets.filter(w => !w.section_id).map(w => (
                    <SortableWidget key={w.id} id={w.id} isEditMode={isEditMode}>
                      <div className="group relative block rounded-xl overflow-hidden shadow-lg hover:shadow-xl cursor-pointer h-48 w-full">
                        {w.image_url ? <img src={w.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-primary/80 to-primary" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                          <h3 className="text-xl font-bold">{w.title}</h3>
                        </div>
                      </div>
                    </SortableWidget>
                  ))}
                </div>
              </div>
            )}
          </SortableContext>
        </DndContext>
      </div>}
      {showBulletinModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between p-4 border-b"><h3 className="font-semibold">{editingBulletin ? 'Bearbeiten' : 'Neue Nachricht'}</h3><button onClick={() => setShowBulletinModal(false)}><X className="h-5 w-5" /></button></div><div className="p-4 space-y-4"><input value={bulletinTitle} onChange={e => setBulletinTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Titel" /><textarea value={bulletinContent} onChange={e => setBulletinContent(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Inhalt" rows={4} /><input value={bulletinLinkUrl} onChange={e => setBulletinLinkUrl(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Link URL" /><input value={bulletinLinkText} onChange={e => setBulletinLinkText(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Link Text" /><div className="flex gap-2"><input type="color" value={bulletinCustomColor || '#ffffff'} onChange={e => setBulletinCustomColor(e.target.value)} className="w-10 h-10 rounded border" /><select value={bulletinPriority} onChange={e => setBulletinPriority(e.target.value as any)} className="flex-1 px-3 py-2 border rounded-lg"><option value="low">Niedrig</option><option value="normal">Normal</option><option value="high">Hoch</option><option value="urgent">Dringend</option></select></div><label className="flex items-center gap-2"><input type="checkbox" checked={bulletinPinned} onChange={e => setBulletinPinned(e.target.checked)} />Anpinnen</label></div><div className="flex justify-end gap-2 p-4 border-t"><button onClick={() => setShowBulletinModal(false)} className="px-4 py-2 text-gray-700">Abbrechen</button><button onClick={saveBulletin} className="px-4 py-2 bg-primary text-white rounded-lg">Speichern</button></div></div></div>}
      {showWidgetModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">{editingWidget ? 'Bearbeiten' : widgetType === 'link' ? 'Neue Link-Vorschau' : widgetType === 'youtube' ? 'Neues YouTube-Widget' : widgetType === 'html' ? 'Neues HTML-Widget' : 'Neues Widget'}</h3>
            <button onClick={() => setShowWidgetModal(false)}><X className="h-5 w-5" /></button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
              <input value={widgetTitle} onChange={e => setWidgetTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Titel" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
              <input value={widgetDescription} onChange={e => setWidgetDescription(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Beschreibung" />
            </div>
            {widgetType === 'link' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link URL *</label>
                <input 
                  value={widgetLinkPreviewUrl} 
                  onChange={e => setWidgetLinkPreviewUrl(e.target.value)} 
                  className="w-full px-3 py-2 border rounded-lg" 
                  placeholder="https://song.so/jura-lernen-und-verstehen" 
                />
                <p className="text-xs text-gray-500 mt-1">Die Vorschau wird automatisch aus den Metadaten der Seite generiert</p>
              </div>
            ) : widgetType === 'youtube' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">YouTube Channel ID *</label>
                  <input 
                    value={widgetYoutubeChannelId} 
                    onChange={e => setWidgetYoutubeChannelId(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-lg" 
                    placeholder="UCelspPjl7qVPqa5Ga7povTQ" 
                  />
                  <p className="text-xs text-gray-500 mt-1">Die Channel ID finden Sie in der URL Ihres YouTube-Kanals</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Videos</label>
                  <select 
                    value={widgetYoutubeVideoCount} 
                    onChange={e => setWidgetYoutubeVideoCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value={1}>1 Video</option>
                    <option value={2}>2 Videos</option>
                    <option value={3}>3 Videos</option>
                    <option value={4}>4 Videos</option>
                    <option value={5}>5 Videos</option>
                  </select>
                </div>
              </>
            ) : widgetType === 'html' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">YouTube-Video URL</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                      onChange={e => {
                        const url = e.target.value;
                        const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                        if (match) {
                          setWidgetHtmlContent(`<iframe width="100%" height="200" src="https://www.youtube.com/embed/${match[1]}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`);
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Fügen Sie eine YouTube-URL ein, um automatisch den Embed-Code zu generieren</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HTML-Code *</label>
                  <textarea 
                    value={widgetHtmlContent} 
                    onChange={e => setWidgetHtmlContent(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm" 
                    placeholder="<iframe src='...'></iframe>" 
                    rows={6}
                  />
                <p className="text-xs text-gray-500 mt-1">Fügen Sie hier Ihren HTML-Code ein (z.B. iframes, eingebettete Inhalte)</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Größe</label>
                  <div className="flex gap-3">
                    <label className={`flex-1 p-3 border-2 rounded-lg cursor-pointer text-center ${widgetSize === 'small' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                      <input type="radio" className="sr-only" checked={widgetSize === 'small'} onChange={() => setWidgetSize('small')} />Klein
                    </label>
                    <label className={`flex-1 p-3 border-2 rounded-lg cursor-pointer text-center ${widgetSize === 'large' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                      <input type="radio" className="sr-only" checked={widgetSize === 'large'} onChange={() => setWidgetSize('large')} />Groß
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bild</label>
              {widgetImage ? (
                <div className="relative">
                  <img src={widgetImage} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                  <button type="button" onClick={() => setWidgetImage(null)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer border-gray-300 hover:border-gray-400">
                  <Upload className="h-6 w-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">Bild hochladen</span>
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
                    const filePath = `widgets/${fileName}`;
                    const arrayBuffer = await file.arrayBuffer();
                    const { error } = await supabase.storage.from('masterclass').upload(filePath, arrayBuffer, { contentType: file.type });
                    if (!error) {
                      const { data: { publicUrl } } = supabase.storage.from('masterclass').getPublicUrl(filePath);
                      setWidgetImage(publicUrl);
                    }
                  }} />
                </label>
              )}
                </div>
                {widgetImage && widgetSize === 'large' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bildhöhe</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setWidgetImageHeight('small')} className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm ${widgetImageHeight === 'small' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>Klein (8rem)</button>
                      <button type="button" onClick={() => setWidgetImageHeight('medium')} className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm ${widgetImageHeight === 'medium' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>Mittel (12rem)</button>
                      <button type="button" onClick={() => setWidgetImageHeight('large')} className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm ${widgetImageHeight === 'large' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>Groß (16rem)</button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
                  <input value={widgetLinkUrl} onChange={e => setWidgetLinkUrl(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="https://..." />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 p-4 border-t">
            <button onClick={() => setShowWidgetModal(false)} className="px-4 py-2 text-gray-700">Abbrechen</button>
            <button onClick={saveWidget} className="px-4 py-2 bg-primary text-white rounded-lg">Speichern</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
