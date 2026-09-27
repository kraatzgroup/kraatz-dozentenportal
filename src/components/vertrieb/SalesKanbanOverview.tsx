import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { CalBooking, Lead } from '../../store/salesStore';
import { LeadCreateModal } from './LeadCreateModal';

interface SalesKanbanOverviewProps {
  calBookings: CalBooking[];
  leads: Lead[];
  onCreateLead: (data: Partial<Lead>) => Promise<void>;
}

type TodoType = 'beratungsgespraech';

interface SalesTodo {
  id: string;
  title: string;
  type: TodoType;
  date: string;
  time?: string | null;
  participant?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  eventTypeId?: string | null;
  studyLocation?: string | null;
  examGoal?: string | null;
  consultationWishes?: string | null;
  meetingUrl?: string | null;
  description?: string | null;
}

const COLUMNS = [
  { label: 'Beratungsgespräch', className: 'border-blue-200 bg-blue-50/95', headingClassName: 'text-blue-900', badgeClassName: 'bg-blue-200 text-blue-900', icon: Phone },
  { label: 'Angebot', className: 'border-amber-200 bg-amber-50/95', headingClassName: 'text-amber-900', badgeClassName: 'bg-amber-200 text-amber-900', icon: FileText },
  { label: '2. Gespräch', className: 'border-orange-200 bg-orange-50/95', headingClassName: 'text-orange-900', badgeClassName: 'bg-orange-200 text-orange-900', icon: MessageSquare },
  { label: 'Probestunde', className: 'border-purple-200 bg-purple-50/95', headingClassName: 'text-purple-900', badgeClassName: 'bg-purple-200 text-purple-900', icon: GraduationCap },
  { label: 'Finalgespräch', className: 'border-rose-200 bg-rose-50/95', headingClassName: 'text-rose-900', badgeClassName: 'bg-rose-200 text-rose-900', icon: Users },
];

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

export function SalesKanbanOverview({ calBookings, leads, onCreateLead }: SalesKanbanOverviewProps) {
  const [selectedTodo, setSelectedTodo] = useState<SalesTodo | null>(null);
  const [isLeadCreateModalOpen, setIsLeadCreateModalOpen] = useState(false);
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

  const calTodos = useMemo<SalesTodo[]>(() => {
    const now = Date.now();
    return calBookings
      .filter(booking => booking.status?.toLowerCase() !== 'cancelled')
      .filter(booking => new Date(booking.end_time).getTime() >= now)
      .map(booking => ({
        id: `cal-booking-${booking.id}`,
        title: booking.attendee_name ? `Beratungsgespräch mit ${booking.attendee_name}` : booking.title || 'Beratungsgespräch',
        type: 'beratungsgespraech' as const,
        date: dateKeyFromValue(booking.start_time) || '',
        time: formatTime(booking.start_time),
        participant: booking.attendee_name,
        email: booking.attendee_email,
        phone: booking.attendee_phone,
        status: booking.status,
        eventTypeId: booking.event_type_id,
        studyLocation: booking.study_location || booking.location,
        examGoal: booking.exam_goal,
        consultationWishes: booking.consultation_wishes,
        meetingUrl: booking.meeting_url,
        description: booking.description && !getSafeHttpUrl(booking.description) ? booking.description : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  }, [calBookings]);

  const manualCallTodos = useMemo<SalesTodo[]>(() => {
    const now = Date.now();
    return leads
      .filter(lead => lead.status === 'new' && !lead.cal_booking_id)
      .filter(lead => !lead.booking_date || new Date(lead.booking_date).getTime() >= now)
      .map(lead => ({
        id: `manual-lead-${lead.id}`,
        title: `Beratungsgespräch mit ${lead.name}`,
        type: 'beratungsgespraech' as const,
        date: dateKeyFromValue(lead.booking_date) || '',
        time: formatTime(lead.booking_date),
        participant: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        eventTypeId: null,
        studyLocation: lead.study_location,
        examGoal: lead.study_goal,
        consultationWishes: lead.notes,
        meetingUrl: null,
        description: null,
      }));
  }, [leads]);

  const callTodos = useMemo(() => [...calTodos, ...manualCallTodos].sort((a, b) =>
    (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31') || (a.time || '').localeCompare(b.time || '')
  ), [calTodos, manualCallTodos]);

  const calTodoGroups = useMemo(() => {
    const todayIndex = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
    const mondayIndex = Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) / 86400000;
    const groups = new Map<string, { label: string; todos: SalesTodo[] }>();

    callTodos.forEach(todo => {
      if (!todo.date) {
        const unscheduledGroup = groups.get('unscheduled');
        if (unscheduledGroup) unscheduledGroup.todos.push(todo);
        else groups.set('unscheduled', { label: 'Ohne Termin', todos: [todo] });
        return;
      }

      const [year, month, day] = todo.date.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const dateIndex = Date.UTC(year, month - 1, day) / 86400000;
      const daysFromToday = dateIndex - todayIndex;
      const weekIndex = Math.floor((dateIndex - mondayIndex) / 7);
      const weekStart = new Date(monday);
      weekStart.setDate(monday.getDate() + weekIndex * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekRange = `${weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}–${weekEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
      const key = daysFromToday < 3 || weekIndex === 0 ? `day-${todo.date}` : `week-${weekIndex}`;
      const label = daysFromToday === 0 ? `Heute · ${formatDayLabel(date)}` :
        daysFromToday === 1 ? `Morgen · ${formatDayLabel(date)}` :
          daysFromToday === 2 ? `Übermorgen · ${formatDayLabel(date)}` :
            weekIndex === 0 ? formatDayLabel(date) :
              `${weekIndex === 1 ? 'Nächste Woche' : `In ${weekIndex} Wochen`} · ${weekRange}`;
      const group = groups.get(key);

      if (group) group.todos.push(todo);
      else groups.set(key, { label, todos: [todo] });
    });

    return Array.from(groups, ([key, group]) => ({ key, ...group }));
  }, [callTodos, today]);

  const todosByDay = useMemo(() => ({
    today: callTodos.filter(todo => todo.date === todayKey),
    nextWorkingDay: callTodos.filter(todo => todo.date === nextWorkingDayKey),
  }), [callTodos, nextWorkingDayKey, todayKey]);

  const renderTodoList = (items: SalesTodo[], emptyLabel: string) => (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="py-3 text-sm text-slate-400">{emptyLabel}</p>
      ) : items.map(todo => {
        const examTag = getExamTag(todo.examGoal);
        return (
          <div
            key={todo.id}
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-label={`Details öffnen: ${todo.title}`}
            onClick={() => setSelectedTodo(todo)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedTodo(todo);
              }
            }}
            className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 rounded-md bg-slate-100 p-1.5 text-slate-600"><Phone className="h-4 w-4" /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{todo.title}</p>
                  {examTag && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">{examTag}</span>}
                </div>
                <p className="text-xs text-slate-500">Beratungsgespräch</p>
                {todo.description && <p className="mt-1 text-xs text-slate-500">{todo.description}</p>}
              </div>
            </div>
            {todo.time && <span className="flex shrink-0 items-center gap-1 text-xs text-blue-600"><Clock className="h-3 w-3" />{todo.time}</span>}
          </div>
        );
      })}
    </div>
  );

  const selectedMeetingUrl = getSafeHttpUrl(selectedTodo?.meetingUrl);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">To Dos</h2>
            <p className="mt-1 text-sm text-slate-500">Anstehende Cal.com-Termine und manuell angelegte Beratungsgespräche.</p>
          </div>
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
            <h3 className="flex items-center gap-2 font-medium text-blue-900"><Clock className="h-4 w-4" />Heute, {formatDayLabel(today)}<span className="text-xs font-normal text-blue-700">({todosByDay.today.length})</span></h3>
            <div className="mt-3">{renderTodoList(todosByDay.today, 'Keine anstehenden Beratungsgespräche für heute.')}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="flex items-center gap-2 font-medium text-slate-900"><ChevronRight className="h-4 w-4" />{isNextWorkingDayTomorrow ? 'Morgen' : 'Nächster Werktag'}<span className="text-xs font-normal text-slate-500">{formatDayLabel(nextWorkingDay)} · {todosByDay.nextWorkingDay.length}</span></h3>
            <div className="mt-3">{renderTodoList(todosByDay.nextWorkingDay, 'Keine anstehenden Beratungsgespräche für den nächsten Werktag.')}</div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Sales-Pipeline</h2>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{callTodos.length} Beratungsgespräche</span>
        </div>
        <div className="grid gap-4 overflow-x-auto md:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((column, index) => {
            const Icon = column.icon;
            const columnGroups = index === 0 ? calTodoGroups : [];
            const itemCount = columnGroups.reduce((count, group) => count + group.todos.length, 0);
            return (
              <div key={column.label} className={`min-h-[330px] rounded-xl border p-3 ${column.className}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className={`flex items-center gap-2 text-sm font-semibold ${column.headingClassName}`}><Icon className="h-4 w-4" />{column.label}</h3>
                  <div className="flex shrink-0 items-center gap-2">
                    {index === 0 && (
                      <button
                        type="button"
                        onClick={() => setIsLeadCreateModalOpen(true)}
                        title="Lead / Call manuell anlegen"
                        aria-label="Lead oder Beratungsgespräch manuell anlegen"
                        className="flex h-7 items-center gap-1 rounded-md bg-blue-600 px-2 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Neu</span>
                      </button>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${column.badgeClassName}`}>{itemCount}</span>
                  </div>
                </div>
                {columnGroups.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-3 text-center text-xs text-slate-500">Keine Einträge</p>
                ) : (
                  <div className="space-y-3">
                    {columnGroups.map(group => (
                      <section key={group.key} className="rounded-lg border border-blue-200 bg-white/60 p-2">
                        <div className="mb-2 px-1">
                          <h4 className="text-xs font-semibold text-blue-900">{group.label}</h4>
                        </div>
                        <div className="space-y-2">
                          {group.todos.map(todo => {
                            const examTag = getExamTag(todo.examGoal);
                            return (
                              <div
                                key={todo.id}
                                role="button"
                                tabIndex={0}
                                aria-haspopup="dialog"
                                aria-label={`Details öffnen: ${todo.title}`}
                                onClick={() => setSelectedTodo(todo)}
                                onKeyDown={event => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setSelectedTodo(todo);
                                  }
                                }}
                                className="cursor-pointer rounded-md border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="min-w-0 text-sm font-semibold text-slate-900">{todo.title}</p>
                                  {examTag && <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">{examTag}</span>}
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                                  <span>{todo.date ? new Date(`${todo.date}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : 'Termin offen'}</span>
                                  {todo.time && <span className="flex items-center gap-1 text-blue-600"><Clock className="h-3 w-3" />{todo.time}</span>}
                                </div>
                                {todo.description && <p className="mt-1 truncate text-xs text-slate-500">{todo.description}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <LeadCreateModal
        isOpen={isLeadCreateModalOpen}
        onClose={() => setIsLeadCreateModalOpen(false)}
        onCreateLead={onCreateLead}
      />
      {selectedTodo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedTodo(null)}>
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
                <h3 id="cal-booking-details-title" className="mt-1 text-lg font-semibold text-slate-900">{selectedTodo.title}</h3>
              </div>
              <button type="button" onClick={() => setSelectedTodo(null)} aria-label="Details schließen" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 text-sm text-slate-700">
              <section className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-3 font-semibold text-slate-900">Meeting-Informationen</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0 text-slate-500" />{new Date(`${selectedTodo.date}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}{selectedTodo.time && ` · ${selectedTodo.time} Uhr`}</div>
                  {selectedTodo.status && <div className="text-slate-600">Status: {getBookingStatusLabel(selectedTodo.status)}</div>}
                  {selectedTodo.description && <p className="whitespace-pre-wrap text-slate-600">{selectedTodo.description}</p>}
                  {selectedMeetingUrl && <a href={selectedMeetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700"><ExternalLink className="h-4 w-4" />Meeting starten</a>}
                </div>
              </section>
              {selectedTodo.type === 'beratungsgespraech' && (
                <section className="rounded-lg border border-slate-200 p-4">
                  <h4 className="mb-3 font-semibold text-slate-900">Lead-Informationen</h4>
                  <div className="space-y-2">
                    {selectedTodo.participant && <div>Name: {selectedTodo.participant}</div>}
                    {selectedTodo.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-slate-500" />{selectedTodo.email}</div>}
                    {selectedTodo.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-slate-500" />Telefon: {selectedTodo.phone}</div>}
                    {selectedTodo.studyLocation && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-slate-500" />Standort: {selectedTodo.studyLocation}</div>}
                    {selectedTodo.examGoal && <div><span className="font-medium">Prüfungsziel:</span> {selectedTodo.examGoal}</div>}
                    {selectedTodo.consultationWishes && <div className="border-t border-slate-200 pt-3"><p className="font-medium">Wünsche für die Beratung</p><p className="mt-1 whitespace-pre-wrap">{selectedTodo.consultationWishes}</p></div>}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
