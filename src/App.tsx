import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthComponent } from './components/AuthComponent';
import { VbLayout } from './components/vb/VbLayout';
import { VbLandingRedirect } from './components/vb-chat/VbLandingRedirect';
import { VbPackagesPage } from './components/vb-chat/VbPackagesPage';
import { VbCaseStudyDashboard } from './components/vb-chat/VbCaseStudyDashboard';
import { VbCaseStudyRequest } from './components/vb-chat/VbCaseStudyRequest';
import { VbChatLayout } from './components/vb-chat/VbChatLayout';
import { VbResultsPage } from './components/vb-chat/VbResultsPage';
import { VbMasterclassPage } from './components/vb-chat/VbMasterclassPage';
import { VbWiederholungPage } from './components/vb-chat/VbWiederholungPage';
import { VbKorrekturDashboard } from './components/vb-chat/VbKorrekturDashboard';
import { VbKorrekturLayout } from './components/vb-chat/VbKorrekturLayout';

// Lazy load heavy components
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const VertriebDashboard = lazy(() => import('./components/VertriebDashboard').then(m => ({ default: m.VertriebDashboard })));
const EliteKleingruppeDashboard = lazy(() => import('./components/EliteKleingruppeDashboard').then(m => ({ default: m.EliteKleingruppeDashboard })));
const DozentenDashboard = lazy(() => import('./components/DozentenDashboard').then(m => ({ default: m.DozentenDashboard })));
const DozentDetail = lazy(() => import('./components/DozentDetail').then(m => ({ default: m.DozentDetail })));
const UserManagement = lazy(() => import('./components/UserManagement').then(m => ({ default: m.UserManagement })));
const Chat = lazy(() => import('./components/Chat').then(m => ({ default: m.Chat })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const IntegrationsTab = lazy(() => import('./components/IntegrationsTab').then(m => ({ default: m.IntegrationsTab })));
const DozentenRechnungen = lazy(() => import('./components/dozent/DozentenRechnungen').then(m => ({ default: m.DozentenRechnungen })));
const DozentenTaetigkeitsbericht = lazy(() => import('./components/dozent/DozentenTaetigkeitsbericht').then(m => ({ default: m.DozentenTaetigkeitsbericht })));
const DozentenTeilnehmer = lazy(() => import('./components/dozent/DozentenTeilnehmer').then(m => ({ default: m.DozentenTeilnehmer })));
const DozentenProbestunden = lazy(() => import('./components/dozent/DozentenProbestunden').then(m => ({ default: m.DozentenProbestunden })));
const DozentenTutorials = lazy(() => import('./components/DozentenTutorials').then(m => ({ default: m.DozentenTutorials })));
const DozentenPortalTutorials = lazy(() => import('./components/DozentenTutorials').then(m => ({
  default: () => m.DozentenTutorials({
    faqTable: 'dozenten_portal_tutorial_faqs',
    videoTable: 'dozenten_portal_tutorial_videos',
    pageTitle: 'Dozenten-Portal: Tutorials',
    pageSubtitle: 'Videos mit Anleitungen und Erklärungen für das Dozenten-Portal',
  })
})));
const TypeformSurvey = lazy(() => import('./components/TypeformSurvey').then(m => ({ default: m.TypeformSurvey })));
const FeedbackAdmin = lazy(() => import('./components/FeedbackAdmin').then(m => ({ default: m.FeedbackAdmin })));
import { useAuthStore } from './store/authStore';
import { usePreviewStore } from './store/previewStore';
import { PreviewBanner } from './components/PreviewBanner';
import { supabase } from './lib/supabase';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/Toast';

import { useState } from 'react';

function App() {
  const { setUser, user, isAdmin, isBuchhaltung, isVerwaltung, isVertrieb, isTeilnehmer, isMaterial, userRole, additionalRoles } = useAuthStore();
  const { isPreviewMode, previewedRole, togglePreview, setPreviewedRole } = usePreviewStore();
  const [appLoading, setAppLoading] = useState(true);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // Global loading: Check session and profile before routing
    const initializeApp = async () => {
      console.log('🚀 App: Initializing...');
      
      // Get session
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('🔑 App: Session check:', session ? 'Found' : 'None');
      
      if (error) {
        console.error('❌ App: Session error:', error);
        setAppLoading(false);
        setAppReady(true);
        return;
      }

      if (session?.user) {
        console.log('👤 App: Setting user:', session.user.email);
        setUser(session.user);
        
        // Wait for profile to be loaded
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        
        const checkProfile = setInterval(() => {
          attempts++;
          const { userRole, additionalRoles, isSettingUser } = useAuthStore.getState();
          
          console.log(`⏳ App: Profile check attempt ${attempts}/${maxAttempts}`, { userRole, isSettingUser });
          
          if (!isSettingUser && userRole !== null) {
            clearInterval(checkProfile);
            console.log('✅ App: Profile loaded, performing role check');
            console.log('📋 App: Account status:', {
              userRole,
              additionalRoles,
              currentPath: window.location.pathname,
              currentSearch: window.location.search
            });

            // Check for elite kleingruppe membership for teilnehmer users
            const checkEliteKleingruppe = async () => {
              const user = useAuthStore.getState().user;
              if (userRole === 'teilnehmer' && user) {
                console.log('🔍 App: Checking elite kleingruppe for user:', user.id);
                const { data: teilnehmerData, error: teilnehmerError } = await supabase
                  .from('teilnehmer')
                  .select('elite_kleingruppe')
                  .eq('profile_id', user.id)
                  .maybeSingle();

                console.log('🔍 App: Teilnehmer data:', { teilnehmerData, teilnehmerError, additionalRoles });

                // Redirect decision tree – only applies on default landing paths,
                // so deep links (e.g. /klausurenbesprechung/*) are preserved on reload.
                const landingPath = window.location.pathname;
                const isDefaultLanding = landingPath === '/' || landingPath === '/login' ||
                  (landingPath === '/dashboard' && !window.location.search.includes('tab='));

                if (!isDefaultLanding) {
                  console.log('✅ App: REDIRECT DECISION: Non-default path, staying on current page:', landingPath);
                } else if (teilnehmerData?.elite_kleingruppe && teilnehmerData.elite_kleingruppe !== 'f' && teilnehmerData.elite_kleingruppe !== 'false' && teilnehmerData.elite_kleingruppe !== null) {
                  // Elite-Kleingruppe members (incl. VB teilnehmer with elite kleingruppe)
                  // land on the Elite-Kleingruppe dashboard. VB teilnehmer additionally
                  // see the "Videoklausurenkorrektur" tab via EliteKleingruppeDashboard.
                  // 'dashboard' is a valid subtab of EliteKleingruppeDashboard (VALID_TABS).
                  console.log('✅ App: REDIRECT DECISION: User has elite kleingruppe membership:', teilnehmerData.elite_kleingruppe, '→ redirecting to /dashboard?tab=dashboard');
                  window.history.replaceState({}, '', '/dashboard?tab=dashboard');
                } else if (additionalRoles?.includes('videobesprechung')) {
                  console.log('✅ App: REDIRECT DECISION: User has videobesprechung role but no elite kleingruppe → redirecting to /klausurenbesprechung/dashboard');
                  window.history.replaceState({}, '', '/klausurenbesprechung/dashboard');
                } else if (window.location.pathname === '/dashboard' && !window.location.search.includes('tab=')) {
                  console.log('✅ App: REDIRECT DECISION: Regular participant on /dashboard → redirecting to /dashboard?tab=dashboard');
                  window.history.replaceState({}, '', '/dashboard?tab=dashboard');
                } else {
                  console.log('✅ App: REDIRECT DECISION: No redirect needed, staying on current page');
                }
              } else if (userRole === 'teilnehmer' && window.location.pathname === '/dashboard' && !window.location.search.includes('tab=')) {
                console.log('✅ App: REDIRECT DECISION: Regular participant on /dashboard → redirecting to /dashboard?tab=dashboard');
                window.history.replaceState({}, '', '/dashboard?tab=dashboard');
              } else if (userRole === 'dozent' && additionalRoles?.includes('videobesprechung_dozent') && user) {
                // VB Springer dozenten land directly on the Korrektur dashboard after login
                const path = window.location.pathname;
                const isDefaultLanding = path === '/' || path === '/login' || (path === '/dashboard' && !window.location.search.includes('tab='));
                if (isDefaultLanding) {
                  const { data: springerProfile } = await supabase
                    .from('profiles')
                    .select('vb_springer')
                    .eq('id', user.id)
                    .maybeSingle();
                  if (springerProfile?.vb_springer === true) {
                    console.log('✅ App: REDIRECT DECISION: VB Springer dozent → redirecting to /klausurenbesprechung/korrektur');
                    window.history.replaceState({}, '', '/klausurenbesprechung/korrektur');
                  } else {
                    console.log('✅ App: REDIRECT DECISION: No redirect needed for userRole:', userRole);
                  }
                } else {
                  console.log('✅ App: REDIRECT DECISION: No redirect needed, staying on current page');
                }
              } else {
                console.log('✅ App: REDIRECT DECISION: No redirect needed for userRole:', userRole);
              }

              setAppLoading(false);
              setAppReady(true);
            };

            checkEliteKleingruppe();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkProfile);
            console.error('❌ App: Profile load timeout');
            setAppLoading(false);
            setAppReady(true);
          }
        }, 100);
      } else {
        console.log('👤 App: No session, showing login');
        setAppLoading(false);
        setAppReady(true);
      }
    };
    
    initializeApp();

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔄 App: Auth state changed:', _event, session?.user?.email);

      const currentUser = useAuthStore.getState().user;

      // On (re-)login re-validate the session and re-fetch the profile.
      // NOTE: Supabase also fires SIGNED_IN when the browser tab regains focus;
      // skip re-initialization if the same user is already active to avoid
      // an unnecessary full app reload on tab switches.
      if (_event === 'SIGNED_IN') {
        if (currentUser && session?.user && currentUser.id === session.user.id) {
          console.log('⏭️ App: SIGNED_IN for already active user (tab focus), ignoring');
          return;
        }
        console.log('🔄 App: SIGNED_IN, forcing fresh session/auth check');
        setUser(session?.user ?? null, true);
        setAppLoading(true);
        setAppReady(false);
        initializeApp();
        return;
      }

      if (_event === 'SIGNED_OUT') {
        console.log('🔄 App: SIGNED_OUT, clearing user and re-initializing');
        setUser(null);
        setAppLoading(true);
        setAppReady(false);
        initializeApp();
        return;
      }

      // Other events (e.g. TOKEN_REFRESHED, USER_UPDATED): only act if the user changed
      if (currentUser && session?.user && currentUser.id === session.user.id) {
        console.log('⏭️ App: User unchanged, ignoring auth event');
        return;
      }

      console.log('🔄 App: User changed, updating');
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  console.log('App: Current user:', user?.email, 'isAdmin:', isAdmin, 'isPreviewMode:', isPreviewMode);

  // Show loading while app is initializing or user profile is being loaded
  if (appLoading || !appReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-600">Anwendung wird geladen...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('App: No user, showing AuthComponent');
    return <AuthComponent />;
  }

  console.log('App: User authenticated, rendering main app');

  // Only show preview mode for actual admins
  const showPreview = isAdmin && isPreviewMode;
  
  // Determine if we should show admin view based on role hierarchy and preview mode
  const showAdminView = showPreview ? previewedRole === 'admin' : isAdmin;
  const showBuchhaltungView = showPreview ? previewedRole === 'buchhaltung' : (isBuchhaltung && !isAdmin);
  const showVerwaltungView = showPreview ? previewedRole === 'verwaltung' : isVerwaltung;
  const showVertriebView = showPreview ? previewedRole === 'vertrieb' : isVertrieb;
  const showTeilnehmerView = showPreview ? previewedRole === 'teilnehmer' : isTeilnehmer;

  console.log('App: Rendering with views:', { showAdminView, showBuchhaltungView, showVerwaltungView, showVertriebView, showTeilnehmerView, userRole });

  return (
    <Router>
      {isAdmin && (
        <PreviewBanner
          isPreviewMode={isPreviewMode}
          previewedRole={previewedRole}
          onTogglePreview={togglePreview}
          onChangeRole={setPreviewedRole}
        />
      )}
      <div className="min-h-screen bg-background flex flex-col">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
        <Routes>
          {/* Root redirect: Auth check first */}
          <Route path="/" element={!user ? <Navigate to="/login" replace /> : <Navigate to="/dashboard" replace />} />

          {/* Legacy route redirects */}
          <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          <Route path="/accounting" element={<Navigate to="/dashboard" replace />} />
          <Route path="/vertrieb" element={<Navigate to="/dashboard" replace />} />
          <Route path="/elite-kleingruppe" element={<Navigate to="/dashboard" replace />} />

          {/* Login route */}
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthComponent />} />

          {/* VB pages - using VbLayout wrapper */}
          <Route path="/klausurenbesprechung" element={!user ? <Navigate to="/login" replace /> : <VbLayout><VbLandingRedirect /></VbLayout>} />
          <Route path="/klausurenbesprechung/pakete" element={!user ? <Navigate to="/login" replace /> : <VbLayout><VbPackagesPage /></VbLayout>} />
          <Route path="/klausurenbesprechung/dashboard" element={!user ? <Navigate to="/login" replace /> : <VbLayout><VbCaseStudyDashboard /></VbLayout>} />
          <Route path="/klausurenbesprechung/sachverhalt-anfordern" element={!user ? <Navigate to="/login" replace /> : <VbLayout><VbCaseStudyRequest /></VbLayout>} />
          <Route path="/klausurenbesprechung/ergebnisse" element={!user ? <Navigate to="/login" replace /> : <VbLayout><VbResultsPage /></VbLayout>} />
          <Route path="/klausurenbesprechung/klausuren-masterclass" element={!user ? <Navigate to="/login" replace /> : <VbLayout><VbMasterclassPage /></VbLayout>} />
          <Route path="/klausurenbesprechung/wiederholung" element={!user ? <Navigate to="/login" replace /> : <VbLayout><VbWiederholungPage /></VbLayout>} />
          <Route
            path="/klausurenbesprechung/korrektur"
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : (isAdmin || additionalRoles?.includes('videobesprechung_dozent')) ? (
                <VbKorrekturLayout><VbKorrekturDashboard /></VbKorrekturLayout>
              ) : (
                <Navigate to="/klausurenbesprechung" replace />
              )
            }
          />
          <Route path="/klausurenbesprechung/einstellungen" element={!user ? <Navigate to="/login" replace /> : <VbLayout><Settings hideChrome /></VbLayout>} />
          {/* Legacy English VB route redirects */}
          <Route path="/klausurenbesprechung/packages" element={!user ? <Navigate to="/login" replace /> : <Navigate to="/klausurenbesprechung/pakete" replace />} />
          <Route path="/klausurenbesprechung/case-studies/request" element={!user ? <Navigate to="/login" replace /> : <Navigate to="/klausurenbesprechung/sachverhalt-anfordern" replace />} />
          <Route path="/klausurenbesprechung/results" element={!user ? <Navigate to="/login" replace /> : <Navigate to="/klausurenbesprechung/ergebnisse" replace />} />
          <Route path="/klausurenbesprechung/masterclass" element={!user ? <Navigate to="/login" replace /> : <Navigate to="/klausurenbesprechung/klausuren-masterclass" replace />} />
          <Route path="/klausurenbesprechung/chat" element={!user ? <Navigate to="/login" replace /> : <VbLayout fullscreen><VbChatLayout /></VbLayout>} />

          {/* Unified dashboard - renders correct view based on role */}
          <Route
            path="/dashboard"
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : isMaterial ?
                <DozentenDashboard /> :
              showTeilnehmerView ?
                <EliteKleingruppeDashboard /> :
              showVertriebView ?
                <VertriebDashboard /> :
              showBuchhaltungView ?
                <AdminDashboard mode="accounting" /> :
              showVerwaltungView ?
                <AdminDashboard mode="verwaltung" /> :
              showAdminView ?
                <AdminDashboard mode="admin" /> :
                <Dashboard isAdmin={false} />
            }
          />
          <Route
            path="/dashboard/elite-kleingruppe/:subTab?"
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : showTeilnehmerView ?
                <EliteKleingruppeDashboard /> :
              isMaterial ?
                <DozentenDashboard /> :
                <Dashboard isAdmin={showAdminView || showVerwaltungView || showVertriebView} />
            }
          />
          <Route
            path="/dashboard/taetigkeitsbericht"
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : isMaterial ?
                <DozentenDashboard /> :
              showTeilnehmerView ?
                <EliteKleingruppeDashboard /> :
              showVertriebView ?
                <VertriebDashboard /> :
              showBuchhaltungView ?
                <AdminDashboard mode="accounting" /> :
              showVerwaltungView ?
                <AdminDashboard mode="verwaltung" /> :
              showAdminView ?
                <AdminDashboard mode="admin" /> :
                <Dashboard isAdmin={false} />
            }
          />

          {/* Sub-routes */}
          <Route 
            path="/users" 
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : showAdminView ? 
                <UserManagement /> : 
                <Navigate to="/dashboard" replace />
            } 
          />
          <Route 
            path="/dozent/:id" 
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : (showAdminView || showBuchhaltungView || showVerwaltungView || showVertriebView) ? 
                <DozentDetail /> : 
                <Navigate to="/dashboard" replace />
            } 
          />

          {/* Common routes */}
          <Route path="/messages" element={!user ? <Navigate to="/login" replace /> : <Chat />} />
          <Route path="/settings" element={!user ? <Navigate to="/login" replace /> : <Settings />} />
          <Route path="/feedback-elite-25" element={!user ? <Navigate to="/login" replace /> : <TypeformSurvey />} />
          <Route
            path="/feedback"
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : (showAdminView || showBuchhaltungView || showVerwaltungView) ?
                <FeedbackAdmin /> :
                <Navigate to="/dashboard" replace />
            }
          />

          {/* Dozenten-Ordner Routen */}
          <Route path="/rechnungen/:id" element={!user ? <Navigate to="/login" replace /> : <DozentenRechnungen />} />
          <Route path="/taetigkeitsbericht/:id" element={!user ? <Navigate to="/login" replace /> : <DozentenTaetigkeitsbericht />} />
          <Route path="/teilnehmer/:id" element={!user ? <Navigate to="/login" replace /> : <DozentenTeilnehmer />} />
          <Route path="/probestunden/:id" element={!user ? <Navigate to="/login" replace /> : <DozentenProbestunden />} />
          <Route path="/tutorials" element={!user ? <Navigate to="/login" replace /> : <DozentenTutorials />} />
          <Route path="/tutorials-dozenten-portal" element={!user ? <Navigate to="/login" replace /> : <DozentenPortalTutorials />} />
          
          <Route 
            path="/integrationen" 
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : (showAdminView || showVerwaltungView || showVertriebView) ? 
                <IntegrationsTab /> : 
                <Navigate to="/dashboard" replace />
            } 
          />

          {/* Catch-all redirect */}
          <Route path="*" element={!user ? <Navigate to="/login" replace /> : <Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
        <Footer />
      </div>
      <ToastContainer />
    </Router>
  );
}

export default App;