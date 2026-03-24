import React, { useEffect, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Logo } from './Logo';
import { PasswordResetForm } from './PasswordResetForm';
import { Footer } from './Footer';

export function AuthComponent() {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingAuth, setProcessingAuth] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check URL parameters for tab=reset and email
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'reset') {
      setShowPasswordReset(true);
      const emailParam = urlParams.get('email');
      if (emailParam) {
        setResetEmail(emailParam);
      }
    }
  }, []);

  useEffect(() => {
    // Handle auth callback from URL hash (for password reset, email confirmation, etc.)
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      if (accessToken && (type === 'recovery' || type === 'invite')) {
        console.log('Handling auth callback:', type);
        setProcessingAuth(true);
        
        try {
          // Set the session with the token from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || ''
          });
          
          if (error) throw error;
          
          if (data.user) {
            console.log('Auth callback successful, user:', data.user.email);
            
            // For password recovery, show the password reset form instead of logging in
            if (type === 'recovery') {
              setShowPasswordReset(true);
            } else {
              setUser(data.user);
            }
            
            // Clear the hash from URL
            window.history.replaceState(null, '', window.location.pathname);
          }
        } catch (error: any) {
          console.error('Auth callback error:', error);
          setError(`Authentifizierungsfehler: ${error.message}`);
        } finally {
          setProcessingAuth(false);
        }
      }
    };
    
    handleAuthCallback();
  }, [setUser]);

  useEffect(() => {
    // Check initial session
    const checkSession = async () => {
      // Only check for existing session if we're not in the middle of processing auth and no user is set
      if (!processingAuth && !user) {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session check:', session ? 'User logged in' : 'No session');
        if (session?.user) {
          console.log('Found existing session, setting user');
          setUser(session.user);
        } else {
          // Only set loading to false if there's no session
          // If there is a session, loading will be set to false by auth state change handler
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // If user is already set and this is just a token refresh, ignore it
        if (user && event === 'TOKEN_REFRESHED') {
          console.log('AuthComponent: Ignoring token refresh - user already authenticated');
          return;
        }

        console.log('Auth state change:', event, session?.user?.email);
        
        // Get current auth store state to check if we're signing out
        const { isSigningOut } = useAuthStore.getState();
        
        // Handle SIGNED_OUT first to prevent race conditions
        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setUser(null);
          setProcessingAuth(false);
          setError(null);
          setLoading(false);
          return;
        }
        
        // Don't process if user is already set and this is the same user
        if (user && session?.user && user.id === session.user.id && event !== 'SIGNED_OUT') {
          console.log('AuthComponent: User already set, ignoring duplicate auth event');
          return;
        }

        // Don't process sign-in events if we're in the middle of signing out
        if (isSigningOut && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          console.log('AuthComponent: Ignoring auth event during sign out:', event);
          return;
        }
        
        // Only process SIGNED_IN events to avoid duplicate processing
        if (event === 'SIGNED_IN' && session?.user && !processingAuth) {
          setProcessingAuth(true);
          setError(null);
          console.log('User signed in, checking/creating profile...');
          
          try {
            // First, let's try to get the profile
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            console.log('Profile lookup result:', { profile, profileError });

            if (!profile || (profileError && profileError.code === 'PGRST116')) {
              // Profile doesn't exist, create it
              console.log('Profile not found, creating new profile for:', session.user.email);
              
              // Determine role based on email
              const isAdmin = session.user.email === 'tools@kraatz-group.de';
              const role = isAdmin ? 'admin' : 'dozent';
              
              console.log('Creating profile with role:', role);
              
              const profileData = {
                id: session.user.id,
                email: session.user.email || '',
                full_name: session.user.user_metadata?.full_name || 
                          session.user.email?.split('@')[0] || 
                          'User',
                role: role
              };
              
              console.log('Profile data to insert:', profileData);
              
              const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .upsert([profileData], { 
                  onConflict: 'id',
                  ignoreDuplicates: false 
                })
                .select()
                .single();

              if (insertError) {
                console.error('Error creating profile:', insertError);
                console.error('Insert error details:', {
                  message: insertError.message,
                  details: insertError.details,
                  hint: insertError.hint,
                  code: insertError.code
                });
                setError(`Fehler beim Erstellen des Benutzerprofils: ${insertError.message}`);
                setProcessingAuth(false);
                return;
              }
              
              console.log('Profile created successfully:', newProfile);
              console.log('Profile verified, setting user in auth store');
              setUser(session.user);
              setProcessingAuth(false);
            } else if (profileError) {
              console.error('Error checking profile:', profileError);
              console.error('Profile check error details:', {
                message: profileError.message,
                details: profileError.details,
                hint: profileError.hint,
                code: profileError.code
              });
              setError(`Fehler beim Laden des Benutzerprofils: ${profileError.message}`);
              setProcessingAuth(false);
              return;
            } else if (profile) {
              console.log('Profile verified, setting user in auth store');
              setUser(session.user);
              setProcessingAuth(false);
            } else {
              console.error('No profile found or created');
              setError('Benutzerprofil konnte nicht erstellt oder gefunden werden');
              setProcessingAuth(false);
            }
          } catch (err: any) {
            console.error('Unexpected error in profile handling:', err);
            setError(`Ein unerwarteter Fehler ist aufgetreten: ${err.message}`);
            setProcessingAuth(false);
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Only update user if it's different to prevent unnecessary re-renders
          if (user?.id !== session.user.id) {
            console.log('Token refreshed with different user, updating');
            setUser(session.user);
          }
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [setUser]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setError('Bitte geben Sie Ihre E-Mail-Adresse ein');
      return;
    }

    setResetLoading(true);
    setError(null);

    try {
      const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-password-reset`;
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email: resetEmail }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Fehler beim Senden des Passwort-Reset-Links');
      }
      
      setSuccessMessage('Ein Login-Link wurde an Ihre E-Mail-Adresse gesendet.');
      setShowPasswordReset(false);
      setResetEmail('');
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      if (error.message?.includes('nicht gefunden') || error.message?.includes('not found')) {
        setError('Benutzer mit dieser E-Mail-Adresse wurde nicht gefunden.');
      } else {
        setError(error.message || 'Fehler beim Senden des Passwort-Reset-Links');
      }
    } finally {
      setResetLoading(false);
    }
  };

  // Always show loading screen during initial auth check to prevent login form flash
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-600">Lade Anwendung...</p>
          </div>
        </div>
      </div>
    );
  }

  if (processingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-600">Benutzerprofil wird verarbeitet...</p>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    console.log('User is authenticated, AuthComponent will unmount');
    return null; // User is authenticated, let App.tsx handle routing
  }

  // Show password reset form if requested
  if (showPasswordReset) {
    return (
      <div className="min-h-screen bg-background flex flex-col px-4 sm:px-0">
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="bg-white p-8 rounded-lg shadow-md w-96 max-w-md">
            <div className="flex flex-col items-center mb-6">
              <Logo />
              <h1 className="text-2xl font-bold mt-4 text-center">Passwort zurücksetzen</h1>
              <p className="text-gray-600 text-sm mt-2 text-center px-2">
                Geben Sie Ihre E-Mail-Adresse ein, um ein neues Passwort zu erhalten
              </p>
            </div>
            
            {(error || successMessage) && (
              <div className={`mb-4 p-3 rounded-md ${successMessage ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm ${successMessage ? 'text-green-700' : 'text-red-700'}`}>
                  {successMessage || error}
                </p>
              </div>
            )}
            
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Ihre E-Mail-Adresse"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                required
              />
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              >
                {resetLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    <span>Wird gesendet...</span>
                  </div>
                ) : (
                  'Passwort zurücksetzen'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordReset(false);
                  setResetEmail('');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="w-full text-center text-sm text-gray-600 hover:text-gray-800"
              >
                Zurück zur Anmeldung
              </button>
            </form>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-4 sm:px-0">
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-96 max-w-md">
          <div className="flex flex-col items-center mb-6">
            <Logo />
            <h1 className="text-2xl font-bold mt-4 text-center">Portal</h1>
            <p className="text-gray-600 text-sm mt-2 text-center">
              Melden Sie sich an, um auf Ihr Portal zuzugreifen
            </p>
          </div>
          
          {(error || successMessage) && (
            <div className={`mb-4 p-3 rounded-md ${successMessage ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm ${successMessage ? 'text-green-700' : 'text-red-700'}`}>
                {successMessage || error}
              </p>
            </div>
          )}
          
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#2C83C0',
                    brandAccent: '#2C83C0',
                    brandButtonText: 'white',
                    defaultButtonBackground: '#f3f4f6',
                    defaultButtonBackgroundHover: '#e5e7eb',
                    inputBackground: 'white',
                    inputBorder: '#d1d5db',
                    inputBorderHover: '#2C83C0',
                    inputBorderFocus: '#2C83C0',
                  }
                }
              },
              className: {
                anchor: 'text-primary hover:text-primary/80',
                button: 'rounded-md transition-colors',
                container: 'space-y-4',
                divider: 'text-gray-400',
                input: 'rounded-md border-gray-300 focus:border-primary focus:ring focus:ring-primary/20',
                label: 'text-sm font-medium text-gray-700',
                loader: 'border-primary',
                message: 'text-sm',
              }
            }}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'E-Mail-Adresse',
                  password_label: 'Passwort',
                  email_input_placeholder: 'Ihre E-Mail-Adresse',
                  password_input_placeholder: 'Ihr Passwort',
                  button_label: 'Anmelden',
                  loading_button_label: 'Anmeldung läuft...',
                  social_provider_text: 'Mit {{provider}} anmelden'
                },
                forgotten_password: {
                  email_label: 'E-Mail-Adresse',
                  email_input_placeholder: 'Ihre E-Mail-Adresse',
                  button_label: 'Passwort zurücksetzen',
                  loading_button_label: 'Passwort-Reset wird gesendet...',
                  link_text: 'Passwort vergessen?',
                  confirmation_text: 'Überprüfen Sie Ihre E-Mail für den Passwort-Reset-Link'
                },
                update_password: {
                  password_label: 'Neues Passwort',
                  password_input_placeholder: 'Ihr neues Passwort',
                  button_label: 'Passwort aktualisieren',
                  loading_button_label: 'Passwort wird aktualisiert...',
                  confirmation_text: 'Ihr Passwort wurde aktualisiert'
                },
                verify_otp: {
                  email_input_label: 'E-Mail-Adresse',
                  email_input_placeholder: 'Ihre E-Mail-Adresse',
                  phone_input_label: 'Telefonnummer',
                  phone_input_placeholder: 'Ihre Telefonnummer',
                  token_input_label: 'Token',
                  token_input_placeholder: 'Ihr OTP-Token',
                  button_label: 'Token verifizieren',
                  loading_button_label: 'Anmeldung läuft...'
                }
              }
            }}
            providers={[]}
            redirectTo={window.location.origin}
            onlyThirdPartyProviders={false}
            magicLink={false}
            showLinks={false}
            view="sign_in"
            additionalData={{}}
            theme="default"
            socialLayout="vertical"
            socialButtonSize="medium"
            inputFieldRequired={true}
            passwordLimit={false}
            socialColors={false}
            otpType="email"
            showPassword={true}
          />
          
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setShowPasswordReset(true);
                setError(null);
                setSuccessMessage(null);
              }}
              className="text-sm text-primary hover:text-primary/80 underline"
            >
              Passwort vergessen?
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}