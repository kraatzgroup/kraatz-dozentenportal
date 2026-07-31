import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { VbHomePage } from './VbHomePage';
import { VbAdminDashboard } from './VbAdminDashboard';

export const VbLandingRedirect: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { isTeilnehmer, isAdmin, additionalRoles } = useAuthStore();

  // If user is authenticated, redirect based on role
  if (user) {
    // Admins see the Klausurenbesprechung admin overview directly
    if (isAdmin) {
      return <VbAdminDashboard />;
    }
    // Participants with videobesprechung role go to dashboard
    if (isTeilnehmer && additionalRoles?.includes('videobesprechung')) {
      return <Navigate to="/klausurenbesprechung/dashboard" replace />;
    }
    // Dozenten with videobesprechung_dozent role go to main dashboard (not correction dashboard)
    if (additionalRoles?.includes('videobesprechung_dozent')) {
      return <Navigate to="/dashboard" replace />;
    }
    // Other users go to main dashboard
    return <Navigate to="/dashboard" replace />;
  }

  // Otherwise show landing page
  return <VbHomePage />;
};
