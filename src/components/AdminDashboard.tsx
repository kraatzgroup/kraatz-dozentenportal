import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, LogOut, Users, Clock, FileText, Eye, Calendar, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useFileStore } from '../store/fileStore';
import { supabase } from '../lib/supabase';
import { useState as useReactState } from 'react';
import { DozentCard } from './DozentCard';
import { RecentUploads } from './RecentUploads';
import { DozentPreviewModal } from './DozentPreviewModal';
import { Logo } from './Logo';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const { userRole, isAdmin, isBuchhaltung, isVerwaltung, isVertrieb } = useAuthStore();
  const { unreadCount, fetchUnreadCount } = useChatStore();
  const { undownloadedCount, fetchUndownloadedCount } = useFileStore();
  const [dozenten, setDozenten] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDozent, setSelectedDozent] = useState<Profile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isCheckingDocuments, setIsCheckingDocuments] = useReactState(false);
  const [checkResult, setCheckResult] = useReactState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchDozenten();
    fetchUnreadCount();
    fetchUndownloadedCount();
    
    // Setup real-time subscription for file uploads (undownloaded count)
    const { setupRealtimeSubscription, cleanupSubscription } = useFileStore.getState();
    setupRealtimeSubscription(); // No folder ID for admin dashboard
    
    return () => {
      cleanupSubscription();
    };
  }, []);

  const fetchDozenten = async () => {
    try {
      console.log('Fetching dozenten...');
      
      let query = supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      
      // Filter based on role
      if (isVertrieb) {
        // Vertrieb can see dozenten
        query = query.eq('role', 'dozent');
      } else if (isVerwaltung) {
        // Verwaltung can see dozenten (but with restricted folder access)
        query = query.eq('role', 'dozent');
      } else {
        // Admin and Buchhaltung can see all dozenten
        query = query.eq('role', 'dozent');
      }

      const { data, error } = await query;

      if (error) throw error;
      console.log('Dozenten fetched:', data?.length || 0);
      setDozenten(data || []);
    } catch (error) {
      console.error('Error fetching dozenten:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleMonthlyDocumentCheck = async () => {
    setIsCheckingDocuments(true);
    setCheckResult(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-monthly-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          forceCheck: true,
          manualExecution: true
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setCheckResult({
          success: true,
          data: result
        });
      } else {
        throw new Error(result.error || 'Fehler beim Ausführen der Dokumentenprüfung');
      }
    } catch (error) {
      console.error('Error running document check:', error);
      setCheckResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    } finally {
      setIsCheckingDocuments(false);
    }
  };
  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Logo />
                <span className="ml-2 text-lg sm:text-xl font-semibold text-gray-900 hidden sm:block">Admin Dashboard</span>
                <span className="ml-2 text-sm font-semibold text-gray-900 sm:hidden">Admin</span>
              </div>
            </div>
            
            {/* Mobile menu button */}
            <div className="sm:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
              >
                <span className="sr-only">Open main menu</span>
                {!isMobileMenuOpen ? (
                  <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : (
                  <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Desktop menu */}
            <div className="hidden sm:flex items-center space-x-2 lg:space-x-4">
              {(isAdmin || isBuchhaltung) && (
              <button
                onClick={() => navigate('/users')}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition"
              >
                <Users className="h-4 w-4 lg:h-5 lg:w-5 mr-1 lg:mr-2" />
                <span className="hidden lg:inline">Benutzerverwaltung</span>
              </button>
              )}
              <button
                onClick={() => navigate('/messages')}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
              >
                <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5 mr-1 lg:mr-2" />
                <span className="hidden lg:inline">Nachrichten</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 lg:h-5 lg:w-5 flex items-center justify-center font-bold text-xs">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-red-500 hover:text-red-700 focus:outline-none transition"
              >
                <LogOut className="h-4 w-4 lg:h-5 lg:w-5 mr-1 lg:mr-2" />
                <span className="hidden lg:inline">Abmelden</span>
              </button>
            </div>
          </div>
          
          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="sm:hidden">
              <div className="pt-2 pb-3 space-y-1 border-t border-gray-200">
                {(isAdmin || isBuchhaltung) && (
                <button
                  onClick={() => {
                    navigate('/users');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-primary hover:text-primary/80 hover:bg-gray-50"
                >
                  <Users className="h-5 w-5 mr-3" />
                  Benutzerverwaltung
                </button>
                )}
                <button
                  onClick={() => {
                    navigate('/messages');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-primary hover:text-primary/80 hover:bg-gray-50 relative"
                >
                  <MessageSquare className="h-5 w-5 mr-3" />
                  Nachrichten
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    handleSignOut();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-red-500 hover:text-red-700 hover:bg-gray-50"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Abmelden
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-4 sm:py-6 px-2 sm:px-6 lg:px-8">

        <div className="mb-8">
          <div className="flex items-center mb-4 pt-3 pb-3 sm:pt-5 sm:pb-5">
            <Clock className="h-5 w-5 text-primary/60 mr-2" />
            <div className="flex items-center">
              <h2 className="text-base sm:text-lg font-medium text-gray-900">Letzte Uploads</h2>
              {undownloadedCount > 0 && (
                <span className="ml-2 sm:ml-3 inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {undownloadedCount} neue
                </span>
              )}
            </div>
          </div>
          <RecentUploads />
        </div>

        <div className="mb-8">
          <div className="flex items-center mb-4 pt-3 pb-3 sm:pt-5 sm:pb-5">
            <FileText className="h-5 w-5 text-primary/60 mr-2" />
            <h2 className="text-base sm:text-lg font-medium text-gray-900">
              {isVertrieb ? 'Dozenten Übersicht' : 
               isVerwaltung ? 'Benutzer Übersicht' : 
               'Dozenten Übersicht'}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              <div className="col-span-full flex justify-center py-6 sm:py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              dozenten.map((dozent) => (
                <DozentCard key={dozent.id} dozent={dozent} userRole={userRole} />
              ))
            )}
          </div>
        </div>
      </main>

      {showPreview && selectedDozent && (
        <DozentPreviewModal
          dozentId={selectedDozent.id}
          onClose={() => {
            setShowPreview(false);
            setSelectedDozent(null);
          }}
        />
      )}
    </div>
  );
}