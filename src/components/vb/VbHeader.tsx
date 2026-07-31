import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { User, CreditCard, LogOut, MessageCircle, Menu, X, LayoutDashboard, Award, GraduationCap, Settings, CalendarDays, ClipboardList } from 'lucide-react';
import { VbNotificationBell } from './VbNotificationBell';

const LOGO_URL = 'https://kraatz-group.de/wp-content/uploads/2023/05/KraatzGroup_Logo_web.png';

const useVbHeaderData = () => {
  const user = useAuthStore(state => state.user);
  const additionalRoles = useAuthStore(state => state.additionalRoles);
  const isAdmin = useAuthStore(state => state.isAdmin);
  const navigate = useNavigate();
  const [userCredits, setUserCredits] = useState<number>(0);
  const [eliteKleingruppe, setEliteKleingruppe] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: ordersData } = await supabase
        .from('vb_orders')
        .select('*')
        .eq('profile_id', user.id)
        .eq('status', 'completed');

      const totalPurchasedCredits = ordersData?.reduce((sum, order) => {
        return sum + (order.case_study_count || 0);
      }, 0) || 0;

      // Every requested Sachverhalt consumes 1 credit immediately (any status)
      const { data: requestsData } = await supabase
        .from('vb_case_study_requests')
        .select('id')
        .eq('profile_id', user.id);

      const usedCredits = (requestsData || []).length;
      setUserCredits(totalPurchasedCredits - usedCredits);

      const { data: teilnehmerData } = await supabase
        .from('teilnehmer')
        .select('elite_kleingruppe')
        .eq('profile_id', user.id)
        .maybeSingle();

      setEliteKleingruppe(teilnehmerData?.elite_kleingruppe || null);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Realtime: update credits immediately when case study requests change
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel(`vb_header_credits_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vb_case_study_requests',
          filter: `profile_id=eq.${user.id}`
        },
        () => fetchUserData()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, fetchUserData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/klausurenbesprechung');
  };

  return { user, additionalRoles, isAdmin, userCredits, eliteKleingruppe, handleSignOut };
};

interface NavLinkItemProps {
  to: string;
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const SidebarNavLink: React.FC<NavLinkItemProps> = ({ to, icon, label, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-primary transition-colors text-sm font-medium"
  >
    {icon}
    <span>{label}</span>
  </Link>
);

// Desktop: left sidebar with navigation on top, settings/user at the bottom.
// Collapsible via hamburger button (logo left, hamburger right when open).
export const VbHeader: React.FC = () => {
  const { user, additionalRoles, isAdmin, userCredits, eliteKleingruppe, handleSignOut } = useVbHeaderData();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vb_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('vb_sidebar_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  if (collapsed) {
    return (
      <aside className="hidden md:flex md:flex-col w-14 flex-shrink-0 bg-white border-r border-gray-200 md:sticky md:top-0 md:h-screen items-center py-4">
        <button
          onClick={toggleCollapsed}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Sidebar öffnen"
          title="Sidebar öffnen"
        >
          <Menu className="w-5 h-5 text-primary" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 lg:w-72 flex-shrink-0 bg-white border-r border-gray-200 md:sticky md:top-0 md:h-screen">
      {/* Logo + collapse toggle */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <Link to="/klausurenbesprechung" className="flex items-center min-w-0">
          <img
            src={LOGO_URL}
            alt="Kraatz Logo"
            className="h-8 lg:h-10 w-auto object-contain"
          />
        </Link>
        <button
          onClick={toggleCollapsed}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="Sidebar schließen"
          title="Sidebar schließen"
        >
          <Menu className="w-5 h-5 text-primary" />
        </button>
      </div>

      {!user && (
        <div className="p-4">
          <Link
            to="/login"
            className="text-gray-600 hover:text-primary transition-colors text-sm font-medium"
          >
            Login
          </Link>
        </div>
      )}

      {user && (
        <>
          {/* Notifications menu item (outside scrolling nav so the dropdown isn't clipped) */}
          <div className="px-2 pt-3">
            <VbNotificationBell variant="menu" />
          </div>

          {/* Navigation (top) */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
            {additionalRoles?.includes('videobesprechung') && (
              <SidebarNavLink to="/klausurenbesprechung/pakete" icon={<CreditCard className="w-4 h-4 text-primary" />} label={`Credits: ${userCredits}`} />
            )}
            {eliteKleingruppe && (
              <>
                <SidebarNavLink to="/klausurenbesprechung/dashboard" icon={<LayoutDashboard className="w-4 h-4 text-primary" />} label="Dashboard" />
                <SidebarNavLink to="/klausurenbesprechung/ergebnisse" icon={<Award className="w-4 h-4 text-primary" />} label="Ergebnisse" />
                {additionalRoles?.includes('videobesprechung') && (
                  <>
                    <SidebarNavLink to="/klausurenbesprechung/wiederholung" icon={<CalendarDays className="w-4 h-4 text-primary" />} label="Wiederholung" />
                    <SidebarNavLink to="/klausurenbesprechung/chat" icon={<MessageCircle className="w-4 h-4 text-primary" />} label="Chat" />
                    <SidebarNavLink to="/klausurenbesprechung/klausuren-masterclass" icon={<GraduationCap className="w-4 h-4 text-primary" />} label="Klausuren-Masterclass" />
                  </>
                )}
              </>
            )}
            {!eliteKleingruppe && additionalRoles?.includes('videobesprechung') && (
              <>
                <SidebarNavLink to="/klausurenbesprechung/dashboard" icon={<LayoutDashboard className="w-4 h-4 text-primary" />} label="Dashboard" />
                <SidebarNavLink to="/klausurenbesprechung/chat" icon={<MessageCircle className="w-4 h-4 text-primary" />} label="Chat" />
                <SidebarNavLink to="/klausurenbesprechung/ergebnisse" icon={<Award className="w-4 h-4 text-primary" />} label="Ergebnisse" />
                <SidebarNavLink to="/klausurenbesprechung/wiederholung" icon={<CalendarDays className="w-4 h-4 text-primary" />} label="Wiederholung" />
                <SidebarNavLink to="/klausurenbesprechung/klausuren-masterclass" icon={<GraduationCap className="w-4 h-4 text-primary" />} label="Klausuren-Masterclass" />
              </>
            )}
            {additionalRoles?.includes('videobesprechung_dozent') && (
              <SidebarNavLink to="/klausurenbesprechung/korrektur" icon={<GraduationCap className="w-4 h-4 text-primary" />} label="Korrektur" />
            )}
            {isAdmin && (
              <SidebarNavLink to="/klausurenbesprechung" icon={<ClipboardList className="w-4 h-4 text-primary" />} label="Admin-Übersicht" />
            )}
          </nav>

          {/* Settings + user (bottom) */}
          <div className="border-t border-gray-200 py-2 px-2 space-y-1">
            <SidebarNavLink to="/klausurenbesprechung/einstellungen" icon={<Settings className="w-4 h-4 text-primary" />} label="Einstellungen" />
            <div className="flex items-center gap-2 px-3 py-2">
              <User className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs text-gray-600 truncate">{user.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-primary transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4 text-primary" />
              <span>Abmelden</span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
};

// Mobile: top bar with hamburger menu
export const VbMobileHeader: React.FC = () => {
  const { user, additionalRoles, isAdmin, userCredits, eliteKleingruppe, handleSignOut } = useVbHeaderData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="md:hidden bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="px-3 sm:px-4">
        <div className="flex justify-between items-center h-14">
          <Link to="/klausurenbesprechung" className="flex items-center flex-shrink-0">
            <img
              src={LOGO_URL}
              alt="Kraatz Logo"
              className="h-7 w-auto object-contain"
            />
          </Link>

          {!user && (
            <Link
              to="/login"
              className="text-gray-600 hover:text-primary transition-colors text-sm"
            >
              Login
            </Link>
          )}

          {user && (
            <div className="flex items-center space-x-1">
              <VbNotificationBell />
              {additionalRoles?.includes('videobesprechung') && (
                <Link
                  to="/klausurenbesprechung/pakete"
                  className="flex items-center space-x-1 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-gray-600 whitespace-nowrap">{userCredits}</span>
                </Link>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5 text-primary" />
                ) : (
                  <Menu className="w-5 h-5 text-primary" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Menu */}
        {user && mobileMenuOpen && (
          <div className="border-t border-gray-200 py-3">
            <nav className="flex flex-col space-y-2">
              {eliteKleingruppe && (
                <>
                  <SidebarNavLink to="/klausurenbesprechung/dashboard" icon={<LayoutDashboard className="w-4 h-4 text-primary" />} label="Dashboard" onClick={closeMenu} />
                  <SidebarNavLink to="/klausurenbesprechung/ergebnisse" icon={<Award className="w-4 h-4 text-primary" />} label="Ergebnisse" onClick={closeMenu} />
                  {additionalRoles?.includes('videobesprechung') && (
                    <>
                      <SidebarNavLink to="/klausurenbesprechung/wiederholung" icon={<CalendarDays className="w-4 h-4 text-primary" />} label="Wiederholung" onClick={closeMenu} />
                      <SidebarNavLink to="/klausurenbesprechung/chat" icon={<MessageCircle className="w-4 h-4 text-primary" />} label="Chat" onClick={closeMenu} />
                      <SidebarNavLink to="/klausurenbesprechung/klausuren-masterclass" icon={<GraduationCap className="w-4 h-4 text-primary" />} label="Klausuren-Masterclass" onClick={closeMenu} />
                    </>
                  )}
                </>
              )}
              {!eliteKleingruppe && additionalRoles?.includes('videobesprechung') && (
                <>
                  <SidebarNavLink to="/klausurenbesprechung/dashboard" icon={<LayoutDashboard className="w-4 h-4 text-primary" />} label="Dashboard" onClick={closeMenu} />
                  <SidebarNavLink to="/klausurenbesprechung/ergebnisse" icon={<Award className="w-4 h-4 text-primary" />} label="Ergebnisse" onClick={closeMenu} />
                  <SidebarNavLink to="/klausurenbesprechung/wiederholung" icon={<CalendarDays className="w-4 h-4 text-primary" />} label="Wiederholung" onClick={closeMenu} />
                  <SidebarNavLink to="/klausurenbesprechung/klausuren-masterclass" icon={<GraduationCap className="w-4 h-4 text-primary" />} label="Klausuren-Masterclass" onClick={closeMenu} />
                  <SidebarNavLink to="/klausurenbesprechung/chat" icon={<MessageCircle className="w-4 h-4 text-primary" />} label="Chat" onClick={closeMenu} />
                </>
              )}
              {additionalRoles?.includes('videobesprechung_dozent') && (
                <SidebarNavLink to="/klausurenbesprechung/korrektur" icon={<GraduationCap className="w-4 h-4 text-primary" />} label="Korrektur" onClick={closeMenu} />
              )}
              {isAdmin && (
                <SidebarNavLink to="/klausurenbesprechung" icon={<ClipboardList className="w-4 h-4 text-primary" />} label="Admin-Übersicht" onClick={closeMenu} />
              )}
              <SidebarNavLink to="/klausurenbesprechung/einstellungen" icon={<Settings className="w-4 h-4 text-primary" />} label="Einstellungen" onClick={closeMenu} />

              <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
                <div className="flex items-center gap-2 px-3 py-2">
                  <User className="w-5 h-5 text-primary" />
                  <span className="text-sm text-gray-600 truncate">{user.email}</span>
                </div>
                <button
                  onClick={() => {
                    closeMenu();
                    handleSignOut();
                  }}
                  className="w-full text-left px-3 py-2 text-gray-600 hover:text-primary transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Abmelden</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
