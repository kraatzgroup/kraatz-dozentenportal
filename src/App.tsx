import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthComponent } from './components/AuthComponent';

// Lazy load heavy components
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const VertriebDashboard = lazy(() => import('./components/VertriebDashboard').then(m => ({ default: m.VertriebDashboard })));
const EliteKleingruppeDashboard = lazy(() => import('./components/EliteKleingruppeDashboard').then(m => ({ default: m.EliteKleingruppeDashboard })));
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
import { useAuthStore } from './store/authStore';
import { usePreviewStore } from './store/previewStore';
import { PreviewBanner } from './components/PreviewBanner';
import { supabase } from './lib/supabase';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/Toast';

import { useState } from 'react';

function App() {
  const { setUser, user, isAdmin, isBuchhaltung, isVerwaltung, isVertrieb, isTeilnehmer, userRole, isSettingUser } = useAuthStore();
  const { isPreviewMode, previewedRole, togglePreview, setPreviewedRole } = usePreviewStore();
  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      // Don't check session if user is already set
      if (user) {
        console.log('App: User already set, skipping initial session check');
        setAppLoading(false);
        return;
      }

      console.log('App: Getting initial session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('App: Initial session:', session ? 'Found' : 'None');
      if (error) {
        console.error('App: Error getting initial session:', error);
      }
      if (session?.user) {
        console.log('App: Setting user from initial session:', session.user.email);
        setUser(session.user);
      }
      setAppLoading(false);
    };
    
    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('App: Auth state changed:', _event, session?.user?.email);
      
      // Don't process if user is already set and this is the same user
      if (user && session?.user && user.id === session.user.id && _event !== 'SIGNED_OUT') {
        console.log('App: User already set, ignoring duplicate auth event');
        return;
      }
      setUser(session?.user ?? null);
      setAppLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  console.log('App: Current user:', user?.email, 'isAdmin:', isAdmin, 'isPreviewMode:', isPreviewMode);

  // Show loading while app is initializing or user profile is being loaded
  if (appLoading || isSettingUser) {
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
          {/* Root redirect to unified dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Legacy route redirects */}
          <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          <Route path="/accounting" element={<Navigate to="/dashboard" replace />} />
          <Route path="/vertrieb" element={<Navigate to="/dashboard" replace />} />
          <Route path="/elite-kleingruppe" element={<Navigate to="/dashboard" replace />} />

          {/* Unified dashboard - renders correct view based on role */}
          <Route 
            path="/dashboard" 
            element={
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
              showTeilnehmerView ?
                <EliteKleingruppeDashboard /> :
                <Dashboard isAdmin={showAdminView || showVerwaltungView || showVertriebView} />
            } 
          />

          {/* Sub-routes */}
          <Route 
            path="/users" 
            element={
              showAdminView ? 
                <UserManagement /> : 
                <Navigate to="/dashboard" replace />
            } 
          />
          <Route 
            path="/dozent/:id" 
            element={
              (showAdminView || showBuchhaltungView || showVerwaltungView || showVertriebView) ? 
                <DozentDetail /> : 
                <Navigate to="/dashboard" replace />
            } 
          />

          {/* Common routes */}
          <Route path="/messages" element={<Chat />} />
          <Route path="/settings" element={<Settings />} />
          
          {/* Dozenten-Ordner Routen */}
          <Route path="/rechnungen/:id" element={<DozentenRechnungen />} />
          <Route path="/taetigkeitsbericht/:id" element={<DozentenTaetigkeitsbericht />} />
          <Route path="/teilnehmer/:id" element={<DozentenTeilnehmer />} />
          <Route path="/probestunden/:id" element={<DozentenProbestunden />} />
          <Route path="/tutorials" element={<DozentenTutorials />} />
          <Route path="/tutorials-dozenten-portal" element={<DozentenPortalTutorials />} />
          
          <Route 
            path="/integrationen" 
            element={
              (showAdminView || showVerwaltungView || showVertriebView) ? 
                <IntegrationsTab /> : 
                <Navigate to="/dashboard" replace />
            } 
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
        <Footer />
      </div>
      <ToastContainer />
    </Router>
  );
}

export default App;