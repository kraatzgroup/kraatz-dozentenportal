import React from 'react';
import { VbHeader } from '../vb/VbHeader';

interface VbLayoutProps {
  children: React.ReactNode;
}

export const VbLayout: React.FC<VbLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-page-bg">
      <VbHeader />
      <main className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};
