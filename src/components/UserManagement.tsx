import React, { useEffect, useState } from 'react';
import { UserPlus, Key, Loader2, AlertCircle, ArrowLeft, Pencil, Trash2, Download, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserStore, User } from '../store/userStore';
import { ProfilePicture } from './ProfilePicture';
import { Logo } from './Logo';
import { supabaseAdmin } from '../lib/supabase';
import { supabase } from '../lib/supabase';

interface DialogState {
  type: 'new' | 'edit' | 'reset' | null;
  userData: {
    id?: string;
    email: string;
    fullName: string;
    password?: string;
    role?: string;
  };
}

interface ConfirmationState {
  show: boolean;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  isDestructive?: boolean;
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
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    show: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {},
    isDestructive: false
  });

  useEffect(() => {
    fetchUsers();
    
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
          role: dialog.userData.role || 'dozent'
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
      
      // Refresh the users list
      await fetchUsers();
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
    setConfirmation({
      show: true,
      title: 'Benutzer löschen',
      message: `Möchten Sie den Benutzer "${name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      confirmText: 'Löschen',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteUser(id);
          setConfirmation(prev => ({ ...prev, show: false }));
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
        role: dialog.userData.role 
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

  const handleDatabaseBackup = async () => {
    setIsBackupLoading(true);
    try {
      const { data, error } = await supabaseAdmin.rpc('generate_backup');
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
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Logo />
                <span className="ml-2 text-lg sm:text-xl font-semibold text-gray-900 hidden sm:block">Admin Dashboard</span>
                <span className="ml-2 text-sm font-semibold text-gray-900 sm:hidden">Admin</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-4 sm:py-6 px-2 sm:px-6 lg:px-8">
        <div className="py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/admin')}
                className="mr-3 sm:mr-4 p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Benutzerverwaltung</h1>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={handleMonthlyDocumentCheck}
                disabled={isCheckingDocuments}
                className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 disabled:opacity-50"
                title="Monatliche Dokumentenprüfung manuell ausführen"
              >
                {isCheckingDocuments ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                ) : (
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                )}
                <span className="text-sm">{isCheckingDocuments ? 'Prüfe...' : 'Dokumente prüfen'}</span>
              </button>
              <button
                onClick={() => setDialog({
                  type: 'new',
                  userData: { email: '', fullName: '', password: '', role: 'dozent' }
                })}
                className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90">
                <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="text-sm">Nutzer hinzufügen</span>
              </button>
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
                {users.map((user) => (
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
                            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              {user.role === 'admin' ? 'Administrator' : 
                               user.role === 'buchhaltung' ? 'Buchhaltung' :
                               user.role === 'verwaltung' ? 'Verwaltung' :
                               user.role === 'vertrieb' ? 'Vertrieb' : 'Dozent'}
                            </span>
                            {!user.last_login ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Ausstehend
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 truncate">
                                Letzter Login: {new Date(user.last_login).toLocaleString('de-DE', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  ...(window.innerWidth >= 640 && {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 flex-shrink-0">
                        {user.role !== 'admin' && (
                          <>
                            <button
                              onClick={() => setDialog({
                                type: 'edit',
                                userData: {
                                  id: user.id,
                                  email: user.email,
                                  fullName: user.full_name
                                }
                              })}
                              className="inline-flex items-center justify-center px-2 sm:px-3 py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                              <Pencil className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Bearbeiten</span>
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.full_name)}
                              className="inline-flex items-center justify-center px-2 sm:px-3 py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                              <Trash2 className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Löschen</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleResetPasswordForUser(user.email, user.full_name)}
                          className="inline-flex items-center justify-center px-2 sm:px-3 py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50" 
                          title="Neues Passwort generieren und per E-Mail senden"
                        >
                          <Key className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Passwort zurücksetzen</span>
                          <span className="sm:hidden">Reset</span>
                        </button>
                      </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Database Backup Section */}
          <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-3 sm:px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Datenbank-Backup</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Laden Sie ein Backup der Datenbank herunter. Das Backup enthält alle Benutzer, Ordner, Dateien und Nachrichten.</p>
              </div>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleDatabaseBackup}
                  disabled={isBackupLoading}
                  className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50">
                  {isBackupLoading ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  )}
                  Backup herunterladen
                </button>
              </div>
            </div>
          </div>

          {/* Dialog Component */}
          {dialog.type && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
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
                        {dialog.type === 'new' ? 'Dozent einladen' :
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
                          {dialog.type === 'edit' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Rolle
                              </label>
                              <select
                                value={dialog.userData.role || 'dozent'}
                                onChange={(e) => setDialog({
                                  ...dialog,
                                  userData: { ...dialog.userData, role: e.target.value }
                                })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                                required
                              >
                                <option value="dozent">Dozent</option>
                                <option value="vertrieb">Vertrieb</option>
                                <option value="verwaltung">Verwaltung</option>
                                <option value="buchhaltung">Buchhaltung</option>
                                <option value="admin">Administrator</option>
                              </select>
                            </div>
                          )}
                          {dialog.type === 'new' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Rolle
                              </label>
                              <select
                                value={dialog.userData.role || 'dozent'}
                                onChange={(e) => setDialog({
                                  ...dialog,
                                  userData: { ...dialog.userData, role: e.target.value }
                                })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                                required
                              >
                                <option value="dozent">Dozent</option>
                                <option value="vertrieb">Vertrieb</option>
                                <option value="verwaltung">Verwaltung</option>
                                <option value="buchhaltung">Buchhaltung</option>
                              </select>
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
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      onClick={confirmation.onConfirm}
                      disabled={localLoading || isLoading}
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
                      onClick={() => setConfirmation(prev => ({ ...prev, show: false }))}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm">
                      Abbrechen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}