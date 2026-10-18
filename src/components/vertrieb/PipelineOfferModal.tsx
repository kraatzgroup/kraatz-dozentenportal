import { useEffect, useMemo, useState, FormEvent } from 'react';
import { X, FileText, Eye, Send, ChevronDown, Package as PackageIcon } from 'lucide-react';
import { Lead } from '../../store/salesStore';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../store/toastStore';
import { getNextMonday } from './dateDefaults';

interface EmailTemplateRow {
  id: string;
  title: string;
  icon?: string | null;
  description?: string | null;
  subject: string;
  body: string;
  category?: string | null;
  is_html?: boolean | null;
}

interface PipelineOfferModalProps {
  lead: Lead | null;
  onClose: () => void;
  /** Wird nach erfolgreichem Versand aufgerufen (Parent setzt den Ziel-Status). */
  onSent: (info: { packageName: string | null; beginDate: string | null; price: number | null; reason: string | null }) => Promise<void>;
  /** Kategorie der E-Mail-Vorlagen (z.B. 'angebot' oder 'kraatzclub'). */
  templateCategory?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  /** Zeigt zusätzlich den "nichts senden"-Button an. */
  allowSkip?: boolean;
  skipLabel?: string;
  onSkip?: (reason: string) => Promise<void>;
  /** Paket-Auswahl und geplanter Beginn ausblenden (z.B. bei Info-Mails). */
  showPackageFields?: boolean;
  /** Grund der Unqualifizierung abfragen (Zu teuer / anderes Rep / Freitext). */
  askReason?: boolean;
}

const PLACEHOLDERS = [
  { token: '[Vorname]', label: 'Vorname' },
  { token: '[Name]', label: 'Name' },
  { token: '[Anrede_Gruss]', label: 'Anrede' },
  { token: '[Stundenpaket]', label: 'Stundenpaket' },
  { token: '[Stundenanzahl]', label: 'Stundenanzahl' },
  { token: '[Preis]', label: 'Preis' },
  { token: '[Beginn]', label: 'Beginn' },
  { token: '[Laufzeit]', label: 'Laufzeit' },
  { token: '[Stundenpreis]', label: 'Stundenpreis' },
  { token: '[Monatsrate]', label: 'Monatsrate' },
];

// Optionale Bausteine (Sections) der Angebots-Mail. Die Vorlage markiert jeden
// Abschnitt mit <!--SECTION:key-->…<!--/SECTION:key-->; der Vertrieb kann die
// Bausteine im Modal einzeln ein-/ausblenden, bevor die Mail versendet wird.
const OFFER_SECTIONS = [
  { key: 'ueberblick', label: 'Einzelunterricht im Überblick' },
  { key: 'einblicke', label: 'Zusätzliche Einblicke' },
  { key: 'probematerial', label: 'Kostenlose Probematerialien' },
  { key: 'preisuebersicht', label: 'Preisübersicht' },
  { key: 'motivation', label: 'Motivationsschub' },
  { key: 'testimonials', label: 'Das sagen unsere Teilnehmer' },
  { key: 'naechste-schritte', label: 'Nächste Schritte' },
];

// Erkennt in einer Vorlage vorhandene Sections (über ihre Markierungen) und
// aktiviert sie standardmäßig alle.
const discoverSections = (bodyText: string): Record<string, boolean> => {
  const present = OFFER_SECTIONS.filter(s => bodyText.includes(`<!--SECTION:${s.key}-->`));
  return Object.fromEntries(present.map(s => [s.key, true]));
};

type OfferTier = 'platin' | 'gold';

const SUBJECTS = [
  { key: 'zr', label: 'Zivilrecht (ZR)', token: 'ZR', baseHours: 55, baseExams: 40 },
  { key: 'oer', label: 'Öffentliches Recht (ÖR)', token: 'OER', baseHours: 50, baseExams: 34 },
  { key: 'str', label: 'Strafrecht (StR)', token: 'STR', baseHours: 35, baseExams: 29 },
] as const;
type SubjectKey = typeof SUBJECTS[number]['key'];

const BASE_TOTAL_HOURS = 140;
const TIER_HOURS: Record<OfferTier, number> = { platin: 140, gold: 70 };
const TIER_NAMES: Record<OfferTier, string> = {
  platin: 'Einzelunterricht 1. Staatsexamen | PLATIN',
  gold: 'Einzelunterricht 1. Staatsexamen | GOLD',
};
const TIER_EMAIL_STYLES: Record<OfferTier | 'individuell' | 'elite', string> = {
  platin: 'background-color:#CFD6DE;background-image:linear-gradient(135deg,#F8FAFC 0%,#CFD6DE 25%,#FFFFFF 45%,#AEB7C2 70%,#E9EDF1 100%);color:#334155;',
  gold: 'background-color:#E8C14F;background-image:linear-gradient(135deg,#FFF6C9 0%,#E8C14F 25%,#FFF3B0 45%,#C9972B 70%,#F3D878 100%);color:#5A3D00;',
  elite: 'background-color:#BFE3C5;background-image:linear-gradient(135deg,#E6F6E8 0%,#BFE3C5 25%,#F2FBF3 45%,#9ECDA6 70%,#D4EED8 100%);color:#1F5130;',
  individuell: 'background-color:#111111;background-image:linear-gradient(135deg,#3A3A3A 0%,#111111 35%,#2B2B2B 60%,#000000 100%);color:#FFFFFF;',
};
const ASSET_PATHS = ['/KraatzGroup_Logo_platin.png', '/KraatzGroup_Logo_gold.png', '/KraatzGroup_Logo_black.png', '/KraatzGroup_Logo_elite.png', '/KraatzGroup_Muster_elite.png', '/KraatzGroup_Muster_platin.png', '/KraatzGroup_Muster_gold.png', '/KraatzGroup_Muster_black.png'];
const PROD_ORIGIN = 'https://portal.kraatz-group.de';
const patternStyle = (file: string) => `background-image:url([Muster_Basis]/KraatzGroup_Muster_${file}.png);background-repeat:repeat;background-size:12px 12px;`;

// Karten-Hintergrund: Logo in Konturfarbe, leicht transparent über dem Material-Verlauf
const cardBg = (style: string, logo: string) => {
  const color = style.match(/background-color:([^;]+);/)![1];
  const gradient = style.match(/background-image:([^;]+);/)![1];
  return `background-color:${color};background-image:url([Muster_Basis]/KraatzGroup_Logo_${logo}.png),${gradient};background-repeat:no-repeat,no-repeat;background-position:center center,0 0;background-size:34% auto,cover;`;
};
const CARD_STYLES: Record<OfferTier | 'individuell' | 'elite', { bg: string; text: string; label: string; title: string; frame: string; tagText: string; pattern: string }> = {
  platin: { bg: cardBg(TIER_EMAIL_STYLES.platin, 'platin'), text: '#1E293B', label: '#475569', title: '#1E293B', frame: '#1E293B', tagText: '#FFFFFF', pattern: patternStyle('platin') },
  gold: { bg: cardBg(TIER_EMAIL_STYLES.gold, 'gold'), text: '#4A3000', label: '#7A5200', title: '#4A3000', frame: '#7A5200', tagText: '#FFFFFF', pattern: patternStyle('gold') },
  elite: { bg: cardBg(TIER_EMAIL_STYLES.elite, 'elite'), text: '#16401F', label: '#2F6B43', title: '#16401F', frame: '#1F5130', tagText: '#FFFFFF', pattern: patternStyle('elite') },
  individuell: { bg: cardBg(TIER_EMAIL_STYLES.individuell, 'black'), text: '#FFFFFF', label: '#D1D5DB', title: '#FFFFFF', frame: '#C7CDD6', tagText: '#111111', pattern: patternStyle('black') },
};
const ELITE_TEMPLATE_ID = 'angebot-elite';
const ELITE_PACKAGE = { name: 'ELITE Kleingruppe 1. Staatsexamen', hours: 382, price: 9785, installments: 13, installment: 752.7 };
type Salutation = 'herr' | 'frau' | 'divers';

const FEMALE_NAMES = new Set(['anna','anne','annika','anja','andrea','angelika','antonia','barbara','bianca','birgit','carina','carla','carolin','caroline','charlene','charlotte','christina','christine','claudia','daniela','diana','eva','elisa','elena','emilia','emily','emma','franziska','friederike','hannah','hanna','heidi','helena','ines','isabel','isabelle','jana','jasmin','jennifer','jessica','johanna','julia','juliane','katharina','kathrin','katja','kerstin','laura','lea','lena','lisa','lara','leonie','lilly','lina','linda','maria','marie','mareike','marlene','martina','melanie','mia','michaela','miriam','monika','nadine','natalie','nicole','nina','paula','petra','pia','sabine','sandra','sara','sarah','sabrina','simone','sophie','sophia','stefanie','steffie','steffi','susanne','svenja','tabea','tanja','theresa','ulrike','ursula','vanessa','verena','viola','vivien','yvonne','zoe','alessandra','marlene','josephine','clara','klara','amelie','celine','melina','mira','nele','rebecca','rebekka','ricarda','rosa','sina','stella','valentina','viktoria','victoria']);
const MALE_NAMES = new Set(['luca','jona','nikola','elias','tobias','mattias','matthias','andreas','lukas','jonas','noah','mika','joshua','kai','sascha','hendrik','mario','nico','niko','marco','marcel']);

const guessSalutation = (firstName: string): Salutation => {
  const name = firstName.trim().split(/[\s-]+/)[0].toLowerCase();
  if (!name) return 'divers';
  if (FEMALE_NAMES.has(name)) return 'frau';
  if (MALE_NAMES.has(name)) return 'herr';
  return /[aei]$/.test(name) && !/(ie|ee)$/.test(name) ? 'frau' : 'herr';
};

const SALUTATION_LABELS: Record<Salutation, string> = { herr: 'Herr', frau: 'Frau', divers: 'Divers / ohne Anrede' };

const splitLeadName = (lead: Lead) => {
  const parts = (lead.name || '').trim().split(/\s+/);
  const first = lead.first_name || (parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '');
  const last = lead.last_name || (parts.length > 1 ? parts[parts.length - 1] : '');
  return { first, last };
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

// Stundenpreis nach Gesamtumfang (70 h = 9.905 €, 140 h = 19.530 €)
const getHourlyRate = (hours: number) => (hours >= 140 ? 139.5 : hours >= 70 ? 141.5 : 143.5);

const defaultDistribution = (total: number): Record<SubjectKey, string> =>
  Object.fromEntries(SUBJECTS.map(s => [s.key, String(Math.round((s.baseHours / BASE_TOTAL_HOURS) * total * 2) / 2)])) as Record<SubjectKey, string>;

const parseHours = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const formatHours = (n: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n);

const OFFER_SENDER = { name: 'Mario Kraatz', email: 'mariokraatz@kraatz-group.de' };

const formatEuro = (value: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);

const formatDate = (value: string) =>
  value ? new Date(value + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

export function PipelineOfferModal({ lead, onClose, onSent, templateCategory = 'angebot', title = 'Angebot senden', description, submitLabel = 'Angebot senden', allowSkip = false, skipLabel = 'Ohne Mail verschieben', onSkip, showPackageFields = true, askReason = false }: PipelineOfferModalProps) {
  const { addToast } = useToastStore();
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isHtml, setIsHtml] = useState(false);
  const [totalHoursInput, setTotalHoursInput] = useState('140');
  const [subjectHours, setSubjectHours] = useState<Record<SubjectKey, string>>(defaultDistribution(140));
  const [salutation, setSalutation] = useState<Salutation>('divers');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [months, setMonths] = useState(12);
  const [beginDate, setBeginDate] = useState(getNextMonday);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [activeSections, setActiveSections] = useState<Record<string, boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [reasonOption, setReasonOption] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setBeginDate(getNextMonday());
    const { first, last } = splitLeadName(lead);
    setFirstName(first);
    setLastName(last);
    setSalutation(guessSalutation(first));
  }, [lead?.id]);

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('email_templates')
        .select('*')
        .order('id');
      const rows = (data || []) as EmailTemplateRow[];
      const offerTemplates = rows.filter(t => t.category === templateCategory);
      const all = offerTemplates.length > 0 ? offerTemplates : rows;
      setTemplates(all);
      if (all.length > 0) {
        setSelectedTemplateId(all[0].id);
        setIsHtml(Boolean(all[0].is_html));
        setSubject(all[0].subject || '');
        setBody(all[0].body || '');
        setActiveSections(discoverSections(all[0].body || ''));
      }
    };
    if (lead) fetchTemplates();
  }, [lead?.id, templateCategory]);

  const totalHours = parseHours(totalHoursInput);
  const distributed = SUBJECTS.reduce((sum, sub) => sum + parseHours(subjectHours[sub.key]), 0);
  const remaining = Math.round((totalHours - distributed) * 100) / 100;
  const isElite = selectedTemplateId === ELITE_TEMPLATE_ID;
  const matchedTier = isElite ? null : (Object.keys(TIER_HOURS) as OfferTier[]).find(t => TIER_HOURS[t] === totalHours) || null;
  const cardKey = isElite ? 'elite' : matchedTier || 'individuell';
  const hourlyRate = getHourlyRate(totalHours);
  const totalPrice = Math.round(totalHours * hourlyRate * 100) / 100;
  const monthlyRate = totalPrice / months;
  const packageName = matchedTier ? TIER_NAMES[matchedTier] : 'Individuelles Angebot 1. Staatsexamen';
  const selectedPackage = !showPackageFields
    ? null
    : isElite
      ? { name: ELITE_PACKAGE.name, hours: ELITE_PACKAGE.hours, price: ELITE_PACKAGE.price }
      : totalHours > 0
        ? { name: packageName, hours: totalHours, price: totalPrice }
        : null;

  const chooseTier = (t: OfferTier) => {
    setTotalHoursInput(String(TIER_HOURS[t]));
    setSubjectHours(defaultDistribution(TIER_HOURS[t]));
  };

  const changeTotal = (value: string) => {
    setTotalHoursInput(value);
    const n = parseHours(value);
    if (n > 0) setSubjectHours(defaultDistribution(n));
  };

  const placeholderValues = useMemo(() => {
    const fullName = `${firstName} ${lastName}`.trim() || lead?.name || '';
    const greeting = salutation === 'divers' || !lastName.trim()
      ? `Guten Tag ${fullName}`
      : `Sehr geehrte${salutation === 'herr' ? 'r Herr' : ' Frau'} ${lastName.trim()}`;
    const values: Record<string, string> = {
      '[Vorname]': firstName,
      '[Nachname]': lastName,
      '[Name]': fullName,
      '[Anrede]': salutation === 'divers' ? '' : SALUTATION_LABELS[salutation],
      '[Anrede_Gruss]': greeting,
      '[Kursteilnehmer]': salutation === 'frau' ? 'Kursteilnehmerin' : salutation === 'herr' ? 'Kursteilnehmer' : 'Kursteilnehmer:in',
      '[Stundenpaket]': selectedPackage?.name || '',
      '[Stundenanzahl]': selectedPackage ? formatHours(selectedPackage.hours) : '',
      '[Preis]': selectedPackage ? formatEuro(selectedPackage.price) : '',
      '[Beginn]': formatDate(beginDate),
      '[Muster_Basis]': window.location.origin,
      '[Karte_Tag_Text]': CARD_STYLES[cardKey].tagText,
      '[Karte_Muster]': CARD_STYLES[cardKey].pattern,
      '[Karte_Stil]': CARD_STYLES[cardKey].bg,
      '[Karte_Text]': CARD_STYLES[cardKey].text,
      '[Karte_Titel]': CARD_STYLES[cardKey].title,
      '[Karte_Rahmen]': CARD_STYLES[cardKey].frame,
      '[Karte_Label]': CARD_STYLES[cardKey].label,
      '[Paket_Stil]': TIER_EMAIL_STYLES[matchedTier || 'individuell'],
      '[Laufzeit]': isElite ? '12 Monate' : selectedPackage ? `${months} ${months === 1 ? 'Monat' : 'Monate'}` : '',
      '[Stundenpreis]': selectedPackage ? formatEuro(hourlyRate) : '',
      '[Monatsrate]': isElite ? formatEuro(ELITE_PACKAGE.installment) : selectedPackage ? formatEuro(monthlyRate) : '',
    };
    (Object.keys(TIER_HOURS) as OfferTier[]).forEach(t => {
      const h = TIER_HOURS[t];
      const price = Math.round(h * getHourlyRate(h) * 100) / 100;
      const key = t === 'platin' ? 'Platin' : 'Gold';
      values[`[${key}_Tag]`] = matchedTier === t && selectedPackage
        ? '<span style="display:inline-block;background-color:#2D84C1;color:#FFFFFF;font-size:10px;font-weight:700;letter-spacing:1px;padding:3px 9px;border-radius:10px;vertical-align:middle;">DEIN PAKET</span>'
        : '';
      const selected = matchedTier === t && Boolean(selectedPackage);
      values[`[${key}_Rahmen_L]`] = selected ? 'border:3px solid #2D84C1;border-right:0;' : '';
      values[`[${key}_Rahmen_R]`] = selected ? 'border:3px solid #2D84C1;border-left:0;' : '';
      values[`[${key}_Preis]`] = formatEuro(price);
      values[`[${key}_Stundenpreis]`] = formatEuro(getHourlyRate(h));
      values[`[${key}_Rate]`] = formatEuro(price / months);
    });
    const rowStyle = TIER_EMAIL_STYLES.individuell + 'padding:14px 16px;border:3px solid #2D84C1;';
    values['[Individuell_Zeile]'] = selectedPackage && !matchedTier
      ? `<tr><td style="${rowStyle}border-right:0;border-radius:10px 0 0 10px;"><strong>${selectedPackage.name}</strong> <span style="display:inline-block;background-color:#2D84C1;color:#FFFFFF;font-size:10px;font-weight:700;letter-spacing:1px;padding:3px 9px;border-radius:10px;vertical-align:middle;">DEIN PAKET</span><br><span style="font-size:12px;">${formatHours(selectedPackage.hours)} Unterrichtsstunden &middot; ZR ${formatHours(parseHours(subjectHours.zr))} / ÖR ${formatHours(parseHours(subjectHours.oer))} / StR ${formatHours(parseHours(subjectHours.str))} &middot; ${months} ${months === 1 ? 'Monat' : 'Monate'} &agrave; ${formatEuro(monthlyRate)} &middot; ${formatEuro(hourlyRate)}/h</span></td><td align="right" style="${rowStyle}border-left:0;border-radius:0 10px 10px 0;font-size:18px;font-weight:700;white-space:nowrap;">${formatEuro(selectedPackage.price)}</td></tr>`
      : '';
    SUBJECTS.forEach(sub => {
      const h = parseHours(subjectHours[sub.key]);
      values[`[Stunden_${sub.token}]`] = formatHours(h);
      values[`[Klausuren_${sub.token}]`] = String(Math.round((sub.baseExams * h) / sub.baseHours));
    });
    return values;
  }, [lead, firstName, lastName, salutation, selectedPackage, matchedTier, isElite, cardKey, beginDate, months, hourlyRate, monthlyRate, subjectHours]);

  // Bedingte Blöcke (<!--IF:key-->…<!--/IF:key-->) entfernen, wenn der Wert fehlt
  const applyConditionals = (text: string) => {
    const flags: Record<string, boolean> = {
      paket: Boolean(selectedPackage),
      beginn: Boolean(beginDate),
    };
    flags.angebot = flags.paket || flags.beginn;
    return ['paket', 'beginn', 'angebot'].reduce(
      (acc, key) => acc.replace(new RegExp(`<!--IF:${key}-->([\\s\\S]*?)<!--/IF:${key}-->`, 'g'), flags[key] ? '$1' : ''),
      text
    );
  };

  // Abgewählte Sections (<!--SECTION:key-->…<!--/SECTION:key-->) entfernen,
  // aktive Sections entsperren (nur die Markierungen entfernen).
  const applySectionToggles = (text: string) =>
    OFFER_SECTIONS.reduce((acc, section) => {
      const re = new RegExp(`<!--SECTION:${section.key}-->([\\s\\S]*?)<!--/SECTION:${section.key}-->`, 'g');
      return acc.replace(re, activeSections[section.key] ? '$1' : '');
    }, text);

  const replacePlaceholders = (text: string) => {
    const withSections = applySectionToggles(text);
    const withConditionals = applyConditionals(withSections);
    const replaceAll = (input: string) =>
      Object.entries(placeholderValues).reduce((acc, [token, value]) => acc.split(token).join(value), input);
    return replaceAll(replaceAll(withConditionals));
  };

  const previewSubject = replacePlaceholders(subject);
  const previewBody = replacePlaceholders(body);
  // Vorschau für HTML-Vorlagen: Tags entfernen, damit sie lesbar bleibt
  const previewBodyText = isHtml
    ? previewBody
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h\d|li)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : previewBody;

  const insertPlaceholder = (token: string) => {
    setBody(prev => prev + (prev && !prev.endsWith('\n') ? ' ' : '') + token);
  };

  const toggleSection = (key: string) =>
    setActiveSections(prev => ({ ...prev, [key]: !prev[key] }));

  const selectTemplate = (template: EmailTemplateRow) => {
    setSelectedTemplateId(template.id);
    setIsHtml(Boolean(template.is_html));
    setShowSource(false);
    setSubject(template.subject || '');
    setBody(template.body || '');
    setActiveSections(discoverSections(template.body || ''));
  };

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lead?.email || !previewSubject.trim() || !previewBody.trim()) {
      addToast('E-Mail-Adresse, Betreff und Text sind erforderlich', 'error');
      return;
    }
    setIsSending(true);
    try {
      // HTML-Vorlagen unverändert senden, Klartext in <p>-Absätze wrappen
      const html = isHtml
        ? ASSET_PATHS.reduce((acc, path) => acc.split(`${window.location.origin}${path}`).join(`${PROD_ORIGIN}${path}`), previewBody)
        : previewBody.split('\n').map(line => `<p>${line}</p>`).join('');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht eingeloggt');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            to: lead.email,
            toName: lead.name,
            subject: previewSubject,
            html,
            fromName: OFFER_SENDER.name,
            fromEmail: OFFER_SENDER.email,
            replyTo: OFFER_SENDER.email,
            edgeFunction: 'send-offer-email',
            context: { leadId: lead.id, templateId: selectedTemplateId || null, packageId: isElite ? 'elite' : matchedTier || 'individuell', hours: totalHours, months, subjectHours },
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || result?.details || 'Send failed');
      addToast(`Angebot an ${lead.email} versendet`, 'success');
      await onSent({ packageName: selectedPackage?.name ?? null, beginDate: beginDate || null, price: selectedPackage?.price ?? null, reason: reasonText.trim() || reasonOption || null });
      onClose();
    } catch (error: any) {
      console.error('Error sending offer email:', error);
      addToast(`Versand fehlgeschlagen: ${error.message}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500">Lead: {lead.name} · {lead.email}</p>
              {description && <p className="text-xs text-gray-500">{description}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSend} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {/* Grund der Unqualifizierung */}
          {askReason && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warum unqualifiziert?</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                {['Zu teuer', 'aktuell noch in einem anderen Rep'].map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setReasonOption(prev => (prev === option ? '' : option))}
                    className={`text-left p-2.5 rounded-lg border transition-colors ${
                      reasonOption === option ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{option}</p>
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={reasonText}
                onChange={e => setReasonText(e.target.value)}
                placeholder="Sonstiger Grund..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          )}

          {/* Template-Auswahl */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail-Vorlage</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {templates.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => selectTemplate(template)}
                  className={`text-left p-2.5 rounded-lg border transition-colors ${
                    selectedTemplateId === template.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{template.icon} {template.title}</p>
                  {template.description && <p className="text-xs text-gray-500 truncate">{template.description}</p>}
                </button>
              ))}
            </div>
          </div>

          {/* Anrede / Vorname / Nachname (Anrede wird standardmäßig aus dem Vornamen erkannt) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Anrede</label>
              <select
                value={salutation}
                onChange={e => setSalutation(e.target.value as Salutation)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {(Object.keys(SALUTATION_LABELS) as Salutation[]).map(k => <option key={k} value={k}>{SALUTATION_LABELS[k]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vorname</label>
              <input
                type="text"
                value={firstName}
                onChange={e => { setFirstName(e.target.value); setSalutation(guessSalutation(e.target.value)); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nachname</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* ELITE Kleingruppe: festes Paket, nur Beginn wählbar */}
          {showPackageFields && isElite && (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm font-semibold text-gray-900">{ELITE_PACKAGE.name}</p>
            <p className="text-xs text-gray-600">max. 8 Teilnehmer · 310 Std. + 72 Std. Wiederholung = {ELITE_PACKAGE.hours} Std. · {formatEuro(ELITE_PACKAGE.price)} · {ELITE_PACKAGE.installments} Raten à {formatEuro(ELITE_PACKAGE.installment)}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Geplanter Beginn</label>
              <input
                type="date"
                value={beginDate}
                onChange={e => setBeginDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
          )}

          {/* Paket: PLATIN / GOLD / individuell, Stundenverteilung, Laufzeit */}
          {showPackageFields && !isElite && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <PackageIcon className="h-4 w-4 mr-1" />Paket
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['platin', 'gold'] as OfferTier[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => chooseTier(t)}
                    style={{
                      background: t === 'platin'
                        ? 'linear-gradient(135deg,#f8fafc 0%,#cfd6de 25%,#ffffff 45%,#aeb7c2 70%,#e9edf1 100%)'
                        : 'linear-gradient(135deg,#fff6c9 0%,#e8c14f 25%,#fff3b0 45%,#c9972b 70%,#f3d878 100%)',
                    }}
                    className={`text-left p-3 rounded-lg border-2 shadow-sm transition-all hover:brightness-105 ${
                      matchedTier === t
                        ? (t === 'platin' ? 'border-slate-500 ring-2 ring-slate-400/60 shadow-md' : 'border-amber-600 ring-2 ring-amber-500/60 shadow-md')
                        : (t === 'platin' ? 'border-slate-300 opacity-80' : 'border-amber-300 opacity-80')
                    }`}
                  >
                    <p className={`text-base font-bold tracking-widest ${t === 'platin' ? 'text-slate-700' : 'text-amber-900'}`}>{t.toUpperCase()}</p>
                    <p className={`text-xs ${t === 'platin' ? 'text-slate-600' : 'text-amber-800'}`}>{TIER_HOURS[t]} Unterrichtsstunden</p>
                  </button>
                ))}
              </div>
              {!matchedTier && <p className="mt-1 text-xs text-amber-600">Individuelles Angebot (abweichende Stundenzahl)</p>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Gesamtstunden</label>
                <input
                  type="number" min="0" step="0.5"
                  value={totalHoursInput}
                  onChange={e => changeTotal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              {SUBJECTS.map(sub => (
                <div key={sub.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{sub.label}</label>
                  <input
                    type="number" min="0" step="0.5"
                    value={subjectHours[sub.key]}
                    onChange={e => setSubjectHours(prev => ({ ...prev, [sub.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              ))}
            </div>
            <p className={`text-sm font-medium ${remaining === 0 ? 'text-green-600' : 'text-amber-600'}`}>
              {remaining === 0
                ? `✓ Verteilung geht auf (${formatHours(distributed)} von ${formatHours(totalHours)} Std.)`
                : remaining > 0
                  ? `Noch ${formatHours(remaining)} Std. zu verteilen`
                  : `${formatHours(-remaining)} Std. zu viel verteilt`}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Laufzeit</label>
                <select
                  value={months}
                  onChange={e => setMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {MONTH_OPTIONS.map(m => <option key={m} value={m}>{m} {m === 1 ? 'Monat' : 'Monate'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Geplanter Beginn</label>
                <input
                  type="date"
                  value={beginDate}
                  onChange={e => setBeginDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 text-center">
              <div><p className="text-xs text-gray-500">Gesamtpreis</p><p className="text-sm font-semibold text-gray-900">{formatEuro(totalPrice)}</p></div>
              <div><p className="text-xs text-gray-500">Stundenpreis</p><p className="text-sm font-semibold text-gray-900">{formatEuro(hourlyRate)}</p></div>
              <div><p className="text-xs text-gray-500">Monatliche Rate</p><p className="text-sm font-semibold text-gray-900">{formatEuro(monthlyRate)}</p></div>
            </div>
          </div>
          )}

          {/* Bausteine der E-Mail: einzeln ein-/ausblendbar */}
          {Object.keys(activeSections).length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(prev => !prev)}
              aria-expanded={showAdvanced}
              className="flex w-full items-center justify-between text-sm font-medium text-gray-700 mb-1"
            >
              <span>Erweiterte Einstellungen · Bausteine der E-Mail</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
            {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {OFFER_SECTIONS.filter(s => s.key in activeSections).map(section => (
                <label key={section.key} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeSections[section.key]}
                    onChange={() => toggleSection(section.key)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">{section.label}</span>
                </label>
              ))}
            </div>
            )}
          </div>
          )}

          {/* Betreff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Betreff</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* HTML-Vorlage: gerenderte Vorschau statt Quelltext */}
          {isHtml && !showSource ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Vorschau der E-Mail</label>
                <button
                  type="button"
                  onClick={() => setShowSource(true)}
                  className="text-xs text-gray-500 underline hover:text-primary"
                >
                  Quelltext bearbeiten
                </button>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-sm font-semibold text-gray-900">{previewSubject}</p>
                <iframe
                  title="E-Mail-Vorschau"
                  sandbox=""
                  srcDoc={previewBody}
                  className="h-[520px] w-full rounded border border-gray-200 bg-white"
                />
              </div>

            </div>
          ) : (
          <div>
            {isHtml && (
              <button type="button" onClick={() => setShowSource(false)} className="mb-2 text-xs text-gray-500 underline hover:text-primary">
                Zurück zur Vorschau
              </button>
            )}
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Nachricht</label>
              <div className="flex items-center gap-1">
                {PLACEHOLDERS.map(p => (
                  <button
                    key={p.token}
                    type="button"
                    onClick={() => insertPlaceholder(p.token)}
                    title={`Platzhalter ${p.token} einfügen`}
                    className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-primary/10 hover:text-primary"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Platzhalter werden beim Versand ersetzt: {PLACEHOLDERS.map(p => p.token).join(' ')}
            </p>
          </div>
          )}

          {/* Vorschau */}
          {showPreview && !(isHtml && !showSource) && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Vorschau</p>
              <p className="text-sm font-semibold text-gray-900 mb-2">{previewSubject}</p>
              {isHtml ? (
                <iframe
                  title="E-Mail-Vorschau"
                  sandbox=""
                  srcDoc={previewBody}
                  className="h-[420px] w-full rounded border border-gray-200 bg-white"
                />
              ) : (
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{previewBodyText}</div>
              )}
            </div>
          )}

          </div>
          <div className="flex shrink-0 justify-end space-x-3 border-t border-gray-200 p-4 sm:p-6">
            {!(isHtml && !showSource) && (
            <button
              type="button"
              onClick={() => setShowPreview(prev => !prev)}
              className="flex items-center px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <Eye className="h-4 w-4 mr-1.5" />{showPreview ? 'Vorschau ausblenden' : 'Vorschau'}
            </button>
            )}
            {allowSkip && onSkip && (
              <button
                type="button"
                onClick={async () => { await onSkip(reasonText.trim() || reasonOption); onClose(); }}
                disabled={isSending}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                {skipLabel}
              </button>
            )}
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSending || !lead.email}
              className="flex items-center px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
            >
              <Send className="h-4 w-4 mr-1.5" />{isSending ? 'Wird gesendet...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
