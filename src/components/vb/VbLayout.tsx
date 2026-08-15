import React from 'react';
import { Navigate } from 'react-router-dom';
import { VbHeader, VbMobileHeader } from '../vb/VbHeader';
import { useAuthStore } from '../../store/authStore';

interface VbLayoutProps {
  children: React.ReactNode;
  fullscreen?: boolean;
}

export const VbLayout: React.FC<VbLayoutProps> = ({ children, fullscreen = false }) => {
  const user = useAuthStore(state => state.user);
  const additionalRoles = useAuthStore(state => state.additionalRoles);
  const isAdmin = useAuthStore(state => state.isAdmin);

  // Gäste (nicht eingeloggt) dürfen die öffentliche Paket-/Checkout-Seite
  // sehen. Eingeloggte User benötigen die Rolle 'videobesprechung'
  // (Teilnehmer) bzw. 'videobesprechung_dozent' (Korrektor) oder Admin.
  const hasAccess =
    !user ||
    isAdmin ||
    additionalRoles?.includes('videobesprechung') ||
    additionalRoles?.includes('videobesprechung_dozent');
  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={`bg-background flex ${fullscreen ? 'h-screen' : 'min-h-screen'}`}>
      <VbHeader />
      <div className="flex-1 flex flex-col min-w-0">
        <VbMobileHeader />
        {fullscreen ? (
          <main className="flex-1 flex flex-col min-h-0">
            {children}
          </main>
        ) : (
          <main className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-8 w-full">
            {children}
          </main>
        )}
      </div>
    </div>
  );
};
