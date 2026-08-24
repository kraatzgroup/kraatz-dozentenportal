import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Users,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  min as dateMin,
  max as dateMax,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useToastStore } from '../store/toastStore';

interface Absence {
  id: string;
  dozent_id: string;
  start_date: string;
  end_date: string;
  note?: string | null;
}

interface MonthCapacity {
  id?: string;
  dozent_id: string;
  month: number;
  year: number;
  max_participants?: number | null;
}

interface AbsenceCalendarProps {
  dozentId?: string;
  isAdmin?: boolean;
  onAvailabilityChange?: (status: string) => void;
  hideMaxParticipants?: boolean;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function AbsenceCalendar({ dozentId, isAdmin = false, onAvailabilityChange, hideMaxParticipants = false }: AbsenceCalendarProps) {
  const { addToast } = useToastStore();
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [capacity, setCapacity] = useState<MonthCapacity | null>(null);
  const [maxParticipants, setMaxParticipants] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  // Background DB writes are non-blocking; no global saving flag needed.
  const isSaving = false;
  const [cursor, setCursor] = useState(() => new Date());
  const scrollCooldown = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Stable ref to the resolved dozent id so optimistic updates can run synchronously
  const dozentIdRef = useRef<string | undefined>(dozentId);
  dozentIdRef.current = dozentId;

  const navigate = useCallback((dir: 'prev' | 'next') => {
    setCursor((c) => (dir === 'prev' ? subMonths(c, 1) : addMonths(c, 1)));
  }, []);

  // Wheel-driven month switching with cooldown so one gesture advances one month
  const handleCalendarWheel = (e: React.WheelEvent) => {
    if (scrollCooldown.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    // Only trigger month switch when the scroll container has reached its bounds
    const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
    const atTop = container.scrollTop <= 0;

    if (e.deltaY > 0 && atBottom) {
      scrollCooldown.current = true;
      navigate('next');
      container.scrollTop = 0;
      window.setTimeout(() => { scrollCooldown.current = false; }, 500);
    } else if (e.deltaY < 0 && atTop) {
      scrollCooldown.current = true;
      navigate('prev');
      container.scrollTop = 0;
      window.setTimeout(() => { scrollCooldown.current = false; }, 500);
    }
  };

  // Drag selection state
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragEnd, setDragEnd] = useState<Date | null>(null);
  const isDragging = dragStart !== null;
  const calendarRef = useRef<HTMLDivElement>(null);

  const monthLabel = format(cursor, 'MMMM yyyy', { locale: de });
  const today = new Date();

  // Build the day grid for the visible month (incl. leading/trailing days from neighbour weeks)
  const days = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  const isDateAbsent = (date: Date) =>
    absences.some((a) => {
      const s = parseISO(a.start_date);
      const e = parseISO(a.end_date);
      return date >= startOfDay(s) && date <= endOfDaySafe(e);
    });

  const isDateInDrag = (date: Date) => {
    if (!dragStart || !dragEnd) return false;
    const s = startOfDay(dateMin([dragStart, dragEnd]));
    const e = endOfDaySafe(dateMax([dragStart, dragEnd]));
    return date >= s && date <= e;
  };

  // Track which month ranges we've already fetched so we don't refetch on revisit
  const fetchedRangesRef = useRef<Set<string>>(new Set());
  const dozentIdForFetchRef = useRef<string | undefined>(undefined);

  const fetchAll = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const targetDozentId = dozentId || user?.id;
      if (!targetDozentId) return;

      // Fetch absences that could touch the visible month (broad window for safety)
      const monthStart = format(startOfMonth(cursor), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(cursor), 'yyyy-MM-dd');
      const { data: absData, error: absError } = await supabase
        .from('dozent_absences')
        .select('*')
        .eq('dozent_id', targetDozentId)
        .lte('start_date', monthEnd)
        .gte('end_date', monthStart)
        .order('start_date', { ascending: true });

      if (absError) throw absError;

      if (silent) {
        // Merge: keep absences outside the fetched window, replace those inside
        setAbsences((prev) => {
          const outside = prev.filter((a) => {
            const s = parseISO(a.start_date);
            const e = parseISO(a.end_date);
            // keep if entirely outside the just-fetched month window
            return e < startOfMonth(cursor) || s > endOfMonth(cursor);
          });
          // de-dupe by id
          const merged = [...outside, ...(absData || [])];
          const seen = new Set<string>();
          return merged.filter((a) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
          });
        });
      } else {
        setAbsences(absData || []);
      }

      // Fetch monthly capacity (max_participants) for the visible month
      const { data: capData, error: capError } = await supabase
        .from('dozent_availability')
        .select('*')
        .eq('dozent_id', targetDozentId)
        .eq('month', cursor.getMonth() + 1)
        .eq('year', cursor.getFullYear())
        .maybeSingle();

      if (capError) throw capError;
      setCapacity(capData || null);
      setMaxParticipants(capData?.max_participants != null ? String(capData.max_participants) : '');

      notifyAvailability(absData || []);
    } catch (error) {
      console.error('Error fetching absences:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const notifyAvailability = (absList: Absence[]) => {
    if (!onAvailabilityChange) return;
    const t = startOfDay(today);
    const isAbsentNow = absList.some((a) => {
      const s = startOfDay(parseISO(a.start_date));
      const e = endOfDaySafe(parseISO(a.end_date));
      return t >= s && t <= e;
    });
    onAvailabilityChange(isAbsentNow ? 'absent' : 'available');
  };

  // Initial load (with spinner) on first mount and when the dozent changes.
  // Month switches fetch silently in the background — no re-render flash.
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current || dozentIdForFetchRef.current !== dozentId) {
      isFirstMount.current = false;
      dozentIdForFetchRef.current = dozentId;
      fetchedRangesRef.current = new Set();
      void fetchAll(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dozentId]);

  useEffect(() => {
    const rangeKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    if (fetchedRangesRef.current.has(rangeKey)) {
      // Already have this month's data — just refresh capacity silently, no spinner
      void fetchAll(true);
      return;
    }
    fetchedRangesRef.current.add(rangeKey);
    void fetchAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  // Global mouseup to finish drag even when released outside a day cell
  useEffect(() => {
    if (!isDragging) return;
    const finish = () => {
      if (dragStart && dragEnd) {
        const start = dateMin([dragStart, dragEnd]);
        const end = dateMax([dragStart, dragEnd]);
        // If the drag starts on an already-absent day, treat it as "erase"
        // (overpainting red -> available again). Otherwise paint a new absence.
        if (isDateAbsent(start)) {
          void eraseAbsence(start, end);
        } else {
          void saveAbsence(start, end);
        }
      }
      setDragStart(null);
      setDragEnd(null);
    };
    window.addEventListener('mouseup', finish);
    window.addEventListener('touchend', finish);
    return () => {
      window.removeEventListener('mouseup', finish);
      window.removeEventListener('touchend', finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, dragStart, dragEnd]);

  const saveAbsence = async (start: Date, end: Date) => {
    if (isAdmin) return;

    // --- Optimistic update (synchronous, no re-render from isSaving/fetchAll) ---
    const overlapping = absences.filter((a) => {
      const s = startOfDay(parseISO(a.start_date));
      const e = endOfDaySafe(parseISO(a.end_date));
      return (
        (start >= subDaysSafe(s) && start <= addDaysSafe(e)) ||
        (end >= subDaysSafe(s) && end <= addDaysSafe(e)) ||
        (start <= s && end >= e)
      );
    });
    const mergedStart = overlapping.length
      ? dateMin([start, ...overlapping.map((a) => parseISO(a.start_date))])
      : start;
    const mergedEnd = overlapping.length
      ? dateMax([end, ...overlapping.map((a) => parseISO(a.end_date))])
      : end;
    const overlapIds = new Set(overlapping.map((a) => a.id));
    const optimisticId = `opt-${Date.now()}-${Math.random()}`;
    const optimisticAbsence: Absence = {
      id: optimisticId,
      dozent_id: dozentIdRef.current || '',
      start_date: format(mergedStart, 'yyyy-MM-dd'),
      end_date: format(mergedEnd, 'yyyy-MM-dd'),
      note: null,
    };
    setAbsences((prev) => [...prev.filter((a) => !overlapIds.has(a.id)), optimisticAbsence]);
    notifyAvailability([...absences.filter((a) => !overlapIds.has(a.id)), optimisticAbsence]);

    // --- Background DB write ---
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const targetDozentId = dozentIdRef.current || user.id;

      const { data: inserted, error: insertError } = await supabase
        .from('dozent_absences')
        .insert({
          dozent_id: targetDozentId,
          start_date: format(mergedStart, 'yyyy-MM-dd'),
          end_date: format(mergedEnd, 'yyyy-MM-dd'),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Replace the optimistic placeholder with the real row
      if (inserted) {
        setAbsences((prev) =>
          prev.map((a) => (a.id === optimisticId ? inserted as Absence : a))
        );
      }

      if (overlapping.length) {
        const { error: delError } = await supabase
          .from('dozent_absences')
          .delete()
          .in('id', overlapping.map((a) => a.id));
        if (delError) throw delError;
      }

      addToast('Abwesenheit eingetragen', 'success');
    } catch (error) {
      console.error('Error saving absence:', error);
      // Rollback optimistic update
      setAbsences((prev) => prev.filter((a) => a.id !== optimisticId));
      addToast('Fehler beim Speichern', 'error');
    }
  };

  // Erase mode: remove the dragged days from existing absences.
  // Splits an absence if the erased range lies in the middle.
  const eraseAbsence = async (start: Date, end: Date) => {
    if (isAdmin) return;

    const dragStart = startOfDay(start);
    const dragEnd = endOfDaySafe(end);

    const affected = absences.filter((a) => {
      const s = startOfDay(parseISO(a.start_date));
      const e = endOfDaySafe(parseISO(a.end_date));
      return dragStart <= e && dragEnd >= s;
    });

    const toDelete: string[] = [];
    const toUpdate: { id: string; start_date?: string; end_date?: string }[] = [];
    const toInsert: { start_date: string; end_date: string }[] = [];

    for (const a of affected) {
      const s = startOfDay(parseISO(a.start_date));
      const e = endOfDaySafe(parseISO(a.end_date));

      if (dragStart <= s && dragEnd >= e) {
        toDelete.push(a.id);
        continue;
      }
      if (dragStart <= s && dragEnd < e) {
        const newStart = addDaysSafe(dragEnd);
        toUpdate.push({ id: a.id, start_date: format(newStart, 'yyyy-MM-dd') });
        continue;
      }
      if (dragStart > s && dragEnd >= e) {
        const newEnd = subDaysSafe(dragStart);
        toUpdate.push({ id: a.id, end_date: format(newEnd, 'yyyy-MM-dd') });
        continue;
      }
      if (dragStart > s && dragEnd < e) {
        const leftEnd = subDaysSafe(dragStart);
        const rightStart = addDaysSafe(dragEnd);
        toUpdate.push({ id: a.id, end_date: format(leftEnd, 'yyyy-MM-dd') });
        toInsert.push({
          start_date: format(rightStart, 'yyyy-MM-dd'),
          end_date: format(e, 'yyyy-MM-dd'),
        });
        continue;
      }
    }

    // --- Optimistic update ---
    const deleteSet = new Set(toDelete);
    const updateMap = new Map(toUpdate.map((u) => [u.id, u]));
    const optimisticInserts: Absence[] = toInsert.map((r, i) => ({
      id: `opt-ins-${Date.now()}-${i}`,
      dozent_id: dozentIdRef.current || '',
      start_date: r.start_date,
      end_date: r.end_date,
      note: null,
    }));
    const optimisticAbsences = [
      ...absences
        .filter((a) => !deleteSet.has(a.id))
        .map((a) => {
          const u = updateMap.get(a.id);
          if (!u) return a;
          return {
            ...a,
            start_date: u.start_date ?? a.start_date,
            end_date: u.end_date ?? a.end_date,
          };
        }),
      ...optimisticInserts,
    ];
    setAbsences(optimisticAbsences);
    notifyAvailability(optimisticAbsences);

    // --- Background DB write ---
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const targetDozentId = dozentIdRef.current || user.id;

      if (toDelete.length) {
        const { error } = await supabase.from('dozent_absences').delete().in('id', toDelete);
        if (error) throw error;
      }
      for (const u of toUpdate) {
        const { error } = await supabase.from('dozent_absences').update(u).eq('id', u.id);
        if (error) throw error;
      }
      if (toInsert.length) {
        const rows = toInsert.map((r) => ({ dozent_id: targetDozentId, ...r }));
        const { data: insertedRows, error } = await supabase
          .from('dozent_absences')
          .insert(rows)
          .select();
        if (error) throw error;
        // Replace optimistic placeholders with real rows
        if (insertedRows && insertedRows.length) {
          const optIds = new Set(optimisticInserts.map((a) => a.id));
          setAbsences((prev) => [
            ...prev.filter((a) => !optIds.has(a.id)),
            ...(insertedRows as Absence[]),
          ]);
        }
      }

      addToast('Abwesenheit entfernt', 'success');
    } catch (error) {
      console.error('Error erasing absence:', error);
      // Rollback: refetch the truth from DB
      void fetchAll(true);
      addToast('Fehler beim Entfernen', 'error');
    }
  };

  const deleteAbsence = async (id: string) => {
    if (isAdmin) return;

    // --- Optimistic update ---
    const optimistic = absences.filter((a) => a.id !== id);
    setAbsences(optimistic);
    notifyAvailability(optimistic);

    // --- Background DB write ---
    try {
      const { error } = await supabase.from('dozent_absences').delete().eq('id', id);
      if (error) throw error;
      addToast('Abwesenheit entfernt', 'success');
    } catch (error) {
      console.error('Error deleting absence:', error);
      void fetchAll(true);
      addToast('Fehler beim Löschen', 'error');
    }
  };

  const saveMaxParticipants = async (value: string) => {
    if (isAdmin) return;
    setMaxParticipants(value);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const targetDozentId = dozentId || user.id;
      const num = value === '' ? null : Math.max(0, parseInt(value, 10) || 0);

      if (capacity?.id) {
        const { error } = await supabase
          .from('dozent_availability')
          .update({ max_participants: num, updated_at: new Date().toISOString() })
          .eq('id', capacity.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('dozent_availability')
          .insert({
            dozent_id: targetDozentId,
            month: cursor.getMonth() + 1,
            year: cursor.getFullYear(),
            capacity_status: 'available',
            max_participants: num,
          })
          .select()
          .single();
        if (error) throw error;
        setCapacity(data);
      }
    } catch (error) {
      console.error('Error saving max participants:', error);
    }
  };

  const handleDayMouseDown = (date: Date) => {
    if (isAdmin || isSaving) return;
    setDragStart(date);
    setDragEnd(date);
  };
  const handleDayMouseEnter = (date: Date) => {
    if (!isDragging) return;
    setDragEnd(date);
  };

  // Absences that fall within the visible month (for the list below the calendar)
  const visibleAbsences = useMemo(() => {
    const ms = startOfMonth(cursor);
    const me = endOfMonth(cursor);
    return absences
      .filter((a) => {
        const s = parseISO(a.start_date);
        const e = parseISO(a.end_date);
        return e >= ms && s <= me;
      })
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [absences, cursor]);

  const fmtRange = (a: Absence) => {
    const s = parseISO(a.start_date);
    const e = parseISO(a.end_date);
    return isSameDay(s, e)
      ? format(s, 'dd.MM.yyyy', { locale: de })
      : `${format(s, 'dd.MM.', { locale: de })} – ${format(e, 'dd.MM.yyyy', { locale: de })}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg font-medium text-gray-900">Verfügbarkeit &amp; Abwesenheit</h3>
        </div>
        <div className="p-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Verfügbarkeit &amp; Abwesenheit</h3>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Month header with prev/next + today */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('prev')}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              aria-label="Vorheriger Monat"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h4 className="font-medium text-gray-900 capitalize min-w-[140px] text-center">{monthLabel}</h4>
            <button
              onClick={() => navigate('next')}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              aria-label="Nächster Monat"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <button
            onClick={() => setCursor(new Date())}
            className="text-xs text-primary hover:underline"
          >
            Heute
          </button>
        </div>

        {/* Scrollable calendar area: scroll to switch months at the bounds */}
        <div
          ref={scrollContainerRef}
          onWheel={handleCalendarWheel}
          className="select-none overflow-y-auto max-h-[55vh] pr-1"
        >
          <div ref={calendarRef}>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((date) => {
              const inMonth = isSameMonth(date, cursor);
              const isToday = isSameDay(date, today);
              const absent = isDateAbsent(date);
              const inDrag = isDateInDrag(date);
              const isPast = startOfDay(date) < startOfDay(today);

              const base =
                'relative h-12 sm:h-14 flex items-start justify-end p-1.5 text-sm rounded-md border transition-colors';
              let cls = 'border-gray-200 ';
              if (!inMonth) cls += 'text-gray-300 bg-gray-50 ';
              else if (inDrag) cls += 'bg-red-500 text-white border-red-500 ';
              else if (absent) cls += 'bg-red-100 text-red-800 border-red-300 ';
              else if (isToday) cls += 'bg-primary-50 text-primary border-primary ';
              else if (isPast) cls += 'text-gray-400 bg-gray-50 ';
              else cls += 'text-gray-700 hover:bg-gray-100 ';

              return (
                <div
                  key={date.toISOString()}
                  onMouseDown={() => handleDayMouseDown(date)}
                  onMouseEnter={() => handleDayMouseEnter(date)}
                  onTouchStart={() => handleDayMouseDown(date)}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    const el = document.elementFromPoint(touch.clientX, touch.clientY);
                    const dayEl = el?.closest('[data-day]') as HTMLElement | null;
                    if (dayEl) {
                      const ds = dayEl.getAttribute('data-day');
                      if (ds) handleDayMouseEnter(new Date(ds));
                    }
                  }}
                  data-day={format(date, 'yyyy-MM-dd')}
                  className={`${base} ${cls} ${isAdmin || isSaving ? 'cursor-default' : 'cursor-crosshair'}`}
                >
                  <span className={isToday && !inDrag && !absent ? 'font-bold' : ''}>
                    {format(date, 'd')}
                  </span>
                  {absent && !inDrag && (
                    <span className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </div>

        {/* Max participants for the month */}
        {!isAdmin && !hideMaxParticipants && (
          <div className="mt-5 max-w-xs">
            <label className="block text-xs text-gray-500 mb-1">
              Max. neue Teilnehmer im {format(cursor, 'MMMM', { locale: de })}
            </label>
            <div className="relative">
              <Users className="h-4 w-4 text-gray-400 absolute left-2 top-2.5" />
              <input
                type="number"
                min="0"
                value={maxParticipants}
                onChange={(e) => saveMaxParticipants(e.target.value)}
                placeholder="z.B. 5"
                disabled={isSaving}
                className="w-full text-sm pl-8 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {isAdmin && !hideMaxParticipants && capacity?.max_participants != null && (
          <div className="mt-5 flex items-center text-sm text-gray-600">
            <Users className="h-4 w-4 mr-1" />
            Max. {capacity.max_participants} neue Teilnehmer im {format(cursor, 'MMMM', { locale: de })}
          </div>
        )}

        {/* Existing absences in this month */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Abwesenheiten in diesem Monat</h4>
          {visibleAbsences.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Abwesenheiten eingetragen.</p>
          ) : (
            <ul className="space-y-2">
              {visibleAbsences.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between bg-red-50 border border-red-200 rounded-md px-3 py-2"
                >
                  <div className="flex items-center text-sm text-red-800">
                    <Calendar className="h-4 w-4 mr-2 text-red-500" />
                    <span className="font-medium">{fmtRange(a)}</span>
                    {a.note && <span className="ml-2 text-red-600">— {a.note}</span>}
                  </div>
                  {!isAdmin && (
                    <button
                      onClick={() => deleteAbsence(a.id)}
                      disabled={isSaving}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100"
                      aria-label="Abwesenheit löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// --- date helpers (avoid pulling extra date-fns fns) ---
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDaySafe(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDaysSafe(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + 1);
  return x;
}
function subDaysSafe(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - 1);
  return x;
}
