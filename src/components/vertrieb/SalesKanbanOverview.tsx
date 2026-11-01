import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  Pencil,
  Phone,
  Plus,
  Users,
  X,
  TrendingDown,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { CalBooking, Lead, TrialLesson, useSalesStore } from '../../store/salesStore';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../store/toastStore';
import { LeadCreateModal } from './LeadCreateModal';
import { PipelineOfferModal, OfferConfig, deriveOfferConfig } from './PipelineOfferModal';
import { PipelineClosedModal } from './PipelineClosedModal';
import { PipelineTrialModal, TrialRequestData } from './PipelineTrialModal';
import { LeadHistoryModal } from './LeadHistoryModal';
import { LeadEditModal } from './LeadEditModal';
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
  scheduledCallDone: boolean;
  trialStatus: string | null;
  trialRejected: string | null;
  rejectedTrial: TrialLesson | null;
  downsellInfo: string | null;
  downsellMailSent: boolean;
  downsellReason: string | null;
  offerPackageLine: string | null;
}

interface TodoEntry {
  item: PipelineItem;
  /** Zeitstempel des geplanten 2. Gesprächs (ms), sonst null für Beratungsgespräche. */
  scheduledAt: number | null;
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

interface CardAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}

interface DraggableCardProps {
  item: PipelineItem;
  isNew: boolean;
  onSelect: (item: PipelineItem) => void;
  action?: CardAction;
}

// Verhindert, dass Klicks auf Buttons in der Karte einen Drag oder das Detail-Modal auslösen
const stopCardEvents = {
  onPointerDown: (e: React.SyntheticEvent) => e.stopPropagation(),
  onMouseDown: (e: React.SyntheticEvent) => e.stopPropagation(),
  onTouchStart: (e: React.SyntheticEvent) => e.stopPropagation(),
  onKeyDown: (e: React.SyntheticEvent) => e.stopPropagation(),
};

const CardContent = memo(function CardContent({ item, isNew }: { item: PipelineItem; isNew: boolean }) {
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
      {(item.column === 'trial_pending' || item.column === 'finalgespraech' || item.column === 'closed' || item.column === 'post_offer_call') && item.offerPackageLine && (
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
        <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${item.scheduledCallDone ? 'text-amber-700' : item.escalated ? 'text-rose-700' : 'text-orange-700'}`}>
          <Phone className="h-3 w-3 shrink-0" />{item.scheduledCallDone ? 'Bitte bearbeiten' : `Bitte anrufen${item.escalated ? ' – überfällig' : ''}`}
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
});

const EditLeadContext = createContext<(item: PipelineItem) => void>(() => {});

const DraggableCard = memo(function DraggableCard({ item, isNew, onSelect, action }: DraggableCardProps) {
  const onEdit = useContext(EditLeadContext);
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
      className={`relative cursor-grab select-none rounded-md border bg-white p-3 pr-8 shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 active:cursor-grabbing ${
        item.escalated ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <button
        type="button"
        title="Stammdaten bearbeiten"
        aria-label={`Stammdaten bearbeiten: ${item.title}`}
        {...stopCardEvents}
        onClick={e => { e.stopPropagation(); onEdit(item); }}
        className="absolute right-1.5 top-1.5 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <CardContent item={item} isNew={isNew} />
      {action && (() => {
        const ActionIcon = action.icon;
        return (
          <button type="button" {...stopCardEvents} onClick={e => { e.stopPropagation(); action.onClick?.(); }} className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <ActionIcon className="h-3.5 w-3.5" />{action.label}
          </button>
        );
      })()}
    </div>
  );
}, (prev, next) => prev.item === next.item && prev.isNew === next.isNew && prev.action?.label === next.action?.label);

type TodoTierId = 'critical' | 'due' | 'planned';

const TIER_STYLES: Record<TodoTierId, { wrap: string; stripe: string; title: string; text: string; chip: string; chipActive: string }> = {
  critical: {
    wrap: 'border-rose-200 bg-rose-50/60', stripe: 'bg-rose-500', title: 'text-rose-900', text: 'text-rose-800',
    chip: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100', chipActive: 'border-rose-500 bg-rose-600 text-white',
  },
  due: {
    wrap: 'border-amber-200 bg-amber-50/60', stripe: 'bg-amber-500', title: 'text-amber-900', text: 'text-amber-800',
    chip: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100', chipActive: 'border-amber-500 bg-amber-500 text-white',
  },
  planned: {
    wrap: 'border-blue-100 bg-blue-50/40', stripe: 'bg-blue-500', title: 'text-blue-900', text: 'text-blue-800',
    chip: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100', chipActive: 'border-blue-500 bg-blue-600 text-white',
  },
};

function TodoTier({ tier, title, description, count, children }: { tier: TodoTierId; title: string; description: string; count: number; children: React.ReactNode }) {
  const s = TIER_STYLES[tier];
  return (
    <div className={`relative overflow-hidden rounded-lg border p-4 pl-5 ${s.wrap}`}>
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${s.stripe}`} />
      <div className="flex items-baseline gap-2">
        <h3 className={`font-semibold ${s.title}`}>{title}</h3>
        <span className={`text-xs ${s.text}`}>({count})</span>
      </div>
      <p className={`mt-0.5 text-xs ${s.text}`}>{description}</p>
      <div className="mt-4 space-y-5">{children}</div>
    </div>
  );
}

interface TodoGroupProps {
  tier: TodoTierId;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  items: PipelineItem[];
  renderItem: (item: PipelineItem) => React.ReactNode;
  limit?: number;
}

function TodoGroup({ tier, icon: Icon, label, hint, items, renderItem, limit }: TodoGroupProps) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const s = TIER_STYLES[tier];
  const visible = limit && !expanded ? items.slice(0, limit) : items;
  return (
    <div>
      <h4 className={`flex items-center gap-1.5 text-sm font-medium ${s.title}`}>
        <Icon className="h-4 w-4" />{label}
        <span className={`text-xs font-normal ${s.text}`}>({items.length})</span>
      </h4>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visible.map(renderItem)}</div>
      {limit !== undefined && items.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className={`mt-2 w-full rounded-md py-1.5 text-xs font-medium transition hover:bg-white/70 ${s.title}`}
        >
          {expanded ? 'Weniger anzeigen' : `Mehr anzeigen (${items.length - limit})`}
        </button>
      )}
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
  const [todoFilter, setTodoFilter] = useState<TodoTierId | 'all'>('all');
  const [offerLead, setOfferLead] = useState<Lead | null>(null);
  const [downsellRequest, setDownsellRequest] = useState<Lead | null>(null);
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);
  const [trialRequest, setTrialRequest] = useState<{ lead: Lead; initial: TrialRequestData | null; rejectedDozentId: string | null; rejectedDozentName: string | null } | null>(null);

  const [resendLead, setResendLead] = useState<Lead | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [closeRequest, setCloseRequest] = useState<Lead | null>(null);
  const [closeConfigLead, setCloseConfigLead] = useState<Lead | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Geplante 2.-Gespräch-ToDos (pending): der Anruf wird erst ab dem Termin fällig
  const [callTodos, setCallTodos] = useState<{ lead_id: string; scheduled_date: string; scheduled_time: string | null }[]>([]);
  useEffect(() => {
    supabase
      .from('sales_todos')
      .select('lead_id, scheduled_date, scheduled_time')
      .eq('todo_type', 'gespraech_nach_angebot')
      .eq('status', 'pending')
      .not('lead_id', 'is', null)
      .then(({ data }) => setCallTodos((data || []) as { lead_id: string; scheduled_date: string; scheduled_time: string | null }[]));
  }, [leads]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const today = useMemo(() => new Date(), []);
  const todayKey = formatDateKey(today);
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
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

    // Frühestes offenes Anruf-ToDo je Lead (Termin ohne Uhrzeit = Tagesbeginn)
    const scheduledCallByLead = new Map<string, number>();
    callTodos.forEach(t => {
      const ms = new Date(`${t.scheduled_date}T${t.scheduled_time || '00:00'}`).getTime();
      const prev = scheduledCallByLead.get(t.lead_id);
      if (prev === undefined || ms < prev) scheduledCallByLead.set(t.lead_id, ms);
    });
    // Fälligkeitszeitpunkt des Follow-ups: geplanter Termin, sonst 24h nach Angebot
    const followUpDueAt = (lead: Lead) =>
      scheduledCallByLead.get(lead.id) ?? (lead.offer_sent_at ? new Date(lead.offer_sent_at).getTime() + FOLLOW_UP_AFTER_OFFER_MS : null);

    // Spalte + Hinweis je Lead: 2. Gespräch = Follow-up-Anruf spätestens 24h nach Angebot,
    // Finalgespräch = nach Ende der Probestunde
    const placeLead = (lead: Lead): { column: ColumnDef['id']; hint: string | null } => {
      switch (lead.status) {
        case 'new':
          return { column: 'new', hint: null };
        case 'offer_sent': {
          const scheduled = scheduledCallByLead.get(lead.id);
          if (scheduled !== undefined) {
            return now >= scheduled
              ? { column: 'post_offer_call', hint: `Geplanter Anruf war ${formatStamp(scheduled)} Uhr` }
              : { column: 'offer_sent', hint: `Anruf geplant für ${formatStamp(scheduled)} Uhr` };
          }
          if (!lead.offer_sent_at) return { column: 'offer_sent', hint: null };
          const due = new Date(lead.offer_sent_at).getTime() + FOLLOW_UP_AFTER_OFFER_MS;
          return now >= due
            ? { column: 'post_offer_call', hint: `Follow-up-Anruf fällig seit ${formatStamp(due)}` }
            : { column: 'offer_sent', hint: null };
        }
        case 'post_offer_call': {
          const scheduled = scheduledCallByLead.get(lead.id);
          if (scheduled !== undefined && now < scheduled) {
            return { column: 'offer_sent', hint: `Anruf geplant für ${formatStamp(scheduled)} Uhr` };
          }
          return { column: 'post_offer_call', hint: scheduled !== undefined ? `Geplanter Anruf war ${formatStamp(scheduled)} Uhr` : 'Follow-up-Anruf (Mario Kraatz)' };
        }
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
            const pinnedToTrial = lead.status === 'trial_pending' && !lead.final_call_date;
            return now < end || pinnedToTrial
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

    // Cal.com-Buchung je Lead (für Zoom-/Meeting-URL im Detail-Modal)
    const bookingByCalId = new Map(calBookings.map(b => [String(b.cal_booking_id), b]));

    // Leads sind die persistente Datenquelle der Pipeline
    const leadItems: PipelineItem[] = leads
      .filter(lead => !TERMINAL_STATUSES.includes(lead.status))
      .map(lead => {
        const placed = placeLead(lead);
        // Abgelehnte Probestunde: Dozent hat abgesagt -> neu anfragen
        let trialRejected: string | null = null;
        const latestTrial = latestTrialByLead.get(lead.id);
        if (latestTrial?.status === 'cancelled' && latestTrial.dozent_name && placed.column !== 'closed') {
          const dt = latestTrial.scheduled_date ? formatStamp(new Date(latestTrial.scheduled_date).getTime()) : 'Termin offen';
          trialRejected = `Probestunde neu anfragen – Dozent ${latestTrial.dozent_name} hat die Probestunde für ${dt} abgelehnt`;
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
        // Geplanter Anruf (2. Gespräch) liegt in der Vergangenheit -> oben zum Bearbeiten.
        // Sobald der Lead weitergezogen wurde (andere Spalte), fällt er dort wieder raus.
        const scheduledCall = scheduledCallByLead.get(lead.id) ?? null;
        const scheduledCallDone = scheduledCall !== null && now >= scheduledCall && placed.column === 'post_offer_call';
        return {
        ...placed,
        hint: trialRejected ?? placed.hint,
        escalated: placed.column === 'post_offer_call'
          && !scheduledCallDone
          && followUpDueAt(lead) !== null
          && now - followUpDueAt(lead)! >= FOLLOW_UP_ESCALATION_MS - FOLLOW_UP_AFTER_OFFER_MS,
        scheduledCallDone,
        offerLines: getOfferLines(lead, now),
        trialStatus,
        trialRejected,
        rejectedTrial: trialRejected ? latestTrial ?? null : null,
        downsellInfo,
        downsellMailSent,
        downsellReason,
        offerPackageLine,
        id: `lead-${lead.id}`,
        lead,
        calBooking: null,
        title: lead.name,
        status: lead.status,
        date: scheduledCallDone ? formatDateKey(new Date(scheduledCall)) : dateKeyFromValue(lead.booking_date),
        time: scheduledCallDone ? new Date(scheduledCall).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : formatTime(lead.booking_date),
        startsAt: scheduledCallDone ? new Date(scheduledCall).toISOString() : lead.booking_date,
        participant: lead.name,
        email: lead.email,
        phone: lead.phone,
        studyLocation: lead.study_location,
        examGoal: lead.study_goal,
        consultationWishes: lead.notes,
        meetingUrl: lead.cal_booking_id ? (bookingByCalId.get(lead.cal_booking_id)?.meeting_url ?? null) : null,
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
        scheduledCallDone: false,
        trialStatus: null,
        trialRejected: null,
        rejectedTrial: null,
        downsellInfo: null,
        downsellMailSent: false,
        downsellReason: null,
        offerPackageLine: null,
      }));

    return [...leadItems, ...bookingItems];
  }, [leads, calBookings, trialLessons, callTodos]);

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

  // Follow-up-Anrufe (2. Gespräch): To-Do oben unter den kommenden Gesprächen.
  // Stattgefundene geplante Anrufe zählen nicht als "anrufen", sondern als "bearbeiten".
  const followUpDue = useMemo(
    () => items
      .filter(item => item.column === 'post_offer_call' && !item.scheduledCallDone)
      .sort((a, b) => {
        const da = a.lead?.offer_sent_at || '9999';
        const db = b.lead?.offer_sent_at || '9999';
        return da.localeCompare(db) || a.title.localeCompare(b.title);
      }),
    [items]
  );

  // Über 24h nach Fälligkeit ohne Rückruf: ganz oben, rot umrandet (und nicht doppelt in der orange-Gruppe)
  const followUpEscalated = useMemo(() => followUpDue.filter(item => item.escalated), [followUpDue]);
  const followUpDueNonEscalated = useMemo(() => followUpDue.filter(item => !item.escalated), [followUpDue]);

  // Zukünftig geplante Anrufe (2. Gespräch): im To-Do-Bereich oben sichtbar machen
  const upcomingCalls = useMemo(() => {
    const now = Date.now();
    const byLead = new Map<string, number>();
    callTodos.forEach(t => {
      const ms = new Date(`${t.scheduled_date}T${t.scheduled_time || '00:00'}`).getTime();
      if (Number.isNaN(ms)) return;
      const prev = byLead.get(t.lead_id);
      if (prev === undefined || ms < prev) byLead.set(t.lead_id, ms);
    });
    return items
      .filter(item => item.lead && byLead.has(item.lead.id))
      .map(item => ({ item, scheduledAt: byLead.get(item.lead!.id)! }))
      .filter(({ scheduledAt }) => scheduledAt > now)
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
  }, [items, callTodos]);

  // Stattgefundene geplante Anrufe (2. Gespräch): ganz oben zum Weiterverarbeiten
  const doneCalls = useMemo(
    () => items
      .filter(item => item.scheduledCallDone)
      .sort((a, b) => (b.startsAt || '').localeCompare(a.startsAt || '')),
    [items]
  );

  // "Zu bearbeiten": stattgefundene geplante Anrufe zuerst, danach vergangene Beratungsgespräche
  const zuBearbeiten = useMemo(() => [...doneCalls, ...pastCalls], [doneCalls, pastCalls]);

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
  const todosByDay = useMemo(() => {
    const sortEntries = (arr: TodoEntry[]) => [...arr].sort((a, b) => {
      const at = a.scheduledAt ?? (a.item.startsAt ? new Date(a.item.startsAt).getTime() : 0);
      const bt = b.scheduledAt ?? (b.item.startsAt ? new Date(b.item.startsAt).getTime() : 0);
      return at - bt;
    });
    const consultToday: TodoEntry[] = newItems.filter(item => item.date === todayKey).map(item => ({ item, scheduledAt: null }));
    const consultNext: TodoEntry[] = newItems.filter(item => item.date === nextWorkingDayKey).map(item => ({ item, scheduledAt: null }));
    const scheduledToday: TodoEntry[] = upcomingCalls.filter(({ scheduledAt }) => formatDateKey(new Date(scheduledAt)) === todayKey).map(({ item, scheduledAt }) => ({ item, scheduledAt }));
    const scheduledLater: TodoEntry[] = upcomingCalls.filter(({ scheduledAt }) => formatDateKey(new Date(scheduledAt)) !== todayKey).map(({ item, scheduledAt }) => ({ item, scheduledAt }));
    return {
      today: sortEntries([...consultToday, ...scheduledToday]),
      nextWorkingDay: sortEntries([...consultNext, ...scheduledLater]),
    };
  }, [newItems, upcomingCalls, todayKey, nextWorkingDayKey]);

  const renderTodoList = (todoItems: TodoEntry[], emptyLabel: string) => (
    <div className="space-y-2">
      {todoItems.length === 0 ? (
        <p className="py-3 text-sm text-slate-400">{emptyLabel}</p>
      ) : todoItems.map(({ item, scheduledAt }) => {
        const examTag = getExamTag(item.examGoal);
        const scheduled = scheduledAt != null ? new Date(scheduledAt) : null;
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
                <p className="text-xs text-slate-500">{scheduled ? '2. Gespräch' : 'Beratungsgespräch'}</p>
                {scheduled && item.offerPackageLine && <p className="mt-1 text-xs text-amber-800">{item.offerPackageLine}</p>}
                {item.description && <p className="mt-1 text-xs text-slate-500">{item.description}</p>}
              </div>
            </div>
            {scheduled ? (
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium text-blue-600">{scheduled.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</p>
                <p className="text-xs text-slate-500">{scheduled.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
              </div>
            ) : (
              item.time && <span className="flex shrink-0 items-center gap-1 text-xs text-blue-600"><Clock className="h-3 w-3" />{item.time}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  /**
   * Stellt sicher, dass zu einem Cal.com-Booking ein Lead existiert.
   * Wird beim Verschieben eines reinen Booking-Items benötigt.
   */
  const ensureLead = useCallback(async (item: PipelineItem): Promise<Lead | null> => {
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
  }, [onCreateLead, addToast]);

  const handleEditItem = useCallback(async (item: PipelineItem) => {
    const lead = await ensureLead(item);
    if (lead) setEditLead(lead);
  }, [ensureLead]);

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
    if (targetStatus === 'closed') {
      // Ohne hinterlegtes Angebot gibt es nichts zu bestätigen: direkt die Paket-Maske öffnen
      if (deriveOfferConfig(lead)) setCloseRequest(lead);
      else setCloseConfigLead(lead);
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

  const handleOfferSent = async ({ packageName, beginDate, price, config }: { packageName: string | null; beginDate: string | null; price: number | null; config?: OfferConfig }) => {
    if (!offerLead) return;
    await onUpdateLead(offerLead.id, {
      status: 'offer_sent',
      offer_sent_at: new Date().toISOString(),
      offer_package: packageName,
      offer_start_date: beginDate,
      offer_price: price,
      offer_config: config ?? null,
    });
    setOfferLead(null);
  };

  const handleCloseUnchanged = async () => {
    if (!closeRequest) return;
    await onUpdateLead(closeRequest.id, { status: 'closed' });
    addToast('Lead abgeschlossen', 'success');
    setCloseRequest(null);
  };

  const handleCloseChanged = async ({ packageName, beginDate, price, config }: { packageName: string | null; beginDate: string | null; price: number | null; config?: OfferConfig }) => {
    if (!closeConfigLead) return;
    await onUpdateLead(closeConfigLead.id, {
      status: 'closed',
      offer_package: packageName,
      offer_start_date: beginDate,
      offer_price: price,
      offer_config: config ?? null,
    });
    addToast('Lead mit geändertem Vertragsgegenstand abgeschlossen', 'success');
    setCloseConfigLead(null);
  };

  const handleResendSent = async ({ packageName, beginDate, price, config }: { packageName: string | null; beginDate: string | null; price: number | null; config?: OfferConfig }) => {
    if (!resendLead) return;
    const inOfferStage = resendLead.status === 'offer_sent' || resendLead.status === 'post_offer_call';
    await onUpdateLead(resendLead.id, {
      ...(inOfferStage ? { status: 'offer_sent' as const } : {}),
      offer_sent_at: new Date().toISOString(),
      offer_package: packageName,
      offer_start_date: beginDate,
      offer_price: price,
      offer_config: config ?? null,
    });
    setResendLead(null);
  };

  const handleOfferSkip = async () => {
    if (!offerLead) return;
    await onUpdateLead(offerLead.id, { status: 'offer_sent', offer_sent_at: null });
    addToast('Lead nach „Angebot“ verschoben (ohne Mail)', 'success');
    setOfferLead(null);
  };

  const handleTrialSkip = async () => {
    if (!trialRequest) return;
    await onUpdateLead(trialRequest.lead.id, { status: 'trial_pending', final_call_date: null });
    addToast('Lead nach „Probestunde“ verschoben (ohne neue Anfrage)', 'success');
    setTrialRequest(null);
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
  const selectedPhaseLabel = selectedItem
    ? COLUMNS.find(c => c.id === selectedItem.column)?.label ?? STATUS_LABELS[selectedItem.status] ?? 'Beratungsgespräch'
    : null;

  // Abgelehnte Probestunde: Anfrage mit den bisherigen Daten neu öffnen (abgelehnter Dozent vorgemerkt)
  const openTrialReRequest = (item: PipelineItem) => {
    if (!item.lead || !item.rejectedTrial) return;
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
  };

  // "Anrufen" öffnet das Lead-Detail mit allen Infos; der Anruf wird von dort gestartet
  const callAction = (item: PipelineItem): CardAction | undefined =>
    item.phone ? { label: 'Anrufen', icon: Phone, onClick: () => setSelectedItem(item) } : undefined;

  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone.replace(/[^\d+]/g, ''));
      addToast('Telefonnummer kopiert', 'success');
    } catch {
      addToast('Kopieren nicht möglich', 'error');
    }
  };

  const tierCounts: Record<TodoTierId, number> = {
    critical: followUpEscalated.length + rejectedTrials.length,
    due: zuBearbeiten.length + followUpDueNonEscalated.length + finalDue.length,
    planned: todosByDay.today.length + todosByDay.nextWorkingDay.length,
  };
  const showTier = (tier: TodoTierId) => todoFilter === 'all' || todoFilter === tier;
  const filterChips: { id: TodoTierId; label: string }[] = [
    { id: 'critical', label: 'kritisch' },
    { id: 'due', label: 'fällig' },
    { id: 'planned', label: 'geplant' },
  ];

  // ESC schließt das oberste offene Fenster (Verlauf liegt über dem Detail-Modal)
  useEffect(() => {
    if (!selectedItem && !historyLead) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (historyLead) setHistoryLead(null);
      else setSelectedItem(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedItem, historyLead]);

  return (
    <EditLeadContext.Provider value={handleEditItem}>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
    <div className="space-y-6">
      {/* To Do Übersicht */}
      <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">To Dos</h2>
            <p className="mt-1 text-sm text-slate-500">Nach Dringlichkeit sortiert – Karten lassen sich direkt in die Pipeline ziehen.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="To Dos filtern">
            <button
              type="button"
              aria-pressed={todoFilter === 'all'}
              onClick={() => setTodoFilter('all')}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${todoFilter === 'all' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              Alle
            </button>
            {filterChips.map(chip => (
              <button
                key={chip.id}
                type="button"
                aria-pressed={todoFilter === chip.id}
                onClick={() => setTodoFilter(prev => (prev === chip.id ? 'all' : chip.id))}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${todoFilter === chip.id ? TIER_STYLES[chip.id].chipActive : TIER_STYLES[chip.id].chip}`}
              >
                <span className="font-semibold">{tierCounts[chip.id]}</span> {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {todoFilter === 'all' && tierCounts.critical === 0 && tierCounts.due === 0 && (
            <p className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />Keine kritischen oder fälligen Aufgaben – alles abgearbeitet.
            </p>
          )}

          {showTier('critical') && (tierCounts.critical > 0 ? (
            <TodoTier tier="critical" title="Kritisch" description="Sofort erledigen – hier wartet ein Lead bereits zu lange." count={tierCounts.critical}>
              <TodoGroup
                tier="critical"
                icon={Phone}
                label="2. Gespräch überfällig"
                hint="Follow-up seit mehr als 24 Stunden fällig."
                items={followUpEscalated}
                renderItem={item => <DraggableCard key={item.id} item={item} isNew={false} onSelect={setSelectedItem} action={callAction(item)} />}
              />
              <TodoGroup
                tier="critical"
                icon={GraduationCap}
                label="Probestunde abgelehnt"
                hint="Dozent hat abgesagt – Probestunde neu anfragen."
                items={rejectedTrials}
                renderItem={item => (
                  <DraggableCard
                    key={item.id}
                    item={item}
                    isNew={false}
                    onSelect={openTrialReRequest}
                    action={{ label: 'Neu anfragen', icon: GraduationCap, onClick: () => openTrialReRequest(item) }}
                  />
                )}
              />
            </TodoTier>
          ) : todoFilter === 'critical' && (
            <p className="py-3 text-sm text-slate-400">Keine kritischen Aufgaben.</p>
          ))}

          {showTier('due') && (tierCounts.due > 0 ? (
            <TodoTier tier="due" title="Fällig" description="Heute weiterverarbeiten, damit nichts liegen bleibt." count={tierCounts.due}>
              <TodoGroup
                tier="due"
                icon={Clock}
                label="Stattgefundene Calls"
                hint="Karte in die passende Pipeline-Spalte ziehen (Angebot, Probestunde …)."
                items={zuBearbeiten}
                limit={PAST_CALLS_PREVIEW}
                renderItem={item => <DraggableCard key={item.id} item={item} isNew={item.status === 'new'} onSelect={setSelectedItem} />}
              />
              <TodoGroup
                tier="due"
                icon={Phone}
                label="2. Gespräch – Follow-up"
                hint="Angebot vor über 24 Stunden versendet bzw. geplanter Anruf fällig."
                items={followUpDueNonEscalated}
                renderItem={item => <DraggableCard key={item.id} item={item} isNew={false} onSelect={setSelectedItem} action={callAction(item)} />}
              />
              <TodoGroup
                tier="due"
                icon={Users}
                label="Finalgespräch"
                hint="Probestunde beendet bzw. Finalgespräch offen."
                items={finalDue}
                renderItem={item => <DraggableCard key={item.id} item={item} isNew={false} onSelect={setSelectedItem} action={callAction(item)} />}
              />
            </TodoTier>
          ) : todoFilter === 'due' && (
            <p className="py-3 text-sm text-slate-400">Keine fälligen Aufgaben.</p>
          ))}

          {showTier('planned') && (
            <TodoTier tier="planned" title="Geplant" description="Anstehende Beratungsgespräche und vereinbarte Anrufe." count={todosByDay.today.length + todosByDay.nextWorkingDay.length}>
              <div className={`grid gap-5 ${!isWeekend ? 'lg:grid-cols-2' : ''}`}>
                {!isWeekend && (
                  <div>
                    <h4 className="flex items-center gap-1.5 text-sm font-medium text-blue-900">
                      <Clock className="h-4 w-4" />Heute, {formatDayLabel(today)}
                      <span className="text-xs font-normal text-blue-800">({todosByDay.today.length})</span>
                    </h4>
                    <div className="mt-2">{renderTodoList(todosByDay.today, 'Keine anstehenden Termine für heute.')}</div>
                  </div>
                )}
                <div>
                  <h4 className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <ChevronRight className="h-4 w-4" />{isNextWorkingDayTomorrow ? 'Morgen' : 'Nächster Werktag'}, {formatDayLabel(nextWorkingDay)}
                    <span className="text-xs font-normal text-slate-500">({todosByDay.nextWorkingDay.length})</span>
                  </h4>
                  <div className="mt-2">{renderTodoList(todosByDay.nextWorkingDay, 'Keine anstehenden Termine für den nächsten Werktag.')}</div>
                </div>
              </div>
            </TodoTier>
          )}
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
        initialConfig={deriveOfferConfig(offerLead)}
        allowSkip
        skipLabel="Ohne Mail verschieben"
        onSkip={handleOfferSkip}
        onClose={() => setOfferLead(null)}
        onSent={handleOfferSent}
      />

      {/* Angebot erneut senden: bisherige Konfiguration vorbelegt */}
      <PipelineOfferModal
        lead={resendLead}
        initialConfig={deriveOfferConfig(resendLead)}
        title="Angebot erneut senden"
        submitLabel="Angebot erneut senden"
        onClose={() => setResendLead(null)}
        onSent={handleResendSent}
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

      {/* Stammdaten des Leads bearbeiten */}
      <LeadEditModal
        lead={editLead}
        onClose={() => setEditLead(null)}
        onSave={async (id, data) => {
          await onUpdateLead(id, data);
          addToast('Lead-Stammdaten gespeichert', 'success');
        }}
      />

      {/* Abschluss: Vertragsgegenstand bestätigen */}
      <PipelineClosedModal
        lead={closeRequest}
        onClose={() => setCloseRequest(null)}
        onUnchanged={handleCloseUnchanged}
        onChanged={() => { setCloseConfigLead(closeRequest); setCloseRequest(null); }}
      />

      {/* Abschluss mit geändertem Vertragsgegenstand: Paket-Maske aus der Angebotserstellung */}
      <PipelineOfferModal
        lead={closeConfigLead}
        configOnly
        initialConfig={deriveOfferConfig(closeConfigLead) ?? { elite: false, totalHours: 140, subjectHours: { zr: '55', oer: '50', str: '35' }, months: 12, beginDate: closeConfigLead?.offer_start_date ?? null }}
        title="Vertragsgegenstand anpassen"
        description="Bisher gewähltes Paket – bitte an den Vertrag anpassen."
        submitLabel="Als abgeschlossen markieren"
        onClose={() => setCloseConfigLead(null)}
        onSent={handleCloseChanged}
      />

      {/* Probestunde anfragen */}
      <PipelineTrialModal
        lead={trialRequest?.lead || null}
        initial={trialRequest?.initial || null}
        rejectedDozentId={trialRequest?.rejectedDozentId || null}
        rejectedDozentName={trialRequest?.rejectedDozentName || null}
        onClose={() => setTrialRequest(null)}
        onSubmit={handleTrialSubmit}
        onSkip={handleTrialSkip}
      />

      {/* Detail-Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedItem(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cal-booking-details-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-700">{selectedPhaseLabel}</p>
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
                  {selectedItem.lead && (selectedItem.lead.offer_sent_at || selectedItem.lead.offer_package) && (
                    <button
                      type="button"
                      onClick={() => { setResendLead(selectedItem.lead); setSelectedItem(null); }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
                    >
                      <Mail className="h-3.5 w-3.5" />Angebot erneut senden
                    </button>
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
                  {selectedItem.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-slate-500" /><a href={`mailto:${selectedItem.email}`} className="text-primary hover:underline">{selectedItem.email}</a></div>}
                  {selectedItem.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="text-slate-600">Telefon:</span>
                      <span className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 font-medium text-slate-900">
                        {selectedItem.phone}
                        <button
                          type="button"
                          onClick={() => copyPhone(selectedItem.phone!)}
                          title="Telefonnummer kopieren"
                          aria-label="Telefonnummer kopieren"
                          className="rounded p-1 text-slate-400 transition hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  )}
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
    </EditLeadContext.Provider>
  );
}
