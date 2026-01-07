import { useState, useEffect, useRef } from 'react';
import { X, Save, UserPlus, Camera, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToastStore } from '../store/toastStore';

interface Dozent {
  id?: string;
  title: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  legal_areas: string[];
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  profile_picture_url?: string;
}

interface DozentFormProps {
  dozent?: Dozent | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (dozent: Dozent) => void;
}

export function DozentForm({ dozent, onClose, onSaved, onDelete }: DozentFormProps) {
  const { addToast } = useToastStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState<Dozent>({
    title: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    legal_areas: [],
    street: '',
    house_number: '',
    postal_code: '',
    city: '',
    profile_picture_url: ''
  });
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!dozent?.id;

  useEffect(() => {
    if (dozent) {
      setFormData({
        title: dozent.title || '',
        first_name: dozent.first_name || '',
        last_name: dozent.last_name || '',
        email: dozent.email || '',
        phone: dozent.phone || '',
        legal_areas: dozent.legal_areas || [],
        street: dozent.street || '',
        house_number: dozent.house_number || '',
        postal_code: dozent.postal_code || '',
        city: dozent.city || '',
        profile_picture_url: dozent.profile_picture_url || ''
      });
      if (dozent.profile_picture_url) {
        setProfilePicturePreview(dozent.profile_picture_url);
      }
    }
  }, [dozent]);

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('Bild darf maximal 5MB groß sein', 'error');
        return;
      }
      setProfilePictureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveProfilePicture = () => {
    setProfilePictureFile(null);
    setProfilePicturePreview('');
    setFormData({ ...formData, profile_picture_url: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      addToast('Bitte Vor- und Nachname eingeben', 'error');
      return;
    }

    if (!formData.email.trim()) {
      addToast('Bitte E-Mail-Adresse eingeben', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const fullName = formData.title 
        ? `${formData.title} ${formData.first_name} ${formData.last_name}`.trim()
        : `${formData.first_name} ${formData.last_name}`.trim();

      let profilePictureUrl = formData.profile_picture_url || null;

      // Upload profile picture if a new one was selected
      if (profilePictureFile) {
        const dozentId = isEditing && dozent?.id ? dozent.id : crypto.randomUUID();
        const fileExt = profilePictureFile.name.split('.').pop();
        const fileName = `${dozentId}/profile.${fileExt}`;

        // First delete existing file if any
        await supabase.storage
          .from('profile-pictures')
          .remove([fileName]);

        // Read file as ArrayBuffer to ensure proper upload
        const arrayBuffer = await profilePictureFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const { error: uploadError } = await supabase.storage
          .from('profile-pictures')
          .upload(fileName, uint8Array, { 
            cacheControl: '3600',
            contentType: profilePictureFile.type,
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          // Continue without profile picture
        } else {
          const { data: urlData } = supabase.storage
            .from('profile-pictures')
            .getPublicUrl(fileName);
          profilePictureUrl = urlData.publicUrl;
        }
      }

      const dataToSave: any = {
        title: formData.title.trim() || null,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        full_name: fullName,
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        legal_areas: formData.legal_areas.length > 0 ? formData.legal_areas : null,
        street: formData.street.trim() || null,
        house_number: formData.house_number.trim() || null,
        postal_code: formData.postal_code.trim() || null,
        city: formData.city.trim() || null,
        profile_picture_url: profilePictureUrl,
        role: 'dozent'
      };

      if (isEditing && dozent?.id) {
        const { error } = await supabase
          .from('profiles')
          .update(dataToSave)
          .eq('id', dozent.id);

        if (error) throw error;
        addToast('Dozent wurde aktualisiert', 'success');
      } else {
        // Create auth user with default password
        const { data: newUserId, error: authError } = await supabase
          .rpc('create_dozent_user', { 
            user_email: formData.email.trim(),
            user_password: 'Dozent123!'
          });

        if (authError) {
          console.error('Error creating auth user:', authError);
          throw new Error('Fehler beim Erstellen des Benutzerkontos: ' + authError.message);
        }

        // Create profile with the auth user's ID
        const { error } = await supabase
          .from('profiles')
          .insert({
            ...dataToSave,
            id: newUserId
          });

        if (error) throw error;
        addToast('Dozent wurde hinzugefügt (Passwort: Dozent123!)', 'success');
      }

      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Error saving dozent:', error);
      addToast(error.message || 'Fehler beim Speichern', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLegalAreaChange = (area: string, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, legal_areas: [...formData.legal_areas, area] });
    } else {
      setFormData({ ...formData, legal_areas: formData.legal_areas.filter(a => a !== area) });
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <div className="flex items-center">
            <UserPlus className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Dozent bearbeiten' : 'Dozent hinzufügen'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Profile Picture */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profilbild
            </label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {profilePicturePreview ? (
                  <img
                    src={profilePicturePreview}
                    alt="Profilbild"
                    className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-gray-200">
                    <span className="text-primary font-medium text-2xl">
                      {formData.first_name?.[0]?.toUpperCase() || ''}{formData.last_name?.[0]?.toUpperCase() || ''}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90"
                  title="Bild ändern"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-primary hover:text-primary/80"
                >
                  Bild hochladen
                </button>
                {profilePicturePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveProfilePicture}
                    className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Entfernen
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">Max. 5MB, JPG/PNG empfohlen</p>
          </div>

          {/* Title (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titel (optional)
            </label>
            <select
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Kein Titel</option>
              <option value="Dr.">Dr.</option>
              <option value="Prof.">Prof.</option>
              <option value="LL.M.">LL.M.</option>
              <option value="Ass. jur.">Ass. jur.</option>
              <option value="Dipl. jur.">Dipl. jur.</option>
              <option value="RA">RA</option>
            </select>
          </div>

          {/* Name Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vorname *
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Vorname"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nachname *
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Nachname"
                required
              />
            </div>
          </div>

          {/* Legal Areas - Checkboxes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechtsgebiet
            </label>
            <div className="space-y-2">
              {['Zivilrecht', 'Strafrecht', 'Öffentliches Recht'].map((area) => (
                <label key={area} className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.legal_areas.includes(area)}
                    onChange={(e) => handleLegalAreaChange(area, e.target.checked)}
                    className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-gray-700">{area}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail-Adresse *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="email@beispiel.de"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefonnummer
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="+49 123 456789"
            />
          </div>

          {/* Address Section */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Anschrift
            </label>
            
            {/* Street and House Number */}
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div className="col-span-2">
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Straße"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.house_number}
                  onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
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
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="PLZ"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ort"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center disabled:opacity-50"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Speichern' : 'Hinzufügen'}
                </>
              )}
            </button>
          </div>

          {/* Delete Button - only show when editing */}
          {isEditing && onDelete && dozent && (
            <div className="pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full sm:w-auto px-3 py-1.5 text-red-600 hover:text-red-700 text-sm flex items-center justify-center sm:justify-start"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Dozent löschen
              </button>
            </div>
          )}
        </form>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && dozent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowDeleteConfirm(false)}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Dozent löschen?</h3>
              <p className="text-gray-600 mb-4">
                Möchten Sie <strong>{dozent.first_name} {dozent.last_name}</strong> wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    if (onDelete) onDelete(dozent as Dozent);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
