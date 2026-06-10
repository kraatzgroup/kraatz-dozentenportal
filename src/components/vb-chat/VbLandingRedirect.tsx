import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { VbHomePage } from './VbHomePage';

export const VbLandingRedirect: React.FC = () => {
  const user = useAuthStore(state => state.user);

  // If user is authenticated, redirect to dashboard
  if (user) {
    return <Navigate to="/klausurenbesprechung/dashboard" replace />;
  }

  // Otherwise show landing page
  return <VbHomePage />;
};
