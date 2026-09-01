import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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

interface DropdownPosition {
  top: number;
  left: number | null;
  right: number | null;
}

export const VbNotificationBell: React.FC<VbNotificationBellProps> = ({ variant = 'icon' }) => {
  const user = useAuthStore(state => state.user);
  const additionalRoles = useAuthStore(state => state.additionalRoles);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<VbNotification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<DropdownPosition>({ top: 0, left: null, right: null });

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

  // Compute dropdown position from the bell button's bounding rect so the
  // portal-rendered dropdown can be placed correctly regardless of which
  // stacking context the bell lives in (sidebar / mobile header).
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 320; // w-80
    const margin = 8;

    let left: number | null = null;
    let right: number | null = null;

    if (variant === 'menu') {
      // Open to the right of the sidebar button
      left = rect.right + margin;
      // If it would overflow the viewport, flip to the left side
      if (left + dropdownWidth > window.innerWidth) {
        left = null;
        right = window.innerWidth - rect.left + margin;
      }
    } else {
      // Align right edge of dropdown with right edge of the bell button
      right = window.innerWidth - rect.right;
      // If it would overflow on the left, anchor to the left edge instead
      if ((right ?? 0) + dropdownWidth > window.innerWidth) {
        right = null;
        left = rect.left;
      }
    }

    setPosition({ top: rect.bottom + margin, left, right });
  }, [open, variant]);

  // Recompute on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 320;
      const margin = 8;
      let left: number | null = null;
      let right: number | null = null;
      if (variant === 'menu') {
        left = rect.right + margin;
        if (left + dropdownWidth > window.innerWidth) {
          left = null;
          right = window.innerWidth - rect.left + margin;
        }
      } else {
        right = window.innerWidth - rect.right;
        if ((right ?? 0) + dropdownWidth > window.innerWidth) {
          right = null;
          left = rect.left;
        }
      }
      setPosition({ top: rect.bottom + margin, left, right });
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, variant]);

  // Close dropdown on outside click (button + portal dropdown are both excluded)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Sort: unread first (newest first), then read (newest first)
  const sortedNotifications = [...notifications].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleClickNotification = async (n: VbNotification) => {
    console.log('🔔 Notification clicked:', {
      id: n.id,
      title: n.title,
      type: n.type,
      read: n.read,
      related_case_study_id: n.related_case_study_id,
      related_conversation_id: n.related_conversation_id,
      additionalRoles,
    });
    // Optimistically mark as read in local state immediately so the
    // badge count drops without waiting for the DB round-trip / refetch.
    if (!n.read) {
      setNotifications(prev => prev.map(item =>
        item.id === n.id ? { ...item, read: true } : item
      ));
      supabase
        .from('vb_notifications')
        .update({ read: true })
        .eq('id', n.id)
        .then(({ error }) => {
          if (error) console.error('Error marking notification as read:', error);
        });
    }
    setOpen(false);
    if (n.related_conversation_id) {
      console.log('🔔 Redirecting to chat (related_conversation_id)');
      navigate('/klausurenbesprechung/chat');
    } else if (n.related_case_study_id) {
      // Dozents go to the correction workspace
      const isDozent = additionalRoles?.includes('videobesprechung_dozent') || additionalRoles?.includes('admin');
      console.log('🔔 related_case_study_id branch - isDozent:', isDozent, 'additionalRoles:', additionalRoles);
      if (isDozent) {
        console.log('🔔 Redirecting dozent to korrektur');
        navigate('/klausurenbesprechung/korrektur');
      } else {
        // Teilnehmer: immer zum dashboard, wo sie den Sachverhalt, das
        // Zusatzmaterial und die Korrektur (Video, PDF, Note) sehen können.
        // Deep-link via #case-study-{id} scrollt direkt zur jeweiligen Klausur.
        console.log('🔔 Redirecting teilnehmer to dashboard with case-study hash:', n.related_case_study_id);
        navigate(`/klausurenbesprechung/dashboard#case-study-${n.related_case_study_id}`);
      }
    } else {
      console.log('🔔 No related_case_study_id or related_conversation_id - no redirect');
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

  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    top: position.top,
    left: position.left ?? undefined,
    right: position.right ?? undefined,
    zIndex: 9999,
  };

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="w-80 max-w-[90vw] bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden"
    >
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
        {sortedNotifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            Keine Benachrichtigungen
          </div>
        ) : (
          sortedNotifications.map(n => (
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
  ) : null;

  return (
    <div className="relative" ref={containerRef}>
      {variant === 'menu' ? (
        <button
          ref={buttonRef}
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
          ref={buttonRef}
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

      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
};
