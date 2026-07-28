import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, BookOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CaseStudyRequest {
  id: string;
  case_study_number: number;
  legal_area: string;
  sub_area: string;
  focus_area: string;
  status: string;
  video_correction_url?: string;
}

interface StudentFeedback {
  id: string;
  case_study_id: string;
  profile_id: string;
  mistakes_learned: string;
  improvements_planned: string;
  review_date: string;
  email_reminder: boolean;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

interface RepeatEntry {
  caseStudy: CaseStudyRequest;
  feedback: StudentFeedback;
  date: Date;
}

export const VbWiederholungPage: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [caseStudies, setCaseStudies] = useState<CaseStudyRequest[]>([]);
  const [feedbacks, setFeedbacks] = useState<Record<string, StudentFeedback>>({});
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        const { data: caseStudyData, error } = await supabase
          .from('vb_case_study_requests')
          .select('id, case_study_number, legal_area, sub_area, focus_area, status, video_correction_url')
          .eq('profile_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        setCaseStudies(
          (caseStudyData || []).map((cs, idx) => ({
            ...cs,
            case_study_number: cs.case_study_number ?? idx + 1
          }))
        );
      } catch (error) {
        console.error('Error loading case studies:', error);
      }

      try {
        const stored = localStorage.getItem('vb_student_feedbacks');
        if (stored) {
          const parsed = JSON.parse(stored);
          setFeedbacks(parsed);
        }
      } catch (error) {
        console.error('Error loading feedbacks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const entriesById = useMemo(() => {
    const map: Record<string, CaseStudyRequest> = {};
    caseStudies.forEach(cs => { map[cs.id] = cs; });
    return map;
  }, [caseStudies]);

  const repeatEntries: RepeatEntry[] = useMemo(() => {
    const entries: RepeatEntry[] = [];
    Object.entries(feedbacks).forEach(([caseStudyId, feedback]) => {
      if (!feedback.review_date) return;
      const caseStudy = entriesById[caseStudyId];
      if (!caseStudy) return;
      entries.push({
        caseStudy,
        feedback,
        date: parseISO(feedback.review_date)
      });
    });
    return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [feedbacks, entriesById]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale: de });
    const end = endOfWeek(endOfMonth(currentMonth), { locale: de });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const entriesForDay = (day: Date) => repeatEntries.filter(entry => isSameDay(entry.date, day));

  const selectedEntries = selectedDate ? entriesForDay(selectedDate) : [];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Wiederholung</h1>
          <p className="text-gray-600 mt-1">
            Hier siehst du alle Klausuren, deren Inhalte du wiederholen möchtest.
          </p>
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Wiederholungen im Kalender
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Wiederholungen werden im Kalender angezeigt, wenn du im Feedbackpapier einen Wiederholungstermin festlegst.
            </p>
          </div>
          <Link
            to="/klausurenbesprechung/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <BookOpen className="w-4 h-4" />
            Zur Klausurenkorrektur
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: de })}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Nächster Monat"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(day => {
              const dayEntries = entriesForDay(day);
              const hasEntry = dayEntries.length > 0;
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    min-h-[4.5rem] sm:min-h-[6rem] p-1.5 rounded-lg border text-left transition-colors flex flex-col
                    ${isCurrentMonth ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 text-gray-400'}
                    ${isSelected ? 'ring-2 ring-primary border-primary' : 'hover:border-gray-300'}
                  `}
                >
                  <span className={`text-sm font-medium ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                    {format(day, 'd')}
                  </span>
                  {hasEntry && (
                    <div className="mt-auto space-y-1">
                      {dayEntries.slice(0, 3).map(entry => (
                        <div
                          key={entry.caseStudy.id}
                          className="text-[10px] sm:text-xs truncate px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium"
                        >
                          Klausur #{entry.caseStudy.case_study_number}
                        </div>
                      ))}
                      {dayEntries.length > 3 && (
                        <div className="text-[10px] sm:text-xs px-1.5 text-purple-600">
                          +{dayEntries.length - 3} weitere
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            {selectedDate
              ? format(selectedDate, 'dd. MMMM yyyy', { locale: de })
              : 'Termin auswählen'}
          </h3>

          {selectedEntries.length > 0 ? (
            <div className="space-y-4">
              {selectedEntries.map(entry => (
                <div
                  key={entry.caseStudy.id}
                  className="p-4 rounded-lg border border-purple-100 bg-purple-50/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-gray-900">
                        Klausur #{entry.caseStudy.case_study_number}
                      </div>
                      <div className="text-sm text-gray-600">
                        {entry.caseStudy.legal_area} · {entry.caseStudy.sub_area}
                      </div>
                    </div>
                    <BookOpen className="w-5 h-5 text-purple-500 flex-shrink-0" />
                  </div>
                  {entry.caseStudy.focus_area && (
                    <div className="text-sm text-gray-700 mt-2">
                      <span className="font-medium">Schwerpunkt:</span> {entry.caseStudy.focus_area}
                    </div>
                  )}
                  {entry.feedback.mistakes_learned && (
                    <div className="mt-3 text-sm text-gray-700">
                      <div className="font-medium text-gray-900 mb-1">Was habe ich falsch gemacht?</div>
                      <p className="line-clamp-3">{entry.feedback.mistakes_learned}</p>
                    </div>
                  )}
                  {entry.feedback.improvements_planned && (
                    <div className="mt-3 text-sm text-gray-700">
                      <div className="font-medium text-gray-900 mb-1">Was möchte ich besser machen?</div>
                      <p className="line-clamp-3">{entry.feedback.improvements_planned}</p>
                    </div>
                  )}
                  <Link
                    to={`/klausurenbesprechung/dashboard#case-study-${entry.caseStudy.id}`}
                    className="mt-4 inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                  >
                    <BookOpen className="w-4 h-4" />
                    Zur Klausurenkorrektur
                  </Link>
                </div>
              ))}
            </div>
          ) : selectedDate ? (
            <p className="text-gray-500 text-sm">An diesem Tag sind keine Wiederholungen geplant.</p>
          ) : (
            <p className="text-gray-500 text-sm">
              Wähle einen Tag im Kalender aus, um geplante Wiederholungen anzuzeigen.
            </p>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <Link
              to="/klausurenbesprechung/dashboard"
              className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
            >
              <ArrowRight className="w-4 h-4" />
              Zurück zum Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
