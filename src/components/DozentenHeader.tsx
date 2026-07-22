import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useMessageStore } from '../store/messageStore';
import { supabase } from '../lib/supabase';
import { Calendar, Bell, MessageSquare, Settings, LogOut, Menu, X, Upload, FileText, CheckCircle, XCircle } from 'lucide-react';

export const DozentenHeader: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const additionalRoles = useAuthStore(state => state.additionalRoles);
  const vbLegalAreas = useAuthStore(state => state.vbLegalAreas);
  const messages = useMessageStore(state => state.messages);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showActivityDropdown, setShowActivityDropdown] = useState(false);
  const [unreadActivities, setUnreadActivities] = useState<any[]>([]);
  const [vbAvailable, setVbAvailable] = useState<boolean | null>(null);
  const [isVbSpringer, setIsVbSpringer] = useState(false);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [showAvailabilityConfirm, setShowAvailabilityConfirm] = useState(false);
  const [openCases, setOpenCases] = useState<{ requests: string[]; corrections: string[]; videos: string[] } | null>(null);

  const isVbDozent = additionalRoles?.includes('videobesprechung_dozent');

  const unreadMessages = messages.filter(message => !message.read);

  useEffect(() => {
    if (!user) return;
    const fetchUnreadNotifications = async () => {
      console.log('🔔 DozentenHeader: Fetching unread vb_notifications for user:', user.id);
      const { data, error } = await supabase
        .from('vb_notifications')
        .select('id, title, message, type, created_at')
        .eq('profile_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        console.error('❌ DozentenHeader: Error fetching vb_notifications:', error);
      }
      console.log(`🔔 DozentenHeader: Found ${data?.length || 0} unread notifications:`, data);
      setUnreadActivities(data || []);
    };
    fetchUnreadNotifications();

    const channel = supabase
      .channel(`vb-notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'vb_notifications',
        filter: `profile_id=eq.${user.id}`
      }, (payload) => {
        console.log('🔔 DozentenHeader: Realtime notification received:', payload.new);
        setUnreadActivities(prev => [payload.new as any, ...prev]);
      })
      .subscribe((status) => {
        console.log('🔔 DozentenHeader: Realtime subscription status:', status);
      });

    return () => {
      console.log('🔔 DozentenHeader: Removing realtime channel');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleNotificationClick = async (notificationId: string) => {
    console.log('🔔 DozentenHeader: Notification clicked, marking as read:', notificationId);
    setUnreadActivities(prev => prev.filter(n => n.id !== notificationId));
    setShowActivityDropdown(false);
    const { error } = await supabase
      .from('vb_notifications')
      .update({ read: true })
      .eq('id', notificationId);
    if (error) {
      console.error('❌ DozentenHeader: Error marking notification as read:', error);
    } else {
      console.log('✅ DozentenHeader: Notification marked as read:', notificationId);
    }
    navigate('/klausurenbesprechung/korrektur');
  };

  const handleMarkAllRead = async () => {
    if (!user || unreadActivities.length === 0) return;
    const ids = unreadActivities.map(n => n.id);
    console.log(`🔔 DozentenHeader: Marking all ${ids.length} notifications as read:`, ids);
    setUnreadActivities([]);
    const { error } = await supabase
      .from('vb_notifications')
      .update({ read: true })
      .in('id', ids);
    if (error) {
      console.error('❌ DozentenHeader: Error marking all notifications as read:', error);
    } else {
      console.log('✅ DozentenHeader: All notifications marked as read');
    }
  };

  useEffect(() => {
    const fetchVbAvailability = async () => {
      if (!user || !isVbDozent) return;
      const { data } = await supabase
        .from('profiles')
        .select('vb_available, vb_springer')
        .eq('id', user.id)
        .single();
      setVbAvailable(data?.vb_available !== false);
      setIsVbSpringer(data?.vb_springer === true);
    };
    fetchVbAvailability();
  }, [user?.id, isVbDozent]);

  const handleOpenAvailabilityConfirm = async () => {
    setOpenCases(null);
    setShowAvailabilityConfirm(true);
    // Only relevant when switching to "Nicht verfügbar": check for open cases
    if (!user || vbAvailable !== true) return;
    try {
      const areas = vbLegalAreas || [];
      let requestCases: any[] = [];
      if (areas.length > 0) {
        const { data } = await supabase
          .from('vb_case_study_requests')
          .select('id, case_study_number, legal_area, sub_area, focus_area, profile_id')
          .eq('status', 'requested')
          .in('legal_area', areas);
        requestCases = data || [];
      }
      const { data: assigned } = await supabase
        .from('vb_case_study_requests')
        .select('id, case_study_number, legal_area, sub_area, focus_area, profile_id, status, video_correction_url')
        .eq('assigned_dozent_id', user.id)
        .in('status', ['submitted', 'under_review', 'corrected']);
      const correctionCases = (assigned || []).filter(c => c.status === 'submitted' || c.status === 'under_review');
      const videoCases = (assigned || []).filter(c => c.status === 'corrected' && !c.video_correction_url);

      // Resolve student names
      const profileIds = [...new Set([...requestCases, ...correctionCases, ...videoCases].map(c => c.profile_id).filter(Boolean))];
      const nameMap = new Map<string, string>();
      if (profileIds.length > 0) {
        const { data: students } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', profileIds);
        (students || []).forEach(s => nameMap.set(s.id, s.full_name || s.email));
      }

      const describeCase = (c: any) => {
        const parts = [c.legal_area, c.sub_area].filter(Boolean).join(' / ');
        const student = nameMap.get(c.profile_id);
        return `Klausur #${c.case_study_number ?? '?'} – ${parts}${c.focus_area ? `, ${c.focus_area}` : ''}${student ? ` (${student})` : ''}`;
      };

      setOpenCases({
        requests: requestCases.map(describeCase),
        corrections: correctionCases.map(describeCase),
        videos: videoCases.map(describeCase)
      });
    } catch (err) {
      console.error('Error checking open VB cases:', err);
    }
  };

  const handleToggleVbAvailability = async () => {
    if (!user || vbAvailable === null || isTogglingAvailability) return;
    // Springer-Dozenten können sich nicht auf "Nicht verfügbar" stellen
    if (isVbSpringer) return;
    const newValue = !vbAvailable;
    setIsTogglingAvailability(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ vb_available: newValue })
        .eq('id', user.id);
      if (error) throw error;
      setVbAvailable(newValue);
      // Notify springer about handed-over cases when going unavailable
      if (newValue === false) {
        try {
          console.log('📧 DozentenHeader: Invoking vb-notify-springer-handover...');
          const { data: handoverResult, error: handoverError } = await supabase.functions.invoke('vb-notify-springer-handover', {
            body: { dozentId: user.id }
          });
          if (handoverError) {
            console.error('❌ DozentenHeader: Springer handover notification failed:', handoverError);
          } else {
            console.log('✅ DozentenHeader: Springer handover notification result:', handoverResult);
          }
        } catch (e) {
          console.error('❌ DozentenHeader: Springer handover notification exception:', e);
        }
      }
      // Reload the page so all views reflect the new availability
      window.location.reload();
    } catch (err) {
      console.error('Error toggling VB availability:', err);
      setIsTogglingAvailability(false);
      setShowAvailabilityConfirm(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg p-1 -ml-1 hover:bg-gray-100 transition-colors"
              >
                <img
                  src="https://kraatz-group.de/wp-content/uploads/2023/05/KraatzGroup_Logo_web.png"
                  alt="Kraatz Group"
                  className="h-6 sm:h-8 w-auto object-contain"
                />
                <span className="ml-2 text-xl font-semibold text-gray-900">Dozenten-Portal</span>
              </button>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-2 sm:space-x-4">
            {isVbDozent ? (
              isVbSpringer ? null : (
                <button
                  onClick={handleOpenAvailabilityConfirm}
                  disabled={vbAvailable === null || isTogglingAvailability}
                  className={`inline-flex items-center px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer disabled:opacity-60 ${
                    vbAvailable === false
                      ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                      : 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                  }`}
                  title="Verfügbarkeit für Videoklausurenkorrektur umschalten"
                >
                  {vbAvailable === false ? (
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  )}
                  <span className="hidden sm:inline">{vbAvailable === false ? 'Nicht verfügbar' : 'Verfügbar'}</span>
                </button>
              )
            ) : (
              <button
                className="inline-flex items-center px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200"
                title="Verfügbarkeit bearbeiten"
              >
                <Calendar className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Begrenzt</span>
              </button>
            )}
            <button
              onClick={() => setShowActivityDropdown(!showActivityDropdown)}
              className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
              title="Letzte Aktivitäten"
            >
              <Bell className="h-5 w-5" />
              {unreadActivities.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {unreadActivities.length > 99 ? '99+' : unreadActivities.length}
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
            {isVbDozent && !isVbSpringer && (
              <button
                onClick={handleOpenAvailabilityConfirm}
                disabled={vbAvailable === null || isTogglingAvailability}
                className={`inline-flex items-center justify-center p-2 rounded-full border transition cursor-pointer disabled:opacity-60 ${
                  vbAvailable === false
                    ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                    : 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                }`}
                title="Verfügbarkeit für Videoklausurenkorrektur umschalten"
              >
                {vbAvailable === false ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              onClick={() => setShowActivityDropdown(!showActivityDropdown)}
              className="relative inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              <Bell className="h-6 w-6" />
              {unreadActivities.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {unreadActivities.length > 99 ? '99+' : unreadActivities.length}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/messages')}
              className="relative inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              <MessageSquare className="h-6 w-6" />
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
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Activity Dropdown */}
        {showActivityDropdown && (
          <div className="absolute right-2 top-16 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Letzte Aktivitäten</h3>
              {unreadActivities.length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                >
                  Alle als gelesen markieren
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-80">
              {unreadActivities.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  Keine neuen Aktivitäten
                </div>
              ) : (
                unreadActivities.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => handleNotificationClick(activity.id)}
                    className="p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        activity.type === 'success' ? 'bg-green-100' : 'bg-orange-100'
                      }`}>
                        {activity.type === 'success'
                          ? <Upload className="h-4 w-4 text-green-600" />
                          : <FileText className="h-4 w-4 text-orange-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-900">{activity.title}</p>
                        <p className="text-xs text-gray-500 truncate">{activity.message}</p>
                        {activity.created_at && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(activity.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr
                          </p>
                        )}
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
              <button
                onClick={() => {
                  navigate('/dashboard');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-5 w-5">
                  <rect width="7" height="9" x="3" y="3" rx="1" />
                  <rect width="7" height="5" x="14" y="3" rx="1" />
                  <rect width="7" height="9" x="14" y="12" rx="1" />
                  <rect width="7" height="5" x="3" y="16" rx="1" />
                </svg>
                Dashboard
              </button>
              <button
                onClick={() => {
                  navigate('/klausurenbesprechung/korrektur');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Calendar className="h-5 w-5 mr-2" />
                Korrektur
              </button>
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
      </div>

      {/* VB Availability Confirmation Modal */}
      {showAvailabilityConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isTogglingAvailability && setShowAvailabilityConfirm(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center mb-4">
              {vbAvailable ? (
                <XCircle className="h-6 w-6 text-red-500 mr-2 flex-shrink-0" />
              ) : (
                <CheckCircle className="h-6 w-6 text-green-500 mr-2 flex-shrink-0" />
              )}
              <h3 className="text-lg font-medium text-gray-900">
                {vbAvailable ? 'Auf "Nicht verfügbar" stellen?' : 'Auf "Verfügbar" stellen?'}
              </h3>
            </div>
            {vbAvailable ? (
              <div className="text-sm text-gray-600 space-y-2 mb-6">
                <p>Wenn Sie sich auf <strong>Nicht verfügbar</strong> stellen:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Neue Sachverhalt-Anfragen für die Videoklausurenkorrektur werden automatisch an den Springer-Dozenten weitergeleitet.</li>
                  <li>Sie sehen keine neuen offenen Anfragen mehr in den Tabs „Anfragen" und „Materialien versendet".</li>
                  <li>Bereits von Ihnen übernommene Klausuren bleiben bei Ihnen und können weiter bearbeitet werden.</li>
                </ul>
                {openCases && (openCases.requests.length > 0 || openCases.corrections.length > 0 || openCases.videos.length > 0) && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded-md">
                    <p className="font-medium text-yellow-800">⚠️ Vorsicht: Sie haben noch offene Fälle!</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1 text-yellow-800">
                      {openCases.requests.length > 0 && (
                        <li>
                          {openCases.requests.length === 1 ? '1 offene Anfrage, für die noch ein Sachverhalt zugewiesen werden muss:' : `${openCases.requests.length} offene Anfragen, für die noch Sachverhalte zugewiesen werden müssen:`}
                          <ul className="list-[circle] pl-5 mt-0.5 space-y-0.5">
                            {openCases.requests.map((label, i) => <li key={i}>{label}</li>)}
                          </ul>
                        </li>
                      )}
                      {openCases.corrections.length > 0 && (
                        <li>
                          {openCases.corrections.length === 1 ? '1 eingereichte Klausur, die noch korrigiert werden muss:' : `${openCases.corrections.length} eingereichte Klausuren, die noch korrigiert werden müssen:`}
                          <ul className="list-[circle] pl-5 mt-0.5 space-y-0.5">
                            {openCases.corrections.map((label, i) => <li key={i}>{label}</li>)}
                          </ul>
                        </li>
                      )}
                      {openCases.videos.length > 0 && (
                        <li>
                          {openCases.videos.length === 1 ? '1 korrigierte Klausur, zu der noch ein Video bereitgestellt werden muss:' : `${openCases.videos.length} korrigierte Klausuren, zu denen noch Videos bereitgestellt werden müssen:`}
                          <ul className="list-[circle] pl-5 mt-0.5 space-y-0.5">
                            {openCases.videos.map((label, i) => <li key={i}>{label}</li>)}
                          </ul>
                        </li>
                      )}
                    </ul>
                    <p className="mt-2 text-yellow-800">Bitte schließen Sie diese Fälle nach Möglichkeit ab, bevor Sie sich auf „Nicht verfügbar“ stellen.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-600 space-y-2 mb-6">
                <p>Wenn Sie sich auf <strong>Verfügbar</strong> stellen:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Sie erhalten wieder neue Sachverhalt-Anfragen für Ihre Rechtsgebiete (E-Mail und Benachrichtigung).</li>
                  <li>Offene Anfragen werden Ihnen wieder in den Tabs „Anfragen" und „Materialien versendet" angezeigt.</li>
                  <li>Der Springer-Dozent erhält für Ihre Rechtsgebiete keine neuen Anfragen mehr.</li>
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAvailabilityConfirm(false)}
                disabled={isTogglingAvailability}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-60"
              >
                Abbrechen
              </button>
              <button
                onClick={handleToggleVbAvailability}
                disabled={isTogglingAvailability}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-60 ${
                  vbAvailable ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isTogglingAvailability
                  ? 'Wird gespeichert…'
                  : vbAvailable
                    ? 'Ja, auf "Nicht verfügbar" stellen'
                    : 'Ja, auf "Verfügbar" stellen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};