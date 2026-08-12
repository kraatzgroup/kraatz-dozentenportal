/**
 * RoleGuard — Central, server-validated route guard.
 *
 * This is the SINGLE enforcement point for role-based access control in the app.
 * It NEVER trusts stale localStorage/sessionStorage cache. On every mount (i.e.
 * every route change) it either:
 *   - Uses the store IF the last server validation was < REVALIDATE_MS ago, OR
 *   - Re-fetches fresh session data from the server via get_user_session_data RPC
 *     and updates the store before deciding whether to render.
 *
 * If the user lacks the required role/flag, they are redirected to their correct
 * dashboard (auto-detected from their server-validated roles). If no session
 * exists, they go to /login. On any validation error the guard fails CLOSED
 * (redirects to /login) — it never renders protected content on uncertainty.
 *
 * Usage:
 *   <Route path="/users" element={
 *     <RoleGuard require={['admin']}>
 *       <UserManagement />
 *     </RoleGuard>
 *   } />
 *
 *   <Route path="/messages" element={
 *     <RoleGuard requireAuthOnly>
 *       <Chat />
 *     </RoleGuard>
 *   } />
 *
 *   <Route path="/dashboard" element={
 *     <RoleGuard dashboard />  // auto-selects the correct dashboard view
 *   } />
 */

import { useEffect, useState, ReactNode, lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePreviewStore } from '../store/previewStore';

/**
 * How long (ms) the store is trusted after a successful server validation.
 * Navigations within this window are instant (no server round-trip).
 * After this window, the guard blocks and re-validates synchronously.
 *
 * 15 seconds — short enough to catch role changes quickly, long enough to
 * avoid hammering the server on rapid navigations.
 */
const REVALIDATE_MS = 15_000;

/** Roles / flags that RoleGuard can check. */
export type GuardRequirement =
  | 'admin'
  | 'buchhaltung'
  | 'verwaltung'
  | 'vertrieb'
  | 'dozent'
  | 'teilnehmer'
  | 'material'
  | 'elite_kleingruppe'
  | 'videobesprechung'
  | 'videobesprechung_dozent'
  | 'vb_springer';

interface RoleGuardProps {
  children?: ReactNode;
  /** Roles/flags the user must have (ANY of them grants access). */
  require?: GuardRequirement[];
  /** If true, only checks that the user is logged in — no role requirement. */
  requireAuthOnly?: boolean;
  /**
   * If true, this is the unified /dashboard route. The guard auto-selects the
   * correct dashboard component based on the server-validated roles and
   * renders it. `children` is ignored in this mode.
   */
  dashboard?: boolean;
  /** Custom redirect path if access denied. Defaults to auto-detection. */
  redirectTo?: string;
}

// ─── Lazy dashboard components (shared code-split chunks) ─────────────────

const LazyDashboard = lazy(() => import('./Dashboard').then(m => ({ default: m.Dashboard })));
const LazyAdminDashboard = lazy(() => import('./AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const LazyVertriebDashboard = lazy(() => import('./VertriebDashboard').then(m => ({ default: m.VertriebDashboard })));
const LazyEliteKleingruppeDashboard = lazy(() => import('./EliteKleingruppeDashboard').then(m => ({ default: m.EliteKleingruppeDashboard })));
const LazyDozentenDashboard = lazy(() => import('./DozentenDashboard').then(m => ({ default: m.DozentenDashboard })));

const SuspenseFallback = (
  <div className="flex-1 flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Check a single requirement against the current store state. */
function hasRequirement(
  state: ReturnType<typeof useAuthStore.getState>,
  req: GuardRequirement,
): boolean {
  switch (req) {
    case 'admin': return state.isAdmin;
    case 'buchhaltung': return state.isBuchhaltung;
    case 'verwaltung': return state.isVerwaltung;
    case 'vertrieb': return state.isVertrieb;
    case 'dozent': return state.isDozent;
    case 'teilnehmer': return state.isTeilnehmer;
    case 'material': return state.isMaterial;
    case 'elite_kleingruppe': return state.isEliteKleingruppe;
    case 'videobesprechung': return state.additionalRoles.includes('videobesprechung');
    case 'videobesprechung_dozent': return state.additionalRoles.includes('videobesprechung_dozent');
    case 'vb_springer': return state.isVbSpringer;
    default: return false;
  }
}

/**
 * Determine the correct landing dashboard for the current user based on
 * server-validated roles. Used for redirecting users who are on a page
 * they don't have access to.
 */
export function getCorrectDashboardPath(): string {
  const s = useAuthStore.getState();
  if (s.isMaterial) return '/dashboard';
  if (s.isTeilnehmer && s.isEliteKleingruppe) return '/dashboard?tab=dashboard';
  if (s.isTeilnehmer && s.additionalRoles.includes('videobesprechung')) return '/klausurenbesprechung/dashboard';
  if (s.isTeilnehmer) return '/dashboard?tab=dashboard';
  if (s.isDozent && s.additionalRoles.includes('videobesprechung_dozent') && s.isVbSpringer) return '/klausurenbesprechung/korrektur';
  return '/dashboard';
}

// ─── Loading spinner ──────────────────────────────────────────────────────

function GuardSpinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Berechtigung wird geprüft...</p>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard selector (used in dashboard mode) ──────────────────────────

function DashboardSelector() {
  const {
    isMaterial, isTeilnehmer, isEliteKleingruppe, additionalRoles,
    isAdmin, isBuchhaltung, isVerwaltung, isVertrieb,
  } = useAuthStore();
  const { isPreviewMode, previewedRole } = usePreviewStore();

  const showPreview = isAdmin && isPreviewMode;
  const showAdminView = showPreview ? previewedRole === 'admin' : isAdmin;
  const showBuchhaltungView = showPreview ? previewedRole === 'buchhaltung' : (isBuchhaltung && !isAdmin);
  const showVerwaltungView = showPreview ? previewedRole === 'verwaltung' : isVerwaltung;
  const showVertriebView = showPreview ? previewedRole === 'vertrieb' : isVertrieb;
  const showTeilnehmerView = showPreview ? previewedRole === 'teilnehmer' : isTeilnehmer;

  let content: ReactNode;

  if (isMaterial) {
    content = <LazyDozentenDashboard />;
  } else if (showTeilnehmerView && isEliteKleingruppe) {
    content = <LazyEliteKleingruppeDashboard />;
  } else if (showTeilnehmerView && additionalRoles.includes('videobesprechung')) {
    return <Navigate to="/klausurenbesprechung/dashboard" replace />;
  } else if (showTeilnehmerView) {
    content = <LazyDashboard isAdmin={false} />;
  } else if (showVertriebView) {
    content = <LazyVertriebDashboard />;
  } else if (showBuchhaltungView) {
    content = <LazyAdminDashboard mode="accounting" />;
  } else if (showVerwaltungView) {
    content = <LazyAdminDashboard mode="verwaltung" />;
  } else if (showAdminView) {
    content = <LazyAdminDashboard mode="admin" />;
  } else {
    content = <LazyDashboard isAdmin={false} />;
  }

  return <Suspense fallback={SuspenseFallback}>{content}</Suspense>;
}

// ─── Main guard component ─────────────────────────────────────────────────

export function RoleGuard({ children, require, requireAuthOnly, dashboard, redirectTo }: RoleGuardProps) {
  const location = useLocation();
  const [validated, setValidated] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [deniedRedirect, setDeniedRedirect] = useState<string>('/dashboard');

  useEffect(() => {
    let cancelled = false;

    const runValidation = async () => {
      const store = useAuthStore.getState();

      // No user → login
      if (!store.user) {
        if (cancelled) return;
        setDeniedRedirect('/login');
        setAccessDenied(true);
        setValidated(true);
        return;
      }

      // Check if we need a fresh server validation
      const now = Date.now();
      const lastValidated = store.lastValidatedAt;
      const isFresh = lastValidated !== null && (now - lastValidated) < REVALIDATE_MS;

      if (!isFresh) {
        console.log(`🛡️ RoleGuard: Re-validating with server (last validated ${lastValidated ? `${now - lastValidated}ms ago` : 'never'}) for ${location.pathname}`);
        const ok = await store.validateSession();
        if (cancelled) return;
        if (!ok) {
          // Validation failed — fail CLOSED, redirect to login
          console.error('🛡️ RoleGuard: Server validation failed, failing closed → /login');
          setDeniedRedirect('/login');
          setAccessDenied(true);
          setValidated(true);
          return;
        }
      }

      // Re-read store after potential validation
      const fresh = useAuthStore.getState();

      // Check requirements
      if (requireAuthOnly || dashboard) {
        // Just need to be logged in, or dashboard mode (always allowed —
        // DashboardSelector picks the right view)
        setAccessDenied(false);
      } else if (require && require.length > 0) {
        const hasAny = require.some(r => hasRequirement(fresh, r));
        if (!hasAny) {
          console.log(`🛡️ RoleGuard: Access denied for ${location.pathname} — requires [${require.join(', ')}], user has role=${fresh.userRole}, additional=[${fresh.additionalRoles.join(',')}]`);
          setDeniedRedirect(redirectTo || getCorrectDashboardPath());
          setAccessDenied(true);
        } else {
          setAccessDenied(false);
        }
      } else {
        setAccessDenied(false);
      }

      setValidated(true);
    };

    runValidation();

    return () => {
      cancelled = true;
    };
    // Re-run on every location change (route navigation)
  }, [location.pathname, location.search, require, requireAuthOnly, dashboard, redirectTo]);

  // While validating, show spinner
  if (!validated) {
    return <GuardSpinner />;
  }

  // Access denied → redirect
  if (accessDenied) {
    return <Navigate to={deniedRedirect} replace />;
  }

  // Dashboard mode: select the correct dashboard component
  if (dashboard) {
    return <DashboardSelector />;
  }

  return <>{children}</>;
}
