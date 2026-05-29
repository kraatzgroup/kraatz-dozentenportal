import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Download, Trash2, User, Calendar, Filter, ArrowLeft, MessageSquare, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';

interface FeedbackResponse {
  id: string;
  created_at: string;
  q1_first_name: string | null;
  q1_last_name: string | null;
  q2_source: string | null;
  q3_exam_quality: number | null;
  q4_exam_help: string | null;
  q5_exam_improvement: string | null;
  q6_material_quality: number | null;
  q7_material_help: string | null;
  q8_enjoy_individual: string | null;
  q9_more_than_group: string | null;
  q10_video_quality: number | null;
  q11_video_improvement: string | null;
  q12_timing_works: string | null;
  q13_timing_improvement: string | null;
  q14_zivil_didaktik: number | null;
  q15_zivil_freundlichkeit: number | null;
  q16_zivil_souveranitaet: number | null;
  q17_zivil_comments: string | null;
  q18_oef_didaktik: number | null;
  q19_oef_freundlichkeit: number | null;
  q20_oef_souveranitaet: number | null;
  q21_oef_comments: string | null;
  q22_straf_didaktik: number | null;
  q23_straf_freundlichkeit: number | null;
  q24_straf_souveranitaet: number | null;
  q25_straf_comments: string | null;
  q26_recommend: string | null;
  q27_not_recommend_reason: string | null;
  q28_final_comments: string | null;
}

interface GroupedFeedback {
  participantName: string;
  responses: FeedbackResponse[];
}

export const FeedbackAdmin = () => {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const { unreadCount, fetchUnreadCount } = useChatStore();
  const [feedbackResponses, setFeedbackResponses] = useState<FeedbackResponse[]>([]);
  const [groupedFeedback, setGroupedFeedback] = useState<GroupedFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedParticipants, setExpandedParticipants] = useState<Set<string>>(new Set());
  const [filterName, setFilterName] = useState('');

  useEffect(() => {
    fetchFeedbackResponses();
    fetchUnreadCount();
  }, []);

  useEffect(() => {
    groupResponsesByParticipant();
  }, [feedbackResponses, filterName]);

  const fetchFeedbackResponses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('feedback_responses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedbackResponses(data || []);
    } catch (err: any) {
      console.error('Error fetching feedback:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const groupResponsesByParticipant = () => {
    const grouped: Record<string, FeedbackResponse[]> = {};

    feedbackResponses.forEach(response => {
      const firstName = response.q1_first_name || 'Unbekannt';
      const lastName = response.q1_last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();

      if (!grouped[fullName]) {
        grouped[fullName] = [];
      }
      grouped[fullName].push(response);
    });

    // Convert to array and filter by name if filter is set
    let groupedArray = Object.entries(grouped).map(([participantName, responses]) => ({
      participantName,
      responses
    }));

    if (filterName) {
      groupedArray = groupedArray.filter(group =>
        group.participantName.toLowerCase().includes(filterName.toLowerCase())
      );
    }

    // Sort by most recent response
    groupedArray.sort((a, b) => {
      const aLatest = new Date(a.responses[0].created_at);
      const bLatest = new Date(b.responses[0].created_at);
      return bLatest.getTime() - aLatest.getTime();
    });

    setGroupedFeedback(groupedArray);
  };

  const toggleParticipant = (participantName: string) => {
    setExpandedParticipants(prev => {
      const next = new Set(prev);
      if (next.has(participantName)) {
        next.delete(participantName);
      } else {
        next.add(participantName);
      }
      return next;
    });
  };

  const deleteResponse = async (id: string) => {
    if (!window.confirm('Möchten Sie diese Antwort wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('feedback_responses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchFeedbackResponses();
    } catch (err: any) {
      console.error('Error deleting feedback:', err);
      alert('Fehler beim Löschen: ' + err.message);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Datum',
      'Vorname',
      'Nachname',
      'Quelle',
      'Klausuren Qualität',
      'Klausuren Hilfe',
      'Klausuren Verbesserung',
      'Material Qualität',
      'Material Hilfe',
      'Einzelunterricht genießen',
      'Mehr als Gruppenkurs',
      'Video Qualität',
      'Video Verbesserung',
      'Terminabsprache funktioniert',
      'Terminabsprache Verbesserung',
      'Zivil Didaktik',
      'Zivil Freundlichkeit',
      'Zivil Souveränität',
      'Zivil Kommentare',
      'Öffentlich Didaktik',
      'Öffentlich Freundlichkeit',
      'Öffentlich Souveränität',
      'Öffentlich Kommentare',
      'Straf Didaktik',
      'Straf Freundlichkeit',
      'Straf Souveränität',
      'Straf Kommentare',
      'Empfehlen',
      'Nicht empfehlen Grund',
      'Finale Kommentare'
    ];

    const rows = feedbackResponses.map(r => [
      new Date(r.created_at).toLocaleDateString('de-DE'),
      r.q1_first_name || '',
      r.q1_last_name || '',
      r.q2_source || '',
      r.q3_exam_quality || '',
      r.q4_exam_help || '',
      r.q5_exam_improvement || '',
      r.q6_material_quality || '',
      r.q7_material_help || '',
      r.q8_enjoy_individual || '',
      r.q9_more_than_group || '',
      r.q10_video_quality || '',
      r.q11_video_improvement || '',
      r.q12_timing_works || '',
      r.q13_timing_improvement || '',
      r.q14_zivil_didaktik || '',
      r.q15_zivil_freundlichkeit || '',
      r.q16_zivil_souveranitaet || '',
      r.q17_zivil_comments || '',
      r.q18_oef_didaktik || '',
      r.q19_oef_freundlichkeit || '',
      r.q20_oef_souveranitaet || '',
      r.q21_oef_comments || '',
      r.q22_straf_didaktik || '',
      r.q23_straf_freundlichkeit || '',
      r.q24_straf_souveranitaet || '',
      r.q25_straf_comments || '',
      r.q26_recommend || '',
      r.q27_not_recommend_reason || '',
      r.q28_final_comments || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `feedback_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <Logo />
                </div>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <Logo />
                </div>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <p className="text-red-700">Fehler beim Laden der Feedback-Daten: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header/Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Logo />
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition"
                >
                  Dashboard
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate('/messages')}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
                title="Nachrichten"
              >
                <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => signOut()}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-red-500 hover:text-red-700 focus:outline-none transition"
                title="Abmelden"
              >
                <LogOut className="h-4 w-4 lg:h-5 lg:w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-4 sm:py-6 px-2 sm:px-6 lg:px-8">
        <div className="py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="mr-3 sm:mr-4 p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full"
                title="Zurück zum Dashboard"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Feedback-Übersicht</h1>
            </div>
          </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <Filter className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Nach Teilnehmer filtern..."
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
        >
          <Download className="w-4 h-4" />
          CSV Export
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            {feedbackResponses.length} Antworten von {groupedFeedback.length} Teilnehmern
          </p>
        </div>

        {groupedFeedback.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Keine Feedback-Antworten gefunden
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {groupedFeedback.map(({ participantName, responses }) => (
              <div key={participantName} className="border-b border-gray-200 last:border-b-0">
                <button
                  onClick={() => toggleParticipant(participantName)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-800">{participantName}</p>
                      <p className="text-sm text-gray-500">
                        {responses.length} {responses.length === 1 ? 'Antwort' : 'Antworten'} • 
                        Letzte: {new Date(responses[0].created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                  {expandedParticipants.has(participantName) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {expandedParticipants.has(participantName) && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="space-y-4">
                      {responses.map((response) => (
                        <div key={response.id} className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Calendar className="w-4 h-4" />
                              {new Date(response.created_at).toLocaleDateString('de-DE')} um{' '}
                              {new Date(response.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <button
                              onClick={() => deleteResponse(response.id)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              title="Löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-medium text-gray-700 mb-1">Quelle</p>
                              <p className="text-gray-600">{response.q2_source || '-'}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700 mb-1">Klausuren Qualität</p>
                              <p className="text-gray-600">{response.q3_exam_quality || '-'}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700 mb-1">Klausuren Hilfe</p>
                              <p className="text-gray-600">{response.q4_exam_help || '-'}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700 mb-1">Material Qualität</p>
                              <p className="text-gray-600">{response.q6_material_quality || '-'}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700 mb-1">Einzelunterricht genießen</p>
                              <p className="text-gray-600">{response.q8_enjoy_individual || '-'}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700 mb-1">Mehr als Gruppenkurs</p>
                              <p className="text-gray-600">{response.q9_more_than_group || '-'}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700 mb-1">Video Qualität</p>
                              <p className="text-gray-600">{response.q10_video_quality || '-'}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700 mb-1">Terminabsprache funktioniert</p>
                              <p className="text-gray-600">{response.q12_timing_works || '-'}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700 mb-1">Empfehlen</p>
                              <p className="text-gray-600">{response.q26_recommend || '-'}</p>
                            </div>
                          </div>

                          {(response.q5_exam_improvement || response.q11_video_improvement || 
                            response.q13_timing_improvement || response.q27_not_recommend_reason ||
                            response.q28_final_comments) && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="font-medium text-gray-700 mb-2">Kommentare & Verbesserungsvorschläge</p>
                              <div className="space-y-2 text-sm text-gray-600">
                                {response.q5_exam_improvement && (
                                  <p><span className="font-medium">Klausuren:</span> {response.q5_exam_improvement}</p>
                                )}
                                {response.q11_video_improvement && (
                                  <p><span className="font-medium">Videos:</span> {response.q11_video_improvement}</p>
                                )}
                                {response.q13_timing_improvement && (
                                  <p><span className="font-medium">Terminabsprache:</span> {response.q13_timing_improvement}</p>
                                )}
                                {response.q27_not_recommend_reason && (
                                  <p><span className="font-medium">Nicht empfehlen:</span> {response.q27_not_recommend_reason}</p>
                                )}
                                {response.q28_final_comments && (
                                  <p><span className="font-medium">Sonstiges:</span> {response.q28_final_comments}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {(response.q14_zivil_didaktik || response.q15_zivil_freundlichkeit || 
                            response.q16_zivil_souveranitaet || response.q17_zivil_comments) && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="font-medium text-gray-700 mb-2">Zivilrecht Dozent</p>
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div>
                                  <p className="text-gray-500">Didaktik</p>
                                  <p className="text-gray-600">{response.q14_zivil_didaktik || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Freundlichkeit</p>
                                  <p className="text-gray-600">{response.q15_zivil_freundlichkeit || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Souveränität</p>
                                  <p className="text-gray-600">{response.q16_zivil_souveranitaet || '-'}</p>
                                </div>
                              </div>
                              {response.q17_zivil_comments && (
                                <p className="mt-2 text-sm text-gray-600 italic">{response.q17_zivil_comments}</p>
                              )}
                            </div>
                          )}

                          {(response.q18_oef_didaktik || response.q19_oef_freundlichkeit || 
                            response.q20_oef_souveranitaet || response.q21_oef_comments) && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="font-medium text-gray-700 mb-2">Öffentliches Recht Dozent</p>
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div>
                                  <p className="text-gray-500">Didaktik</p>
                                  <p className="text-gray-600">{response.q18_oef_didaktik || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Freundlichkeit</p>
                                  <p className="text-gray-600">{response.q19_oef_freundlichkeit || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Souveränität</p>
                                  <p className="text-gray-600">{response.q20_oef_souveranitaet || '-'}</p>
                                </div>
                              </div>
                              {response.q21_oef_comments && (
                                <p className="mt-2 text-sm text-gray-600 italic">{response.q21_oef_comments}</p>
                              )}
                            </div>
                          )}

                          {(response.q22_straf_didaktik || response.q23_straf_freundlichkeit || 
                            response.q24_straf_souveranitaet || response.q25_straf_comments) && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="font-medium text-gray-700 mb-2">Strafrecht Dozent</p>
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div>
                                  <p className="text-gray-500">Didaktik</p>
                                  <p className="text-gray-600">{response.q22_straf_didaktik || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Freundlichkeit</p>
                                  <p className="text-gray-600">{response.q23_straf_freundlichkeit || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Souveränität</p>
                                  <p className="text-gray-600">{response.q24_straf_souveranitaet || '-'}</p>
                                </div>
                              </div>
                              {response.q25_straf_comments && (
                                <p className="mt-2 text-sm text-gray-600 italic">{response.q25_straf_comments}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
};
