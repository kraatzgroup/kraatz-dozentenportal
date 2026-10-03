import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  Calendar,
  ChevronRight,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  FileText,
  GraduationCap,
  MessageSquare,
  Phone,
  Plus,
  Users,
  X,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react';
import { CalBooking, Lead, TrialLesson, useSalesStore } from '../../store/salesStore';
import { useToastStore } from '../../store/toastStore';
import { LeadCreateModal } from './LeadCreateModal';
import { PipelineOfferModal } from './PipelineOfferModal';
import { PipelineTrialModal, TrialRequestData } from './PipelineTrialModal';
import { LeadHistoryModal } from './LeadHistoryModal';
import { getNextMondayDateTime, toDateTimeLocal } from './dateDefaults';

interface SalesKanbanOverviewProps {
  calBookings: CalBooking[];
  leads: Lead[];
  onCreateLead: (data: Partial<Lead>) => Promise<void>;
  onUpdateLead: (id: string, data: Partial<Lead>) => Promise<void>;
  trialLessons: TrialLesson[];
  onCreateTrialLesson: (data: Partial<TrialLesson>) => Promise<void>;
}

interface PipelineItem {
  id: string;
  lead: Lead | null;
  calBooking: CalBooking | null;
  title: string;
  status: Lead['status'];
  date: string | null;
  time: string | null;
  startsAt: string | null;
  participant: string | null;
  email: string | null;
  phone: string | null;
  studyLocation: string | null;
  examGoal: string | null;
  consultationWishes: string | null;
  meetingUrl: string | null;
  description: string | null;
  source: 'cal' | 'manual';
  column: ColumnDef['id'];
  hint: string | null;
  offerLines: string[];
  escalated: boolean;
  trialStatus: string | null;
  trialRejected: string | null;
  rejectedTrial: TrialLesson | null;
  downsellInfo: string | null;
  downsellMailSent: boolean;
  downsellReason: string | null;
  offerPackageLine: string | null;
}

// Kommende Termine zuerst (nach Startzeit), Terminlose ans Ende
const sortByStartsAt = (arr: PipelineItem[]) =>
  [...arr].sort((a, b) => {
    if (!a.startsAt) return 1;
    if (!b.startsAt) return -1;
    return a.startsAt.localeCompare(b.startsAt);
  });

interface ColumnDef {
  id: Lead['status'];
  label: string;
  statuses: Lead['status'][];
  className: string;
  headingClassName: string;
  badgeClassName: string;
  icon: React.ComponentType<{ className?: string }>;
}

const COLUMNS: ColumnDef[] = [
  {
    id: 'new', label: 'Beratungsgespräch', statuses: ['new'],
    className: 'border-blue-200 bg-blue-50/95', headingClassName: 'text-blue-900', badgeClassName: 'bg-blue-200 text-blue-900', icon: Phone,
  },
  {
    id: 'offer_sent', label: 'Angebot', statuses: ['offer_sent'],
    className: 'border-amber-200 bg-amber-50/95', headingClassName: 'text-amber-900', badgeClassName: 'bg-amber-200 text-amber-900', icon: FileText,
  },
  {
    id: 'post_offer_call', label: '2. Gespräch', statuses: ['post_offer_call'],
    className: 'border-orange-200 bg-orange-50/95', headingClassName: 'text-orange-900', badgeClassName: 'bg-orange-200 text-orange-900', icon: MessageSquare,
  },
  {
    id: 'trial_pending', label: 'Probestunde', statuses: ['trial_pending'],
    className: 'border-purple-200 bg-purple-50/95', headingClassName: 'text-purple-900', badgeClassName: 'bg-purple-200 text-purple-900', icon: GraduationCap,
  },
  {
    id: 'finalgespraech', label: 'Finalgespräch', statuses: ['post_trial_call', 'finalgespraech', 'vertragsanforderung', 'vertrag_versendet', 'contract_closed'],
    className: 'border-rose-200 bg-rose-50/95', headingClassName: 'text-rose-900', badgeClassName: 'bg-rose-200 text-rose-900', icon: Users,
  },
  {
    id: 'downsell', label: 'Downsell / Unqualifiziert', statuses: ['downsell', 'unqualified'],
    className: 'border-gray-300 bg-gray-50/95', headingClassName: 'text-gray-700', badgeClassName: 'bg-gray-200 text-gray-700', icon: TrendingDown,
  },
  {
    id: 'closed', label: 'Abgeschlossen', statuses: ['closed'],
    className: 'border-green-200 bg-green-50/95', headingClassName: 'text-green-900', badgeClassName: 'bg-green-200 text-green-900', icon: CheckCircle2,
  },
];

const COLLAPSED_LIMIT = 5;

const FOLLOW_UP_AFTER_OFFER_MS = 24 * 60 * 60 * 1000;
const FOLLOW_UP_ESCALATION_MS = 48 * 60 * 60 * 1000;
const PAST_CALLS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const PAST_CALLS_PREVIEW = 6;

const TERMINAL_STATUSES: Lead['status'][] = [];

const STATUS_LABELS: Record<string, string> = {
  new: 'Beratungsgespräch',
  offer_sent: 'Angebot',
  post_offer_call: '2. Gespräch',
  trial_pending: 'Probestunde',
  post_trial_call: 'Finalgespräch',
  finalgespraech: 'Finalgespräch',
  vertragsanforderung: 'Vertragsanforderung',
  vertrag_versendet: 'Vertrag versendet',
  contract_closed: 'Vertrag geschlossen',
  closed: 'Abgeschlossen',
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateKeyFromValue = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatDateKey(date);
};

const getNextWorkingDay = (date: Date) => {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  return next;
};

const formatDayLabel = (date: Date) =>
  date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });

const formatLongDate = (value: string) => {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Angebotsinfos für die Karte: "Angebot versendet am …" sowie Paket und Start, soweit vorhanden
const formatEuro = (value: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);

// Angebotsinfos für die Karte: "Angebot versendet am … um …" sowie Paket (mit Preis) und Start
// Relative Zeit seit Versand (nur unter 24 Stunden anzeigen)
const getSentAgo = (sentAt: string, now: number) => {
  const diffMs = now - new Date(sentAt).getTime();
  if (diffMs < 0 || diffMs >= FOLLOW_UP_AFTER_OFFER_MS) return null;
  if (diffMs < 60_000) return 'gerade eben versendet';
  if (diffMs < 3_600_000) return `versendet vor ${Math.floor(diffMs / 60_000)} Minuten`;
  return `versendet vor ${Math.floor(diffMs / 3_600_000)} Stunden`;
};

const getOfferLines = (lead: Lead, now: number) => {
  if (!['offer_sent', 'post_offer_call'].includes(lead.status) || !lead.offer_sent_at) return [];
  const sent = new Date(lead.offer_sent_at);
  const sentOn = Number.isNaN(sent.getTime()) ? null : `Angebot versendet am ${formatLongDate(lead.offer_sent_at)} um ${sent.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
  const price = lead.offer_price != null ? ` · ${formatEuro(lead.offer_price)}` : '';
  const details = lead.offer_package ? `💰 ${lead.offer_package}${price}` : null;
  const ago = getSentAgo(lead.offer_sent_at, now);
  // Unter 24h nur die relative Zeit zeigen, ab 24h den vollen Versandzeitpunkt
  return (ago ? [ago, details] : [sentOn, details]).filter((line): line is string => Boolean(line));
};

const formatTime = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

const getExamTag = (examGoal: string | null | undefined) => {
  const normalized = examGoal?.toLocaleLowerCase('de-DE') || '';
  if (normalized.includes('1. examen') || normalized.includes('1. staatsexamen')) return '1. Examen';
  if (normalized.includes('2. examen') || normalized.includes('2. staatsexamen')) return '2. Examen';
  if (normalized.includes('zwischenprüfung')) return 'Zwischenprüfung';
  return null;
};

const getBookingStatusLabel = (status: string | null | undefined) => {
  switch (status?.toLowerCase()) {
    case 'accepted': return 'Bestätigt';
    case 'pending': return 'Ausstehend';
    case 'unconfirmed': return 'Nicht bestätigt';
    default: return status || null;
  }
};

const getSafeHttpUrl = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

interface DraggableCardProps {
  item: PipelineItem;
  isNew: boolean;
  onSelect: (item: PipelineItem) => void;
}

function CardContent({ item, isNew }: { item: PipelineItem; isNew: boolean }) {
  const examTag = getExamTag(item.examGoal);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold text-slate-900">{item.title}</p>
        <span className="flex shrink-0 flex-wrap items-center gap-1">
          {item.column === 'trial_pending' && item.trialStatus && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
              item.trialStatus === 'findet gerade statt' ? 'bg-blue-100 text-blue-800'
              : item.trialStatus === 'angenommen' ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-700'
            }`}>{item.trialStatus}</span>
          )}
          {examTag && <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">{examTag}</span>}
        </span>
      </div>
      {item.offerLines.length === 0 && item.column !== 'trial_pending' && item.column !== 'downsell' && item.column !== 'closed' && !(item.hint && item.hint.startsWith('Probestunde beendet')) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>{item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : 'Termin offen'}</span>
          {item.time && <span className="flex items-center gap-1 text-blue-600"><Clock className="h-3 w-3" />{item.time}</span>}
        </div>
      )}
      {isNew && item.date && new Date(`${item.date}T12:00:00`).getTime() < Date.now() && (
        <p className="mt-1 text-xs font-medium text-amber-600">Vergangener Call</p>
      )}
      {(item.column === 'trial_pending' || item.column === 'finalgespraech' || item.column === 'closed') && item.offerPackageLine && (
        <p className="mt-1 text-xs text-amber-800">{item.offerPackageLine}</p>
      )}
      {item.column === 'downsell' ? (
        <>
          {item.downsellMailSent ? (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-teal-700">
              <Mail className="h-3 w-3 shrink-0" />{item.downsellInfo}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">{item.downsellInfo}</p>
          )}
          {item.downsellReason && <p className="mt-1 text-xs text-slate-500">Grund: {item.downsellReason}</p>}
        </>
      ) : item.column === 'post_offer_call' ? (
        <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${item.escalated ? 'text-rose-700' : 'text-orange-700'}`}>
          <Phone className="h-3 w-3 shrink-0" />Bitte anrufen{item.escalated ? ' – überfällig' : ''}
        </p>
      ) : (
        <>
          {item.offerLines.length > 0 && (
            <div className="mt-1 space-y-0.5 text-xs text-amber-800">
              {item.offerLines.map((line, index) => (
                <p key={line} className="flex items-center gap-1">
                  {index === 0 && <Mail className="h-3 w-3 shrink-0" />}
                  <span>{line}</span>
                </p>
              ))}
            </div>
          )}
          {item.hint && (
            <p className={`mt-1 text-xs font-medium ${
              item.trialRejected
                ? 'text-rose-700'
                : item.column === 'trial_pending'
                  ? 'text-purple-700'
                  : item.hint.includes('fällig') ? 'text-amber-600' : 'text-slate-500'
            }`}>{item.hint}</p>
          )}
        </>
      )}
      {item.description && <p className="mt-1 truncate text-xs text-slate-500">{item.description}</p>}
    </>
  );
}

function DraggableCard({ item, isNew, onSelect }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`Details öffnen: ${item.title}`}
      onClick={() => onSelect(item)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(item);
        }
      }}
      className={`cursor-grab select-none rounded-md border bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 active:cursor-grabbing ${
        item.escalated ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <CardContent item={item} isNew={isNew} />
    </div>
  );
}

interface ColumnProps {
  column: ColumnDef;
  items: PipelineItem[];
  onSelect: (item: PipelineItem) => void;
  onNewLead: () => void;
}

function PipelineColumn({ column, items, onSelect, onNewLead }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const Icon = column.icon;
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > COLLAPSED_LIMIT;
  const visibleItems = expanded || !hasMore ? items : items.slice(0, COLLAPSED_LIMIT + 1);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[330px] flex-col rounded-xl border p-3 transition-shadow ${column.className} ${
        isOver ? 'ring-2 ring-blue-400 ring-offset-1' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className={`flex items-center gap-2 text-sm font-semibold ${column.headingClassName}`}>
          <Icon className="h-4 w-4" />{column.label}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          {column.id === 'new' && (
            <button
              type="button"
              onClick={onNewLead}
              title="Lead / Call manuell anlegen"
              aria-label="Lead oder Beratungsgespräch manuell anlegen"
              className="flex h-7 items-center gap-1 rounded-md bg-blue-600 px-2 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Lead</span>
            </button>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${column.badgeClassName}`}>{items.length}</span>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-3 text-center text-xs text-slate-500">
          Karte hierher ziehen
        </p>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item, index) => {
            const isFadedPreview = !expanded && hasMore && index === COLLAPSED_LIMIT;
            return isFadedPreview ? (
              <div
                key={item.id}
                aria-hidden="true"
                className="pointer-events-none max-h-14 overflow-hidden"
                style={{
                  maskImage: 'linear-gradient(to bottom, black 10%, transparent)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 10%, transparent)',
                }}
              >
                <DraggableCard item={item} isNew={item.status === 'new'} onSelect={onSelect} />
              </div>
            ) : (
              <DraggableCard key={item.id} item={item} isNew={item.status === 'new'} onSelect={onSelect} />
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded(prev => !prev)}
              className={`w-full rounded-md py-1.5 text-xs font-medium transition hover:bg-white/70 ${column.headingClassName}`}
            >
              {expanded ? 'Weniger anzeigen' : `Mehr anzeigen (${items.length - COLLAPSED_LIMIT})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SalesKanbanOverview({
  calBookings,
  leads,
  onCreateLead,
  onUpdateLead,
  trialLessons,
  onCreateTrialLesson,
}: SalesKanbanOverviewProps) {
  const { addToast } = useToastStore();
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [isLeadCreateModalOpen, setIsLeadCreateModalOpen] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [offerLead, setOfferLead] = useState<Lead | null>(null);
  const [downsellRequest, setDownsellRequest] = useState<Lead | null>(null);
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);
  const [trialRequest, setTrialRequest] = useState<{ lead: Lead; initial: TrialRequestData | null; rejectedDozentId: string | null; rejectedDozentName: string | null } | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const today = useMemo(() => new Date(), []);
  const todayKey = formatDateKey(today);
  const nextWorkingDay = useMemo(() => getNextWorkingDay(today), [today]);
  const nextWorkingDayKey = formatDateKey(nextWorkingDay);
  const tomorrow = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    return date;
  }, [today]);
  const isNextWorkingDayTomorrow = formatDateKey(tomorrow) === nextWorkingDayKey;

  const items = useMemo<PipelineItem[]>(() => {
    const now = Date.now();

    const formatStamp = (ms: number) =>
      new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    // Neueste (nicht abgesagte) Probestunde je Lead
    const trialByLead = new Map<string, TrialLesson>();
    trialLessons
      .filter(t => t.lead_id && !['cancelled', 'no_show'].includes(t.status))
      .forEach(t => {
        const prev = trialByLead.get(t.lead_id!);
        if (!prev || (t.scheduled_date || '') > (prev.scheduled_date || '')) trialByLead.set(t.lead_id!, t);
      });

    // Neueste Probestunde je Lead inkl. abgelehnter (für Ablehnungs-ToDo)
    const latestTrialByLead = new Map<string, TrialLesson>();
    trialLessons
      .filter(t => t.lead_id)
      .forEach(t => {
        const prev = latestTrialByLead.get(t.lead_id!);
        if (!prev || (t.updated_at || '') > (prev.updated_at || '')) latestTrialByLead.set(t.lead_id!, t);
      });

    // Spalte + Hinweis je Lead: 2. Gespräch = Follow-up-Anruf spätestens 24h nach Angebot,
    // Finalgespräch = nach Ende der Probestunde
    const placeLead = (lead: Lead): { column: ColumnDef['id']; hint: string | null } => {
      switch (lead.status) {
        case 'new':
          return { column: 'new', hint: null };
        case 'offer_sent': {
          if (!lead.offer_sent_at) return { column: 'offer_sent', hint: null };
          const due = new Date(lead.offer_sent_at).getTime() + FOLLOW_UP_AFTER_OFFER_MS;
          return now >= due
            ? { column: 'post_offer_call', hint: `Follow-up-Anruf fällig seit ${formatStamp(due)}` }
            : { column: 'offer_sent', hint: null };
        }
        case 'post_offer_call':
          return { column: 'post_offer_call', hint: 'Follow-up-Anruf (Mario Kraatz)' };
        case 'downsell':
          return { column: 'downsell', hint: null };
        case 'unqualified':
          return { column: 'downsell', hint: 'Unqualifiziert' };
        case 'closed':
          return { column: 'closed', hint: null };
        case 'trial_pending':
        case 'post_trial_call': {
          const trial = trialByLead.get(lead.id);
          if (trial?.scheduled_date) {
            const start = new Date(trial.scheduled_date).getTime();
            const end = start + (trial.duration || 60) * 60000;
            const dozent = trial.dozent_name || 'Dozent';
            const rechtsgebiet = trial.rechtsgebiet ? ` im ${trial.rechtsgebiet}` : '';
            const trialHint = `Probestunde angefragt für ${formatStamp(start)} Uhr, ${trial.duration || 60} Min., bei ${dozent}${rechtsgebiet}`;
            return now < end
              ? { column: 'trial_pending', hint: trialHint }
              : { column: 'finalgespraech', hint: `Probestunde beendet – Termin war ${formatStamp(start)} Uhr` };
          }
          if (trial) return { column: 'trial_pending', hint: 'Probestunde angefragt – Termin offen' };
          return { column: lead.status === 'post_trial_call' ? 'finalgespraech' : 'trial_pending', hint: null };
        }
        default:
          return { column: 'finalgespraech', hint: null };
      }
    };

    // Leads sind die persistente Datenquelle der Pipeline
    const leadItems: PipelineItem[] = leads
      .filter(lead => !TERMINAL_STATUSES.includes(lead.status))
      .map(lead => {
        const placed = placeLead(lead);
        // Abgelehnte Probestunde: Dozent hat abgesagt -> neu anfragen
        let trialRejected: string | null = null;
        const latestTrial = latestTrialByLead.get(lead.id);
        if (latestTrial?.status === 'cancelled') {
          const dt = latestTrial.scheduled_date ? formatStamp(new Date(latestTrial.scheduled_date).getTime()) : 'Termin offen';
          trialRejected = `Probestunde neu anfragen – Dozent ${latestTrial.dozent_name || 'XY'} hat die Probestunde für ${dt} abgelehnt`;
        }

        // Downsell: Infomail Kraatz Club versendet oder nichts gesendet
        let downsellInfo: string | null = null;
        let downsellMailSent = false;
        if (placed.column === 'downsell') {
          if (lead.downsell_mail_sent_at) {
            downsellMailSent = true;
            downsellInfo = `Angebot Kraatz Club versendet am ${formatStamp(new Date(lead.downsell_mail_sent_at).getTime())} Uhr`;
          } else {
            downsellInfo = 'Nichts gesendet';
          }
        }
        const downsellReason = placed.column === 'downsell' ? lead.downsell_reason : null;
        const offerPackageLine = lead.offer_package
          ? `💰 ${lead.offer_package}${lead.offer_price != null ? ` · ${formatEuro(lead.offer_price)}` : ''}`
          : null;

        // Status-Tag der Probestunde: noch ausstehend / angenommen / findet gerade statt
        let trialStatus: string | null = null;
        if (placed.column === 'trial_pending') {
          const trial = trialByLead.get(lead.id);
          if (trial?.scheduled_date) {
            const start = new Date(trial.scheduled_date).getTime();
            const end = start + (trial.duration || 60) * 60000;
            if (now >= start && now < end) trialStatus = 'findet gerade statt';
            else if (['confirmed', 'scheduled', 'completed'].includes(trial.status) || trial.dozent_confirmed) trialStatus = 'angenommen';
            else trialStatus = 'noch ausstehend';
          } else if (trial) {
            trialStatus = 'noch ausstehend';
          }
        }
        return {
        ...placed,
        hint: trialRejected ?? placed.hint,
        escalated: placed.column === 'post_offer_call'
          && lead.offer_sent_at !== null
          && now - new Date(lead.offer_sent_at).getTime() >= FOLLOW_UP_ESCALATION_MS,
        offerLines: getOfferLines(lead, now),
        trialStatus,
        trialRejected,
        rejectedTrial: latestTrial?.status === 'cancelled' ? latestTrial : null,
        downsellInfo,
        downsellMailSent,
        downsellReason,
        offerPackageLine,
        id: `lead-${lead.id}`,
        lead,
        calBooking: null,
        title: lead.name,
        status: lead.status,
        date: dateKeyFromValue(lead.booking_date),
        time: formatTime(lead.booking_date),
        startsAt: lead.booking_date,
        participant: lead.name,
        email: lead.email,
        phone: lead.phone,
        studyLocation: lead.study_location,
        examGoal: lead.study_goal,
        consultationWishes: lead.notes,
        meetingUrl: null,
        description: null,
        source: lead.cal_booking_id ? 'cal' as const : 'manual' as const,
        };
      });

    // Cal.com-Bookings ohne zugehörigen Lead (noch nicht synchronisiert):
    // nur kommende/laufende anzeigen — vergangene Calls laufen über die Leads.
    const bookingItems: PipelineItem[] = calBookings
      .filter(booking => booking.status?.toLowerCase() !== 'cancelled')
      .filter(booking => new Date(booking.end_time).getTime() >= now)
      .filter(booking => !leads.some(lead => lead.cal_booking_id === String(booking.cal_booking_id)))
      .map(booking => ({
        id: `cal-booking-${booking.id}`,
        lead: null,
        calBooking: booking,
        title: booking.attendee_name ? `Beratungsgespräch mit ${booking.attendee_name}` : booking.title || 'Beratungsgespräch',
        status: 'new' as const,
        date: dateKeyFromValue(booking.start_time),
        time: formatTime(booking.start_time),
        startsAt: booking.start_time,
        participant: booking.attendee_name,
        email: booking.attendee_email,
        phone: booking.attendee_phone,
        studyLocation: booking.study_location || booking.location,
        examGoal: booking.exam_goal ?? null,
        consultationWishes: booking.consultation_wishes ?? null,
        meetingUrl: booking.meeting_url,
        description: booking.description && !getSafeHttpUrl(booking.description) ? booking.description : null,
        source: 'cal' as const,
        column: 'new' as const,
        hint: null,
        offerLines: [],
        escalated: false,
        trialStatus: null,
        trialRejected: null,
        rejectedTrial: null,
        downsellInfo: null,
        downsellMailSent: false,
        downsellReason: null,
        offerPackageLine: null,
      }));

    return [...leadItems, ...bookingItems];
  }, [leads, calBookings, trialLessons]);

  // Vergangene/laufende Calls ohne Folgeschritt landen oben als To-Do, nicht in der Spalte
  const isPastCall = (item: PipelineItem) =>
    item.status === 'new' && Boolean(item.startsAt) && new Date(item.startsAt!).getTime() <= Date.now();

  const pastCalls = useMemo(
    () => items
      .filter(isPastCall)
      // Nur die letzten 14 Tage anzeigen
      .filter(item => Date.now() - new Date(item.startsAt!).getTime() <= PAST_CALLS_WINDOW_MS)
      .sort((a, b) => (b.startsAt || '').localeCompare(a.startsAt || '')),
    [items]
  );

  // Follow-up-Anrufe (2. Gespräch): To-Do oben unter den kommenden Gesprächen
  const followUpDue = useMemo(
    () => items
      .filter(item => item.column === 'post_offer_call')
      .sort((a, b) => {
        const da = a.lead?.offer_sent_at || '9999';
        const db = b.lead?.offer_sent_at || '9999';
        return da.localeCompare(db) || a.title.localeCompare(b.title);
      }),
    [items]
  );

  // Über 48 Stunden ohne Rückruf: ganz oben, rot umrandet
  const followUpEscalated = useMemo(() => followUpDue.filter(item => item.escalated), [followUpDue]);

  // Abgelehnte Probestunden: oben als ToDo, neu anfragen
  const rejectedTrials = useMemo(() => items.filter(item => item.trialRejected), [items]);

  // Finalgespräche: als ToDo oben, parallel zu den 2. Gesprächen
  const finalDue = useMemo(
    () => items
      .filter(item => item.column === 'finalgespraech')
      .sort((a, b) => {
        const aTrial = a.hint?.startsWith('Probestunde beendet') ? 0 : 1;
        const bTrial = b.hint?.startsWith('Probestunde beendet') ? 0 : 1;
        if (aTrial !== bTrial) return aTrial - bTrial;
        const da = a.lead?.final_call_date || '9999';
        const db = b.lead?.final_call_date || '9999';
        return da.localeCompare(db) || a.title.localeCompare(b.title);
      }),
    [items]
  );

  const itemsByColumn = useMemo(() => {
    const map = new Map<ColumnDef['id'], PipelineItem[]>();
    COLUMNS.forEach(column => map.set(column.id, []));
    items.forEach(item => {
      if (isPastCall(item)) return;
      map.get(item.column)?.push(item);
    });
    map.forEach((arr, key) => {
      if (key === 'post_offer_call') {
        // 2. Gespräch: älteste Einträge zuerst (längste Wartezeit)
        map.set(key, [...arr].sort((a, b) => {
          const da = a.lead?.offer_sent_at || '9999';
          const db = b.lead?.offer_sent_at || '9999';
          return da.localeCompare(db);
        }));
      } else {
        map.set(key, sortByStartsAt(arr));
      }
    });
    return map;
  }, [items]);

  // Anstehende Beratungsgespräche (Status 'new', noch nicht begonnen)
  const newItems = useMemo(() => items.filter(item => item.status === 'new' && !isPastCall(item)), [items]);
  const todosByDay = useMemo(() => ({
    today: sortByStartsAt(newItems.filter(item => item.date === todayKey)),
    nextWorkingDay: sortByStartsAt(newItems.filter(item => item.date === nextWorkingDayKey)),
  }), [newItems, nextWorkingDayKey, todayKey]);

  const renderTodoList = (todoItems: PipelineItem[], emptyLabel: string) => (
    <div className="space-y-2">
      {todoItems.length === 0 ? (
        <p className="py-3 text-sm text-slate-400">{emptyLabel}</p>
      ) : todoItems.map(item => {
        const examTag = getExamTag(item.examGoal);
        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-label={`Details öffnen: ${item.title}`}
            onClick={() => setSelectedItem(item)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedItem(item);
              }
            }}
            className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 rounded-md bg-slate-100 p-1.5 text-slate-600"><Phone className="h-4 w-4" /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  {examTag && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">{examTag}</span>}
                </div>
                <p className="text-xs text-slate-500">Beratungsgespräch</p>
                {item.description && <p className="mt-1 text-xs text-slate-500">{item.description}</p>}
              </div>
            </div>
            {item.time && <span className="flex shrink-0 items-center gap-1 text-xs text-blue-600"><Clock className="h-3 w-3" />{item.time}</span>}
          </div>
        );
      })}
    </div>
  );

  /**
   * Stellt sicher, dass zu einem Cal.com-Booking ein Lead existiert.
   * Wird beim Verschieben eines reinen Booking-Items benötigt.
   */
  const ensureLead = async (item: PipelineItem): Promise<Lead | null> => {
    if (item.lead) return item.lead;
    if (!item.calBooking) return null;
    if (!item.email) {
      addToast('Keine E-Mail-Adresse vorhanden — Lead kann nicht angelegt werden', 'error');
      return null;
    }
    const nameParts = (item.participant || '').split(/\s+/).filter(Boolean);
    await onCreateLead({
      name: item.participant || item.email,
      first_name: nameParts[0] || null,
      last_name: nameParts.slice(1).join(' ') || null,
      email: item.email,
      phone: item.phone,
      source: 'cal.com',
      cal_booking_id: String(item.calBooking.cal_booking_id),
      study_goal: item.examGoal,
      study_location: item.studyLocation,
      notes: item.consultationWishes,
      booking_date: item.calBooking.start_time,
      status: 'new',
    });
    // createLead refresht den Store — den frisch angelegten Lead wiederfinden
    const fresh = useSalesStore.getState().leads.find(l => l.cal_booking_id === String(item.calBooking!.cal_booking_id));
    return fresh || null;
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const item = items.find(i => i.id === active.id);
    if (!item) return;
    const column = COLUMNS.find(c => c.id === over.id);
    if (!column) return;
    const targetStatus = column.id;
    if (item.column === column.id && !isPastCall(item)) return;

    const lead = await ensureLead(item);
    if (!lead) return;

    // Spezifische Trigger je nach Ziel-Spalte
    if (targetStatus === 'offer_sent') {
      setOfferLead(lead);
      return;
    }
    if (targetStatus === 'trial_pending') {
      setTrialRequest({ lead, initial: null, rejectedDozentId: null, rejectedDozentName: null });
      return;
    }
    if (targetStatus === 'downsell') {
      setDownsellRequest(lead);
      return;
    }
    // Alle übrigen Verschiebungen: direkter Status-Update
    await onUpdateLead(lead.id, { status: targetStatus });
    addToast(`Status auf „${STATUS_LABELS[targetStatus] || targetStatus}“ gesetzt`, 'success');
  };

  const handleDownsellSent = async (info: { packageName: string | null; beginDate: string | null; price: number | null; reason: string | null }) => {
    if (!downsellRequest) return;
    await onUpdateLead(downsellRequest.id, { status: 'downsell', downsell_mail_sent_at: new Date().toISOString(), downsell_reason: info.reason || null });
    addToast('Kraatz-Club-Mail versendet und Lead verschoben', 'success');
    setDownsellRequest(null);
  };

  const handleDownsellSkip = async (reason: string) => {
    if (!downsellRequest) return;
    await onUpdateLead(downsellRequest.id, { status: 'downsell', downsell_reason: reason || null });
    addToast('Lead ohne Mail verschoben', 'success');
    setDownsellRequest(null);
  };

  const handleOfferSent = async ({ packageName, beginDate, price }: { packageName: string | null; beginDate: string | null; price: number | null }) => {
    if (!offerLead) return;
    await onUpdateLead(offerLead.id, {
      status: 'offer_sent',
      offer_sent_at: new Date().toISOString(),
      offer_package: packageName,
      offer_start_date: beginDate,
      offer_price: price,
    });
    setOfferLead(null);
  };

  const handleTrialSubmit = async (data: TrialRequestData) => {
    if (!trialRequest) return;
    await onCreateTrialLesson({ ...data, status: 'requested' });
    const trialEnd = new Date(data.scheduled_date);
    trialEnd.setMinutes(trialEnd.getMinutes() + data.duration + 60);
    await onUpdateLead(trialRequest.lead.id, { status: 'trial_pending', final_call_date: trialEnd.toISOString() });
    addToast('Probestunde angelegt und beim Dozenten angefragt', 'success');
    setTrialRequest(null);
  };

  const selectedMeetingUrl = getSafeHttpUrl(selectedItem?.meetingUrl);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
    <div className="space-y-6">
      {/* To Do Übersicht */}
      <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">To Dos</h2>
            <p className="mt-1 text-sm text-slate-500">Anstehende Cal.com-Termine und manuell angelegte Beratungsgespräche.</p>
          </div>
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        {followUpEscalated.length > 0 && (
          <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50/70 p-4">
            <h3 className="flex items-center gap-2 font-medium text-rose-900">
              <Phone className="h-4 w-4" />2. Gespräch überfällig
              <span className="text-xs font-normal text-rose-700">({followUpEscalated.length})</span>
            </h3>
            <p className="mt-1 text-xs text-rose-800">Seit mehr als 48 Stunden nicht zurückgerufen – bitte sofort anrufen.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {followUpEscalated.map(item => (
                <DraggableCard key={item.id} item={item} isNew={false} onSelect={setSelectedItem} />
              ))}
            </div>
          </div>
        )}
        {rejectedTrials.length > 0 && (
          <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50/70 p-4">
            <h3 className="flex items-center gap-2 font-medium text-rose-900">
              <GraduationCap className="h-4 w-4" />Probestunde abgelehnt
              <span className="text-xs font-normal text-rose-700">({rejectedTrials.length})</span>
            </h3>
            <p className="mt-1 text-xs text-rose-800">Dozent hat die Probestunde abgelehnt – bitte neu anfragen.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rejectedTrials.map(item => (
                <DraggableCard
                  key={item.id}
                  item={item}
                  isNew={false}
                  onSelect={() => {
                    if (item.lead && item.rejectedTrial) {
                      const t = item.rejectedTrial;
                      setTrialRequest({
                        lead: item.lead,
                        initial: {
                          teilnehmer_name: t.teilnehmer_name || item.lead.name,
                          teilnehmer_email: t.teilnehmer_email || item.lead.email,
                          teilnehmer_phone: t.teilnehmer_phone || item.lead.phone,
                          scheduled_date: toDateTimeLocal(t.scheduled_date) || getNextMondayDateTime(),
                          dozent_id: undefined,
                          rechtsgebiet: t.rechtsgebiet || undefined,
                          uni_standort: t.uni_standort || undefined,
                          landesrecht: t.landesrecht || undefined,
                          notes: t.notes || undefined,
                          duration: t.duration || 60,
                          lead_id: item.lead.id,
                        },
                        rejectedDozentId: t.dozent_id || null,
                        rejectedDozentName: t.dozent_name || null,
                      });
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {(followUpDue.length > 0 || finalDue.length > 0) && (
          <div className={`mb-4 grid gap-4 ${followUpDue.length > 0 && finalDue.length > 0 ? 'lg:grid-cols-2' : ''}`}>
            {followUpDue.length > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-4">
                <h3 className="flex items-center gap-2 font-medium text-orange-900">
                  <Phone className="h-4 w-4" />2. Gespräch – Follow-up fällig
                  <span className="text-xs font-normal text-orange-700">({followUpDue.length})</span>
                </h3>
                <p className="mt-1 text-xs text-orange-800">Angebot vor mehr als 24 Stunden versendet – bitte anrufen.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {followUpDue.map(item => (
                    <DraggableCard key={item.id} item={item} isNew={false} onSelect={setSelectedItem} />
                  ))}
                </div>
              </div>
            )}
            {finalDue.length > 0 && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
                <h3 className="flex items-center gap-2 font-medium text-rose-900">
                  <Users className="h-4 w-4" />Finalgespräch fällig
                  <span className="text-xs font-normal text-rose-700">({finalDue.length})</span>
                </h3>
                <p className="mt-1 text-xs text-rose-800">Probestunde beendet bzw. Finalgespräch offen – weiterverarbeiten.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {finalDue.map(item => (
                    <DraggableCard key={item.id} item={item} isNew={false} onSelect={setSelectedItem} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <h3 className="flex items-center gap-2 font-medium text-blue-900"><Clock className="h-4 w-4" />Heute, {formatDayLabel(today)}<span className="text-xs font-normal text-blue-700">({todosByDay.today.length})</span></h3>
          <div className="mt-3">{renderTodoList(todosByDay.today, 'Keine anstehenden Beratungsgespräche für heute.')}</div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {pastCalls.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <h3 className="flex items-center gap-2 font-medium text-amber-900">
                <Clock className="h-4 w-4" />Zu bearbeiten – stattgefundene Calls
                <span className="text-xs font-normal text-amber-700">({pastCalls.length})</span>
              </h3>
              <p className="mt-1 text-xs text-amber-800">Karte in die passende Pipeline-Spalte ziehen (Angebot, 2. Gespräch, Probestunde …).</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(showAllPast ? pastCalls : pastCalls.slice(0, PAST_CALLS_PREVIEW)).map(item => (
                  <DraggableCard key={item.id} item={item} isNew onSelect={setSelectedItem} />
                ))}
              </div>
              {pastCalls.length > PAST_CALLS_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAllPast(prev => !prev)}
                  className="mt-3 w-full rounded-md py-1.5 text-xs font-medium text-amber-900 transition hover:bg-white/70"
                >
                  {showAllPast ? 'Weniger anzeigen' : `Mehr anzeigen (${pastCalls.length - PAST_CALLS_PREVIEW})`}
                </button>
              )}
            </div>
          )}
          <div className={`rounded-lg border border-slate-200 bg-slate-50 p-4 ${pastCalls.length === 0 ? 'lg:col-start-2' : ''}`}>
            <h3 className="flex items-center gap-2 font-medium text-slate-900"><ChevronRight className="h-4 w-4" />{isNextWorkingDayTomorrow ? 'Morgen' : 'Nächster Werktag'}<span className="text-xs font-normal text-slate-500">{formatDayLabel(nextWorkingDay)} · {todosByDay.nextWorkingDay.length}</span></h3>
            <div className="mt-3">{renderTodoList(todosByDay.nextWorkingDay, 'Keine anstehenden Beratungsgespräche für den nächsten Werktag.')}</div>
          </div>
        </div>
      </section>

      {/* Sales-Pipeline */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Sales-Pipeline</h2>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{newItems.length} Beratungsgespräche</span>
        </div>
          <div className="grid gap-4 overflow-x-auto md:grid-cols-2 xl:grid-cols-7">
            {COLUMNS.map(column => (
              <PipelineColumn
                key={column.id}
                column={column}
                items={itemsByColumn.get(column.id) || []}
                onSelect={column.id === 'downsell'
                  ? (item) => { if (item.lead) setHistoryLead(item.lead); }
                  : setSelectedItem}
                onNewLead={() => setIsLeadCreateModalOpen(true)}
              />
            ))}
          </div>
      </section>

      <LeadCreateModal
        isOpen={isLeadCreateModalOpen}
        onClose={() => setIsLeadCreateModalOpen(false)}
        onCreateLead={onCreateLead}
      />

      {/* Customer Journey */}
      <LeadHistoryModal
        lead={historyLead}
        onClose={() => setHistoryLead(null)}
      />

      {/* Angebot senden */}
      <PipelineOfferModal
        lead={offerLead}
        onClose={() => setOfferLead(null)}
        onSent={handleOfferSent}
      />

      {/* Downsell / Unqualifiziert: Informationsmail Kraatz Club? */}
      <PipelineOfferModal
        lead={downsellRequest}
        templateCategory="kraatzclub"
        title="Angebot Kraatz Club"
        submitLabel="Angebot senden"
        allowSkip
        skipLabel="Nichts senden"
        showPackageFields={false}
        askReason
        onSkip={handleDownsellSkip}
        onClose={() => setDownsellRequest(null)}
        onSent={handleDownsellSent}
      />

      {/* Probestunde anfragen */}
      <PipelineTrialModal
        lead={trialRequest?.lead || null}
        initial={trialRequest?.initial || null}
        rejectedDozentId={trialRequest?.rejectedDozentId || null}
        rejectedDozentName={trialRequest?.rejectedDozentName || null}
        onClose={() => setTrialRequest(null)}
        onSubmit={handleTrialSubmit}
      />

      {/* Detail-Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cal-booking-details-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Beratungsgespräch</p>
                <h3 id="cal-booking-details-title" className="mt-1 text-lg font-semibold text-slate-900">{selectedItem.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                {selectedItem.lead && (
                  <button
                    type="button"
                    onClick={() => { setHistoryLead(selectedItem.lead); }}
                    className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                  >
                    Verlauf
                  </button>
                )}
                <button type="button" onClick={() => setSelectedItem(null)} aria-label="Details schließen" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="space-y-5 text-sm text-slate-700">
              <section className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-3 font-semibold text-slate-900">Meeting-Informationen</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0 text-slate-500" />{selectedItem.date ? new Date(`${selectedItem.date}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Kein Termin'}{selectedItem.time && ` · ${selectedItem.time} Uhr`}</div>
                  {selectedItem.lead && <div className="text-slate-600">Pipeline-Status: <span className="font-medium">{STATUS_LABELS[selectedItem.status] || selectedItem.status}</span></div>}
                  {selectedItem.offerLines.length > 0 && (
                    <div className="mt-2 space-y-0.5 text-amber-800">
                      {selectedItem.offerLines.map(line => <p key={line}>{line}</p>)}
                    </div>
                  )}
                  {selectedItem.calBooking?.status && <div className="text-slate-600">Booking-Status: {getBookingStatusLabel(selectedItem.calBooking.status)}</div>}
                  {selectedItem.description && <p className="whitespace-pre-wrap text-slate-600">{selectedItem.description}</p>}
                </div>
                {selectedMeetingUrl && (
                  <div className="mt-4">
                    <a href={selectedMeetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700"><ExternalLink className="h-4 w-4" />Meeting starten</a>
                  </div>
                )}
              </section>
              <section className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-3 font-semibold text-slate-900">Lead-Informationen</h4>
                <div className="space-y-2">
                  {selectedItem.participant && <div>Name: {selectedItem.participant}</div>}
                  {selectedItem.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-slate-500" />{selectedItem.email}</div>}
                  {selectedItem.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-slate-500" />Telefon: {selectedItem.phone}</div>}
                  {selectedItem.studyLocation && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-slate-500" />Standort: {selectedItem.studyLocation}</div>}
                  {selectedItem.examGoal && <div><span className="font-medium">Prüfungsziel:</span> {selectedItem.examGoal}</div>}
                  {selectedItem.consultationWishes && <div className="border-t border-slate-200 pt-3"><p className="font-medium">Wünsche für die Beratung</p><p className="mt-1 whitespace-pre-wrap">{selectedItem.consultationWishes}</p></div>}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
          <DragOverlay dropAnimation={null}>
            {activeId ? (() => {
              const activeItem = items.find(i => i.id === activeId);
              return activeItem ? (
                <div className="cursor-grabbing rounded-md border border-blue-400 bg-white p-3 shadow-xl ring-2 ring-blue-300">
                  <CardContent item={activeItem} isNew={activeItem.status === 'new'} />
                </div>
              ) : null;
            })() : null}
          </DragOverlay>
    </div>
    </DndContext>
  );
}
