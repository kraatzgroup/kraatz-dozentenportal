import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthComponent } from './components/AuthComponent';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { DozentDetail } from './components/DozentDetail';
import { UserManagement } from './components/UserManagement';
import { Chat } from './components/Chat';
import { Settings } from './components/Settings';
import { useAuthStore } from './store/authStore';
import { usePreviewStore } from './store/previewStore';
import { PreviewBanner } from './components/PreviewBanner';
import { supabase } from './lib/supabase';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/Toast';

import { useState } from 'react';

function App() {
  const { setUser, user, isAdmin, isBuchhaltung, isVerwaltung, isVertrieb, userRole } = useAuthStore();
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

  // Show loading while app is initializing
  if (appLoading) {
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
  const showAdminView = showPreview ? previewedRole === 'admin' : (isAdmin || isBuchhaltung);
  const showVerwaltungView = showPreview ? previewedRole === 'verwaltung' : isVerwaltung;
  const showVertriebView = showPreview ? previewedRole === 'vertrieb' : isVertrieb;

  console.log('App: Rendering with views:', { showAdminView, showVerwaltungView, showVertriebView, userRole });

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
        <Routes>
          {/* Root redirect based on admin status */}
          <Route 
            path="/" 
            element={
              (showAdminView || showVerwaltungView || showVertriebView) ? 
                <Navigate to="/admin" replace /> : 
                <Navigate to="/dashboard" replace />
            } 
          />

          {/* Admin routes - accessible based on role hierarchy */}
          <Route 
            path="/admin" 
            element={
              (showAdminView || showVerwaltungView || showVertriebView) ? 
                <AdminDashboard /> : 
                <Navigate to="/dashboard" replace />
            } 
          />
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
              (showAdminView || showVerwaltungView || showVertriebView) ? 
                <DozentDetail /> : 
                <Navigate to="/dashboard" replace />
            } 
          />

          {/* Common routes */}
          <Route 
            path="/dashboard" 
            element={<Dashboard isAdmin={showAdminView || showVerwaltungView || showVertriebView} />} 
          />
          <Route path="/messages" element={<Chat />} />
          <Route path="/settings" element={<Settings />} />


          {/* Catch-all redirect */}
          <Route 
            path="*" 
            element={
              (showAdminView || showVerwaltungView || showVertriebView) ? 
                <Navigate to="/admin" replace /> : 
                <Navigate to="/dashboard" replace />
            } 
          />
        </Routes>
        <Footer />
      </div>
      <ToastContainer />
    </Router>
  );
}

export default App;