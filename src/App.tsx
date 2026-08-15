import { useEffect, useState, lazy, Suspense } from 'react';
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
const UserManagement = lazy(() => import('./components/UserManagement').then(m => ({ default: m.UserManagement })));
const DozentDetail = lazy(() => import('./components/DozentDetail').then(m => ({ default: m.DozentDetail })));
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
import { RoleGuard } from './components/RoleGuard';
import { useSessionValidator } from './hooks/useSessionValidator';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/Toast';

const SuspenseFallback = (
  <div className="flex-1 flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

function App() {
  const { user, isAdmin } = useAuthStore();
  const { isPreviewMode, previewedRole, togglePreview, setPreviewedRole } = usePreviewStore();
  const [appReady, setAppReady] = useState(false);

  // Sets up: initial session validation, auth state listener, window focus
  // re-validation, periodic re-validation, online re-validation.
  // This is the global session lifecycle manager.
  useSessionValidator();

  // Wait for the initial session check to complete before rendering routes.
  // The session validator calls setUser which sets lastValidatedAt; we wait
  // for either a user or a confirmed no-session state.
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max

    const checkReady = setInterval(() => {
      attempts++;
      const state = useAuthStore.getState();

      // Ready if: user is set and validated, OR no user and not loading
      if ((state.user && state.lastValidatedAt) || (!state.user && !state.isSettingUser)) {
        clearInterval(checkReady);
        console.log('🚀 App: Ready — user:', state.user?.email || 'none');
        setAppReady(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkReady);
        console.error('❌ App: Initial load timeout');
        setAppReady(true);
      }
    }, 100);

    return () => clearInterval(checkReady);
  }, []);

  // Show loading while app is initializing
  if (!appReady) {
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

  // Not authenticated → show login
  if (!user) {
    return <AuthComponent />;
  }

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
        <Suspense fallback={SuspenseFallback}>
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Legacy route redirects */}
          <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          <Route path="/accounting" element={<Navigate to="/dashboard" replace />} />
          <Route path="/vertrieb" element={<Navigate to="/dashboard" replace />} />
          <Route path="/elite-kleingruppe" element={<Navigate to="/dashboard" replace />} />

          {/* Login route */}
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />

          {/* ─── VB pages (klausurenbesprechung) ─────────────────────────── */}
          {/* VB teilnehmer pages: any authenticated user can access (the VB
              components themselves check videobesprechung role internally) */}
          <Route path="/klausurenbesprechung" element={<RoleGuard requireAuthOnly><VbLayout><VbLandingRedirect /></VbLayout></RoleGuard>} />
          {/* Pakete-Seite ist öffentlich: Neukunden kaufen ohne Login, der
              User wird nach Zahlung im stripe-webhook automatisch angelegt */}
          <Route path="/klausurenbesprechung/pakete" element={<VbLayout><VbPackagesPage /></VbLayout>} />
          <Route path="/klausurenbesprechung/dashboard" element={<RoleGuard requireAuthOnly><VbLayout><VbCaseStudyDashboard /></VbLayout></RoleGuard>} />
          <Route path="/klausurenbesprechung/sachverhalt-anfordern" element={<RoleGuard requireAuthOnly><VbLayout><VbCaseStudyRequest /></VbLayout></RoleGuard>} />
          <Route path="/klausurenbesprechung/ergebnisse" element={<RoleGuard requireAuthOnly><VbLayout><VbResultsPage /></VbLayout></RoleGuard>} />
          <Route path="/klausurenbesprechung/klausuren-masterclass" element={<RoleGuard requireAuthOnly><VbLayout><VbMasterclassPage /></VbLayout></RoleGuard>} />
          <Route path="/klausurenbesprechung/wiederholung" element={<RoleGuard requireAuthOnly><VbLayout><VbWiederholungPage /></VbLayout></RoleGuard>} />
          {/* VB Korrektur: admin or videobesprechung_dozent only */}
          <Route
            path="/klausurenbesprechung/korrektur"
            element={
              <RoleGuard require={['admin', 'videobesprechung_dozent']} redirectTo="/klausurenbesprechung">
                <VbKorrekturLayout><VbKorrekturDashboard /></VbKorrekturLayout>
              </RoleGuard>
            }
          />
          <Route path="/klausurenbesprechung/einstellungen" element={<RoleGuard requireAuthOnly><VbLayout><Settings hideChrome /></VbLayout></RoleGuard>} />
          {/* Legacy English VB route redirects */}
          <Route path="/klausurenbesprechung/packages" element={<Navigate to="/klausurenbesprechung/pakete" replace />} />
          <Route path="/klausurenbesprechung/case-studies/request" element={<Navigate to="/klausurenbesprechung/sachverhalt-anfordern" replace />} />
          <Route path="/klausurenbesprechung/results" element={<Navigate to="/klausurenbesprechung/ergebnisse" replace />} />
          <Route path="/klausurenbesprechung/masterclass" element={<Navigate to="/klausurenbesprechung/klausuren-masterclass" replace />} />
          <Route path="/klausurenbesprechung/chat" element={<RoleGuard requireAuthOnly><VbLayout fullscreen><VbChatLayout /></VbLayout></RoleGuard>} />

          {/* ─── Unified dashboard ────────────────────────────────────────── */}
          {/* RoleGuard in dashboard mode auto-selects the correct view based
              on server-validated roles. EliteKleingruppeDashboard is only
              shown when isEliteKleingruppe is true. */}
          <Route path="/dashboard" element={<RoleGuard dashboard />} />
          <Route path="/dashboard/elite-kleingruppe/:subTab?" element={<RoleGuard dashboard />} />
          <Route path="/dashboard/taetigkeitsbericht" element={<RoleGuard dashboard />} />

          {/* ─── Staff-only routes ────────────────────────────────────────── */}
          <Route
            path="/users"
            element={<RoleGuard require={['admin']}><UserManagement /></RoleGuard>}
          />
          <Route
            path="/dozent/:id"
            element={<RoleGuard require={['admin', 'buchhaltung', 'verwaltung', 'vertrieb']}><DozentDetail /></RoleGuard>}
          />
          <Route
            path="/feedback"
            element={<RoleGuard require={['admin', 'buchhaltung', 'verwaltung']}><FeedbackAdmin /></RoleGuard>}
          />
          <Route
            path="/integrationen"
            element={<RoleGuard require={['admin', 'verwaltung', 'vertrieb']}><IntegrationsTab /></RoleGuard>}
          />

          {/* ─── Common routes (any authenticated user) ───────────────────── */}
          <Route path="/messages" element={<RoleGuard requireAuthOnly><Chat /></RoleGuard>} />
          <Route path="/settings" element={<RoleGuard requireAuthOnly><Settings /></RoleGuard>} />
          <Route path="/feedback-elite-25" element={<RoleGuard requireAuthOnly><TypeformSurvey /></RoleGuard>} />

          {/* ─── Dozenten-Ordner routes ───────────────────────────────────── */}
          <Route path="/rechnungen/:id" element={<RoleGuard requireAuthOnly><DozentenRechnungen /></RoleGuard>} />
          <Route path="/taetigkeitsbericht/:id" element={<RoleGuard requireAuthOnly><DozentenTaetigkeitsbericht /></RoleGuard>} />
          <Route path="/teilnehmer/:id" element={<RoleGuard requireAuthOnly><DozentenTeilnehmer /></RoleGuard>} />
          <Route path="/probestunden/:id" element={<RoleGuard requireAuthOnly><DozentenProbestunden /></RoleGuard>} />
          <Route path="/tutorials" element={<RoleGuard requireAuthOnly><DozentenTutorials /></RoleGuard>} />
          <Route path="/tutorials-dozenten-portal" element={<RoleGuard requireAuthOnly><DozentenPortalTutorials /></RoleGuard>} />

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
