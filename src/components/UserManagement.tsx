import React, { useEffect, useState } from 'react';
import { UserPlus, Key, Loader2, AlertCircle, ArrowLeft, Pencil, Trash2, Download, Calendar, Search, Mail, Bell, MessageSquare, LogOut, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserStore, User } from '../store/userStore';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { ProfilePicture } from './ProfilePicture';
import { Logo } from './Logo';
import { DozentForm } from './DozentForm';
import { TeilnehmerForm } from './TeilnehmerForm';
import { supabase } from '../lib/supabase';

interface DialogState {
  type: 'new' | 'edit' | 'reset' | null;
  userData: {
    id?: string;
    email: string;
    fullName: string;
    password?: string;
    role?: string;
    additional_roles?: string[];
    eliteKleingruppe?: string;
  };
}

interface ConfirmationState {
  show: boolean;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  isDestructive?: boolean;
  requireNameConfirmation?: boolean;
  nameToConfirm?: string;
}

interface CreateUserResponse {
  success: boolean;
  message?: string;
  error?: string;
  userId?: string;
  email?: string;
  emailId?: string;
}

export function UserManagement() {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const { unreadCount, fetchUnreadCount } = useChatStore();
  const { users, isLoading, error, fetchUsers, createUser, updateUser, deleteUser, resetPassword } = useUserStore();
  const [localError, setLocalError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({
    type: null,
    userData: { email: '', fullName: '', password: '' }
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isCheckingDocuments, setIsCheckingDocuments] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [showDozentForm, setShowDozentForm] = useState(false);
  const [selectedDozentForEdit, setSelectedDozentForEdit] = useState<any>(null);
  const [showTeilnehmerForm, setShowTeilnehmerForm] = useState(false);
  const [selectedTeilnehmerForEdit, setSelectedTeilnehmerForEdit] = useState<any>(null);
  const [dozenten, setDozenten] = useState<{ id: string; full_name: string }[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    show: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {},
    isDestructive: false,
    requireNameConfirmation: false,
    nameToConfirm: ''
  });
  const [confirmationInput, setConfirmationInput] = useState('');
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [eliteTeilnehmerIds, setEliteTeilnehmerIds] = useState<Set<string>>(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [eliteKleingruppen, setEliteKleingruppen] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchUnreadCount();
    
    // Fetch elite teilnehmer IDs to filter out regular teilnehmer
    const fetchEliteTeilnehmer = async () => {
      const { data } = await supabase
        .from('teilnehmer')
        .select('profile_id')
        .eq('is_elite_kleingruppe', true);
      
      if (data) {
        setEliteTeilnehmerIds(new Set(data.map(t => t.profile_id)));
      }
    };
    fetchEliteTeilnehmer();
    
    // Fetch dozenten for TeilnehmerForm
    const fetchDozenten = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'dozent')
        .order('full_name');
      if (data) setDozenten(data);
    };
    fetchDozenten();
    
    // Fetch elite kleingruppen for teilnehmer creation
    const fetchEliteKleingruppen = async () => {
      const { data } = await supabase
        .from('elite_kleingruppen')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (data) setEliteKleingruppen(data);
    };
    fetchEliteKleingruppen();
    
    // Debug: Log environment variables
    console.log('Environment check:', {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      edgeFunctionUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`
    });
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const requestId = Math.random().toString(36).substring(7);
    console.log('Creating user with data:', dialog.userData);
    
    // Validate input
    if (!dialog.userData.email || !dialog.userData.fullName) {
      setLocalError('E-Mail und Name sind erforderlich');
      return;
    }
    
    try {
      setSuccessMessage(null);
      setLocalError(null);
      setLocalLoading(true);
      
      // Try edge function first, fallback to direct creation
      console.log(`[${requestId}] Attempting to call create-user edge function...`);
      const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
      console.log(`[${requestId}] Edge function URL:`, edgeFunctionUrl);
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: dialog.userData.email,
          fullName: dialog.userData.fullName,
          role: dialog.userData.role || 'dozent',
          eliteKleingruppe: dialog.userData.eliteKleingruppe || undefined
        }),
      });
      
      console.log(`[${requestId}] Edge function response status:`, response.status);
      const result: CreateUserResponse = await response.json();
      console.log(`[${requestId}] Edge function response:`, result);
      
      if (!response.ok || !result.success) {
        console.warn(`[${requestId}] Edge function failed, falling back to direct creation`);
        
        // Fallback to direct user creation using the store
        await createUser({
          email: dialog.userData.email,
          password: '', // Will trigger password reset email
          fullName: dialog.userData.fullName,
          role: dialog.userData.role || 'dozent'
        });
        
        setSuccessMessage(`Benutzer wurde erfolgreich erstellt. Eine E-Mail zum Setzen des Passworts wurde an ${dialog.userData.email} gesendet.`);
      } else {
        setSuccessMessage(`Einladungs-E-Mail wurde erfolgreich an ${dialog.userData.email} gesendet. (Edge Function)`);
      }
      
      closeDialog();
      
      // Refresh the users list and elite teilnehmer IDs
      await fetchUsers();
      
      // Re-fetch elite teilnehmer IDs to include the newly created one
      const { data: eliteData } = await supabase
        .from('teilnehmer')
        .select('profile_id')
        .eq('is_elite_kleingruppe', true);
      if (eliteData) {
        setEliteTeilnehmerIds(new Set(eliteData.map(t => t.profile_id)));
      }
    } catch (error) {
      console.error(`[${requestId}] Error in handleCreateUser:`, error);
      
      // Try fallback method if edge function completely fails
      try {
        console.log(`[${requestId}] Trying fallback user creation method...`);
        await createUser({
          email: dialog.userData.email,
          password: '', // Will trigger password reset email
          fullName: dialog.userData.fullName,
          role: dialog.userData.role || 'dozent'
        });
        
        setSuccessMessage(`Benutzer wurde erfolgreich erstellt. Eine E-Mail zum Setzen des Passworts wurde an ${dialog.userData.email} gesendet.`);
        closeDialog();
        await fetchUsers();
      } catch (fallbackError) {
        console.error(`[${requestId}] Fallback creation also failed:`, fallbackError);
        setLocalError(fallbackError instanceof Error ? fallbackError.message : 'Fehler beim Erstellen des Benutzers');
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    setConfirmationInput('');
    setConfirmation({
      show: true,
      title: 'Benutzer löschen',
      message: `Möchten Sie den Benutzer "${name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      confirmText: 'Löschen',
      isDestructive: true,
      requireNameConfirmation: true,
      nameToConfirm: name,
      onConfirm: async () => {
        try {
          // First, delete from teilnehmer table if user is an elite teilnehmer
          const { error: teilnehmerError } = await supabase
            .from('teilnehmer')
            .delete()
            .eq('profile_id', id);
          
          if (teilnehmerError) {
            console.warn('Error deleting teilnehmer entry:', teilnehmerError);
            // Continue with user deletion even if teilnehmer deletion fails
          }
          
          // Then delete the user from profiles
          await deleteUser(id);
          
          // Refresh elite teilnehmer IDs
          const { data: eliteData } = await supabase
            .from('teilnehmer')
            .select('profile_id')
            .eq('is_elite_kleingruppe', true);
          if (eliteData) {
            setEliteTeilnehmerIds(new Set(eliteData.map(t => t.profile_id)));
          }
          
          setConfirmation(prev => ({ ...prev, show: false }));
          setConfirmationInput('');
        } catch (error) {
          // Error is handled by the store
        }
      }
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setDialogError(null);
    
    if (!dialog.userData.id || !dialog.userData.fullName) {
      setDialogError('Name ist erforderlich');
      return;
    }

    try {
      setLocalLoading(true);
      await updateUser(dialog.userData.id, { 
        fullName: dialog.userData.fullName,
        role: dialog.userData.role,
        additional_roles: dialog.userData.additional_roles || []
      });
      setSuccessMessage('Benutzer wurde erfolgreich aktualisiert.');
      closeDialog();
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      setDialogError(error instanceof Error ? error.message : 'Fehler beim Aktualisieren des Benutzers');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setDialogError(null);
    
    if (!dialog.userData.email) {
      setDialogError('Bitte geben Sie eine E-Mail-Adresse ein.');
      return;
    }

    try {
      console.log('Sending password reset email to:', dialog.userData.email);
      await resetPassword(dialog.userData.email);
      setSuccessMessage(`Ein Link zum Zurücksetzen des Passworts wurde an ${dialog.userData.email} gesendet.`);
      closeDialog();
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      // Handle different types of email service errors
      if (error.message?.includes('rate limit') || error.message?.includes('over_email_send_rate_limit')) {
        setDialogError('E-Mail-Versandlimit erreicht. Bitte warten Sie 5-10 Minuten und versuchen Sie es erneut.');
      } else if (error.message?.includes('Error sending recovery email') || error.status === 500) {
        setDialogError('Der E-Mail-Service ist nicht verfügbar. Bitte wenden Sie sich an den Administrator, um das Passwort manuell zurückzusetzen.');
      } else if (error.message?.includes('unexpected_failure')) {
        setDialogError('E-Mail-Service-Fehler: Bitte wenden Sie sich an den Administrator, um das Passwort manuell zurückzusetzen.');
      } else {
        setDialogError(`Fehler beim Senden des Passwort-Reset-Links: ${error.message}`);
      }
    }
  };

  const handleResetPasswordForUser = async (userEmail: string, userName: string) => {
    setConfirmation({
      show: true,
      title: 'Neues Passwort generieren',
      message: `Möchten Sie ein neues Passwort für "${userEmail}" generieren und per E-Mail senden?`,
      confirmText: 'Passwort senden',
      isDestructive: false,
      onConfirm: async () => {
        try {
          console.log('Generating new password for user:', userEmail);
          await resetPassword(userEmail);
          setConfirmation(prev => ({ ...prev, show: false }));
          setSuccessMessage(`Ein neues Passwort wurde generiert und an ${userEmail} gesendet.`);
        } catch (error: any) {
          console.error('Password reset error:', error);
          setConfirmation(prev => ({ ...prev, show: false }));
          
          // Clear success message and let the store error be displayed
          setSuccessMessage(null);
        }
      }
    });
  };

  const handleResendWelcomeEmail = async (userEmail: string, userName: string, userId: string) => {
    setConfirmation({
      show: true,
      title: 'Willkommens-E-Mail erneut senden',
      message: `Möchten Sie die Willkommens-E-Mail mit dem Aktivierungslink für "${userName}" erneut senden?`,
      confirmText: 'Senden',
      onConfirm: async () => {
        try {
          setLocalLoading(true);
          
          // Call resend-welcome-email edge function directly
          // This will generate a new magic link and send the email
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-welcome-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              email: userEmail,
              fullName: userName
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const result = await response.json();
          console.log('Resend email result:', result);

          setSuccessMessage(`Willkommens-E-Mail für "${userName}" erfolgreich gesendet.`);
        } catch (error: any) {
          console.error('Error resending welcome email:', error);
          setDialogError(`Fehler beim Senden der Willkommens-E-Mail: ${error.message}`);
        } finally {
          setLocalLoading(false);
          setConfirmation(prev => ({ ...prev, show: false }));
        }
      },
      isDestructive: false
    });
  };

  const handleDatabaseBackup = async () => {
    setIsBackupLoading(true);
    try {
      const { data, error } = await supabase.rpc('generate_backup');
      if (error) throw error;

      // Create a blob from the SQL data
      const blob = new Blob([data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      
      // Create a download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccessMessage('Datenbank-Backup wurde erfolgreich heruntergeladen.');
    } catch (error: any) {
      console.error('Error creating backup:', error);
      setSuccessMessage(null);
    } finally {
      setIsBackupLoading(false);
    }
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

  const closeDialog = () => {
    setDialogError(null);
    setDialog({
      type: null,
      userData: { email: '', fullName: '', role: 'dozent' }
    });
  };

  // Use local error or store error
  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Logo onClick={() => navigate('/dashboard')} />
                <span className="ml-2 text-lg sm:text-xl font-semibold text-gray-900 hidden sm:block">Dashboard</span>
                <span className="ml-2 text-sm font-semibold text-gray-900 sm:hidden">Dashboard</span>
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
                  <Menu className="block h-6 w-6" />
                ) : (
                  <X className="block h-6 w-6" />
                )}
              </button>
            </div>
            
            {/* Desktop menu */}
            <div className="hidden sm:flex items-center space-x-2 lg:space-x-4">
              <div className="relative">
                <button
                  className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
                  title="Aktivitäten"
                >
                  <Bell className="h-4 w-4 lg:h-5 lg:w-5" />
                </button>
              </div>
              
              <button
                onClick={() => navigate('/messages')}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-primary hover:text-primary/80 focus:outline-none transition relative"
                title="Nachrichten"
              >
                <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => signOut()}
                className="inline-flex items-center px-2 lg:px-3 py-2 border border-transparent text-xs lg:text-sm leading-4 font-medium rounded-md text-red-500 hover:text-red-700 focus:outline-none transition"
                title="Abmelden"
              >
                <LogOut className="h-4 w-4 lg:h-5 lg:w-5" />
              </button>
            </div>
          </div>
          
          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="sm:hidden">
              <div className="pt-2 pb-3 space-y-1 border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-primary hover:text-primary/80 hover:bg-gray-50"
                >
                  <Bell className="h-5 w-5 mr-3" />
                  Aktivitäten
                </button>
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
                    signOut();
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

      <div className="max-w-7xl mx-auto py-4 sm:py-6 px-2 sm:px-6 lg:px-8">
        <div className="py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="mr-3 sm:mr-4 p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full"
                title="Zurück zum Dashboard"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Benutzerverwaltung</h1>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => setShowRoleSelection(true)}
                className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90">
                <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="text-sm">Nutzer hinzufügen</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Benutzer suchen (Name, E-Mail, Rolle)..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
              />
            </div>
          </div>

          {/* Document Check Result */}
          {checkResult && (
            <div className={`mb-6 p-4 rounded-lg border ${
              checkResult.success 
                ? 'bg-green-50 border-green-200 text-green-700' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-start">
                {checkResult.success ? (
                  <Calendar className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  {checkResult.success ? (
                    <div>
                      <h3 className="font-medium mb-2">Dokumentenprüfung abgeschlossen</h3>
                      <div className="text-sm space-y-1">
                        <p>Geprüfter Zeitraum: {checkResult.data.previousMonth} {checkResult.data.previousYear}</p>
                        <p>Dozenten geprüft: {checkResult.data.totalDozenten}</p>
                        <p>E-Mails versendet: {checkResult.data.emailsSent}</p>
                        {checkResult.data.emailsFailed > 0 && (
                          <p className="text-orange-600">E-Mail-Fehler: {checkResult.data.emailsFailed}</p>
                        )}
                        <details className="mt-2">
                          <summary className="cursor-pointer font-medium">Details anzeigen</summary>
                          <div className="mt-2 space-y-1">
                            {checkResult.data.results.map((result: any, index: number) => (
                              <div key={index} className="text-xs bg-white p-2 rounded border">
                                <strong>{result.dozentName}</strong>: 
                                {result.missingCount > 0 ? (
                                  <span className="text-red-600 ml-1">
                                    {result.missingCount} fehlend ({result.missingDocuments.join(', ')})
                                  </span>
                                ) : (
                                  <span className="text-green-600 ml-1">Vollständig</span>
                                )}
                                {result.receivedCount > 0 && (
                                  <span className="text-blue-600 ml-1">
                                    | {result.receivedCount} erhalten ({result.receivedDocuments.join(', ')})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-medium mb-1">Fehler bei der Dokumentenprüfung</h3>
                      <p className="text-sm">{checkResult.error}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setCheckResult(null)}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {(displayError || successMessage) && (
            <div className={`mb-4 p-4 border rounded-md flex items-center ${
              successMessage 
                ? 'bg-green-50 border-green-200 text-green-700' 
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span>{successMessage || displayError}</span>
            </div>
          )}

          {isLoading && !dialog.type ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {users.filter(user => {
                  // Filter out regular teilnehmer (non-elite) - they don't have login access
                  // Keep: admin, buchhaltung, verwaltung, vertrieb, dozent, and elite-kleingruppe teilnehmer
                  if (user.role === 'teilnehmer' && !eliteTeilnehmerIds.has(user.id)) {
                    return false; // Exclude regular teilnehmer
                  }
                  
                  // Apply search filter
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  const roleText = user.role === 'admin' ? 'administrator' : 
                                   user.role === 'buchhaltung' ? 'buchhaltung' :
                                   user.role === 'verwaltung' ? 'verwaltung' :
                                   user.role === 'vertrieb' ? 'vertrieb' :
                                   user.role === 'teilnehmer' ? 'teilnehmer' : 'dozent';
                  const additionalRolesText = (user.additional_roles || []).join(' ').toLowerCase();
                  return user.full_name.toLowerCase().includes(query) ||
                         user.email.toLowerCase().includes(query) ||
                         roleText.includes(query) ||
                         additionalRolesText.includes(query);
                }).sort((a, b) => {
                  // Sort by created_at descending (newest first)
                  const dateA = new Date(a.created_at || 0).getTime();
                  const dateB = new Date(b.created_at || 0).getTime();
                  return dateB - dateA;
                }).map((user) => (
                  <li key={user.id}>
                    <div className="px-3 sm:px-4 py-4 sm:px-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center flex-1 min-w-0">
                        <ProfilePicture
                          userId={user.id}
                          url={user.profile_picture_url}
                          size="sm"
                          editable={user.role !== 'admin'}
                          isAdmin={user.role === 'admin'}
                          fullName={user.full_name}
                          onUpdate={() => fetchUsers()}
                        />
                          <div className="ml-3 flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">{user.full_name}</h3>
                            <p className="text-sm text-gray-500 mb-1 truncate">{user.email}</p>
                            {!user.last_login ? (
                              <p className="text-xs text-gray-500 mb-1 truncate">Letzter Login: Ausstehend</p>
                            ) : (
                              <p className="text-xs text-gray-500 mb-1 truncate">
                                Letzter Login: {new Date(user.last_login).toLocaleString('de-DE', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  ...(window.innerWidth >= 640 && {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                })}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              {user.role === 'admin' ? 'Administrator' : 
                               user.role === 'buchhaltung' ? 'Buchhaltung' :
                               user.role === 'verwaltung' ? 'Verwaltung' :
                               user.role === 'vertrieb' ? 'Vertrieb' :
                               user.role === 'teilnehmer' ? 'Teilnehmer' : 'Dozent'}
                            </span>
                            {!user.last_login && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                                Ausstehend
                              </span>
                            )}
                            {user.role === 'teilnehmer' && eliteTeilnehmerIds.has(user.id) && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                Elite-Kleingruppe
                              </span>
                            )}
                            {user.additional_roles && user.additional_roles.length > 0 && (
                              <>
                                {user.additional_roles.map((r) => (
                                  <span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                    +{r === 'admin' ? 'Admin' :
                                      r === 'buchhaltung' ? 'Buchhaltung' :
                                      r === 'verwaltung' ? 'Verwaltung' :
                                      r === 'vertrieb' ? 'Vertrieb' :
                                      r === 'teilnehmer' ? 'Teilnehmer' : 'Dozent'}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              if (user.role === 'dozent') {
                                setSelectedDozentForEdit(user);
                                setShowDozentForm(true);
                              } else {
                                setDialog({
                                  type: 'edit',
                                  userData: {
                                    id: user.id,
                                    email: user.email,
                                    fullName: user.full_name,
                                    role: user.role,
                                    additional_roles: user.additional_roles || []
                                  }
                                });
                              }
                            }}
                            className="p-2 border border-gray-300 shadow-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            title="Bearbeiten"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id, user.full_name)}
                            className="p-2 border border-gray-300 shadow-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            title="Löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          {!user.last_login && (
                            <button
                              onClick={() => handleResendWelcomeEmail(user.email, user.full_name, user.id)}
                              className="p-2 border border-orange-300 shadow-sm rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100"
                              title="Willkommens-E-Mail erneut senden"
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleResetPasswordForUser(user.email, user.full_name)}
                            className="p-2 border border-gray-300 shadow-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            title="Passwort zurücksetzen"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}


          {/* Dialog Component */}
          {dialog.type && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={(e) => e.stopPropagation()}>
                  <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <form onSubmit={
                    dialog.type === 'new' ? handleCreateUser :
                    dialog.type === 'edit' ? handleUpdateUser :
                    handleResetPassword
                  }>
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {dialog.type === 'new' ? 
                          (dialog.userData.role === 'teilnehmer' ? 'Teilnehmer (Elite-Kleingruppe) einladen' : 
                           dialog.userData.role === 'verwaltung' ? 'Verwaltung / Buchhaltung / Vertrieb einladen' :
                           'Dozent einladen') :
                         dialog.type === 'edit' ? 'User bearbeiten' :
                         'Neues Passwort generieren'}
                      </h3>
                      {dialogError && (
                        <div className="mb-4 p-3 border border-red-200 rounded-md bg-red-50 text-red-700 text-sm">
                          {dialogError}
                        </div>
                      )}
                      {dialog.type === 'reset' ? (
                        <p className="text-sm text-gray-600 mb-4">
                          Ein neues Passwort wird generiert und an die E-Mail-Adresse <strong>{dialog.userData.email}</strong> gesendet.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Vollständiger Name
                            </label>
                            <input
                              type="text"
                              value={dialog.userData.fullName}
                              onChange={(e) => setDialog({
                                ...dialog,
                                userData: { ...dialog.userData, fullName: e.target.value }
                              })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                              required
                            />
                          </div>
                          {(dialog.type === 'edit' || dialog.type === 'new') && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Hauptrolle
                              </label>
                              <select
                                value={dialog.userData.role || 'dozent'}
                                onChange={(e) => {
                                  const newRole = e.target.value;
                                  const currentAdditional = dialog.userData.additional_roles || [];
                                  setDialog({
                                    ...dialog,
                                    userData: { 
                                      ...dialog.userData, 
                                      role: newRole,
                                      additional_roles: currentAdditional.filter(r => r !== newRole)
                                    }
                                  });
                                }}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                                required
                              >
                                <option value="dozent">Dozent</option>
                                <option value="teilnehmer">Teilnehmer</option>
                                <option value="vertrieb">Vertrieb</option>
                                <option value="verwaltung">Verwaltung</option>
                                <option value="buchhaltung">Buchhaltung</option>
                                {dialog.type === 'edit' && <option value="admin">Administrator</option>}
                              </select>
                            </div>
                          )}
                          {(dialog.type === 'edit' || dialog.type === 'new') && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Zusätzliche Rollen
                              </label>
                              <div className="space-y-2">
                                {[
                                  { value: 'dozent', label: 'Dozent' },
                                  { value: 'teilnehmer', label: 'Teilnehmer' },
                                  { value: 'buchhaltung', label: 'Buchhaltung' },
                                  { value: 'verwaltung', label: 'Verwaltung' },
                                  { value: 'vertrieb', label: 'Vertrieb' },
                                ]
                                  .filter(r => r.value !== dialog.userData.role)
                                  .map(r => (
                                    <label key={r.value} className="flex items-center space-x-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={(dialog.userData.additional_roles || []).includes(r.value)}
                                        onChange={(e) => {
                                          const current = dialog.userData.additional_roles || [];
                                          const updated = e.target.checked
                                            ? [...current, r.value]
                                            : current.filter(x => x !== r.value);
                                          setDialog({
                                            ...dialog,
                                            userData: { ...dialog.userData, additional_roles: updated }
                                          });
                                        }}
                                        className="rounded border-gray-300 text-primary focus:ring-primary/20"
                                      />
                                      <span className="text-sm text-gray-700">{r.label}</span>
                                    </label>
                                  ))}
                              </div>
                              <p className="mt-2 text-xs text-gray-500">
                                Zusätzliche Rollen ermöglichen Zugriff auf weitere Bereiche.
                              </p>
                            </div>
                          )}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              E-Mail-Adresse
                            </label>
                            <input
                              type="email"
                              value={dialog.userData.email}
                              onChange={(e) => setDialog({
                                ...dialog,
                                userData: { ...dialog.userData, email: e.target.value }
                              })}
                              disabled={dialog.type === 'edit'}
                              className={`block w-full rounded-md border-gray-300 shadow-sm ${
                                dialog.type === 'edit' ? 'bg-gray-100' : 'focus:border-primary focus:ring focus:ring-primary/20'
                              }`}
                              required
                            />
                            {dialog.type === 'edit' && (
                              <p className="mt-2 text-sm text-gray-500">
                                Die E-Mail-Adresse kann nicht geändert werden.
                              </p>
                            )}
                            {dialog.type === 'new' && (
                              <p className="mt-2 text-sm text-gray-500">
                                Der Benutzer wird mit der ausgewählten Rolle erstellt und erhält eine Einladungs-E-Mail zum Aktivieren des Kontos.
                              </p>
                            )}
                          </div>
                          {dialog.type === 'new' && dialog.userData.role === 'teilnehmer' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Elite-Kleingruppe *
                              </label>
                              <select
                                value={dialog.userData.eliteKleingruppe || ''}
                                onChange={(e) => setDialog({
                                  ...dialog,
                                  userData: { ...dialog.userData, eliteKleingruppe: e.target.value }
                                })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                                required
                              >
                                <option value="">Bitte wählen...</option>
                                {eliteKleingruppen.map((gruppe) => (
                                  <option key={gruppe.id} value={gruppe.name}>
                                    {gruppe.name}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-2 text-sm text-gray-500">
                                Teilnehmer müssen einer Elite-Kleingruppe zugeordnet werden.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        disabled={localLoading || isLoading}
                        id="user-action-submit-button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                        {(localLoading || isLoading) ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                        ) : (
                          dialog.type === 'new' ? 'Benutzer einladen' :
                          dialog.type === 'edit' ? 'Speichern' :
                          'Passwort senden'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={closeDialog}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm">
                        Abbrechen
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Dialog */}
          {confirmation.show && (
            <div className="fixed z-20 inset-0 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                  <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start">
                      <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${
                        confirmation.isDestructive ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        {confirmation.isDestructive ? (
                          <AlertCircle className="h-6 w-6 text-red-600" />
                        ) : (
                          <Key className="h-6 w-6 text-blue-600" />
                        )}
                      </div>
                      <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          {confirmation.title}
                        </h3>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            {confirmation.message}
                          </p>
                          {confirmation.requireNameConfirmation && (
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Bitte geben Sie den Namen zur Bestätigung ein:
                              </label>
                              <input
                                type="text"
                                value={confirmationInput}
                                onChange={(e) => setConfirmationInput(e.target.value)}
                                placeholder={confirmation.nameToConfirm}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      onClick={confirmation.onConfirm}
                      disabled={localLoading || isLoading || (confirmation.requireNameConfirmation && confirmationInput !== confirmation.nameToConfirm)}
                      className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 ${
                        confirmation.isDestructive
                          ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                          : 'bg-primary hover:bg-primary/90 focus:ring-primary'
                      }`}>
                      {(localLoading || isLoading) ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        confirmation.confirmText
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmation(prev => ({ ...prev, show: false }));
                        setConfirmationInput('');
                      }}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm">
                      Abbrechen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showDozentForm && (
            <DozentForm
              dozent={selectedDozentForEdit}
              onClose={() => {
                setShowDozentForm(false);
                setSelectedDozentForEdit(null);
              }}
              onSaved={() => {
                fetchUsers();
                setShowDozentForm(false);
                setSelectedDozentForEdit(null);
              }}
            />
          )}

          {showTeilnehmerForm && (
            <TeilnehmerForm
              teilnehmer={selectedTeilnehmerForEdit}
              dozenten={dozenten}
              onClose={() => {
                setShowTeilnehmerForm(false);
                setSelectedTeilnehmerForEdit(null);
              }}
              onSaved={async () => {
                await fetchUsers();
                
                // Re-fetch elite teilnehmer IDs to include newly created ones
                const { data: eliteData } = await supabase
                  .from('teilnehmer')
                  .select('profile_id')
                  .eq('is_elite_kleingruppe', true);
                if (eliteData) {
                  setEliteTeilnehmerIds(new Set(eliteData.map(t => t.profile_id)));
                }
                
                setShowTeilnehmerForm(false);
                setSelectedTeilnehmerForEdit(null);
              }}
            />
          )}

          {/* Role Selection Dialog */}
          {showRoleSelection && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Welche Rolle soll der neue Nutzer haben?</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowRoleSelection(false);
                      setShowDozentForm(true);
                      setSelectedDozentForEdit(null);
                    }}
                    className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div className="font-medium text-gray-900">Dozent</div>
                    <div className="text-sm text-gray-500 mt-1">Unterrichtende Person mit erweiterten Rechten</div>
                  </button>
                  <button
                    onClick={() => {
                      setShowRoleSelection(false);
                      setShowTeilnehmerForm(true);
                      setSelectedTeilnehmerForEdit(null);
                    }}
                    className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div className="font-medium text-gray-900">Teilnehmer (Elite-Kleingruppe)</div>
                    <div className="text-sm text-gray-500 mt-1">Elite-Kleingruppe Teilnehmer mit Login-Zugang</div>
                  </button>
                  <button
                    onClick={() => {
                      setShowRoleSelection(false);
                      setDialog({
                        type: 'new',
                        userData: { email: '', fullName: '', password: '', role: 'verwaltung' }
                      });
                      setDialogError(null);
                    }}
                    className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div className="font-medium text-gray-900">Verwaltung / Buchhaltung / Vertrieb</div>
                    <div className="text-sm text-gray-500 mt-1">Mitarbeiter mit administrativen Aufgaben</div>
                  </button>
                </div>
                <button
                  onClick={() => setShowRoleSelection(false)}
                  className="w-full mt-4 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}