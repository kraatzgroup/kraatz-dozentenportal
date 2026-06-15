import React from 'react';
import { Navigate } from 'react-router-dom';
import { VbHeader } from '../vb/VbHeader';
import { useAuthStore } from '../../store/authStore';

interface VbLayoutProps {
  children: React.ReactNode;
}

export const VbLayout: React.FC<VbLayoutProps> = ({ children }) => {
  const additionalRoles = useAuthStore(state => state.additionalRoles);
  const isAdmin = useAuthStore(state => state.isAdmin);

  // Users tagged with the 'videobesprechung' (student) or 'videobesprechung_dozent'
  // (corrector) role, or admins, may access VB pages.
  const hasAccess =
    isAdmin ||
    additionalRoles?.includes('videobesprechung') ||
    additionalRoles?.includes('videobesprechung_dozent');
  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <VbHeader />
      <main className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};
