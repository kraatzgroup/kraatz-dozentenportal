import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { HelpCircle, Video, ChevronDown, ChevronUp, ChevronLeft, MessageSquare, Plus, Edit2, Trash2, X } from 'lucide-react';

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

const getEmbedUrl = (url: string): { type: 'iframe' | 'video'; embedUrl: string } => {
  if (url.includes('loom.com')) {
    const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (match) return { type: 'iframe', embedUrl: `https://www.loom.com/embed/${match[1]}` };
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let videoId = '';
    if (url.includes('youtube.com/watch')) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      videoId = urlParams.get('v') || '';
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    }
    if (videoId) return { type: 'iframe', embedUrl: `https://www.youtube.com/embed/${videoId}` };
  }
  if (url.includes('vimeo.com')) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match) return { type: 'iframe', embedUrl: `https://player.vimeo.com/video/${match[1]}` };
  }
  return { type: 'video', embedUrl: url };
};

interface TutorialsProps {
  faqTable?: string;
  videoTable?: string;
  pageTitle?: string;
  pageSubtitle?: string;
}

export function DozentenTutorials({
  faqTable = 'dozenten_support_faqs',
  videoTable = 'dozenten_support_videos',
  pageTitle = 'Tutorials & Support',
  pageSubtitle = 'Videos mit Anleitungen und Erklärungen',
}: TutorialsProps = {}) {
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const { addToast } = useToastStore();

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [videos, setVideos] = useState<SupportVideo[]>([]);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Admin state
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: 'Allgemein' });
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<SupportVideo | null>(null);
  const [videoForm, setVideoForm] = useState({ title: '', description: '', video_url: '', category: 'Allgemein' });

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    setIsLoading(true);
    const { data: faqData } = await supabase.from(faqTable).select('*').eq('is_active', true).order('order_index');
    setFaqs(faqData || []);
    const { data: videoData } = await supabase.from(videoTable).select('*').eq('is_active', true).order('order_index');
    setVideos(videoData || []);
    setIsLoading(false);
  };

  // FAQ CRUD
  const handleSaveFaq = async () => {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) return;
    try {
      if (editingFaq) {
        await supabase.from(faqTable).update({
          question: faqForm.question, answer: faqForm.answer, category: faqForm.category, updated_at: new Date().toISOString()
        }).eq('id', editingFaq.id);
      } else {
        const { data: maxOrder } = await supabase.from(faqTable).select('order_index').order('order_index', { ascending: false }).limit(1).maybeSingle();
        await supabase.from(faqTable).insert({
          question: faqForm.question, answer: faqForm.answer, category: faqForm.category, order_index: (maxOrder?.order_index || 0) + 1, is_active: true
        });
      }
      setShowFaqModal(false); setEditingFaq(null); setFaqForm({ question: '', answer: '', category: 'Allgemein' });
      fetchContent(); addToast('FAQ gespeichert', 'success');
    } catch (error) { console.error('Error saving FAQ:', error); addToast('Fehler beim Speichern', 'error'); }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm('Möchten Sie diese FAQ wirklich löschen?')) return;
    await supabase.from(faqTable).update({ is_active: false }).eq('id', id);
    fetchContent();
  };

  // Video CRUD
  const handleSaveVideo = async () => {
    if (!videoForm.title.trim() || !videoForm.video_url.trim()) return;
    try {
      if (editingVideo) {
        await supabase.from(videoTable).update({
          title: videoForm.title, description: videoForm.description || null, video_url: videoForm.video_url, category: videoForm.category, updated_at: new Date().toISOString()
        }).eq('id', editingVideo.id);
      } else {
        const { data: maxOrder } = await supabase.from(videoTable).select('order_index').order('order_index', { ascending: false }).limit(1).maybeSingle();
        await supabase.from(videoTable).insert({
          title: videoForm.title, description: videoForm.description || null, video_url: videoForm.video_url, category: videoForm.category, order_index: (maxOrder?.order_index || 0) + 1, is_active: true
        });
      }
      setShowVideoModal(false); setEditingVideo(null); setVideoForm({ title: '', description: '', video_url: '', category: 'Allgemein' });
      fetchContent(); addToast('Video gespeichert', 'success');
    } catch (error) { console.error('Error saving video:', error); addToast('Fehler beim Speichern', 'error'); }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm('Möchten Sie dieses Video wirklich löschen?')) return;
    await supabase.from(videoTable).update({ is_active: false }).eq('id', id);
    fetchContent();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <HelpCircle className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/messages')} className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium whitespace-nowrap">
            <MessageSquare className="h-4 w-4 mr-2" />Support kontaktieren
          </button>
          {isAdmin && (
            <>
              <button onClick={() => { setEditingVideo(null); setVideoForm({ title: '', description: '', video_url: '', category: 'Allgemein' }); setShowVideoModal(true); }} className="inline-flex items-center px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm">
                <Plus className="h-4 w-4 mr-1" />Video
              </button>
              <button onClick={() => { setEditingFaq(null); setFaqForm({ question: '', answer: '', category: 'Allgemein' }); setShowFaqModal(true); }} className="inline-flex items-center px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm">
                <Plus className="h-4 w-4 mr-1" />FAQ
              </button>
            </>
          )}
        </div>
      </div>

      {/* Videos Section */}
      {videos.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-medium text-gray-900 flex items-center gap-2">
                  <Video className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  Hilfsvideos
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {pageSubtitle}
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {videos.map((video) => {
                const { type, embedUrl } = getEmbedUrl(video.video_url);
                return (
                  <div key={video.id} className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                    <div className="aspect-video bg-black">
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
                          controls
                          className="w-full h-full"
                          poster={video.thumbnail_url || undefined}
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-sm font-medium text-gray-900 flex-1">{video.title}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 whitespace-nowrap">
                          {video.category}
                        </span>
                      </div>
                      {video.description && (
                        <p className="text-sm text-gray-600 mt-2">{video.description}</p>
                      )}
                      {isAdmin && (
                        <div className="mt-3 flex items-center gap-2">
                          <button onClick={() => { setEditingVideo(video); setVideoForm({ title: video.title, description: video.description || '', video_url: video.video_url, category: video.category }); setShowVideoModal(true); }} className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            <Edit2 className="h-3 w-3 mr-1" />Bearbeiten
                          </button>
                          <button onClick={() => handleDeleteVideo(video.id)} className="inline-flex items-center px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">
                            <Trash2 className="h-3 w-3 mr-1" />Löschen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* FAQ Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-medium text-gray-900 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Häufig gestellte Fragen
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Antworten auf die wichtigsten Fragen
          </p>
        </div>
        {faqs.length === 0 ? (
          <div className="p-8 text-center">
            <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Noch keine FAQs vorhanden</h4>
            <p className="text-gray-500">Der Support-Bereich wird bald mit Inhalten gefüllt.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {faqs.map((faq) => (
              <div key={faq.id} className="p-4 sm:p-6">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                  className="w-full flex items-start justify-between text-left gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 mb-2">
                      {faq.category}
                    </span>
                    <h4 className="text-sm sm:text-base font-medium text-gray-900 break-words">{faq.question}</h4>
                  </div>
                  {expandedFaq === faq.id ? (
                    <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
                  )}
                </button>
                {expandedFaq === faq.id && (
                  <div className="mt-3 pl-0">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{faq.answer}</p>
                    {isAdmin && (
                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={() => { setEditingFaq(faq); setFaqForm({ question: faq.question, answer: faq.answer, category: faq.category }); setShowFaqModal(true); }} className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                          <Edit2 className="h-3 w-3 mr-1" />Bearbeiten
                        </button>
                        <button onClick={() => handleDeleteFaq(faq.id)} className="inline-flex items-center px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">
                          <Trash2 className="h-3 w-3 mr-1" />Löschen
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

      {/* Empty State when no content at all */}
      {videos.length === 0 && faqs.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <HelpCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">{pageTitle}</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Hier findest du bald hilfreiche Videos und Antworten auf häufig gestellte Fragen.
          </p>
        </div>
      )}

      {/* FAQ Modal */}
      {showFaqModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowFaqModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">{editingFaq ? 'FAQ bearbeiten' : 'Neue FAQ hinzufügen'}</h3>
                <button onClick={() => setShowFaqModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                  <select value={faqForm.category} onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    <option value="Allgemein">Allgemein</option>
                    <option value="Einheiten">Einheiten</option>
                    <option value="Materialien">Materialien</option>
                    <option value="Technisch">Technisch</option>
                    <option value="Abrechnung">Abrechnung</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frage *</label>
                  <input type="text" value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })} placeholder="z.B. Wie reiche ich meine Stunden ein?" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Antwort *</label>
                  <textarea value={faqForm.answer} onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })} rows={4} placeholder="Die ausführliche Antwort..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setShowFaqModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Abbrechen</button>
                <button onClick={handleSaveFaq} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">Speichern</button>
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
                <h3 className="text-lg font-medium text-gray-900">{editingVideo ? 'Video bearbeiten' : 'Neues Video hinzufügen'}</h3>
                <button onClick={() => setShowVideoModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                  <select value={videoForm.category} onChange={(e) => setVideoForm({ ...videoForm, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    <option value="Allgemein">Allgemein</option>
                    <option value="Einheiten">Einheiten</option>
                    <option value="Materialien">Materialien</option>
                    <option value="Technisch">Technisch</option>
                    <option value="Abrechnung">Abrechnung</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                  <input type="text" value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} placeholder="z.B. Einführung ins Portal" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video-URL * (YouTube, Loom, Vimeo oder direkter Link)</label>
                  <input type="text" value={videoForm.video_url} onChange={(e) => setVideoForm({ ...videoForm, video_url: e.target.value })} placeholder="https://www.loom.com/share/..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                  <textarea value={videoForm.description} onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })} rows={3} placeholder="Kurze Beschreibung des Videos..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setShowVideoModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Abbrechen</button>
                <button onClick={handleSaveVideo} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">Speichern</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
