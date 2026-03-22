import { useState, useEffect, useRef } from 'react';
import { X, Save, UserPlus, Camera, Trash2, Users, BookOpen, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useToastStore } from '../store/toastStore';

interface ParsedDozent {
  name: string;
  email: string;
  phone: string;
  legal_areas: string[];
  title: string;
  first_name: string;
  last_name: string;
}

interface EliteKleingruppe {
  id: string;
  name: string;
  description?: string;
}

interface EliteKleingruppeAssignment {
  elite_kleingruppe_id: string;
  legal_areas: string[];
}

interface Dozent {
  id?: string;
  title: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  legal_areas: string[];
  exam_types?: string[];
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  profile_picture_url?: string;
  iban: string;
  bic: string;
  bank_name: string;
  tax_id: string;
  hourly_rate_unterricht: number | null;
  hourly_rate_elite: number | null;
  hourly_rate_elite_korrektur: number | null;
  hourly_rate_sonstige: number | null;
  elite_kleingruppe_assignments?: EliteKleingruppeAssignment[];
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
    exam_types: ['1. Staatsexamen'],
    street: '',
    house_number: '',
    postal_code: '',
    city: '',
    profile_picture_url: '',
    iban: '',
    bic: '',
    bank_name: '',
    tax_id: '',
    hourly_rate_unterricht: null,
    hourly_rate_elite: null,
    hourly_rate_elite_korrektur: null,
    hourly_rate_sonstige: null
  });
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string>('');
  const [eliteKleingruppen, setEliteKleingruppen] = useState<EliteKleingruppe[]>([]);
  const [isEliteKleingruppeEnabled, setIsEliteKleingruppeEnabled] = useState(false);
  const [eliteAssignments, setEliteAssignments] = useState<Record<string, string[]>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const organigrammInputRef = useRef<HTMLInputElement>(null);
  const [parsedDozenten, setParsedDozenten] = useState<ParsedDozent[]>([]);
  const [showDozentPicker, setShowDozentPicker] = useState(false);

  const isEditing = !!dozent?.id;

  // Fetch Elite-Kleingruppen and assignments
  useEffect(() => {
    const fetchEliteKleingruppen = async () => {
      const { data } = await supabase.from('elite_kleingruppen').select('id, name, description').order('name');
      setEliteKleingruppen(data || []);
    };
    fetchEliteKleingruppen();
  }, []);

  // Load existing assignments when editing
  useEffect(() => {
    if (dozent?.id) {
      const fetchAssignments = async () => {
        const { data } = await supabase
          .from('elite_kleingruppe_dozenten')
          .select('elite_kleingruppe_id, legal_area')
          .eq('dozent_id', dozent.id);
        
        if (data && data.length > 0) {
          setIsEliteKleingruppeEnabled(true);
          const assignments: Record<string, string[]> = {};
          
          // Group by elite_kleingruppe_id and collect legal_areas
          data.forEach(a => {
            if (!assignments[a.elite_kleingruppe_id]) {
              assignments[a.elite_kleingruppe_id] = [];
            }
            if (!assignments[a.elite_kleingruppe_id].includes(a.legal_area)) {
              assignments[a.elite_kleingruppe_id].push(a.legal_area);
            }
          });
          
          setEliteAssignments(assignments);
        }
      };
      fetchAssignments();
    }
  }, [dozent?.id]);

  useEffect(() => {
    if (dozent) {
      console.log('📋 DozentForm: Dozent-Daten beim Laden:', {
        id: (dozent as any).id,
        full_name: (dozent as any).full_name,
        hourly_rate_unterricht: (dozent as any).hourly_rate_unterricht,
        hourly_rate_elite: (dozent as any).hourly_rate_elite,
        hourly_rate_elite_korrektur: (dozent as any).hourly_rate_elite_korrektur,
        hourly_rate_sonstige: (dozent as any).hourly_rate_sonstige,
        has_korrektur_key: 'hourly_rate_elite_korrektur' in (dozent as any),
        all_keys: Object.keys(dozent as any).filter(k => k.includes('hourly'))
      });
      // Split full_name into title, first_name and last_name if needed
      let title = dozent.title || '';
      let firstName = dozent.first_name || '';
      let lastName = dozent.last_name || '';
      
      if (!firstName && !lastName && (dozent as any).full_name) {
        const fullName = (dozent as any).full_name;
        const titlePrefixes = ['Dr.', 'Prof.', 'LL.M.', 'Ass. jur.', 'Dipl. jur.', 'RA'];
        
        // Extract titles from the beginning
        let remainingName = fullName;
        const extractedTitles: string[] = [];
        
        for (const prefix of titlePrefixes) {
          if (remainingName.startsWith(prefix)) {
            extractedTitles.push(prefix);
            remainingName = remainingName.substring(prefix.length).trim();
          }
        }
        
        if (extractedTitles.length > 0) {
          title = extractedTitles.join(' ');
        }
        
        // Split remaining name into first and last name
        const nameParts = remainingName.split(' ').filter((p: string) => p.length > 0);
        if (nameParts.length > 0) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        }
      }
      
      setFormData({
        title: title,
        first_name: firstName,
        last_name: lastName,
        email: dozent.email || '',
        phone: dozent.phone || '',
        legal_areas: dozent.legal_areas || [],
        exam_types: (dozent as any).exam_types || ['1. Staatsexamen'],
        street: dozent.street || '',
        house_number: dozent.house_number || '',
        postal_code: dozent.postal_code || '',
        city: dozent.city || '',
        profile_picture_url: dozent.profile_picture_url || '',
        iban: (dozent as any).iban || '',
        bic: (dozent as any).bic || '',
        bank_name: (dozent as any).bank_name || '',
        tax_id: (dozent as any).tax_id || '',
        hourly_rate_unterricht: (dozent as any).hourly_rate_unterricht ?? null,
        hourly_rate_elite: (dozent as any).hourly_rate_elite ?? null,
        hourly_rate_elite_korrektur: (dozent as any).hourly_rate_elite_korrektur ?? null,
        hourly_rate_sonstige: (dozent as any).hourly_rate_sonstige ?? null
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

  const handleImportOrganigramm = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const dozentMap = new Map<string, ParsedDozent>();

      const parseName = (raw: string): { title: string; firstName: string; lastName: string } => {
        let name = raw.trim();
        // Remove annotations like "(ab 01.10.25)"
        name = name.replace(/\s*\(.*?\)\s*/g, '').trim();
        const titlePrefixes = ['Dr.', 'Prof.', 'LL.M.', 'Ass. jur.', 'Dipl. jur.', 'RA'];
        let title = '';
        for (const prefix of titlePrefixes) {
          if (name.startsWith(prefix)) {
            title = prefix;
            name = name.substring(prefix.length).trim();
            break;
          }
        }
        const parts = name.split(' ').filter(p => p.length > 0);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        return { title, firstName, lastName };
      };

      const addDozent = (name: string, email: string, phone: string, area: string) => {
        if (!name || !name.trim()) return;
        const cleanName = name.replace(/\s*\(.*?\)\s*/g, '').trim();
        const key = cleanName.toLowerCase();
        const existing = dozentMap.get(key);
        if (existing) {
          if (!existing.legal_areas.includes(area)) {
            existing.legal_areas.push(area);
          }
          if (!existing.email && email) existing.email = email;
          if (!existing.phone && phone) existing.phone = phone;
        } else {
          const { title, firstName, lastName } = parseName(name);
          dozentMap.set(key, {
            name: cleanName,
            email: (email || '').trim(),
            phone: (phone || '').trim(),
            legal_areas: [area],
            title,
            first_name: firstName,
            last_name: lastName
          });
        }
      };

      // Sheet 1 (Tabelle1): A-C = Zivilrecht, D-F = Öff. Recht, G-I = Strafrecht
      const sheet1 = wb.Sheets[wb.SheetNames[0]];
      if (sheet1) {
        const getCellStr = (cell: string): string => {
          const c = sheet1[cell];
          return c ? String(c.v || '').trim() : '';
        };
        for (let row = 4; row <= 50; row++) {
          const zrName = getCellStr(`A${row}`);
          const zrEmail = getCellStr(`B${row}`);
          const zrPhone = getCellStr(`C${row}`);
          if (zrName) addDozent(zrName, zrEmail, zrPhone, 'Zivilrecht');

          const orName = getCellStr(`D${row}`);
          const orEmail = getCellStr(`E${row}`);
          const orPhone = getCellStr(`F${row}`);
          if (orName) addDozent(orName, orEmail, orPhone, 'Öffentliches Recht');

          const srName = getCellStr(`G${row}`);
          const srEmail = getCellStr(`H${row}`);
          const srPhone = getCellStr(`I${row}`);
          if (srName) addDozent(srName, srEmail, srPhone, 'Strafrecht');
        }
      }

      // Sheet 2 (Dozenten unter 50€/Std): A,B,C,D = ZR (Name,Rate,Email,Phone) | E,F,G,H = ÖR | I,J,K,L = SR
      if (wb.SheetNames.length > 1) {
        const sheet2 = wb.Sheets[wb.SheetNames[1]];
        if (sheet2) {
          const getCellStr2 = (cell: string): string => {
            const c = sheet2[cell];
            return c ? String(c.v || '').trim() : '';
          };
          for (let row = 4; row <= 30; row++) {
            const zrName = getCellStr2(`A${row}`);
            const zrEmail = getCellStr2(`C${row}`);
            const zrPhone = getCellStr2(`D${row}`);
            if (zrName) addDozent(zrName, zrEmail, zrPhone, 'Zivilrecht');

            const orName = getCellStr2(`E${row}`);
            const orEmail = getCellStr2(`G${row}`);
            const orPhone = getCellStr2(`H${row}`);
            if (orName) addDozent(orName, orEmail, orPhone, 'Öffentliches Recht');

            const srName = getCellStr2(`I${row}`);
            const srEmail = getCellStr2(`K${row}`);
            const srPhone = getCellStr2(`L${row}`);
            if (srName) addDozent(srName, srEmail, srPhone, 'Strafrecht');
          }
        }
      }

      const dozentList = Array.from(dozentMap.values()).sort((a, b) => a.last_name.localeCompare(b.last_name));
      setParsedDozenten(dozentList);
      setShowDozentPicker(true);
      addToast(`${dozentList.length} Dozenten aus Organigramm geladen`, 'success');
    } catch (error) {
      console.error('Error importing organigramm:', error);
      addToast('Fehler beim Importieren des Organigramms', 'error');
    }

    if (organigrammInputRef.current) {
      organigrammInputRef.current.value = '';
    }
  };

  const [existingDozentId, setExistingDozentId] = useState<string | null>(null);

  const bulkImportAll = async () => {
    if (parsedDozenten.length === 0) return;
    setIsLoading(true);

    try {
      // Build profiles array for edge function
      const profiles = parsedDozenten.map(d => ({
        full_name: d.title ? `${d.title} ${d.first_name} ${d.last_name}`.trim() : `${d.first_name} ${d.last_name}`.trim(),
        title: d.title || null,
        first_name: d.first_name,
        last_name: d.last_name,
        email: d.email || null,
        phone: d.phone || null,
        legal_areas: d.legal_areas,
      }));

      const { data: { session } } = await supabase.auth.getSession();
      const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-profiles`;
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ profiles }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Import fehlgeschlagen');
      }

      const parts = [];
      if (result.created > 0) parts.push(`${result.created} neu angelegt`);
      if (result.updated > 0) parts.push(`${result.updated} aktualisiert`);
      if (result.errors > 0) parts.push(`${result.errors} Fehler`);
      if (result.failedNames?.length > 0) {
        console.error('Failed imports:', result.failedNames);
      }
      addToast(`Import abgeschlossen: ${parts.join(', ')}`, result.errors > 0 ? 'error' : 'success');

      setShowDozentPicker(false);
      setParsedDozenten([]);
      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Bulk import error:', error);
      addToast(`Fehler beim Import: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const selectDozentFromList = async (d: ParsedDozent) => {
    // Check if dozent already exists in DB
    const fullName = d.title ? `${d.title} ${d.first_name} ${d.last_name}`.trim() : `${d.first_name} ${d.last_name}`.trim();
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, legal_areas, title, street, house_number, postal_code, city, iban, bic, bank_name, tax_id, hourly_rate_unterricht, hourly_rate_elite, hourly_rate_elite_korrektur, hourly_rate_sonstige, exam_types, profile_picture_url')
      .eq('role', 'dozent')
      .eq('full_name', fullName)
      .maybeSingle();

    if (existing) {
      // Dozent exists → switch to update mode
      setExistingDozentId(existing.id);
      setFormData(prev => ({
        ...prev,
        title: d.title || prev.title,
        first_name: d.first_name,
        last_name: d.last_name,
        email: d.email || existing.email || prev.email,
        phone: d.phone || existing.phone || prev.phone,
        legal_areas: d.legal_areas.length > 0 ? d.legal_areas : (existing.legal_areas || prev.legal_areas),
        exam_types: existing.exam_types || prev.exam_types,
        street: existing.street || prev.street,
        house_number: existing.house_number || prev.house_number,
        postal_code: existing.postal_code || prev.postal_code,
        city: existing.city || prev.city,
        profile_picture_url: existing.profile_picture_url || prev.profile_picture_url,
        iban: existing.iban || prev.iban,
        bic: existing.bic || prev.bic,
        bank_name: existing.bank_name || prev.bank_name,
        tax_id: existing.tax_id || prev.tax_id,
        hourly_rate_unterricht: existing.hourly_rate_unterricht ?? prev.hourly_rate_unterricht,
        hourly_rate_elite: existing.hourly_rate_elite ?? prev.hourly_rate_elite,
        hourly_rate_elite_korrektur: existing.hourly_rate_elite_korrektur ?? prev.hourly_rate_elite_korrektur,
        hourly_rate_sonstige: existing.hourly_rate_sonstige ?? prev.hourly_rate_sonstige,
      }));
      if (existing.profile_picture_url) {
        setProfilePicturePreview(existing.profile_picture_url);
      }
      setShowDozentPicker(false);
      addToast(`${d.name} existiert bereits — Daten werden aktualisiert`, 'success');
    } else {
      // New dozent
      setExistingDozentId(null);
      setFormData(prev => ({
        ...prev,
        title: d.title || prev.title,
        first_name: d.first_name,
        last_name: d.last_name,
        email: d.email || prev.email,
        phone: d.phone || prev.phone,
        legal_areas: d.legal_areas.length > 0 ? d.legal_areas : prev.legal_areas,
        hourly_rate_unterricht: prev.hourly_rate_unterricht
      }));
      setShowDozentPicker(false);
      addToast(`${d.name} ausgewählt`, 'success');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      addToast('Bitte Vor- und Nachname eingeben', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const fullName = formData.title 
        ? `${formData.title} ${formData.first_name} ${formData.last_name}`.trim()
        : `${formData.first_name} ${formData.last_name}`.trim();

      // Check for duplicate names (only when creating new user)
      if (!isEditing) {
        const { data: existingProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('full_name', fullName);

        if (existingProfiles && existingProfiles.length > 0) {
          const existingEmails = existingProfiles.map(p => p.email).join(', ');
          addToast(`⚠️ Ein Benutzer mit dem Namen "${fullName}" existiert bereits (${existingEmails}). Bitte verwenden Sie einen eindeutigen Namen.`, 'error');
          setIsLoading(false);
          return;
        }
      }

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

      // Log hourly rates for debugging
      console.log('💰 Stundensätze vor dem Speichern:', {
        hourly_rate_unterricht: formData.hourly_rate_unterricht,
        hourly_rate_elite: formData.hourly_rate_elite,
        hourly_rate_elite_korrektur: formData.hourly_rate_elite_korrektur,
        hourly_rate_sonstige: formData.hourly_rate_sonstige
      });

      const dataToSave: any = {
        title: formData.title.trim() || null,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        full_name: fullName,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        legal_areas: formData.legal_areas.length > 0 ? formData.legal_areas : null,
        street: formData.street.trim() || null,
        house_number: formData.house_number.trim() || null,
        postal_code: formData.postal_code.trim() || null,
        city: formData.city.trim() || null,
        profile_picture_url: profilePictureUrl,
        iban: formData.iban.trim() || null,
        bic: formData.bic.trim() || null,
        bank_name: formData.bank_name.trim() || null,
        tax_id: formData.tax_id.trim() || null,
        hourly_rate_unterricht: formData.hourly_rate_unterricht,
        hourly_rate_elite: formData.hourly_rate_elite,
        hourly_rate_elite_korrektur: formData.hourly_rate_elite_korrektur,
        hourly_rate_sonstige: formData.hourly_rate_sonstige,
        role: 'dozent'
      };

      console.log('📦 DataToSave Stundensätze:', {
        hourly_rate_unterricht: dataToSave.hourly_rate_unterricht,
        hourly_rate_elite: dataToSave.hourly_rate_elite,
        hourly_rate_elite_korrektur: dataToSave.hourly_rate_elite_korrektur,
        hourly_rate_sonstige: dataToSave.hourly_rate_sonstige
      });

      let dozentId: string;

      if (existingDozentId) {
        // Imported dozent that already exists in DB → update
        dozentId = existingDozentId;
        const { error } = await supabase
          .from('profiles')
          .update(dataToSave)
          .eq('id', dozentId);

        if (error) throw error;

        // Delete existing elite assignments before saving new ones
        await supabase.from('elite_kleingruppe_dozenten').delete().eq('dozent_id', dozentId);
        addToast('Dozent wurde aktualisiert', 'success');
      } else if (isEditing && dozent?.id) {
        dozentId = dozent.id;
        console.log('🔄 UPDATE - Dozent ID:', dozentId);
        console.log('🔄 UPDATE - Stundensätze:', {
          hourly_rate_unterricht: dataToSave.hourly_rate_unterricht,
          hourly_rate_elite: dataToSave.hourly_rate_elite,
          hourly_rate_elite_korrektur: dataToSave.hourly_rate_elite_korrektur,
          hourly_rate_sonstige: dataToSave.hourly_rate_sonstige
        });
        
        // Check if email was added and user account doesn't exist yet
        const hadNoEmail = !(dozent as any).email;
        const nowHasEmail = formData.email.trim();
        let userAccountCreated = false;
        
        if (hadNoEmail && nowHasEmail) {
          // Check if user account exists in auth.users
          const { data: { user } } = await supabase.auth.admin.getUserById(dozentId);
          
          if (!user) {
            // Create user account via edge function
            try {
              const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
              const response = await fetch(edgeFunctionUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                  email: formData.email.trim(),
                  fullName: fullName,
                  role: 'dozent',
                  userId: dozentId // Use existing profile ID
                }),
              });

              const result = await response.json();

              if (response.ok && result.success) {
                userAccountCreated = true;
                console.log('✅ User account created for existing dozent');
              } else {
                console.error('Error creating user account:', result);
                addToast('Hinweis: Profil wurde aktualisiert, aber Benutzeraccount konnte nicht erstellt werden: ' + (result.error || 'Unbekannter Fehler'), 'error');
              }
            } catch (err) {
              console.error('Exception creating user account:', err);
              addToast('Hinweis: Profil wurde aktualisiert, aber Benutzeraccount konnte nicht erstellt werden', 'error');
            }
          }
        }
        
        const { data: updateResult, error } = await supabase
          .from('profiles')
          .update(dataToSave)
          .eq('id', dozentId)
          .select('hourly_rate_unterricht, hourly_rate_elite, hourly_rate_elite_korrektur, hourly_rate_sonstige');

        if (error) {
          console.error('❌ UPDATE ERROR:', error);
          throw error;
        }
        
        console.log('✅ UPDATE SUCCESS - Gespeicherte Stundensätze:', updateResult);
        
        // Delete existing assignments before saving new ones
        await supabase.from('elite_kleingruppe_dozenten').delete().eq('dozent_id', dozentId);
        
        if (userAccountCreated) {
          addToast('Dozent wurde aktualisiert und Benutzeraccount wurde erstellt. Einladungs-E-Mail wurde gesendet.', 'success');
        } else {
          addToast('Dozent wurde aktualisiert', 'success');
        }
      } else {
        // Create profile without user account (email is stored but no login created)
        dozentId = crypto.randomUUID();

        // Upsert profile with additional dozent-specific fields
        // The create-user edge function already created the basic profile,
        // but we need to add dozent-specific fields
        console.log('➕ UPSERT - Dozent ID:', dozentId);
        console.log('➕ UPSERT - Stundensätze:', {
          hourly_rate_unterricht: dataToSave.hourly_rate_unterricht,
          hourly_rate_elite: dataToSave.hourly_rate_elite,
          hourly_rate_elite_korrektur: dataToSave.hourly_rate_elite_korrektur,
          hourly_rate_sonstige: dataToSave.hourly_rate_sonstige
        });
        
        const { data: upsertResult, error } = await supabase
          .from('profiles')
          .upsert({
            id: dozentId,
            email: formData.email.trim() || null,
            full_name: fullName,
            role: 'dozent',
            title: dataToSave.title,
            phone: dataToSave.phone,
            legal_areas: dataToSave.legal_areas,
            street: dataToSave.street,
            house_number: dataToSave.house_number,
            postal_code: dataToSave.postal_code,
            city: dataToSave.city,
            profile_picture_url: dataToSave.profile_picture_url,
            iban: dataToSave.iban,
            bic: dataToSave.bic,
            bank_name: dataToSave.bank_name,
            tax_id: dataToSave.tax_id,
            hourly_rate_unterricht: dataToSave.hourly_rate_unterricht,
            hourly_rate_elite: dataToSave.hourly_rate_elite,
            hourly_rate_elite_korrektur: dataToSave.hourly_rate_elite_korrektur,
            hourly_rate_sonstige: dataToSave.hourly_rate_sonstige
          }, {
            onConflict: 'id'
          })
          .select('hourly_rate_unterricht, hourly_rate_elite, hourly_rate_elite_korrektur, hourly_rate_sonstige');

        if (error) {
          console.error('❌ UPSERT ERROR:', error);
          throw error;
        }
        
        console.log('✅ UPSERT SUCCESS - Gespeicherte Stundensätze:', upsertResult);
        addToast('Dozent wurde hinzugefügt (ohne Benutzerkonto)', 'success');
      }

      // Save Elite-Kleingruppe assignments if enabled
      if (isEliteKleingruppeEnabled && Object.keys(eliteAssignments).length > 0) {
        // Flatten assignments: one row per legal area per kleingruppe
        const assignmentsToInsert: { dozent_id: string; elite_kleingruppe_id: string; legal_area: string }[] = [];
        
        Object.entries(eliteAssignments)
          .filter(([_, areas]) => areas.length > 0)
          .forEach(([groupId, areas]) => {
            areas.forEach(area => {
              assignmentsToInsert.push({
                dozent_id: dozentId,
                elite_kleingruppe_id: groupId,
                legal_area: area
              });
            });
          });

        if (assignmentsToInsert.length > 0) {
          const { error: assignmentError } = await supabase
            .from('elite_kleingruppe_dozenten')
            .insert(assignmentsToInsert);
          
          if (assignmentError) {
            console.error('Error saving assignments:', assignmentError);
          }
        }
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

  const handleEliteLegalAreaChange = (groupId: string, area: string, checked: boolean) => {
    setEliteAssignments(prev => {
      const current = prev[groupId] || [];
      if (checked) {
        return { ...prev, [groupId]: [...current, area] };
      } else {
        return { ...prev, [groupId]: current.filter(a => a !== area) };
      }
    });
  };

  const handleLegalAreaChange = (area: string, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, legal_areas: [...formData.legal_areas, area] });
    } else {
      setFormData({ ...formData, legal_areas: formData.legal_areas.filter(a => a !== area) });
    }
  };

  const handleExamTypeChange = (examType: string, checked: boolean) => {
    const currentExamTypes = formData.exam_types || [];
    if (checked) {
      setFormData({ ...formData, exam_types: [...currentExamTypes, examType] });
    } else {
      setFormData({ ...formData, exam_types: currentExamTypes.filter(t => t !== examType) });
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center">
            <UserPlus className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Dozent bearbeiten' : 'Dozent hinzufügen'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={organigrammInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportOrganigramm}
              className="hidden"
            />
            {!isEditing && (
              <button
                type="button"
                onClick={() => organigrammInputRef.current?.click()}
                className="p-1 text-gray-400 hover:text-primary rounded transition-colors"
                title="Organigramm importieren"
              >
                <Upload className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Dozent Picker from Organigramm */}
        {showDozentPicker && parsedDozenten.length > 0 && (
          <div className="mx-4 mt-4 border border-blue-200 rounded-lg bg-blue-50/50 max-h-80 overflow-y-auto">
            <div className="sticky top-0 bg-blue-50 px-3 py-2 border-b border-blue-200 flex items-center justify-between z-10">
              <span className="text-sm font-medium text-blue-900">
                {parsedDozenten.length} Dozenten gefunden
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={bulkImportAll}
                  disabled={isLoading}
                  className="px-3 py-1 text-xs font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                  ) : (
                    <>
                      <Upload className="h-3 w-3" />
                      Alle importieren
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDozentPicker(false)}
                  className="text-blue-400 hover:text-blue-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-blue-100">
              {parsedDozenten.map((d, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectDozentFromList(d)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-100/70 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-900">
                      {d.title ? `${d.title} ` : ''}{d.first_name} {d.last_name}
                    </span>
                    {d.email && (
                      <span className="text-xs text-gray-500 ml-2">{d.email}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    {d.legal_areas.map((area, i) => (
                      <span
                        key={i}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          area === 'Zivilrecht' ? 'bg-blue-100 text-blue-700' :
                          area === 'Strafrecht' ? 'bg-red-100 text-red-700' :
                          'bg-green-100 text-green-700'
                        }`}
                      >
                        {area === 'Zivilrecht' ? 'ZR' : area === 'Strafrecht' ? 'SR' : 'ÖR'}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

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

          {/* Exam Types - Checkboxes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Staatsexamen
            </label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={(formData.exam_types || []).includes('1. Staatsexamen')}
                  onChange={(e) => handleExamTypeChange('1. Staatsexamen', e.target.checked)}
                  className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="ml-2 text-sm text-gray-700">1. Staatsexamen</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={(formData.exam_types || []).includes('2. Staatsexamen')}
                  onChange={(e) => handleExamTypeChange('2. Staatsexamen', e.target.checked)}
                  className="h-4 w-4 text-amber-600 border-gray-300 rounded focus:ring-amber-600"
                />
                <span className="ml-2 text-sm text-gray-700">2. Staatsexamen</span>
              </label>
            </div>
          </div>

          {/* Elite-Kleingruppe Section */}
          <div className="border-t pt-4">
            <label className="flex items-center cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={isEliteKleingruppeEnabled}
                onChange={(e) => setIsEliteKleingruppeEnabled(e.target.checked)}
                className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="ml-2 text-sm font-medium text-gray-900 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Elite-Kleingruppe Dozent
              </span>
            </label>

            {/* Elite-Kleingruppe Assignment Panel */}
            {isEliteKleingruppeEnabled && eliteKleingruppen.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <p className="text-sm text-gray-600">
                  Weisen Sie dem Dozenten Elite-Kleingruppen zu und definieren Sie die Rechtsgebiete pro Gruppe:
                </p>
                
                <div className="space-y-3">
                  {eliteKleingruppen.map((group) => (
                    <div key={group.id} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left: Group Info */}
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <BookOpen className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{group.name}</p>
                            {group.description && (
                              <p className="text-xs text-gray-500">{group.description}</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Right: Legal Areas */}
                        <div className="flex flex-wrap gap-3">
                          {['Zivilrecht', 'Strafrecht', 'Öffentliches Recht'].map((area) => (
                            <label key={`${group.id}-${area}`} className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(eliteAssignments[group.id] || []).includes(area)}
                                onChange={(e) => handleEliteLegalAreaChange(group.id, area, e.target.checked)}
                                className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                              />
                              <span className="ml-1.5 text-sm text-gray-700">{area}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {eliteKleingruppen.length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    Keine Elite-Kleingruppen verfügbar. Bitte erstellen Sie zuerst eine Gruppe.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail-Adresse (optional)
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="dozent@example.com"
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

          {/* Bank Details Section */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Bankverbindung
            </label>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bankname</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="z.B. Deutsche Bank"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">IBAN</label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                  placeholder="DE89 3704 0044 0532 0130 00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">BIC</label>
                <input
                  type="text"
                  value={formData.bic}
                  onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                  placeholder="COBADEFFXXX"
                />
              </div>
            </div>
          </div>

          {/* Tax ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Steuernummer / USt-IdNr.
            </label>
            <input
              type="text"
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="z.B. 12/345/67890 oder DE123456789"
            />
          </div>

          {/* Hourly Rates Section */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Stundensatz (€/Std.)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Unterricht</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.hourly_rate_unterricht ?? ''}
                    onChange={(e) => setFormData({ ...formData, hourly_rate_unterricht: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent pr-8"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Elite-Kleingruppe Unterricht</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.hourly_rate_elite ?? ''}
                    onChange={(e) => setFormData({ ...formData, hourly_rate_elite: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent pr-8"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Elite-Kleingruppe Korrektur</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.hourly_rate_elite_korrektur ?? ''}
                    onChange={(e) => setFormData({ ...formData, hourly_rate_elite_korrektur: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent pr-8"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sonstige Tätigkeiten</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.hourly_rate_sonstige ?? ''}
                    onChange={(e) => setFormData({ ...formData, hourly_rate_sonstige: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent pr-8"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                </div>
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
