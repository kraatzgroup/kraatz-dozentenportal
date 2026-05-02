import { useState, useEffect, useRef } from 'react';
import { X, Save, UserPlus, User, MapPin, Trash2, AlertTriangle, Upload, Calendar, Clock, BookOpen, ChevronDown, ChevronUp, FileText, FileText as FileContract, Edit2, Gift, Plus } from 'lucide-react';
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
  gender?: string;
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
  const [activeTab, setActiveTab] = useState<'stammdaten' | 'dozenten' | 'vertraege' | 'notizen'>('stammdaten');
  const [contracts, setContracts] = useState<any[]>([]);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(null);
  const [contractPackages, setContractPackages] = useState<any[]>([]);
  const [aggregatedLegalAreaHours, setAggregatedLegalAreaHours] = useState<{
    zivilrecht: number;
    strafrecht: number;
    oeffentliches_recht: number;
    sonstiges: number;
  }>({ zivilrecht: 0, strafrecht: 0, oeffentliches_recht: 0, sonstiges: 0 });
  const [usedLegalAreaHours, setUsedLegalAreaHours] = useState<Record<string, number>>({
    zivilrecht: 0, strafrecht: 0, oeffentliches_recht: 0, sonstiges: 0,
  });
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [freeHours, setFreeHours] = useState<any[]>([]);
  const [showFreeHourDialog, setShowFreeHourDialog] = useState(false);
  const [editingFreeHour, setEditingFreeHour] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  } | null>(null);
  const [newContractForm, setNewContractForm] = useState<{
    start_date: string;
    end_date: string;
    legal_areas: { zivilrecht: number; strafrecht: number; oeffentliches_recht: number };
    frequency_type: string;
    frequency_hours: { zivilrecht: number | null; strafrecht: number | null; oeffentliches_recht: number | null };
  }>({
    start_date: '',
    end_date: '',
    legal_areas: { zivilrecht: 0, strafrecht: 0, oeffentliches_recht: 0 },
    frequency_type: 'monthly',
    frequency_hours: { zivilrecht: null, strafrecht: null, oeffentliches_recht: null },
  });

  const tabs = [
    { id: 'stammdaten' as const, label: 'Stammdaten', icon: UserPlus },
    { id: 'dozenten' as const, label: 'Dozenten', icon: User },
    { id: 'vertraege' as const, label: 'Verträge', icon: FileContract },
    { id: 'notizen' as const, label: 'Notizen', icon: FileText },
  ];
  
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
    gender: '',
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
        gender: (teilnehmer as any).gender || '',
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

  useEffect(() => {
    const fetchContracts = async () => {
      if (teilnehmer?.id) {
        const { data, error } = await supabase
          .from('contracts')
          .select('*, contract_packages(*)')
          .eq('teilnehmer_id', teilnehmer.id)
          .order('created_at', { ascending: true });

        if (!error && data) {
          // Sort by: oldest first, then most hours remaining first
          const sorted = [...data].sort((a, b) => {
            const aRemaining = (a.total_hours || 0) - (a.calculated_hours || 0);
            const bRemaining = (b.total_hours || 0) - (b.calculated_hours || 0);
            // Primary: created_at ascending (oldest first)
            // Secondary: remaining hours descending (most hours left first)
            if (aRemaining !== bRemaining) {
              return bRemaining - aRemaining;
            }
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          setContracts(sorted);

          // Fetch aggregated legal area hours for all contracts
          if (sorted.length > 0) {
            const contractIds = sorted.map(c => c.id);
            const { data: packages, error: packagesError } = await supabase
              .from('contract_packages')
              .select('id, contract_package_legal_areas (legal_area, hours)')
              .in('contract_id', contractIds);

            if (!packagesError && packages) {
              const aggregated = {
                zivilrecht: 0,
                strafrecht: 0,
                oeffentliches_recht: 0,
                sonstiges: 0
              };

              packages.forEach(pkg => {
                if (pkg.contract_package_legal_areas) {
                  pkg.contract_package_legal_areas.forEach((la: any) => {
                    if (aggregated[la.legal_area] !== undefined) {
                      aggregated[la.legal_area] += la.hours || 0;
                    }
                  });
                }
              });

              setAggregatedLegalAreaHours(aggregated);
            }

            // Fetch all free_hours for all contracts of this teilnehmer
            const { data: allFreeHours, error: fhError } = await supabase
              .from('free_hours')
              .select('*')
              .in('contract_id', contractIds)
              .order('created_at', { ascending: false });
            if (!fhError && allFreeHours) {
              setFreeHours(allFreeHours);
            }

            // Fetch participant_hours and aggregate used per legal area
            const { data: phData } = await supabase
              .from('participant_hours')
              .select('hours, legal_area')
              .eq('teilnehmer_id', teilnehmer.id);
            if (phData) {
              const used: Record<string, number> = { zivilrecht: 0, strafrecht: 0, oeffentliches_recht: 0, sonstiges: 0 };
              const normalize = (la: string | null): string | null => {
                if (!la) return null;
                const l = la.toLowerCase().replace(/ö/g, 'oe').replace(/ /g, '_');
                if (['zivilrecht', 'strafrecht', 'oeffentliches_recht', 'sonstiges'].includes(l)) return l;
                return null;
              };
              phData.forEach((row: any) => {
                const k = normalize(row.legal_area);
                if (k) used[k] += Number(row.hours) || 0;
              });
              setUsedLegalAreaHours(used);
            }
          }
        }
      }
    };
    
    fetchContracts();
  }, [teilnehmer?.id]);

  const fetchContractPackages = async (contractId: string) => {
    const { data, error } = await supabase
      .from('contract_packages')
      .select(`
        *,
        packages (*),
        contract_package_legal_areas (*)
      `)
      .eq('contract_id', contractId);
    
    if (!error && data) {
      setContractPackages(data);
    }

    // Refresh all free hours for this teilnehmer
    await refreshAllFreeHours();

    // Also refresh contract data so hours are live-updated in the modal
    const { data: refreshedContract } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();
    if (refreshedContract) {
      setEditingContract((prev: any) => (prev && prev.id === contractId ? { ...prev, ...refreshedContract } : prev));
    }
  };

  const refreshAllFreeHours = async () => {
    if (!contracts.length) {
      setFreeHours([]);
      return;
    }
    const contractIds = contracts.map((c: any) => c.id);
    const { data, error } = await supabase
      .from('free_hours')
      .select('*')
      .in('contract_id', contractIds)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setFreeHours(data);
    }
  };

  const saveFreeHour = async () => {
    if (!editingFreeHour) return;
    const contractId = editingFreeHour.contract_id || editingContract?.id || contracts[0]?.id;
    if (!contractId) {
      addToast('Kein Vertrag verfügbar – Freistunden können nur Verträgen zugewiesen werden', 'error');
      return;
    }
    const payload = {
      contract_id: contractId,
      hours: parseFloat(editingFreeHour.hours) || 0,
      reason: editingFreeHour.reason || '',
      legal_area: editingFreeHour.legal_area || null,
    };
    if (!payload.hours || payload.hours <= 0) {
      addToast('Bitte gültige Stundenzahl eingeben', 'error');
      return;
    }
    if (!payload.reason.trim()) {
      addToast('Bitte Begründung eingeben', 'error');
      return;
    }
    if (!payload.legal_area) {
      addToast('Bitte Rechtsgebiet auswählen', 'error');
      return;
    }
    try {
      if (editingFreeHour.id) {
        const { error } = await supabase
          .from('free_hours')
          .update(payload)
          .eq('id', editingFreeHour.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('free_hours')
          .insert(payload);
        if (error) throw error;
      }
      setShowFreeHourDialog(false);
      setEditingFreeHour(null);
      await refreshAllFreeHours();
      addToast('Freistunden gespeichert', 'success');
    } catch (err: any) {
      console.error('Error saving free hours:', err);
      addToast('Fehler beim Speichern der Freistunden', 'error');
    }
  };

  const deleteFreeHour = async (id: string) => {
    try {
      const { error } = await supabase.from('free_hours').delete().eq('id', id);
      if (error) throw error;
      await refreshAllFreeHours();
      addToast('Freistunden gelöscht', 'success');
    } catch (err) {
      console.error('Error deleting free hours:', err);
      addToast('Fehler beim Löschen', 'error');
    }
  };

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
        gender: formData.gender || null,
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
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
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

        {/* Tab Navigation */}
        <div className="flex border-b bg-gray-50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary bg-white'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Stammdaten Tab */}
            {activeTab === 'stammdaten' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
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
                  <div className="grid grid-cols-3 gap-3">
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

                  {/* Gender Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Geschlecht
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="männlich"
                          checked={formData.gender === 'männlich'}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                        />
                        <span className="ml-2 text-sm text-gray-700">Männlich</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="weiblich"
                          checked={formData.gender === 'weiblich'}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                        />
                        <span className="ml-2 text-sm text-gray-700">Weiblich</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="divers"
                          checked={formData.gender === 'divers'}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                        />
                        <span className="ml-2 text-sm text-gray-700">Divers</span>
                      </label>
                    </div>
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-2 gap-3">
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
                </div>

                {/* Right Column */}
                <div className="space-y-4">
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
                </div>
              </div>
            )}

            {/* Dozenten Tab */}
            {activeTab === 'dozenten' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Dozenten-Zuweisungen</h3>
                  <p className="text-sm text-gray-500 mb-6">Weisen Sie für jedes Rechtsgebiet einen Dozenten zu.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Zivilrecht Dozent */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Zivilrecht
                      </label>
                      <select
                        value={formData.dozent_zivilrecht_id || ''}
                        onChange={(e) => setFormData({ ...formData, dozent_zivilrecht_id: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">-- Kein Dozent --</option>
                        {dozenten?.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Strafrecht Dozent */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Strafrecht
                      </label>
                      <select
                        value={formData.dozent_strafrecht_id || ''}
                        onChange={(e) => setFormData({ ...formData, dozent_strafrecht_id: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">-- Kein Dozent --</option>
                        {dozenten?.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Öffentliches Recht Dozent */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Öffentliches Recht
                      </label>
                      <select
                        value={formData.dozent_oeffentliches_recht_id || ''}
                        onChange={(e) => setFormData({ ...formData, dozent_oeffentliches_recht_id: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">-- Kein Dozent --</option>
                        {dozenten?.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Assigned Dozenten Summary */}
                {(formData.dozent_zivilrecht_id || formData.dozent_strafrecht_id || formData.dozent_oeffentliches_recht_id) && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Aktuelle Zuweisungen</h4>
                    <div className="space-y-2">
                      {formData.dozent_zivilrecht_id && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Zivilrecht:</span>
                          <span className="font-medium text-gray-900">
                            {dozenten?.find(d => d.id === formData.dozent_zivilrecht_id)?.full_name || '-'}
                          </span>
                        </div>
                      )}
                      {formData.dozent_strafrecht_id && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Strafrecht:</span>
                          <span className="font-medium text-gray-900">
                            {dozenten?.find(d => d.id === formData.dozent_strafrecht_id)?.full_name || '-'}
                          </span>
                        </div>
                      )}
                      {formData.dozent_oeffentliches_recht_id && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Öffentliches Recht:</span>
                          <span className="font-medium text-gray-900">
                            {dozenten?.find(d => d.id === formData.dozent_oeffentliches_recht_id)?.full_name || '-'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Verträge Tab */}
            {activeTab === 'vertraege' && (
              <div className="space-y-4">
                {/* Summary Section */}
                {contracts.length > 0 && (() => {
                  const earliestStart = contracts.reduce((min, c) => {
                    const d = new Date(c.start_date);
                    return d < min ? d : min;
                  }, new Date(contracts[0].start_date));
                  const latestEnd = contracts.reduce((max, c) => {
                    if (!c.end_date) return max;
                    const d = new Date(c.end_date);
                    return d > max ? d : max;
                  }, contracts[0].end_date ? new Date(contracts[0].end_date) : new Date());

                  const totalFreeHoursUsed = freeHours.reduce((s, fh) => s + (parseFloat(fh.hours_used) || 0), 0);
                  const totalHoursUsed = contracts.reduce((sum, c) => {
                    const packageUsed = c.contract_packages?.reduce((pkgSum: number, pkg: any) => pkgSum + (pkg.hours_used || 0), 0) || 0;
                    return sum + packageUsed;
                  }, 0) + totalFreeHoursUsed;
                  const totalFreeHours = freeHours.reduce((s, fh) => s + (parseFloat(fh.hours) || 0), 0);
                  const totalHoursBooked = contracts.reduce((sum, c) => {
                    const packageTotal = c.contract_packages?.reduce((pkgSum: number, pkg: any) => pkgSum + (pkg.hours_total || 0), 0) || c.total_hours || 0;
                    return sum + packageTotal;
                  }, 0) + totalFreeHours;

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const totalDuration = latestEnd.getTime() - earliestStart.getTime();
                  const elapsed = today.getTime() - earliestStart.getTime();
                  const progress = totalDuration ? Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100) : 0;

                  return (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                      <div>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Laufzeit ({earliestStart.toLocaleDateString('de-DE')} - {latestEnd.toLocaleDateString('de-DE')})</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Stunden</span>
                        <span className="text-sm font-medium text-gray-900">{totalHoursUsed} / {totalHoursBooked} Std.</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { key: 'zivilrecht', label: 'Zivilrecht' },
                          { key: 'strafrecht', label: 'Strafrecht' },
                          { key: 'oeffentliches_recht', label: 'öffentliches Recht' },
                        ].map(({ key, label }) => {
                          const freeForArea = freeHours.reduce((s, fh) => s + (fh.legal_area === key ? (parseFloat(fh.hours) || 0) : 0), 0);
                          const totalForArea = ((aggregatedLegalAreaHours as any)[key] || 0) + freeForArea;
                          const usedForArea = usedLegalAreaHours[key] || 0;
                          return (
                            <div key={key} className="bg-white rounded p-2 text-center">
                              <span className="text-xs text-gray-600 block">{label}</span>
                              <span className="text-sm font-medium text-gray-900">
                                {usedForArea} / {totalForArea} Std.
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Freistunden Block */}
                      <div className="border-t border-gray-200 pt-3 space-y-3">
                        {(() => {
                          const breakdown = freeHours.reduce((acc: Record<string, { used: number; total: number }>, fh) => {
                            const key = fh.legal_area;
                            if (!key) return acc;
                            if (!acc[key]) acc[key] = { used: 0, total: 0 };
                            acc[key].total += parseFloat(fh.hours) || 0;
                            acc[key].used += parseFloat(fh.hours_used) || 0;
                            return acc;
                          }, {});
                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Gift className="h-4 w-4 text-amber-600" />
                                  <span className="text-sm font-medium text-gray-900">Freistunden</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingFreeHour({
                                      id: null,
                                      hours: '',
                                      reason: '',
                                      legal_area: '',
                                      contract_id: contracts[0]?.id || null,
                                    });
                                    setShowFreeHourDialog(true);
                                  }}
                                  className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors flex items-center gap-1"
                                  disabled={contracts.length === 0}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Hinzufügen
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                {[
                                  { key: 'zivilrecht', label: 'Zivilrecht' },
                                  { key: 'strafrecht', label: 'Strafrecht' },
                                  { key: 'oeffentliches_recht', label: 'öffentliches Recht' },
                                ].map(({ key, label }) => {
                                  const entry = breakdown[key];
                                  return (
                                    <div key={key} className="bg-amber-50 rounded p-2 text-center">
                                      <span className="text-xs text-amber-700 block">{label}</span>
                                      <span className="text-sm font-medium text-amber-900">
                                        {entry && entry.total > 0
                                          ? `${entry.used} / ${entry.total} Std.`
                                          : '0 Std.'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              {false && freeHours.length > 0 && (
                                <div className="space-y-1.5">
                                  {freeHours.map((fh) => {
                                    const formatLegalArea = (area: string | null) => {
                                      if (!area) return '—';
                                      if (area === 'oeffentliches_recht') return 'öffentliches Recht';
                                      return area.charAt(0).toUpperCase() + area.slice(1);
                                    };
                                    const used = parseFloat(fh.hours_used) || 0;
                                    const total = parseFloat(fh.hours) || 0;
                                    const isExhausted = used >= total && total > 0;
                                    return (
                                      <div key={fh.id} className="bg-white rounded px-3 py-2 flex items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <span className={`font-medium whitespace-nowrap ${isExhausted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                            {used} / {total} Std.
                                          </span>
                                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 whitespace-nowrap">
                                            {formatLegalArea(fh.legal_area)}
                                          </span>
                                          <span className="text-gray-600 truncate">{fh.reason}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingFreeHour({ ...fh });
                                              setShowFreeHourDialog(true);
                                            }}
                                            className="p-1 text-gray-400 hover:text-primary rounded transition-colors"
                                            title="Bearbeiten"
                                          >
                                            <Edit2 className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setConfirmDialog({
                                                title: 'Freistunden löschen',
                                                message: `Möchten Sie diese Freistunden (${fh.hours} Std.) wirklich löschen?`,
                                                variant: 'danger',
                                                confirmLabel: 'Löschen',
                                                onConfirm: async () => {
                                                  await deleteFreeHour(fh.id);
                                                  setConfirmDialog(null);
                                                },
                                              });
                                            }}
                                            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                                            title="Löschen"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Verträge</h3>
                  <div className="flex items-center gap-2">
                    {/* Show Legacy Import button if participant has legacy data but no contracts */}
                    {contracts.length === 0 && formData.contract_start && formData.contract_end && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (!teilnehmer?.id) return;

                            // Check if participant already has contracts
                            const { data: existingContracts } = await supabase
                              .from('contracts')
                              .select('id')
                              .eq('teilnehmer_id', teilnehmer.id);

                            if (existingContracts && existingContracts.length > 0) {
                              addToast('Teilnehmer hat bereits Verträge', 'error');
                              return;
                            }

                            // Calculate total hours from legacy data
                            const totalHours =
                              ((formData as any).hours_zivilrecht || 0) +
                              ((formData as any).hours_strafrecht || 0) +
                              ((formData as any).hours_oeffentliches_recht || 0);

                            // Get actual used hours from participant_hours
                            const { data: participantHours } = await supabase
                              .from('participant_hours')
                              .select('legal_area, hours')
                              .eq('teilnehmer_id', teilnehmer.id);

                            const usedHours = participantHours?.reduce((sum: number, ph: any) => sum + (ph.hours || 0), 0) || 0;

                            // Create contract
                            const { data: contract, error: contractError } = await supabase
                              .from('contracts')
                              .insert({
                                contract_number: formData.tn_nummer || 'LEGACY',
                                teilnehmer_id: teilnehmer.id,
                                start_date: formData.contract_start,
                                end_date: formData.contract_end,
                                status: 'active',
                                frequency_type: (formData as any).frequency_type || 'monthly',
                                frequency_hours_zivilrecht: (formData as any).frequency_hours_zivilrecht || null,
                                frequency_hours_strafrecht: (formData as any).frequency_hours_strafrecht || null,
                                frequency_hours_oeffentliches_recht: (formData as any).frequency_hours_oeffentliches_recht || null,
                              })
                              .select()
                              .single();

                            if (contractError) throw contractError;

                            // Create Paket 1
                            const { data: contractPackage, error: packageError } = await supabase
                              .from('contract_packages')
                              .insert({
                                contract_id: contract.id,
                                teilnehmer_id: teilnehmer.id,
                                hours_total: totalHours || (formData as any).booked_hours || 0,
                                hours_used: usedHours,
                                status: 'active',
                                start_date: formData.contract_start,
                                end_date: formData.contract_end,
                                custom_name: 'Paket 1',
                              })
                              .select()
                              .single();

                            if (packageError) throw packageError;

                            // Create legal areas
                            const legalAreas = [];
                            if ((formData as any).hours_zivilrecht) {
                              legalAreas.push({ contract_package_id: contractPackage.id, legal_area: 'zivilrecht', hours: (formData as any).hours_zivilrecht });
                            }
                            if ((formData as any).hours_strafrecht) {
                              legalAreas.push({ contract_package_id: contractPackage.id, legal_area: 'strafrecht', hours: (formData as any).hours_strafrecht });
                            }
                            if ((formData as any).hours_oeffentliches_recht) {
                              legalAreas.push({ contract_package_id: contractPackage.id, legal_area: 'oeffentliches_recht', hours: (formData as any).hours_oeffentliches_recht });
                            }

                            if (legalAreas.length > 0) {
                              const { error: laError } = await supabase
                                .from('contract_package_legal_areas')
                                .insert(legalAreas);
                              if (laError) throw laError;
                            }

                            // Link teilnehmer to current contract
                            await supabase
                              .from('teilnehmer')
                              .update({ current_contract_id: contract.id })
                              .eq('id', teilnehmer.id);

                            addToast('Legacy Vertrag erfolgreich importiert', 'success');

                            // Refresh contracts
                            const { data: refreshedContracts } = await supabase
                              .from('contracts')
                              .select('*, contract_packages(*)')
                              .eq('teilnehmer_id', teilnehmer.id)
                              .order('created_at', { ascending: true });
                            if (refreshedContracts) setContracts(refreshedContracts);
                          } catch (error: any) {
                            console.error('Legacy import error:', error);
                            addToast(`Fehler beim Import: ${error.message}`, 'error');
                          }
                        }}
                        className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors flex items-center gap-2 text-sm"
                      >
                        <FileContract className="h-4 w-4" />
                        Legacy Import
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowContractDialog(true)}
                      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <FileContract className="h-4 w-4" />
                      Vertrag hinzufügen
                    </button>
                  </div>
                </div>

                {contracts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                    <FileContract className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium">Keine Verträge vorhanden</p>
                    <p className="text-sm mt-2">Erstellen Sie den ersten Vertrag für diesen Teilnehmer.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contracts.map((contract) => {
                      const startDate = new Date(contract.start_date);
                      const endDate = contract.end_date ? new Date(contract.end_date) : null;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const totalDuration = endDate ? endDate.getTime() - startDate.getTime() : null;
                      const elapsed = today.getTime() - startDate.getTime();
                      const progress = totalDuration ? Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100) : 0;

                      // Calculate used hours from contract_packages + free_hours (consumed)
                      const contractFreeHours = freeHours.filter((fh: any) => fh.contract_id === contract.id);
                      const freeUsed = contractFreeHours.reduce((s: number, fh: any) => s + (parseFloat(fh.hours_used) || 0), 0);
                      const freeTotal = contractFreeHours.reduce((s: number, fh: any) => s + (parseFloat(fh.hours) || 0), 0);
                      const packageUsed = contract.contract_packages?.reduce((sum: number, pkg: any) => sum + (pkg.hours_used || 0), 0) || 0;
                      const packageTotal = contract.contract_packages?.reduce((sum: number, pkg: any) => sum + (pkg.hours_total || 0), 0) || contract.total_hours || 0;
                      const usedHours = packageUsed + freeUsed;
                      const totalHours = packageTotal + freeTotal;
                      const remainingHours = totalHours - usedHours;

                      // Compute display status based on dates and hours
                      const isFuture = startDate > today;
                      const isExpired = endDate && endDate < today;
                      const isFull = remainingHours <= 0;
                      const displayStatus = isFuture ? 'Geplant' :
                                              isExpired ? 'Abgelaufen' :
                                              isFull ? 'Voll' :
                                              contract.status === 'cancelled' ? 'Storniert' :
                                              contract.status === 'completed' ? 'Abgeschlossen' :
                                              'Aktiv';

                      const statusColor = displayStatus === 'Aktiv' ? 'bg-green-100 text-green-800' :
                                         displayStatus === 'Geplant' ? 'bg-yellow-100 text-yellow-800' :
                                         displayStatus === 'Abgelaufen' ? 'bg-red-100 text-red-800' :
                                         displayStatus === 'Voll' ? 'bg-gray-100 text-gray-800' :
                                         displayStatus === 'Storniert' ? 'bg-red-100 text-red-800' :
                                         displayStatus === 'Abgeschlossen' ? 'bg-blue-100 text-blue-800' :
                                         'bg-gray-100 text-gray-800';

                      return (
                        <div key={contract.id} className="border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-gray-900">{contract.contract_number}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                  {displayStatus}
                                </span>
                              </div>
                              
                              {/* Laufzeit Progress Bar */}
                              {contract.end_date && (
                                <div className="mb-3">
                                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>Laufzeit</span>
                                    <span>{progress.toFixed(0)}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-primary h-2 rounded-full transition-all"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                <div>
                                  <span className="text-gray-500">Von:</span> {new Date(contract.start_date).toLocaleDateString('de-DE')}
                                </div>
                                <div>
                                  <span className="text-gray-500">Bis:</span> {contract.end_date ? new Date(contract.end_date).toLocaleDateString('de-DE') : '-'}
                                </div>
                                <div>
                                  <span className="text-gray-500">Genutzte Stunden:</span> {usedHours} Std.
                                </div>
                                <div>
                                  <span className="text-gray-500">Gesamtstunden:</span> {totalHours} Std.
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                // Fetch fresh contract data from database with packages
                                const { data: freshContract } = await supabase
                                  .from('contracts')
                                  .select('*, contract_packages(*)')
                                  .eq('id', contract.id)
                                  .single();

                                setEditingContract(freshContract || contract);
                                await fetchContractPackages(contract.id);
                                
                                // Auto-create "Paket 1" if no packages exist
                                const { data: existingPackages } = await supabase
                                  .from('contract_packages')
                                  .select('id')
                                  .eq('contract_id', contract.id);
                                
                                if (!existingPackages || existingPackages.length === 0) {
                                  // Auto-create "Paket 1" directly (no global packages dependency)
                                  try {
                                    const { error: cpError } = await supabase
                                      .from('contract_packages')
                                      .insert({
                                        contract_id: contract.id,
                                        teilnehmer_id: teilnehmer?.id,
                                        package_id: null,
                                        custom_name: 'Paket 1',
                                        hours_total: 0,
                                        hours_used: 0,
                                        status: 'active',
                                        start_date: freshContract?.start_date || contract.start_date || null,
                                        end_date: freshContract?.end_date || contract.end_date || null,
                                        created_by: (await supabase.auth.getUser()).data.user?.id
                                      });
                                    if (!cpError) {
                                      await fetchContractPackages(contract.id);
                                    }
                                  } catch (error) {
                                    console.error('Error creating default package:', error);
                                  }
                                }
                                
                                setShowContractDialog(true);
                              }}
                              className="p-2 text-gray-400 hover:text-primary rounded transition-colors"
                              title="Vertrag bearbeiten"
                            >
                              <Edit2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Notizen Tab */}
            {activeTab === 'notizen' && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium">Notizen</p>
                <p className="text-sm mt-2">Hier können Sie Notizen zum Teilnehmer hinzufügen.</p>
                <p className="text-xs mt-4 text-gray-400">Diese Funktion wird in Kürze implementiert.</p>
              </div>
            )}

            {/* Imported Lessons Preview - shown in Stammdaten tab */}
            {activeTab === 'stammdaten' && importedLessons.length > 0 && (
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
          </div>

          {/* Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 p-6 border-t bg-gray-50">
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

          {/* Contract Dialog */}
          {showContractDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingContract ? 'Vertrag bearbeiten' : 'Neuen Vertrag hinzufügen'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowContractDialog(false);
                      setEditingContract(null);
                      setContractPackages([]);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-4 space-y-6">
                  {editingContract && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <h4 className="font-medium text-gray-900">Vertragsinformationen</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Teilnehmer:</span>
                          <span className="ml-2 text-gray-900">{formData.first_name} {formData.last_name}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">TN-Nummer:</span>
                          <span className="ml-2 text-gray-900">{formData.tn_nummer}</span>
                        </div>
                        <div>
                          <label className="block text-gray-500 mb-1">Vertragsnummer</label>
                          <input
                            type="text"
                            value={editingContract.contract_number || ''}
                            onChange={(e) => setEditingContract({ ...editingContract, contract_number: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-500 mb-1">Startdatum</label>
                          <input
                            type="date"
                            value={editingContract.start_date || ''}
                            onChange={(e) => setEditingContract({ ...editingContract, start_date: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-500 mb-1">Enddatum</label>
                          <input
                            type="date"
                            value={editingContract.end_date || ''}
                            onChange={(e) => setEditingContract({ ...editingContract, end_date: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-500 mb-1">Gesamtstunden</label>
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={editingContract.total_hours || 0}
                            disabled
                            className="w-full px-2 py-1 border border-gray-200 rounded bg-gray-100 text-gray-600"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-500 mb-1">Genutzte Stunden</label>
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={editingContract.contract_packages?.reduce((sum: number, pkg: any) => sum + (pkg.hours_used || 0), 0) || 0}
                            disabled
                            className="w-full px-2 py-1 border border-gray-200 rounded bg-gray-100 text-gray-600"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-500 mb-1">Verbleibende Stunden</label>
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={(editingContract.contract_packages?.reduce((sum: number, pkg: any) => sum + (pkg.hours_total || 0), 0) || editingContract.total_hours || 0) - (editingContract.contract_packages?.reduce((sum: number, pkg: any) => sum + (pkg.hours_used || 0), 0) || 0)}
                            disabled
                            className="w-full px-2 py-1 border border-gray-200 rounded bg-gray-100 text-gray-600"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-500 mb-1">Status</label>
                          <select
                            value={editingContract.status || 'active'}
                            onChange={(e) => setEditingContract({ ...editingContract, status: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          >
                            <option value="draft">Entwurf</option>
                            <option value="active">Aktiv</option>
                            <option value="paused">Pausiert</option>
                            <option value="completed">Abgeschlossen</option>
                            <option value="cancelled">Storniert</option>
                            <option value="expired">Abgelaufen</option>
                          </select>
                        </div>
                      </div>

                      {/* Rechtsgebiete - showing used/total hours per legal area */}
                      {editingContract && contractPackages.length > 0 && (() => {
                        // Calculate total hours per legal area from all packages
                        const legalAreaTotals: { [key: string]: number } = {};
                        contractPackages.forEach((cp: any) => {
                          if (cp.contract_package_legal_areas) {
                            cp.contract_package_legal_areas.forEach((pla: any) => {
                              legalAreaTotals[pla.legal_area] = (legalAreaTotals[pla.legal_area] || 0) + (pla.hours || 0);
                            });
                          }
                        });

                        // Calculate used hours per legal area from participant_hours
                        const legalAreaUsed: { [key: string]: number } = usedLegalAreaHours || {};

                        const formatLegalArea = (area: string) => {
                          if (area === 'oeffentliches_recht') return 'öffentliches Recht';
                          if (area === 'zivilrecht') return 'Zivilrecht';
                          if (area === 'strafrecht') return 'Strafrecht';
                          return area.charAt(0).toUpperCase() + area.slice(1);
                        };

                        const legalAreas = ['zivilrecht', 'strafrecht', 'oeffentliches_recht'];
                        const hasLegalAreaData = legalAreas.some(area => legalAreaTotals[area] > 0);

                        if (!hasLegalAreaData) return null;

                        return (
                          <div className="bg-blue-50 rounded-md p-3 mt-4">
                            <h5 className="text-xs font-medium text-blue-800 mb-2">Rechtsgebiete</h5>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              {legalAreas.map((area) => {
                                const total = legalAreaTotals[area] || 0;
                                const used = legalAreaUsed[area] || 0;
                                if (total === 0) return null;
                                return (
                                  <div key={area} className="flex items-center justify-between bg-white rounded px-2 py-1">
                                    <span className="text-blue-700">{formatLegalArea(area)}</span>
                                    <span className="font-medium text-blue-900">{used} / {total} Std.</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Frequenz / Soll-Stunden pro Periode */}
                      <div className="space-y-3 mt-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">Frequenz (Soll-Stunden)</h4>
                          <select
                            value={editingContract.frequency_type || 'monthly'}
                            onChange={(e) => setEditingContract({ ...editingContract, frequency_type: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="weekly">Wöchentlich</option>
                            <option value="biweekly">14-tägig</option>
                            <option value="monthly">Monatlich</option>
                            <option value="quarterly">Quartalsweise</option>
                          </select>
                        </div>
                        <div className="bg-amber-50 rounded-md p-3 space-y-2">
                          {([
                            { key: 'frequency_hours_zivilrecht', label: 'Zivilrecht' },
                            { key: 'frequency_hours_strafrecht', label: 'Strafrecht' },
                            { key: 'frequency_hours_oeffentliches_recht', label: 'öffentliches Recht' },
                          ] as const).map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between gap-3 bg-white rounded px-3 py-2">
                              <span className="text-sm text-amber-800 flex-1">{label}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.25"
                                placeholder="—"
                                value={editingContract[key] ?? ''}
                                onChange={(e) => setEditingContract({
                                  ...editingContract,
                                  [key]: e.target.value === '' ? null : parseFloat(e.target.value),
                                })}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                              <span className="text-xs text-gray-500">Std.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Packages Section */}
                  {editingContract && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">Pakete ({contractPackages.length})</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const nextNumber = contractPackages.length + 1;
                            setEditingPackage({
                              id: null, // null indicates new package
                              contract_id: editingContract.id,
                              teilnehmer_id: teilnehmer?.id,
                              package_id: null,
                              custom_name: `Paket ${nextNumber}`,
                              hours_total: 0,
                              hours_used: 0,
                              status: 'active',
                              start_date: editingContract.start_date || '',
                              end_date: editingContract.end_date || '',
                              price_paid: null,
                              notes: '',
                              contract_package_legal_areas: [],
                              packages: null
                            });
                            setShowPackageDialog(true);
                          }}
                          className="px-3 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                        >
                          + Paket hinzufügen
                        </button>
                      </div>
                      {contractPackages.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                          <FileContract className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm">Keine Pakete vorhanden</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {contractPackages.map((cp, index) => (
                            <div key={cp.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">
                                    {cp.custom_name || (index === 0 ? 'Paket 1' : (cp.packages?.name || 'Unbekanntes Paket'))}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    cp.status === 'active' ? 'bg-green-100 text-green-800' :
                                    cp.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                    cp.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {cp.status || 'Aktiv'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPackage(cp);
                                    setShowPackageDialog(true);
                                  }}
                                  className="p-1 text-gray-400 hover:text-primary rounded transition-colors"
                                  title="Paket bearbeiten"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                                <div>
                                  <span className="text-gray-500">Vertragsnummer:</span>
                                  <span className="ml-1 text-gray-900">{editingContract.contract_number}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Startdatum:</span>
                                  <span className="ml-1 text-gray-900">{cp.start_date ? new Date(cp.start_date).toLocaleDateString('de-DE') : '-'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Enddatum:</span>
                                  <span className="ml-1 text-gray-900">{cp.end_date ? new Date(cp.end_date).toLocaleDateString('de-DE') : '-'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Gebucht:</span>
                                  <span className="ml-1 text-gray-900">{cp.hours_total} Std.</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Genutzt:</span>
                                  <span className="ml-1 text-gray-900">{cp.hours_used || 0} Std.</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Verbleibend:</span>
                                  <span className="ml-1 text-gray-900">{cp.hours_total - (cp.hours_used || 0)} Std.</span>
                                </div>
                              </div>
                              {cp.contract_package_legal_areas && cp.contract_package_legal_areas.length > 0 && (
                                <div className="bg-blue-50 rounded-md p-3">
                                  <h5 className="text-xs font-medium text-blue-800 mb-2">Rechtsgebiete</h5>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    {cp.contract_package_legal_areas.map((pla: any) => {
                                      const formatLegalArea = (area: string) => {
                                        if (area === 'oeffentliches_recht') return 'öffentliches Recht';
                                        return area.charAt(0).toUpperCase() + area.slice(1);
                                      };
                                      const totalHours = pla.hours || 0;
                                      const usedHours = (usedLegalAreaHours[pla.legal_area] || 0);
                                      return (
                                        <div key={pla.id} className="flex items-center justify-between bg-white rounded px-2 py-1">
                                          <span className="text-blue-700">{formatLegalArea(pla.legal_area)}</span>
                                          <span className="font-medium text-blue-900">{usedHours} / {totalHours} Std.</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!editingContract && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
                          <input
                            type="date"
                            value={newContractForm.start_date}
                            onChange={(e) => setNewContractForm({ ...newContractForm, start_date: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
                          <input
                            type="date"
                            value={newContractForm.end_date}
                            onChange={(e) => setNewContractForm({ ...newContractForm, end_date: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="space-y-3 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">Paket 1</h4>
                          <span className="text-sm text-gray-500">
                            Gesamt: {newContractForm.legal_areas.zivilrecht + newContractForm.legal_areas.strafrecht + newContractForm.legal_areas.oeffentliches_recht} Std.
                          </span>
                        </div>
                        <div className="bg-blue-50 rounded-md p-3 space-y-2">
                          {([
                            { key: 'zivilrecht', label: 'Zivilrecht' },
                            { key: 'strafrecht', label: 'Strafrecht' },
                            { key: 'oeffentliches_recht', label: 'öffentliches Recht' },
                          ] as const).map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between gap-3 bg-white rounded px-3 py-2">
                              <span className="text-sm text-blue-700 flex-1">{label}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.25"
                                value={newContractForm.legal_areas[key] || 0}
                                onChange={(e) => setNewContractForm({
                                  ...newContractForm,
                                  legal_areas: {
                                    ...newContractForm.legal_areas,
                                    [key]: parseFloat(e.target.value) || 0,
                                  },
                                })}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                              <span className="text-xs text-gray-500">Std.</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Frequenz / Soll-Stunden pro Periode */}
                      <div className="space-y-3 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">Frequenz (Soll-Stunden)</h4>
                          <select
                            value={newContractForm.frequency_type}
                            onChange={(e) => setNewContractForm({ ...newContractForm, frequency_type: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="weekly">Wöchentlich</option>
                            <option value="biweekly">14-tägig</option>
                            <option value="monthly">Monatlich</option>
                            <option value="quarterly">Quartalsweise</option>
                          </select>
                        </div>
                        <div className="bg-amber-50 rounded-md p-3 space-y-2">
                          {([
                            { key: 'zivilrecht', label: 'Zivilrecht' },
                            { key: 'strafrecht', label: 'Strafrecht' },
                            { key: 'oeffentliches_recht', label: 'öffentliches Recht' },
                          ] as const).map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between gap-3 bg-white rounded px-3 py-2">
                              <span className="text-sm text-amber-800 flex-1">{label}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.25"
                                placeholder="—"
                                value={newContractForm.frequency_hours[key] ?? ''}
                                onChange={(e) => setNewContractForm({
                                  ...newContractForm,
                                  frequency_hours: {
                                    ...newContractForm.frequency_hours,
                                    [key]: e.target.value === '' ? null : parseFloat(e.target.value),
                                  },
                                })}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                              <span className="text-xs text-gray-500">Std.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setShowContractDialog(false);
                        setEditingContract(null);
                        setContractPackages([]);
                        setNewContractForm({ start_date: '', end_date: '', legal_areas: { zivilrecht: 0, strafrecht: 0, oeffentliches_recht: 0 }, frequency_type: 'monthly', frequency_hours: { zivilrecht: null, strafrecht: null, oeffentliches_recht: null } });
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                      Schließen
                    </button>
                    {editingContract && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const { error: updErr } = await supabase
                              .from('contracts')
                              .update({
                                contract_number: editingContract.contract_number || null,
                                start_date: editingContract.start_date || null,
                                end_date: editingContract.end_date || null,
                                status: editingContract.status || 'active',
                                frequency_type: editingContract.frequency_type || null,
                                frequency_hours_zivilrecht: editingContract.frequency_hours_zivilrecht ?? null,
                                frequency_hours_strafrecht: editingContract.frequency_hours_strafrecht ?? null,
                                frequency_hours_oeffentliches_recht: editingContract.frequency_hours_oeffentliches_recht ?? null,
                                updated_at: new Date().toISOString(),
                              })
                              .eq('id', editingContract.id);
                            if (updErr) throw updErr;
                            addToast('Vertrag gespeichert', 'success');

                            // Refresh contracts list
                            const { data: refreshed } = await supabase
                              .from('contracts')
                              .select('*, contract_packages(*)')
                              .eq('teilnehmer_id', teilnehmer!.id)
                              .order('created_at', { ascending: true });
                            if (refreshed) setContracts(refreshed);

                            setShowContractDialog(false);
                            setEditingContract(null);
                            setContractPackages([]);
                          } catch (error: any) {
                            console.error('Error updating contract:', error);
                            addToast(`Fehler beim Speichern: ${error.message || error}`, 'error');
                          }
                        }}
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                      >
                        Speichern
                      </button>
                    )}
                    {!editingContract && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!teilnehmer?.id) {
                            addToast('Teilnehmer muss zuerst gespeichert werden', 'error');
                            return;
                          }
                          if (!newContractForm.start_date) {
                            addToast('Bitte Startdatum angeben', 'error');
                            return;
                          }
                          try {
                            // 1. Create contract (trigger auto-creates Paket 1)
                            const { data: newContract, error: cErr } = await supabase
                              .from('contracts')
                              .insert({
                                teilnehmer_id: teilnehmer.id,
                                start_date: newContractForm.start_date,
                                end_date: newContractForm.end_date || null,
                                status: 'active',
                                frequency_type: newContractForm.frequency_type || null,
                                frequency_hours_zivilrecht: newContractForm.frequency_hours.zivilrecht,
                                frequency_hours_strafrecht: newContractForm.frequency_hours.strafrecht,
                                frequency_hours_oeffentliches_recht: newContractForm.frequency_hours.oeffentliches_recht,
                              })
                              .select()
                              .single();
                            if (cErr) throw cErr;

                            // 2. Find the auto-created Paket 1
                            const { data: cp } = await supabase
                              .from('contract_packages')
                              .select('id')
                              .eq('contract_id', newContract.id)
                              .limit(1)
                              .single();

                            if (cp) {
                              // 3. Insert legal areas
                              const legalAreaRows = (Object.entries(newContractForm.legal_areas) as [string, number][])
                                .filter(([, hours]) => hours > 0)
                                .map(([legal_area, hours]) => ({
                                  contract_package_id: cp.id,
                                  legal_area,
                                  hours,
                                }));
                              if (legalAreaRows.length > 0) {
                                await supabase.from('contract_package_legal_areas').insert(legalAreaRows);
                              }

                              // 4. Set hours_total for Paket 1 from legal areas sum
                              const totalHours = Object.values(newContractForm.legal_areas).reduce((a, b) => a + b, 0);
                              await supabase
                                .from('contract_packages')
                                .update({
                                  hours_total: totalHours,
                                  start_date: newContractForm.start_date,
                                  end_date: newContractForm.end_date || null,
                                })
                                .eq('id', cp.id);
                            }

                            addToast('Vertrag wurde erstellt', 'success');
                            // Refresh contracts list
                            const { data: refreshed } = await supabase
                              .from('contracts')
                              .select('*, contract_packages(*)')
                              .eq('teilnehmer_id', teilnehmer.id)
                              .order('created_at', { ascending: false });
                            if (refreshed) setContracts(refreshed);
                            setShowContractDialog(false);
                            setNewContractForm({ start_date: '', end_date: '', legal_areas: { zivilrecht: 0, strafrecht: 0, oeffentliches_recht: 0 }, frequency_type: 'monthly', frequency_hours: { zivilrecht: null, strafrecht: null, oeffentliches_recht: null } });
                          } catch (error: any) {
                            console.error('Error creating contract:', error);
                            addToast(`Fehler beim Erstellen: ${error.message || error}`, 'error');
                          }
                        }}
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                      >
                        Hinzufügen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Package Edit Dialog */}
          {showPackageDialog && editingPackage && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">{editingPackage.id ? 'Paket bearbeiten' : 'Paket hinzufügen'}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPackageDialog(false);
                      setEditingPackage(null);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  {/* Package Name */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Paket Name</label>
                      <input
                        type="text"
                        value={editingPackage.custom_name ?? editingPackage.packages?.name ?? ''}
                        onChange={(e) => setEditingPackage({ ...editingPackage, custom_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Laufzeit */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Laufzeit</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Startdatum</label>
                        <input
                          type="date"
                          value={editingPackage.start_date || ''}
                          onChange={(e) => setEditingPackage({ ...editingPackage, start_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Enddatum</label>
                        <input
                          type="date"
                          value={editingPackage.end_date || ''}
                          onChange={(e) => setEditingPackage({ ...editingPackage, end_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stunden */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Stunden</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gebucht</label>
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={editingPackage.hours_total || 0}
                          onChange={(e) => setEditingPackage({ ...editingPackage, hours_total: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Genutzt</label>
                        <input
                          type="number"
                          value={editingPackage.hours_used || 0}
                          disabled
                          className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Verbleibend</label>
                        <input
                          type="number"
                          value={(editingPackage.hours_total || 0) - (editingPackage.hours_used || 0)}
                          disabled
                          className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-gray-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stunden pro Rechtsgebiet */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Stunden pro Rechtsgebiet</h4>
                    <div className="bg-blue-50 rounded-md p-3 space-y-2">
                      {['zivilrecht', 'strafrecht', 'oeffentliches_recht'].map((area) => {
                        const formatLegalArea = (a: string) => {
                          if (a === 'oeffentliches_recht') return 'öffentliches Recht';
                          return a.charAt(0).toUpperCase() + a.slice(1);
                        };
                        const legalAreas = editingPackage.contract_package_legal_areas || [];
                        const existing = legalAreas.find((pla: any) => pla.legal_area === area);
                        return (
                          <div key={area} className="flex items-center justify-between gap-3 bg-white rounded px-3 py-2">
                            <span className="text-sm text-blue-700 flex-1">{formatLegalArea(area)}</span>
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={existing?.hours ?? 0}
                              onChange={(e) => {
                                const newHours = parseFloat(e.target.value) || 0;
                                const currentLegalAreas = editingPackage.contract_package_legal_areas || [];
                                let updatedLegalAreas;
                                if (existing) {
                                  updatedLegalAreas = currentLegalAreas.map((pla: any) =>
                                    pla.legal_area === area ? { ...pla, hours: newHours } : pla
                                  );
                                } else {
                                  updatedLegalAreas = [...currentLegalAreas, { legal_area: area, hours: newHours, contract_package_id: editingPackage.id }];
                                }
                                setEditingPackage({
                                  ...editingPackage,
                                  contract_package_legal_areas: updatedLegalAreas
                                });
                              }}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <span className="text-xs text-gray-500">Std.</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notizen */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                    <textarea
                      rows={3}
                      value={editingPackage.notes || ''}
                      onChange={(e) => setEditingPackage({ ...editingPackage, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 p-4 border-t">
                  {editingPackage.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        const pkgName = editingPackage.custom_name || editingPackage.packages?.name || 'Paket';
                        setConfirmDialog({
                          title: 'Paket löschen',
                          message: `Möchten Sie das Paket "${pkgName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
                          confirmLabel: 'Löschen',
                          variant: 'danger',
                          onConfirm: async () => {
                            try {
                              const { error } = await supabase
                                .from('contract_packages')
                                .delete()
                                .eq('id', editingPackage.id);
                              if (error) throw error;
                              addToast('Paket wurde gelöscht', 'success');
                              await fetchContractPackages(editingContract.id);
                              setShowPackageDialog(false);
                              setEditingPackage(null);
                            } catch (error: any) {
                              console.error('Error deleting package:', error);
                              addToast(`Fehler beim Löschen: ${error.message || error}`, 'error');
                            }
                          }
                        });
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Paket löschen
                    </button>
                  ) : <div />}
                  <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPackageDialog(false);
                      setEditingPackage(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const isNew = !editingPackage.id;
                        let packageId = editingPackage.id;

                        // Auto-calculate hours_total from legal areas
                        const legalAreasSum = (editingPackage.contract_package_legal_areas || [])
                          .reduce((sum: number, pla: any) => sum + (parseFloat(pla.hours) || 0), 0);
                        const computedHoursTotal = legalAreasSum > 0 ? legalAreasSum : (editingPackage.hours_total || 0);

                        // Check if package end_date extends beyond contract end_date
                        // Normalize to YYYY-MM-DD for reliable comparison
                        const pkgEndStr = editingPackage.end_date ? String(editingPackage.end_date).slice(0, 10) : '';
                        const ctrEndStr = editingContract.end_date ? String(editingContract.end_date).slice(0, 10) : '';
                        if (pkgEndStr && ctrEndStr && pkgEndStr > ctrEndStr) {
                          const newEnd = new Date(pkgEndStr).toLocaleDateString('de-DE');
                          const curEnd = new Date(ctrEndStr).toLocaleDateString('de-DE');
                          const userConfirmed: boolean = await new Promise((resolve) => {
                            setConfirmDialog({
                              title: 'Vertrag verlängern?',
                              message: `Das Enddatum des Pakets (${newEnd}) liegt nach dem Vertragsende (${curEnd}).\n\nSoll der Vertrag bis zum ${newEnd} verlängert werden?`,
                              confirmLabel: 'Ja, verlängern',
                              cancelLabel: 'Nein',
                              variant: 'primary',
                              onConfirm: () => resolve(true),
                              onCancel: () => resolve(false),
                            });
                          });
                          if (userConfirmed) {
                            const { error: extendError } = await supabase
                              .from('contracts')
                              .update({ end_date: pkgEndStr, updated_at: new Date().toISOString() })
                              .eq('id', editingContract.id);
                            if (extendError) throw extendError;
                            setEditingContract({ ...editingContract, end_date: pkgEndStr });
                          }
                        }

                        if (isNew) {
                          // Create new contract_package
                          const { data: newCp, error: cpError } = await supabase
                            .from('contract_packages')
                            .insert({
                              contract_id: editingContract.id,
                              teilnehmer_id: teilnehmer?.id,
                              package_id: null,
                              custom_name: editingPackage.custom_name || null,
                              start_date: editingPackage.start_date || null,
                              end_date: editingPackage.end_date || null,
                              hours_total: computedHoursTotal,
                              hours_used: 0,
                              status: editingPackage.status || 'active',
                              price_paid: editingPackage.price_paid || null,
                              notes: editingPackage.notes || null,
                              created_by: (await supabase.auth.getUser()).data.user?.id
                            })
                            .select()
                            .single();
                          if (cpError) throw cpError;
                          packageId = newCp.id;
                        } else {
                          // Update existing contract_package
                          const { error: cpError } = await supabase
                            .from('contract_packages')
                            .update({
                              custom_name: editingPackage.custom_name || null,
                              start_date: editingPackage.start_date || null,
                              end_date: editingPackage.end_date || null,
                              hours_total: computedHoursTotal,
                              status: editingPackage.status || 'active',
                              price_paid: editingPackage.price_paid || null,
                              notes: editingPackage.notes || null,
                              updated_at: new Date().toISOString()
                            })
                            .eq('id', editingPackage.id);
                          if (cpError) throw cpError;
                        }

                        // Upsert contract_package_legal_areas (per contract package)
                        const legalAreas = editingPackage.contract_package_legal_areas || [];
                        for (const pla of legalAreas) {
                          if (!pla.hours || pla.hours <= 0) {
                            if (pla.id) {
                              await supabase.from('contract_package_legal_areas').delete().eq('id', pla.id);
                            }
                            continue;
                          }
                          if (pla.id) {
                            await supabase
                              .from('contract_package_legal_areas')
                              .update({ hours: pla.hours, updated_at: new Date().toISOString() })
                              .eq('id', pla.id);
                          } else {
                            await supabase
                              .from('contract_package_legal_areas')
                              .insert({
                                contract_package_id: packageId,
                                legal_area: pla.legal_area,
                                hours: pla.hours
                              });
                          }
                        }

                        addToast(isNew ? 'Paket wurde hinzugefügt' : 'Paket wurde aktualisiert', 'success');
                        await fetchContractPackages(editingContract.id);
                        setShowPackageDialog(false);
                        setEditingPackage(null);
                      } catch (error: any) {
                        console.error('Error saving package:', error);
                        addToast(`Fehler beim Speichern des Pakets: ${error.message || error}`, 'error');
                      }
                    }}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                  >
                    {editingPackage.id ? 'Speichern' : 'Hinzufügen'}
                  </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Free Hours Dialog */}
          {showFreeHourDialog && editingFreeHour && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Gift className="h-5 w-5 text-amber-600" />
                    {editingFreeHour.id ? 'Freistunden bearbeiten' : 'Freistunden hinzufügen'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFreeHourDialog(false);
                      setEditingFreeHour(null);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {contracts.length > 1 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vertrag *</label>
                      <select
                        value={editingFreeHour.contract_id || ''}
                        onChange={(e) => setEditingFreeHour({ ...editingFreeHour, contract_id: e.target.value })}
                        disabled={!!editingFreeHour.id}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-gray-100"
                      >
                        <option value="">Bitte wählen…</option>
                        {contracts.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.contract_number || c.id.slice(0, 8)}
                            {c.start_date && c.end_date ? ` (${new Date(c.start_date).toLocaleDateString('de-DE')} - ${new Date(c.end_date).toLocaleDateString('de-DE')})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stunden *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={editingFreeHour.hours ?? ''}
                      onChange={(e) => setEditingFreeHour({ ...editingFreeHour, hours: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rechtsgebiet *</label>
                    <select
                      value={editingFreeHour.legal_area || ''}
                      onChange={(e) => setEditingFreeHour({ ...editingFreeHour, legal_area: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                      <option value="">Bitte wählen…</option>
                      <option value="zivilrecht">Zivilrecht</option>
                      <option value="strafrecht">Strafrecht</option>
                      <option value="oeffentliches_recht">öffentliches Recht</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Freistunden einem Rechtsgebiet zuordnen</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Begründung *</label>
                    <textarea
                      rows={3}
                      value={editingFreeHour.reason || ''}
                      onChange={(e) => setEditingFreeHour({ ...editingFreeHour, reason: e.target.value })}
                      placeholder="z.B. Nachholstunden, Bonus, Kompensation..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFreeHourDialog(false);
                      setEditingFreeHour(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={saveFreeHour}
                    className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
                  >
                    {editingFreeHour.id ? 'Speichern' : 'Hinzufügen'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Custom Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-5 border-b">
              <div className="flex items-center gap-3">
                {confirmDialog.variant === 'danger' ? (
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                ) : (
                  <div className="p-2 bg-blue-100 rounded-full">
                    <AlertTriangle className="h-5 w-5 text-blue-600" />
                  </div>
                )}
                <h3 className="text-lg font-semibold text-gray-900">{confirmDialog.title}</h3>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 whitespace-pre-line">{confirmDialog.message}</p>
            </div>
            <div className="flex justify-end gap-3 p-4 bg-gray-50 rounded-b-lg border-t">
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onCancel?.();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-md transition-colors"
              >
                {confirmDialog.cancelLabel || 'Abbrechen'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const cb = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await cb();
                }}
                className={`px-4 py-2 text-white rounded-md transition-colors ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {confirmDialog.confirmLabel || 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
