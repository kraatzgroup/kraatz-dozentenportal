import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircle, FileText, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

interface VbNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  related_case_study_id: string | null;
  related_conversation_id: string | null;
  created_at: string;
}

const formatTime = (iso: string): string => {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `vor ${diffHours} Std`;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

interface VbNotificationBellProps {
  variant?: 'icon' | 'menu';
}

export const VbNotificationBell: React.FC<VbNotificationBellProps> = ({ variant = 'icon' }) => {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<VbNotification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('vb_notifications')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('Error fetching VB notifications:', error);
      return;
    }
    setNotifications(data || []);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime: new notifications (e.g. chat messages) appear immediately
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`vb_notifications_bell_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vb_notifications',
          filter: `profile_id=eq.${user.id}`
        },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleClickNotification = async (n: VbNotification) => {
    if (!n.read) {
      await supabase
        .from('vb_notifications')
        .update({ read: true })
        .eq('id', n.id);
    }
    setOpen(false);
    if (n.related_conversation_id) {
      navigate('/klausurenbesprechung/chat');
    } else if (n.related_case_study_id) {
      navigate('/klausurenbesprechung/ergebnisse');
    }
    fetchNotifications();
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('vb_notifications')
      .update({ read: true })
      .eq('profile_id', user.id)
      .eq('read', false);
    fetchNotifications();
  };

  const getIcon = (n: VbNotification) => {
    if (n.related_conversation_id) return <MessageCircle className="w-4 h-4 text-primary flex-shrink-0" />;
    if (n.related_case_study_id) return <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />;
    return <Info className="w-4 h-4 text-gray-500 flex-shrink-0" />;
  };

  return (
    <div className="relative" ref={containerRef}>
      {variant === 'menu' ? (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-primary transition-colors text-sm font-medium"
          aria-label="Benachrichtigungen"
        >
          <Bell className="w-4 h-4 text-primary" />
          <span>Benachrichtigungen</span>
          {unreadCount > 0 && (
            <span className="ml-auto bg-red-600 text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          className="relative p-1.5 sm:p-2 rounded-md hover:bg-gray-100 transition-colors"
          title="Benachrichtigungen"
          aria-label="Benachrichtigungen"
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className={`absolute w-80 max-w-[90vw] bg-white rounded-md shadow-lg border border-gray-200 z-50 overflow-hidden ${
          variant === 'menu' ? 'left-full top-0 ml-2' : 'right-0 mt-2'
        }`}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Benachrichtigungen</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:text-primary/80"
              >
                Alle als gelesen markieren
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Keine Benachrichtigungen
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                    n.read ? 'opacity-60' : 'bg-primary/5'
                  }`}
                >
                  {getIcon(n)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${n.read ? 'font-normal text-gray-700' : 'font-semibold text-gray-900'}`}>
                        {n.title}
                      </p>
                      {!n.read && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{n.message}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{formatTime(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
