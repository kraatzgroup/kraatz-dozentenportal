import { useState, useEffect, useRef } from 'react';
import { X, Save, UserPlus, MapPin, Trash2, AlertTriangle, Upload, Calendar, Clock, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useToastStore } from '../store/toastStore';

interface ImportedLesson {
  date: string; // YYYY-MM-DD
  topic: string;
  hours: number;
  grade: number | null;
  legal_area: string; // 'Zivilrecht' | 'Strafrecht' | 'Öffentliches Recht'
  dozent_name: string;
  dozent_id: string | null;
}

interface Teilnehmer {
  id?: string;
  user_id?: string | null;
  tn_nummer?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  phone: string;
  study_goal: string;
  contract_start: string;
  contract_end: string;
  booked_hours: number | null;
  dozent_id: string | null;
  legal_areas: string[];
  dozent_zivilrecht_id: string | null;
  dozent_strafrecht_id: string | null;
  dozent_oeffentliches_recht_id: string | null;
  exam_date: string;
  state_law: string;
  referendariatsstandort: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  elite_kleingruppe?: boolean;
  is_elite_kleingruppe?: boolean;
  elite_kleingruppe_id?: string | null;
  hours_zivilrecht?: number | null;
  hours_strafrecht?: number | null;
  hours_oeffentliches_recht?: number | null;
  frequency_type?: string;
  frequency_hours_zivilrecht?: number | null;
  frequency_hours_strafrecht?: number | null;
  frequency_hours_oeffentliches_recht?: number | null;
}

const GERMAN_STATES = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen'
];

interface TeilnehmerFormProps {
  teilnehmer?: Teilnehmer | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (teilnehmer: Teilnehmer) => void;
  dozenten: { id: string; full_name: string; legal_areas?: string[] | null }[];
}

interface EliteKleingruppe {
  id: string;
  name: string;
}

export function TeilnehmerForm({ teilnehmer, onClose, onSaved, onDelete, dozenten }: TeilnehmerFormProps) {
  const { addToast } = useToastStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eliteKleingruppen, setEliteKleingruppen] = useState<EliteKleingruppe[]>([]);
  const [tnNummerError, setTnNummerError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasImportedData = useRef(false);
  const [importedLessons, setImportedLessons] = useState<ImportedLesson[]>([]);
  const [showImportedLessons, setShowImportedLessons] = useState(true);
  
  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };
  
  const [formData, setFormData] = useState<Teilnehmer>({
    tn_nummer: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    study_goal: '',
    contract_start: getTodayDate(),
    contract_end: '',
    booked_hours: null,
    dozent_id: null,
    legal_areas: [],
    dozent_zivilrecht_id: null,
    dozent_strafrecht_id: null,
    dozent_oeffentliches_recht_id: null,
    exam_date: '',
    state_law: '',
    referendariatsstandort: '',
    street: '',
    house_number: '',
    postal_code: '',
    city: '',
    elite_kleingruppe: false,
    is_elite_kleingruppe: false,
    elite_kleingruppe_id: null,
    hours_zivilrecht: null,
    hours_strafrecht: null,
    hours_oeffentliches_recht: null,
    frequency_type: '',
    frequency_hours_zivilrecht: null,
    frequency_hours_strafrecht: null,
    frequency_hours_oeffentliches_recht: null
  });

  const isEditing = !!teilnehmer?.id;

  const findDozentId = (name: string): string | null => {
    if (!name) return null;
    const normalized = name.trim().toLowerCase();
    const match = dozenten.find(d => d.full_name.toLowerCase() === normalized);
    if (match) return match.id;
    const partialMatch = dozenten.find(d => {
      const parts = normalized.split(' ');
      return parts.every(p => d.full_name.toLowerCase().includes(p));
    });
    return partialMatch?.id || null;
  };

  const parseContractEnd = (text: string): string => {
    const match = text.match(/bis\s+(\d{2})\.(\d{2})\.(\d{2,4})/);
    if (match) {
      const day = match[1];
      const month = match[2];
      const year = match[3].length === 2 ? `20${match[3]}` : match[3];
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  const parseHoursPerMonth = (text: string): number | null => {
    if (!text) return null;
    const match = text.match(/(?:mind\.?|mindestens|min\.?|max\.?|maximal)\s*(\d+[,.]?\d*)\s*(?:Std|Stunden)/i);
    if (match) {
      return parseFloat(match[1].replace(',', '.'));
    }
    // Fallback: try to find any number followed by Std
    const fallback = text.match(/(\d+[,.]?\d*)\s*(?:Std|Stunden)/i);
    if (fallback) {
      return parseFloat(fallback[1].replace(',', '.'));
    }
    return null;
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

      // Sheet 1: "Kontaktdaten + Vertragsggst."
      const contactSheet = wb.Sheets[wb.SheetNames[0]];
      if (!contactSheet) {
        addToast('Ungültiges EU-Vorblatt Format', 'error');
        return;
      }

      const getCellValue = (sheet: XLSX.WorkSheet, cell: string): string => {
        const c = sheet[cell];
        return c ? String(c.v || '').trim() : '';
      };

      const getCellNumber = (sheet: XLSX.WorkSheet, cell: string): number | null => {
        const c = sheet[cell];
        if (!c) return null;
        const val = typeof c.v === 'number' ? c.v : parseFloat(String(c.v).replace(',', '.'));
        return isNaN(val) ? null : val;
      };

      // Parse contact data
      const totalHours = getCellNumber(contactSheet, 'C3');
      
      // Try to find TN number from multiple possible locations
      let tnRaw = getCellValue(contactSheet, 'D4');
      if (!tnRaw) tnRaw = getCellValue(contactSheet, 'C4');
      if (!tnRaw) tnRaw = getCellValue(contactSheet, 'E4');
      // Also try to extract from filename (e.g. "Trinker, Sarah_TN2729_...")
      if (!tnRaw) {
        const fileNameTnMatch = file.name.match(/TN(\d+)/i);
        if (fileNameTnMatch) tnRaw = fileNameTnMatch[1];
      }
      // Clean up: remove "TN" prefix if already present, remove non-digits
      const tnDigits = tnRaw.replace(/[^0-9]/g, '');
      const tnNummer = tnDigits ? `TN${tnDigits.padStart(5, '0')}` : formData.tn_nummer;
      console.log('EU-Vorblatt Import - TN raw:', tnRaw, 'TN parsed:', tnNummer);
      const fullName = getCellValue(contactSheet, 'C5');
      const phone = getCellValue(contactSheet, 'C7');
      const email = getCellValue(contactSheet, 'C9');
      const stateLaw = getCellValue(contactSheet, 'F9');

      // Parse name into first, middle, and last
      let firstName = '';
      let middleName = '';
      let lastName = '';
      if (fullName) {
        const nameParts = fullName.trim().split(/\s+/).filter(p => p.length > 0);
        if (nameParts.length === 1) {
          firstName = nameParts[0];
        } else if (nameParts.length === 2) {
          firstName = nameParts[0];
          lastName = nameParts[1];
        } else {
          firstName = nameParts[0];
          lastName = nameParts[nameParts.length - 1];
          middleName = nameParts.slice(1, -1).join(' ');
        }
      }

      // Parse exam date
      const examDateRaw = getCellValue(contactSheet, 'F8');
      let examDate = '';
      if (examDateRaw) {
        const dateMatch = examDateRaw.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
        if (dateMatch) {
          const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
          examDate = `${year}-${dateMatch[2]}-${dateMatch[1]}`;
        }
      }

      // Parse dozent assignments from rows 16-18
      const dozentAssignments: { name: string; area: string }[] = [];
      for (let row = 16; row <= 20; row++) {
        const dozentName = getCellValue(contactSheet, `A${row}`);
        const areaRaw = getCellValue(contactSheet, `E${row}`);
        if (dozentName && areaRaw) {
          dozentAssignments.push({ name: dozentName, area: areaRaw });
        }
      }

      // Determine legal areas and dozent IDs
      const legalAreas: string[] = [];
      let dozentZivilrechtId: string | null = null;
      let dozentStrafrechtId: string | null = null;
      let dozentOeffentlichesRechtId: string | null = null;

      for (const assignment of dozentAssignments) {
        const areaLower = assignment.area.toLowerCase();
        if (areaLower.includes('zivil')) {
          if (!legalAreas.includes('Zivilrecht')) legalAreas.push('Zivilrecht');
          dozentZivilrechtId = findDozentId(assignment.name);
        } else if (areaLower.includes('straf')) {
          if (!legalAreas.includes('Strafrecht')) legalAreas.push('Strafrecht');
          dozentStrafrechtId = findDozentId(assignment.name);
        } else if (areaLower.includes('öff') || areaLower.includes('oeff') || areaLower === 'ör') {
          if (!legalAreas.includes('Öffentliches Recht')) legalAreas.push('Öffentliches Recht');
          dozentOeffentlichesRechtId = findDozentId(assignment.name);
        }
      }

      // Parse per-subject sheets for hours and frequency
      let hoursZivilrecht: number | null = null;
      let hoursStrafrechtVal: number | null = null;
      let hoursOeffentlichesRecht: number | null = null;
      let frequencyZivilrecht: number | null = null;
      let frequencyStrafrechtVal: number | null = null;
      let frequencyOeffentlichesRecht: number | null = null;
      let contractEnd = '';

      for (let i = 1; i < wb.SheetNames.length; i++) {
        const sheetName = wb.SheetNames[i].toLowerCase().trim();
        const sheet = wb.Sheets[wb.SheetNames[i]];
        if (!sheet) continue;

        const sheetHours = getCellNumber(sheet, 'B3');
        const headerB1 = getCellValue(sheet, 'B1');
        const frequencyText = getCellValue(sheet, 'A4') || getCellValue(sheet, 'B4');
        const maxHours = parseHoursPerMonth(frequencyText);

        if (!contractEnd && headerB1) {
          contractEnd = parseContractEnd(headerB1);
        }

        if (sheetName.includes('zivil')) {
          hoursZivilrecht = sheetHours;
          frequencyZivilrecht = maxHours;
          if (!legalAreas.includes('Zivilrecht')) legalAreas.push('Zivilrecht');
        } else if (sheetName.includes('straf') || sheetName === 'str') {
          hoursStrafrechtVal = sheetHours;
          frequencyStrafrechtVal = maxHours;
          if (!legalAreas.includes('Strafrecht')) legalAreas.push('Strafrecht');
        } else if (sheetName.includes('ör') || sheetName.includes('öff') || sheetName.includes('oeff') || sheetName === 'ör') {
          hoursOeffentlichesRecht = sheetHours;
          frequencyOeffentlichesRecht = maxHours;
          if (!legalAreas.includes('Öffentliches Recht')) legalAreas.push('Öffentliches Recht');
        }
      }

      // Parse lesson entries from each legal area sheet
      const lessons: ImportedLesson[] = [];
      const sheetToArea: Record<string, { area: string; dozentName: string; dozentId: string | null }> = {};
      
      // Build mapping: sheet name -> legal area + dozent
      for (const assignment of dozentAssignments) {
        const areaLower = assignment.area.toLowerCase();
        if (areaLower.includes('zivil')) {
          sheetToArea['zivilrecht'] = { area: 'Zivilrecht', dozentName: assignment.name, dozentId: findDozentId(assignment.name) };
        } else if (areaLower.includes('straf')) {
          sheetToArea['strafrecht'] = { area: 'Strafrecht', dozentName: assignment.name, dozentId: findDozentId(assignment.name) };
        } else if (areaLower.includes('öff') || areaLower.includes('oeff') || areaLower === 'ör') {
          sheetToArea['oeffentliches_recht'] = { area: 'Öffentliches Recht', dozentName: assignment.name, dozentId: findDozentId(assignment.name) };
        }
      }

      for (let i = 1; i < wb.SheetNames.length; i++) {
        const sheetName = wb.SheetNames[i].toLowerCase().trim();
        const sheet = wb.Sheets[wb.SheetNames[i]];
        if (!sheet) continue;

        // Determine which legal area this sheet belongs to
        let areaInfo: { area: string; dozentName: string; dozentId: string | null } | null = null;
        if (sheetName.includes('zivil')) {
          areaInfo = sheetToArea['zivilrecht'] || { area: 'Zivilrecht', dozentName: '', dozentId: null };
        } else if (sheetName.includes('straf') || sheetName === 'str') {
          areaInfo = sheetToArea['strafrecht'] || { area: 'Strafrecht', dozentName: '', dozentId: null };
        } else if (sheetName.includes('ör') || sheetName.includes('öff') || sheetName.includes('oeff')) {
          areaInfo = sheetToArea['oeffentliches_recht'] || { area: 'Öffentliches Recht', dozentName: '', dozentId: null };
        }
        if (!areaInfo) continue;

        // Detect column layout from header row 5
        // Some sheets have: A=Datum, B=Thema, C=Stunden, D=Reststunden
        // Others have:       A=Datum, B=Thema, C=Note/Noten, D=Stunden, E=Reststunden
        let hoursCol = 'C';
        let gradeCol: string | null = null;
        let hoursColFound = false;
        for (let col = 0; col <= 6; col++) {
          const colLetter = String.fromCharCode(65 + col); // A, B, C, D, E, F, G
          const headerCell = sheet[`${colLetter}5`];
          if (headerCell) {
            const headerVal = String(headerCell.v || '').toLowerCase();
            if (headerVal.includes('note')) {
              gradeCol = colLetter;
            } else if (!hoursColFound && (headerVal.includes('stunden') || headerVal.includes('std')) && !headerVal.includes('rest')) {
              hoursCol = colLetter;
              hoursColFound = true;
            }
          }
        }

        // Parse lesson rows starting from row 6
        for (let row = 6; row <= 50; row++) {
          const dateCell = sheet[`A${row}`];
          const topicCell = sheet[`B${row}`];
          const hoursCell = sheet[`${hoursCol}${row}`];
          const gradeCellVal = gradeCol ? sheet[`${gradeCol}${row}`] : null;

          // Stop at "vom Dozenten" marker or empty date
          const cellAValue = dateCell ? String(dateCell.v || '') : '';
          if (cellAValue.toLowerCase().includes('vom dozenten')) break;
          if (!dateCell && !topicCell && !hoursCell) continue;
          if (!dateCell) continue;

          // Parse date
          let dateStr = '';
          if (dateCell.v instanceof Date) {
            const d = dateCell.v;
            dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else {
            const raw = String(dateCell.v || '').trim();
            // Try DD.MM.YYYY or DD.MM.YY
            const fullMatch = raw.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
            if (fullMatch) {
              const year = fullMatch[3].length === 2 ? `20${fullMatch[3]}` : fullMatch[3];
              dateStr = `${year}-${fullMatch[2].padStart(2, '0')}-${fullMatch[1].padStart(2, '0')}`;
            } else {
              // Try DD.MM. format (no year) - assume current year
              const shortMatch = raw.match(/(\d{1,2})\.(\d{1,2})\./);
              if (shortMatch) {
                const year = new Date().getFullYear();
                dateStr = `${year}-${shortMatch[2].padStart(2, '0')}-${shortMatch[1].padStart(2, '0')}`;
              }
            }
          }
          if (!dateStr) continue;

          // Parse hours
          const hours = hoursCell ? (typeof hoursCell.v === 'number' ? hoursCell.v : parseFloat(String(hoursCell.v).replace(',', '.'))) : 0;
          if (isNaN(hours) || hours <= 0) continue;

          // Parse topic
          const topic = topicCell ? String(topicCell.v || '').trim() : '';

          // Parse grade if column exists
          let grade: number | null = null;
          if (gradeCellVal && gradeCellVal.v !== undefined && gradeCellVal.v !== null && gradeCellVal.v !== '') {
            const gradeVal = typeof gradeCellVal.v === 'number' ? gradeCellVal.v : parseFloat(String(gradeCellVal.v).replace(',', '.'));
            if (!isNaN(gradeVal)) grade = gradeVal;
          }

          lessons.push({
            date: dateStr,
            topic,
            hours,
            grade,
            legal_area: areaInfo.area,
            dozent_name: areaInfo.dozentName,
            dozent_id: areaInfo.dozentId
          });
        }
      }

      console.log('Imported lessons:', lessons);
      setImportedLessons(lessons);
      if (lessons.length > 0) {
        setShowImportedLessons(true);
      }

      // Validate: check if imported hours exceed booked hours per legal area
      const importedHoursPerArea: Record<string, number> = {};
      for (const lesson of lessons) {
        importedHoursPerArea[lesson.legal_area] = (importedHoursPerArea[lesson.legal_area] || 0) + lesson.hours;
      }
      const bookedPerArea: Record<string, number | null> = {
        'Zivilrecht': hoursZivilrecht,
        'Öffentliches Recht': hoursOeffentlichesRecht,
        'Strafrecht': hoursStrafrechtVal,
      };
      const warnings: string[] = [];
      for (const [area, imported] of Object.entries(importedHoursPerArea)) {
        const booked = bookedPerArea[area];
        if (booked && imported > booked) {
          warnings.push(`${area}: ${imported} Std. geleistet, aber nur ${booked} Std. gebucht`);
        }
      }
      if (warnings.length > 0) {
        addToast(`⚠️ Stunden überschritten!\n${warnings.join('\n')}`, 'error');
      }

      // Parse contract start from filename
      let contractStart = getTodayDate();
      const fileNameMatch = file.name.match(/(\d{2})\.(\d{2})\.(\d{2,4})-(\d{2})\.(\d{2})\.(\d{2,4})/);
      if (fileNameMatch) {
        const startYear = fileNameMatch[3].length === 2 ? `20${fileNameMatch[3]}` : fileNameMatch[3];
        contractStart = `${startYear}-${fileNameMatch[2]}-${fileNameMatch[1]}`;
      }

      setFormData(prev => ({
        ...prev,
        tn_nummer: tnNummer || prev.tn_nummer,
        first_name: firstName || prev.first_name,
        middle_name: middleName || prev.middle_name,
        last_name: lastName || prev.last_name,
        email: email || prev.email,
        phone: phone || prev.phone,
        state_law: stateLaw || prev.state_law,
        booked_hours: totalHours ?? prev.booked_hours,
        contract_start: contractStart,
        contract_end: contractEnd || prev.contract_end,
        exam_date: examDate || prev.exam_date,
        legal_areas: legalAreas.length > 0 ? legalAreas : prev.legal_areas,
        dozent_zivilrecht_id: dozentZivilrechtId ?? prev.dozent_zivilrecht_id,
        dozent_strafrecht_id: dozentStrafrechtId ?? prev.dozent_strafrecht_id,
        dozent_oeffentliches_recht_id: dozentOeffentlichesRechtId ?? prev.dozent_oeffentliches_recht_id,
        hours_zivilrecht: hoursZivilrecht ?? prev.hours_zivilrecht,
        hours_strafrecht: hoursStrafrechtVal ?? prev.hours_strafrecht,
        hours_oeffentliches_recht: hoursOeffentlichesRecht ?? prev.hours_oeffentliches_recht,
        frequency_type: 'monthly',
        frequency_hours_zivilrecht: frequencyZivilrecht ?? prev.frequency_hours_zivilrecht,
        frequency_hours_strafrecht: frequencyStrafrechtVal ?? prev.frequency_hours_strafrecht,
        frequency_hours_oeffentliches_recht: frequencyOeffentlichesRecht ?? prev.frequency_hours_oeffentliches_recht,
      }));

      const unmatchedDozenten = dozentAssignments.filter(a => !findDozentId(a.name));
      if (unmatchedDozenten.length > 0) {
        addToast(`Dozenten nicht gefunden: ${unmatchedDozenten.map(d => d.name).join(', ')}. Bitte manuell zuweisen.`, 'error');
      }

      // Mark that data was imported to prevent auto-fetch from overwriting
      hasImportedData.current = true;
      
      addToast('EU-Vorblatt erfolgreich importiert', 'success');
    } catch (error) {
      console.error('Error importing Excel:', error);
      addToast('Fehler beim Importieren der Excel-Datei', 'error');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const fetchEliteKleingruppen = async () => {
      const { data, error } = await supabase
        .from('elite_kleingruppen')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (!error && data) {
        setEliteKleingruppen(data);
      }
    };
    
    fetchEliteKleingruppen();
  }, []);

  useEffect(() => {
    const fetchNextTnNummer = async () => {
      // Skip auto-fetch if data was imported from Excel
      if (hasImportedData.current) return;
      
      if (!isEditing && !teilnehmer) {
        try {
          const { data, error } = await supabase.rpc('get_next_tn_nummer');
          if (error) {
            console.error('Error fetching next TN number:', error);
            setFormData(prev => ({ ...prev, tn_nummer: 'TN0001' }));
          } else if (data) {
            setFormData(prev => ({ ...prev, tn_nummer: data }));
          } else {
            setFormData(prev => ({ ...prev, tn_nummer: 'TN0001' }));
          }
        } catch (err) {
          console.error('Exception fetching next TN number:', err);
          setFormData(prev => ({ ...prev, tn_nummer: 'TN0001' }));
        }
      }
    };
    
    fetchNextTnNummer();
  }, [isEditing, teilnehmer]);

  useEffect(() => {
    if (teilnehmer) {
      setFormData({
        tn_nummer: (teilnehmer as any).tn_nummer || '',
        first_name: teilnehmer.first_name || '',
        middle_name: (teilnehmer as any).middle_name || '',
        last_name: teilnehmer.last_name || '',
        email: teilnehmer.email || '',
        phone: (teilnehmer as any).phone || '',
        study_goal: teilnehmer.study_goal || '',
        contract_start: teilnehmer.contract_start || '',
        contract_end: teilnehmer.contract_end || '',
        booked_hours: teilnehmer.booked_hours || null,
        dozent_id: teilnehmer.dozent_id || null,
        legal_areas: teilnehmer.legal_areas || [],
        dozent_zivilrecht_id: teilnehmer.dozent_zivilrecht_id || null,
        dozent_strafrecht_id: teilnehmer.dozent_strafrecht_id || null,
        dozent_oeffentliches_recht_id: teilnehmer.dozent_oeffentliches_recht_id || null,
        exam_date: teilnehmer.exam_date || '',
        state_law: teilnehmer.state_law || '',
        referendariatsstandort: (teilnehmer as any).referendariatsstandort || '',
        street: (teilnehmer as any).street || '',
        house_number: (teilnehmer as any).house_number || '',
        postal_code: (teilnehmer as any).postal_code || '',
        city: (teilnehmer as any).city || '',
        elite_kleingruppe: typeof (teilnehmer as any).elite_kleingruppe === 'boolean' ? (teilnehmer as any).elite_kleingruppe : ((teilnehmer as any).is_elite_kleingruppe || false),
        is_elite_kleingruppe: (teilnehmer as any).is_elite_kleingruppe || false,
        elite_kleingruppe_id: (teilnehmer as any).elite_kleingruppe_id || null,
        hours_zivilrecht: (teilnehmer as any).hours_zivilrecht || null,
        hours_strafrecht: (teilnehmer as any).hours_strafrecht || null,
        hours_oeffentliches_recht: (teilnehmer as any).hours_oeffentliches_recht || null,
        frequency_type: (teilnehmer as any).frequency_type || '',
        frequency_hours_zivilrecht: (teilnehmer as any).frequency_hours_zivilrecht || null,
        frequency_hours_strafrecht: (teilnehmer as any).frequency_hours_strafrecht || null,
        frequency_hours_oeffentliches_recht: (teilnehmer as any).frequency_hours_oeffentliches_recht || null
      });
    }
  }, [teilnehmer]);

  const validateTnNummer = async (tnNummer: string): Promise<boolean> => {
    if (!tnNummer) {
      setTnNummerError('TN-Nummer ist erforderlich');
      return false;
    }

    const tnPattern = /^TN[0-9]{4,5}$/;
    if (!tnPattern.test(tnNummer)) {
      setTnNummerError('TN-Nummer muss im Format TNXXXX oder TNXXXXX sein (z.B. TN0001, TN10000)');
      return false;
    }

    if (!isEditing || tnNummer !== teilnehmer?.tn_nummer) {
      const { data, error } = await supabase
        .from('teilnehmer')
        .select('id')
        .eq('tn_nummer', tnNummer)
        .maybeSingle();

      if (error) {
        console.error('Error checking TN number:', error);
        setTnNummerError('Fehler beim Überprüfen der TN-Nummer');
        return false;
      }

      if (data) {
        setTnNummerError('Diese TN-Nummer existiert bereits');
        return false;
      }
    }

    setTnNummerError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      addToast('Bitte Vor- und Nachname eingeben', 'error');
      return;
    }

    const isTnNummerValid = await validateTnNummer(formData.tn_nummer || '');
    if (!isTnNummerValid) {
      addToast('Bitte gültige TN-Nummer eingeben', 'error');
      return;
    }

    // Validate per-subject hours don't exceed total
    if (formData.booked_hours && formData.legal_areas.length > 0) {
      const sumHours = 
        (formData.legal_areas.includes('Zivilrecht') ? (formData.hours_zivilrecht || 0) : 0) +
        (formData.legal_areas.includes('Strafrecht') ? (formData.hours_strafrecht || 0) : 0) +
        (formData.legal_areas.includes('Öffentliches Recht') ? (formData.hours_oeffentliches_recht || 0) : 0);
      if (sumHours > formData.booked_hours) {
        addToast(`Die Summe der Stunden pro Rechtsgebiet (${sumHours}) übersteigt das gebuchte Stundenpaket (${formData.booked_hours})`, 'error');
        return;
      }
    }

    setIsLoading(true);

    try {
      const fullName = `${formData.first_name.trim()} ${formData.last_name.trim()}`;

      // Check for duplicate names (only when creating new user)
      const isEditing = !!teilnehmer?.id;
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

      // Use selected dozent from dropdown, or any of the legal area dozents as fallback
      // Elite-Kleingruppe participants don't need a dozent assigned here
      const dozentId = formData.dozent_id || 
                       formData.dozent_zivilrecht_id || 
                       formData.dozent_strafrecht_id || 
                       formData.dozent_oeffentliches_recht_id;
      
      if (!dozentId && !formData.elite_kleingruppe) {
        addToast('Bitte mindestens einen Dozenten zuweisen', 'error');
        setIsLoading(false);
        return;
      }
      
      const dataToSave = {
        tn_nummer: formData.tn_nummer?.trim() || null,
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name?.trim() || null,
        last_name: formData.last_name.trim(),
        name: fullName,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        study_goal: formData.study_goal.trim() || null,
        contract_start: formData.contract_start || null,
        contract_end: formData.contract_end || null,
        booked_hours: formData.booked_hours || null,
        dozent_id: dozentId || null,
        legal_areas: formData.legal_areas.length > 0 ? formData.legal_areas : null,
        dozent_zivilrecht_id: formData.dozent_zivilrecht_id || null,
        dozent_strafrecht_id: formData.dozent_strafrecht_id || null,
        dozent_oeffentliches_recht_id: formData.dozent_oeffentliches_recht_id || null,
        exam_date: formData.exam_date || null,
        state_law: formData.state_law || null,
        street: formData.street.trim() || null,
        house_number: formData.house_number.trim() || null,
        postal_code: formData.postal_code.trim() || null,
        city: formData.city.trim() || null,
        elite_kleingruppe: typeof formData.elite_kleingruppe === 'boolean' ? formData.elite_kleingruppe : (formData.is_elite_kleingruppe || false),
        is_elite_kleingruppe: formData.is_elite_kleingruppe || false,
        elite_kleingruppe_id: formData.is_elite_kleingruppe ? (formData.elite_kleingruppe_id || null) : null,
        hours_zivilrecht: formData.legal_areas.includes('Zivilrecht') ? (formData.hours_zivilrecht || null) : null,
        hours_strafrecht: formData.legal_areas.includes('Strafrecht') ? (formData.hours_strafrecht || null) : null,
        hours_oeffentliches_recht: formData.legal_areas.includes('Öffentliches Recht') ? (formData.hours_oeffentliches_recht || null) : null,
        frequency_type: formData.frequency_type || null,
        frequency_hours_zivilrecht: formData.legal_areas.includes('Zivilrecht') ? (formData.frequency_hours_zivilrecht || null) : null,
        frequency_hours_strafrecht: formData.legal_areas.includes('Strafrecht') ? (formData.frequency_hours_strafrecht || null) : null,
        frequency_hours_oeffentliches_recht: formData.legal_areas.includes('Öffentliches Recht') ? (formData.frequency_hours_oeffentliches_recht || null) : null,
        updated_at: new Date().toISOString()
      };

      let savedTeilnehmerId: string | null = null;

      if (isEditing && teilnehmer?.id) {
        const { error } = await supabase
          .from('teilnehmer')
          .update(dataToSave)
          .eq('id', teilnehmer.id);

        if (error) throw error;
        savedTeilnehmerId = teilnehmer.id;
        addToast('Teilnehmer wurde aktualisiert', 'success');
      } else {
        // For Elite-Kleingruppe participants, create user account first
        if (formData.is_elite_kleingruppe && formData.email && formData.elite_kleingruppe_id) {
          console.log('Creating Elite-Kleingruppe user account...');
          
          // Get elite kleingruppe name
          const { data: kleingruppe } = await supabase
            .from('elite_kleingruppen')
            .select('name')
            .eq('id', formData.elite_kleingruppe_id)
            .single();
          
          if (kleingruppe) {
            // Call create-user edge function
            const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
            const response = await fetch(edgeFunctionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                email: formData.email,
                fullName: fullName,
                role: 'teilnehmer',
                eliteKleingruppe: kleingruppe.name
              }),
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
              console.log('User account created successfully');
              
              // Update teilnehmer entry with full data
              const { error: updateError } = await supabase
                .from('teilnehmer')
                .update(dataToSave)
                .eq('email', formData.email);
              
              if (updateError) {
                console.error('Error updating teilnehmer data:', updateError);
                addToast('Benutzer erstellt, aber einige Daten konnten nicht gespeichert werden', 'error');
              } else {
                // Get the created teilnehmer ID
                const { data: createdTn } = await supabase
                  .from('teilnehmer')
                  .select('id')
                  .eq('email', formData.email)
                  .maybeSingle();
                savedTeilnehmerId = createdTn?.id || null;
                addToast('Elite-Teilnehmer wurde erfolgreich erstellt und Einladungs-E-Mail wurde gesendet', 'success');
              }
            } else {
              throw new Error(result.error || 'Fehler beim Erstellen des User-Accounts');
            }
          }
        } else {
          // Regular teilnehmer without user account
          const newId = crypto.randomUUID();
          const { error } = await supabase
            .from('teilnehmer')
            .insert({
              ...dataToSave,
              id: newId,
              created_at: new Date().toISOString()
            });

          if (error) throw error;
          savedTeilnehmerId = newId;
          addToast('Teilnehmer wurde hinzugefügt', 'success');
        }
      }

      // Insert imported lessons into participant_hours
      if (importedLessons.length > 0 && savedTeilnehmerId) {
        const hoursToInsert = importedLessons
          .map(lesson => {
            // Use manually assigned dozent ID from form, fallback to parsed dozent ID from EU-Vorblatt
            let dozentId = lesson.dozent_id;
            if (lesson.legal_area === 'Zivilrecht' && formData.dozent_zivilrecht_id) {
              dozentId = formData.dozent_zivilrecht_id;
            } else if (lesson.legal_area === 'Strafrecht' && formData.dozent_strafrecht_id) {
              dozentId = formData.dozent_strafrecht_id;
            } else if (lesson.legal_area === 'Öffentliches Recht' && formData.dozent_oeffentliches_recht_id) {
              dozentId = formData.dozent_oeffentliches_recht_id;
            }
            return { ...lesson, dozent_id: dozentId };
          })
          .filter(lesson => lesson.dozent_id) // Only insert lessons with matched dozent
          .map(lesson => ({
            teilnehmer_id: savedTeilnehmerId!,
            dozent_id: lesson.dozent_id!,
            hours: lesson.hours,
            date: lesson.date,
            description: lesson.topic + (lesson.grade !== null ? ` (Note: ${lesson.grade})` : ''),
            legal_area: lesson.legal_area
          }));

        if (hoursToInsert.length > 0) {
          const { error: hoursError } = await supabase
            .from('participant_hours')
            .insert(hoursToInsert);

          if (hoursError) {
            console.error('Error inserting imported hours:', hoursError);
            addToast(`Teilnehmer gespeichert, aber ${hoursToInsert.length} Stunden konnten nicht importiert werden: ${hoursError.message}`, 'error');
          } else {
            addToast(`${hoursToInsert.length} Einheiten wurden in die Tätigkeitsberichte übertragen`, 'success');
          }
        }

        // Warn about unmatched dozent lessons
        const unmatchedLessons = importedLessons.filter(l => !l.dozent_id);
        if (unmatchedLessons.length > 0) {
          addToast(`${unmatchedLessons.length} Einheiten konnten nicht übertragen werden (Dozent nicht zugeordnet)`, 'error');
        }
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving teilnehmer:', error);
      addToast('Fehler beim Speichern des Teilnehmers', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <UserPlus className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Teilnehmer bearbeiten' : 'Neuen Teilnehmer hinzufügen'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1 text-gray-400 hover:text-primary rounded transition-colors"
              title="EU-Vorblatt importieren"
            >
              <Upload className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* TN-Nummer Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              TN-Nummer *
            </label>
            <input
              type="text"
              value={formData.tn_nummer || ''}
              onChange={async (e) => {
                const value = e.target.value.toUpperCase();
                setFormData({ ...formData, tn_nummer: value });
                if (value) {
                  await validateTnNummer(value);
                } else {
                  setTnNummerError('');
                }
              }}
              onBlur={() => {
                if (formData.tn_nummer) {
                  validateTnNummer(formData.tn_nummer);
                }
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                tnNummerError 
                  ? 'border-red-300 focus:ring-red-500' 
                  : 'border-gray-300 focus:ring-primary'
              }`}
              placeholder="TN00001"
              required
              maxLength={7}
              pattern="TN[0-9]{4,5}"
            />
            {tnNummerError && (
              <p className="mt-1 text-sm text-red-600">{tnNummerError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Format: TNXXXX oder TNXXXXX (z.B. TN0001, TN10000)
            </p>
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vorname *
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Max"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zweitname
              </label>
              <input
                type="text"
                value={formData.middle_name || ''}
                onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Maria"
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
                placeholder="Mustermann"
                required
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-Mail-Adresse
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="max.mustermann@email.de"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefon
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="+49 123 456789"
              />
            </div>
          </div>

          {/* Address */}
          <div className="border-t pt-4 mt-2">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              Adressdaten
            </h4>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Straße</label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="Musterstraße"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hausnr.</label>
                <input
                  type="text"
                  value={formData.house_number}
                  onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="12a"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">PLZ</label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="12345"
                  maxLength={5}
                />
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Stadt</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="Musterstadt"
                />
              </div>
            </div>
          </div>

          {/* Study Goal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Studienziel
            </label>
            <select
              value={formData.study_goal}
              onChange={(e) => setFormData({ ...formData, study_goal: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Bitte auswählen</option>
              <option value="Grundstudium">Grundstudium</option>
              <option value="Hauptstudium">Hauptstudium</option>
              <option value="1. Staatsexamen Erstversuch">1. Staatsexamen Erstversuch</option>
              <option value="1. Staatsexamen Verbesserungsversuch">1. Staatsexamen Verbesserungsversuch</option>
              <option value="1. Staatsexamen Letztversuch">1. Staatsexamen Letztversuch</option>
              <option value="2. Staatsexamen Erstversuch">2. Staatsexamen Erstversuch</option>
              <option value="2. Staatsexamen Verbesserungsversuch">2. Staatsexamen Verbesserungsversuch</option>
              <option value="2. Staatsexamen Letztversuch">2. Staatsexamen Letztversuch</option>
            </select>
          </div>

          {/* Exam Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prüfungstermin
            </label>
            <input
              type="date"
              value={formData.exam_date}
              onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* State Law */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Landesrecht
            </label>
            <select
              value={formData.state_law}
              onChange={(e) => setFormData({ ...formData, state_law: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Bitte auswählen</option>
              {GERMAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          {/* Referendariatsstandort - Only shown for 2. Staatsexamen */}
          {formData.study_goal?.includes('2. Staatsexamen') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referendariatsstandort
              </label>
              <select
                value={formData.referendariatsstandort}
                onChange={(e) => setFormData({ ...formData, referendariatsstandort: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Bitte auswählen</option>
                <option value="Stuttgart">Stuttgart</option>
                <option value="Karlsruhe">Karlsruhe</option>
                <option value="München">München</option>
                <option value="Nürnberg">Nürnberg</option>
                <option value="Bamberg">Bamberg</option>
                <option value="Berlin (Kammergericht)">Berlin (Kammergericht)</option>
                <option value="Brandenburg">Brandenburg</option>
                <option value="Bremen">Bremen</option>
                <option value="Hamburg">Hamburg</option>
                <option value="Frankfurt am Main">Frankfurt am Main</option>
                <option value="Mecklenburg-Vorpommern">Mecklenburg-Vorpommern</option>
                <option value="Rostock">Rostock</option>
                <option value="Celle">Celle</option>
                <option value="Oldenburg">Oldenburg</option>
                <option value="Braunschweig">Braunschweig</option>
                <option value="Düsseldorf">Düsseldorf</option>
                <option value="Hamm">Hamm</option>
                <option value="Köln">Köln</option>
                <option value="Koblenz">Koblenz</option>
                <option value="Zweibrücken">Zweibrücken</option>
                <option value="Saarbrücken">Saarbrücken</option>
                <option value="Dresden">Dresden</option>
                <option value="Naumburg">Naumburg</option>
                <option value="Schleswig">Schleswig</option>
                <option value="Jena">Jena</option>
              </select>
            </div>
          )}

          {/* Elite-Kleingruppe Section */}
          <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_elite_kleingruppe || false}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setFormData({ 
                    ...formData, 
                    is_elite_kleingruppe: isChecked,
                    elite_kleingruppe: isChecked,
                    elite_kleingruppe_id: isChecked ? formData.elite_kleingruppe_id : null
                  });
                }}
                className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">Elite-Kleingruppe Teilnehmer</span>
            </label>
            
            {formData.is_elite_kleingruppe && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Elite-Kleingruppe zuordnen
                </label>
                <select
                  value={formData.elite_kleingruppe_id || ''}
                  onChange={(e) => setFormData({ ...formData, elite_kleingruppe_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                  required={formData.is_elite_kleingruppe}
                >
                  <option value="">Bitte wählen...</option>
                  {eliteKleingruppen.map((gruppe) => (
                    <option key={gruppe.id} value={gruppe.id}>
                      {gruppe.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, legal_areas: [...formData.legal_areas, area] });
                      } else {
                        setFormData({ ...formData, legal_areas: formData.legal_areas.filter(a => a !== area) });
                      }
                    }}
                    className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-gray-700">{area}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Per-Subject Hours - shown when booked_hours is set and legal areas are selected */}
          {formData.booked_hours && formData.legal_areas.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-blue-800">
                  Stundenverteilung pro Rechtsgebiet
                </label>
                <span className={`text-xs font-medium ${
                  (() => {
                    const sum = 
                      (formData.legal_areas.includes('Zivilrecht') ? (formData.hours_zivilrecht || 0) : 0) +
                      (formData.legal_areas.includes('Strafrecht') ? (formData.hours_strafrecht || 0) : 0) +
                      (formData.legal_areas.includes('Öffentliches Recht') ? (formData.hours_oeffentliches_recht || 0) : 0);
                    return sum > formData.booked_hours! ? 'text-red-600' : sum === formData.booked_hours! ? 'text-green-600' : 'text-blue-600';
                  })()
                }`}>
                  {(
                    (formData.legal_areas.includes('Zivilrecht') ? (formData.hours_zivilrecht || 0) : 0) +
                    (formData.legal_areas.includes('Strafrecht') ? (formData.hours_strafrecht || 0) : 0) +
                    (formData.legal_areas.includes('Öffentliches Recht') ? (formData.hours_oeffentliches_recht || 0) : 0)
                  )} / {formData.booked_hours} Std. verteilt
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {formData.legal_areas.includes('Zivilrecht') && (
                  <div>
                    <label className="block text-xs text-blue-700 mb-1">Zivilrecht</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        max={formData.booked_hours || undefined}
                        value={formData.hours_zivilrecht ?? ''}
                        onChange={(e) => setFormData({ ...formData, hours_zivilrecht: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        placeholder="Std."
                      />
                    </div>
                  </div>
                )}
                {formData.legal_areas.includes('Strafrecht') && (
                  <div>
                    <label className="block text-xs text-blue-700 mb-1">Strafrecht</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        max={formData.booked_hours || undefined}
                        value={formData.hours_strafrecht ?? ''}
                        onChange={(e) => setFormData({ ...formData, hours_strafrecht: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        placeholder="Std."
                      />
                    </div>
                  </div>
                )}
                {formData.legal_areas.includes('Öffentliches Recht') && (
                  <div>
                    <label className="block text-xs text-blue-700 mb-1">Öff. Recht</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        max={formData.booked_hours || undefined}
                        value={formData.hours_oeffentliches_recht ?? ''}
                        onChange={(e) => setFormData({ ...formData, hours_oeffentliches_recht: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        placeholder="Std."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Frequency Hours per Subject - shown when legal areas are selected */}
          {formData.legal_areas.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-md p-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-purple-800">
                  Regelmäßige Stunden pro Rechtsgebiet
                </label>
                <select
                  value={formData.frequency_type}
                  onChange={(e) => setFormData({ ...formData, frequency_type: e.target.value })}
                  className="text-xs border border-purple-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Bitte wählen</option>
                  <option value="weekly">Wochenstunden</option>
                  <option value="monthly">Monatsstunden</option>
                </select>
              </div>
              {formData.frequency_type && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {formData.legal_areas.includes('Zivilrecht') && (
                    <div>
                      <label className="block text-xs text-purple-700 mb-1">Zivilrecht</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.frequency_hours_zivilrecht ?? ''}
                        onChange={(e) => setFormData({ ...formData, frequency_hours_zivilrecht: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white"
                        placeholder={formData.frequency_type === 'weekly' ? 'Std./Woche' : 'Std./Monat'}
                      />
                    </div>
                  )}
                  {formData.legal_areas.includes('Strafrecht') && (
                    <div>
                      <label className="block text-xs text-purple-700 mb-1">Strafrecht</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.frequency_hours_strafrecht ?? ''}
                        onChange={(e) => setFormData({ ...formData, frequency_hours_strafrecht: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white"
                        placeholder={formData.frequency_type === 'weekly' ? 'Std./Woche' : 'Std./Monat'}
                      />
                    </div>
                  )}
                  {formData.legal_areas.includes('Öffentliches Recht') && (
                    <div>
                      <label className="block text-xs text-purple-700 mb-1">Öff. Recht</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.frequency_hours_oeffentliches_recht ?? ''}
                        onChange={(e) => setFormData({ ...formData, frequency_hours_oeffentliches_recht: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white"
                        placeholder={formData.frequency_type === 'weekly' ? 'Std./Woche' : 'Std./Monat'}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Contract Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vertragslaufzeit
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Von</label>
                <input
                  type="date"
                  value={formData.contract_start}
                  onChange={(e) => setFormData({ ...formData, contract_start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bis</label>
                <input
                  type="date"
                  value={formData.contract_end}
                  onChange={(e) => setFormData({ ...formData, contract_end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Booked Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gebuchtes Stundenpaket
            </label>
            <input
              type="number"
              min="0"
              step="0.25"
              value={formData.booked_hours ?? ''}
              onChange={(e) => setFormData({ ...formData, booked_hours: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Stundenanzahl"
            />
          </div>

          {/* Dynamic Dozent Assignment based on selected legal areas - hidden for Elite-Kleingruppe */}
          {formData.legal_areas.length > 0 && !formData.elite_kleingruppe && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Dozenten nach Rechtsgebiet
              </label>
              
              {formData.legal_areas.includes('Zivilrecht') && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dozent Zivilrecht</label>
                  <select
                    value={formData.dozent_zivilrecht_id || ''}
                    onChange={(e) => setFormData({ ...formData, dozent_zivilrecht_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Kein Dozent zugewiesen</option>
                    {dozenten.filter(d => d.legal_areas?.includes('Zivilrecht')).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.legal_areas.includes('Strafrecht') && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dozent Strafrecht</label>
                  <select
                    value={formData.dozent_strafrecht_id || ''}
                    onChange={(e) => setFormData({ ...formData, dozent_strafrecht_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Kein Dozent zugewiesen</option>
                    {dozenten.filter(d => d.legal_areas?.includes('Strafrecht')).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.legal_areas.includes('Öffentliches Recht') && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dozent Öffentliches Recht</label>
                  <select
                    value={formData.dozent_oeffentliches_recht_id || ''}
                    onChange={(e) => setFormData({ ...formData, dozent_oeffentliches_recht_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Kein Dozent zugewiesen</option>
                    {dozenten.filter(d => d.legal_areas?.includes('Öffentliches Recht')).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Imported Lessons Preview */}
          {importedLessons.length > 0 && (
            <div className="border border-blue-200 rounded-lg bg-blue-50/50">
              <button
                type="button"
                onClick={() => setShowImportedLessons(!showImportedLessons)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-blue-100/50 rounded-t-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Importierte Einheiten ({importedLessons.length})
                  </span>
                  <span className="text-xs text-blue-600">
                    {importedLessons.reduce((sum, l) => sum + l.hours, 0)} Std. gesamt
                  </span>
                </div>
                {showImportedLessons ? (
                  <ChevronUp className="h-4 w-4 text-blue-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-blue-600" />
                )}
              </button>
              
              {showImportedLessons && (
                <div className="px-3 pb-3 space-y-3">
                  {/* Group by legal area */}
                  {['Zivilrecht', 'Strafrecht', 'Öffentliches Recht'].map(area => {
                    const areaLessons = importedLessons.filter(l => l.legal_area === area);
                    if (areaLessons.length === 0) return null;
                    
                    // Determine which dozent will be used: manual assignment takes priority
                    let dozentId = areaLessons[0].dozent_id;
                    let dozentName = areaLessons[0].dozent_name;
                    if (area === 'Zivilrecht' && formData.dozent_zivilrecht_id) {
                      dozentId = formData.dozent_zivilrecht_id;
                      const manualDozent = dozenten.find(d => d.id === formData.dozent_zivilrecht_id);
                      if (manualDozent) dozentName = manualDozent.full_name;
                    } else if (area === 'Strafrecht' && formData.dozent_strafrecht_id) {
                      dozentId = formData.dozent_strafrecht_id;
                      const manualDozent = dozenten.find(d => d.id === formData.dozent_strafrecht_id);
                      if (manualDozent) dozentName = manualDozent.full_name;
                    } else if (area === 'Öffentliches Recht' && formData.dozent_oeffentliches_recht_id) {
                      dozentId = formData.dozent_oeffentliches_recht_id;
                      const manualDozent = dozenten.find(d => d.id === formData.dozent_oeffentliches_recht_id);
                      if (manualDozent) dozentName = manualDozent.full_name;
                    }
                    const dozentMatched = dozentId !== null;
                    const totalHoursArea = areaLessons.reduce((sum, l) => sum + l.hours, 0);
                    
                    return (
                      <div key={area} className="bg-white rounded-md border border-gray-200 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              area === 'Zivilrecht' ? 'bg-blue-100 text-blue-800' :
                              area === 'Strafrecht' ? 'bg-red-100 text-red-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {area}
                            </span>
                            <span className="text-xs text-gray-500">
                              {dozentName}
                              {!dozentMatched && dozentName && (
                                <span className="text-amber-600 ml-1">(nicht zugeordnet)</span>
                              )}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-gray-700">{totalHoursArea} Std.</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {areaLessons.map((lesson, idx) => (
                            <div key={idx} className="flex items-center justify-between px-3 py-1.5 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <Calendar className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-600 flex-shrink-0">
                                  {new Date(lesson.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                </span>
                                <span className="text-gray-900 truncate">{lesson.topic}</span>
                                {lesson.grade !== null && (
                                  <span className="text-gray-500 flex-shrink-0">Note: {lesson.grade}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                <Clock className="h-3 w-3 text-gray-400" />
                                <span className="font-medium text-gray-700">{lesson.hours} Std.</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-blue-600 italic">
                    Diese Einheiten werden beim Speichern in die Tätigkeitsberichte der Dozenten übertragen.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4 border-t">
            <div className="flex gap-3">
              {teilnehmer && !teilnehmer.user_id && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full sm:w-auto px-4 py-2 text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors flex items-center justify-center border border-red-200"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </button>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
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
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Teilnehmer löschen?
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Möchten Sie {formData.first_name} {formData.last_name} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
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
                          if (teilnehmer && onDelete) {
                            onDelete(teilnehmer);
                            setShowDeleteConfirm(false);
                          }
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
