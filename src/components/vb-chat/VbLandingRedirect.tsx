import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { VbHomePage } from './VbHomePage';

export const VbLandingRedirect: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { isTeilnehmer, additionalRoles } = useAuthStore();

  // If user is authenticated, redirect based on role
  if (user) {
    // Participants with videobesprechung role go to dashboard
    if (isTeilnehmer && additionalRoles?.includes('videobesprechung')) {
      return <Navigate to="/klausurenbesprechung/dashboard" replace />;
    }
    // Dozenten with videobesprechung_dozent role go to correction dashboard
    if (additionalRoles?.includes('videobesprechung_dozent')) {
      return <Navigate to="/klausurenbesprechung/korrektur" replace />;
    }
    // Other users go to main dashboard
    return <Navigate to="/dashboard" replace />;
  }

  // Otherwise show landing page
  return <VbHomePage />;
};
