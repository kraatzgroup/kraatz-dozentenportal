import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, User, Mail, Camera, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { ProfilePicture } from './ProfilePicture';
import { Logo } from './Logo';

export function Settings() {
  const navigate = useNavigate();
  const { user, isDozent } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    profile_picture_url: null as string | null,
    phone: '',
    street: '',
    house_number: '',
    postal_code: '',
    city: '',
    tax_id: '',
    bank_name: '',
    iban: '',
    bic: ''
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email, profile_picture_url, phone, street, house_number, postal_code, city, tax_id, bank_name, iban, bic, role, additional_roles')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      setProfile({
        full_name: data.full_name || '',
        email: data.email || '',
        profile_picture_url: data.profile_picture_url,
        phone: data.phone || '',
        street: data.street || '',
        house_number: data.house_number || '',
        postal_code: data.postal_code || '',
        city: data.city || '',
        tax_id: data.tax_id || '',
        bank_name: data.bank_name || '',
        iban: data.iban || '',
        bic: data.bic || ''
      });
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      setError('Fehler beim Laden des Profils');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate password if provided
      if (passwordData.newPassword || passwordData.confirmPassword) {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
          throw new Error('Die Passwörter stimmen nicht überein');
        }
        if (passwordData.newPassword.length < 6) {
          throw new Error('Das Passwort muss mindestens 6 Zeichen lang sein');
        }
      }

      // Update profile in database
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          street: profile.street,
          house_number: profile.house_number,
          postal_code: profile.postal_code,
          city: profile.city,
          tax_id: profile.tax_id,
          bank_name: profile.bank_name,
          iban: profile.iban,
          bic: profile.bic
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update email in auth if it changed
      if (profile.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: profile.email
        });

        if (emailError) {
          // If email update fails, revert the profile email
          await supabase
            .from('profiles')
            .update({ email: user.email })
            .eq('id', user.id);
          throw new Error('E-Mail-Adresse konnte nicht aktualisiert werden. Möglicherweise ist diese bereits vergeben.');
        }
      }

      // Update password if provided
      if (passwordData.newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: passwordData.newPassword
        });

        if (passwordError) {
          throw new Error('Passwort konnte nicht aktualisiert werden');
        }
      }

      setSuccess('Profil erfolgreich aktualisiert');
      
      // Clear password fields after successful update
      setPasswordData({ newPassword: '', confirmPassword: '' });
      
      // Refresh the profile data
      await fetchProfile();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Fehler beim Speichern des Profils');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfilePictureUpdate = (url: string) => {
    setProfile(prev => ({ ...prev, profile_picture_url: url }));
    setSuccess('Profilbild erfolgreich aktualisiert');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <Logo />
                  <span className="ml-2 text-xl font-semibold text-gray-900">Dozenten-Portal</span>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Logo />
                <span className="ml-2 text-xl font-semibold text-gray-900">Dozenten-Portal</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex items-center mb-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">Einstellungen</h1>
          </div>

          {(error || success) && (
            <div className={`mb-6 p-4 border rounded-md ${
              success 
                ? 'bg-green-50 border-green-200 text-green-700' 
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {success || error}
            </div>
          )}

          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">
                Profil bearbeiten
              </h3>

              <form onSubmit={handleSave} className="space-y-6">
                {/* Profile Picture Section */}
                <div className="flex items-center space-x-6">
                  <div className="flex-shrink-0">
                    <ProfilePicture
                      userId={user?.id || ''}
                      url={profile.profile_picture_url}
                      size="lg"
                      editable={true}
                      isAdmin={false}
                      fullName={profile.full_name}
                      onUpdate={handleProfilePictureUpdate}
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">Profilbild</h4>
                    <p className="text-sm text-gray-500">
                      Klicken Sie auf das Bild oder ziehen Sie eine neue Datei darauf, um es zu ändern.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Unterstützte Formate: JPG, PNG, GIF (max. 5MB)
                    </p>
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                    <User className="h-4 w-4 inline mr-2" />
                    Vollständiger Name
                  </label>
                  <input
                    type="text"
                    id="full_name"
                    value={profile.full_name}
                    onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                    placeholder="Ihr vollständiger Name"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="h-4 w-4 inline mr-2" />
                    E-Mail-Adresse
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={profile.email}
                    onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                    placeholder="ihre.email@example.com"
                    required
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Bei Änderung der E-Mail-Adresse erhalten Sie eine Bestätigungs-E-Mail.
                  </p>
                </div>

                {/* Contact Information Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    Kontaktinformationen
                  </h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Telefonnummer
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="+49 30 12345678"
                      />
                    </div>

                    {/* Address Section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Anschrift
                      </label>
                      
                      {/* Street and House Number */}
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div className="col-span-2">
                          <input
                            type="text"
                            id="street"
                            value={profile.street}
                            onChange={(e) => setProfile(prev => ({ ...prev, street: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Straße"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            id="house_number"
                            value={profile.house_number}
                            onChange={(e) => setProfile(prev => ({ ...prev, house_number: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Nr."
                          />
                        </div>
                      </div>

                      {/* PLZ and City */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <input
                            type="text"
                            id="postal_code"
                            value={profile.postal_code}
                            onChange={(e) => setProfile(prev => ({ ...prev, postal_code: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="PLZ"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            id="city"
                            value={profile.city}
                            onChange={(e) => setProfile(prev => ({ ...prev, city: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Ort"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tax Information Section - Only for Dozenten */}
                {isDozent && (
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    Steuerliche Angaben
                  </h4>
                  
                  <div>
                    <label htmlFor="tax_id" className="block text-sm font-medium text-gray-700 mb-1">
                      Steuernummer
                    </label>
                    <input
                      type="text"
                      id="tax_id"
                      value={profile.tax_id}
                      onChange={(e) => setProfile(prev => ({ ...prev, tax_id: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                      placeholder="12/345/67890"
                    />
                    <p className="text-xs text-gray-500 mt-1">Wird für die Rechnungserstellung benötigt.</p>
                  </div>
                </div>
                )}

                {/* Banking Information Section - Only for Dozenten */}
                {isDozent && (
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    Bankverbindung
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Diese Informationen werden für die automatische Rechnungserstellung verwendet.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 mb-1">
                        Name der Bank
                      </label>
                      <input
                        type="text"
                        id="bank_name"
                        value={profile.bank_name}
                        onChange={(e) => setProfile(prev => ({ ...prev, bank_name: e.target.value }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="Deutsche Bank AG"
                      />
                    </div>

                    <div>
                      <label htmlFor="iban" className="block text-sm font-medium text-gray-700 mb-1">
                        IBAN
                      </label>
                      <input
                        type="text"
                        id="iban"
                        value={profile.iban}
                        onChange={(e) => setProfile(prev => ({ ...prev, iban: e.target.value.toUpperCase() }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="DE89 3704 0044 0532 0130 00"
                        maxLength={34}
                      />
                    </div>

                    <div>
                      <label htmlFor="bic" className="block text-sm font-medium text-gray-700 mb-1">
                        BIC
                      </label>
                      <input
                        type="text"
                        id="bic"
                        value={profile.bic}
                        onChange={(e) => setProfile(prev => ({ ...prev, bic: e.target.value.toUpperCase() }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="COBADEFFXXX"
                        maxLength={11}
                      />
                    </div>
                  </div>
                </div>
                )}

                {/* Password Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    <Lock className="h-5 w-5 inline mr-2" />
                    Passwort ändern
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Lassen Sie die Felder leer, wenn Sie Ihr Passwort nicht ändern möchten.
                  </p>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* New Password */}
                    <div>
                      <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">
                        Neues Passwort
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="new_password"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 pr-10"
                          placeholder="Mindestens 6 Zeichen"
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
                        Passwort bestätigen
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          id="confirm_password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 pr-10"
                          placeholder="Passwort wiederholen"
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password validation feedback */}
                  {(passwordData.newPassword || passwordData.confirmPassword) && (
                    <div className="mt-3 space-y-1">
                      <div className={`text-sm flex items-center ${
                        passwordData.newPassword.length >= 6 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          passwordData.newPassword.length >= 6 ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        Mindestens 6 Zeichen
                      </div>
                      <div className={`text-sm flex items-center ${
                        passwordData.newPassword && passwordData.confirmPassword && 
                        passwordData.newPassword === passwordData.confirmPassword 
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          passwordData.newPassword && passwordData.confirmPassword && 
                          passwordData.newPassword === passwordData.confirmPassword 
                            ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        Passwörter stimmen überein
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {isSaving ? 'Speichern...' : 'Änderungen speichern'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Additional Information */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <Camera className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Hinweise zu Ihrem Profil
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Ihr Profilbild wird anderen Benutzern im System angezeigt</li>
                    <li>Änderungen an der E-Mail-Adresse müssen bestätigt werden</li>
                    <li>Ihr Name wird in Nachrichten und Datei-Uploads angezeigt</li>
                    <li>Passwort-Änderungen sind optional - lassen Sie die Felder leer, um das aktuelle Passwort zu behalten</li>
                    {isDozent && <li>Bankdaten und Steuernummer werden für die automatische Rechnungserstellung verwendet</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}