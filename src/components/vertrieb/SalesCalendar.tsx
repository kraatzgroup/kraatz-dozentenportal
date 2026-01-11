import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Check, X, Edit2, Trash2, Phone, FileText, Users, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SalesTodo {
  id: string;
  vertrieb_user_id: string | null;
  lead_id: string | null;
  todo_type: 'beratungsgespraech' | 'angebotsversand' | 'gespraech_nach_angebot' | 'probestunde' | 'finalgespraech';
  title: string;
  description: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  teilnehmer_name: string | null;
  teilnehmer_email: string | null;
  teilnehmer_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  isCalBooking?: boolean;
  isTrialLesson?: boolean;
}

interface CalBooking {
  id: string;
  cal_booking_id: number;
  title: string;
  start_time: string;
  end_time: string;
  attendee_name: string;
  attendee_email: string;
  status: string;
}

const TODO_TYPES = [
  { id: 'beratungsgespraech', label: 'Beratungsgespräch', icon: Phone, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'gespraech_nach_angebot', label: 'Gespräch nach Angebot', icon: MessageSquare, color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'probestunde', label: 'Probestunde', icon: Users, color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'finalgespraech', label: 'Finalgespräch', icon: FileText, color: 'bg-red-100 text-red-800 border-red-200' },
];

export function SalesCalendar() {
  const [todos, setTodos] = useState<SalesTodo[]>([]);
  const [calBookings, setCalBookings] = useState<CalBooking[]>([]);
  const [trialLessons, setTrialLessons] = useState<any[]>([]);
  const [finalCallLeads, setFinalCallLeads] = useState<any[]>([]);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(TODO_TYPES.map(t => t.id)));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [formData, setFormData] = useState({
    todo_type: 'beratungsgespraech' as SalesTodo['todo_type'],
    title: '',
    description: '',
    scheduled_date: '',
    scheduled_time: '',
    priority: 'medium' as SalesTodo['priority'],
    teilnehmer_name: '',
    teilnehmer_email: '',
    teilnehmer_phone: '',
    notes: '',
  });

  useEffect(() => {
    fetchTodos();
    fetchCalBookings();
    fetchTrialLessons();
    fetchFinalCallLeads();
  }, []);

  const fetchTodos = async () => {
    const { data, error } = await supabase
      .from('sales_todos')
      .select('*')
      .order('scheduled_date', { ascending: true });
    if (!error && data) setTodos(data);
  };

  const fetchCalBookings = async () => {
    const { data, error } = await supabase
      .from('cal_bookings')
      .select('*')
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true });
    if (!error && data) setCalBookings(data);
  };

  const fetchTrialLessons = async () => {
    const { data, error } = await supabase
      .from('trial_lessons')
      .select('*')
      .in('status', ['scheduled', 'confirmed'])
      .order('scheduled_date', { ascending: true });
    if (!error && data) setTrialLessons(data);
  };

  const fetchFinalCallLeads = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .not('final_call_date', 'is', null)
      .in('status', ['post_trial_call', 'finalgespraech'])
      .order('final_call_date', { ascending: true });
    if (!error && data) setFinalCallLeads(data);
  };

  // Convert Cal bookings to SalesTodo format for unified display
  const calBookingsAsTodos: SalesTodo[] = calBookings.map(b => ({
    id: `cal-${b.id}`,
    vertrieb_user_id: null,
    lead_id: null,
    todo_type: 'beratungsgespraech' as const,
    title: b.title || 'Beratungsgespräch',
    description: null,
    scheduled_date: b.start_time.split('T')[0],
    scheduled_time: new Date(b.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    status: 'pending' as const,
    priority: 'medium' as const,
    teilnehmer_name: b.attendee_name,
    teilnehmer_email: b.attendee_email,
    teilnehmer_phone: null,
    notes: null,
    created_at: b.start_time,
    updated_at: b.start_time,
    isCalBooking: true,
  }));

  // Convert trial lessons to SalesTodo format
  const trialLessonsAsTodos: SalesTodo[] = trialLessons.map(t => ({
    id: `trial-${t.id}`,
    vertrieb_user_id: t.vertrieb_user_id,
    lead_id: t.lead_id,
    todo_type: 'probestunde' as const,
    title: `Probestunde: ${t.teilnehmer_name}`,
    description: t.dozent_name ? `Dozent: ${t.dozent_name}` : null,
    scheduled_date: t.scheduled_date?.split('T')[0] || t.scheduled_date,
    scheduled_time: t.scheduled_date?.includes('T') ? new Date(t.scheduled_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null,
    status: 'pending' as const,
    priority: 'high' as const,
    teilnehmer_name: t.teilnehmer_name,
    teilnehmer_email: t.teilnehmer_email,
    teilnehmer_phone: t.teilnehmer_phone,
    notes: t.notes,
    created_at: t.created_at,
    updated_at: t.updated_at,
    isTrialLesson: true,
  }));

  // Convert final call leads to SalesTodo format
  const finalCallLeadsAsTodos: SalesTodo[] = finalCallLeads.map(l => ({
    id: `finalcall-${l.id}`,
    vertrieb_user_id: null,
    lead_id: l.id,
    todo_type: 'finalgespraech' as const,
    title: `Finalgespräch: ${l.name}`,
    description: null,
    scheduled_date: l.final_call_date?.split('T')[0] || l.final_call_date,
    scheduled_time: l.final_call_date?.includes('T') ? new Date(l.final_call_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null,
    status: 'pending' as const,
    priority: 'high' as const,
    teilnehmer_name: l.name,
    teilnehmer_email: l.email,
    teilnehmer_phone: l.phone,
    notes: l.notes,
    created_at: l.created_at,
    updated_at: l.updated_at,
    isFinalCallLead: true,
  }));

  const allTodos = [...todos, ...calBookingsAsTodos, ...trialLessonsAsTodos, ...finalCallLeadsAsTodos];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (editingId) {
        await supabase.from('sales_todos').update(formData).eq('id', editingId);
      } else {
        await supabase.from('sales_todos').insert({ ...formData, vertrieb_user_id: user?.id, status: 'pending' });
        
        // Auto-create Finalgespräch 24 hours after Gespräch nach Angebot
        if (formData.todo_type === 'gespraech_nach_angebot' && formData.scheduled_date) {
          const followUpDate = new Date(formData.scheduled_date);
          followUpDate.setDate(followUpDate.getDate() + 1);
          const followUpDateStr = followUpDate.toISOString().split('T')[0];
          
          await supabase.from('sales_todos').insert({
            todo_type: 'finalgespraech',
            title: `Finalgespräch: ${formData.teilnehmer_name || formData.title}`,
            scheduled_date: followUpDateStr,
            scheduled_time: formData.scheduled_time,
            teilnehmer_name: formData.teilnehmer_name,
            teilnehmer_email: formData.teilnehmer_email,
            teilnehmer_phone: formData.teilnehmer_phone,
            priority: 'high',
            notes: `Automatisch erstellt nach Gespräch nach Angebot vom ${formData.scheduled_date}`,
            vertrieb_user_id: user?.id,
            status: 'pending'
          });
        }
      }
      await fetchTodos();
      resetForm();
    } catch (error) {
      console.error('Error saving todo:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      todo_type: 'beratungsgespraech',
      title: '',
      description: '',
      scheduled_date: '',
      scheduled_time: '',
      priority: 'medium',
      teilnehmer_name: '',
      teilnehmer_email: '',
      teilnehmer_phone: '',
      notes: '',
    });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (todo: SalesTodo) => {
    setFormData({
      todo_type: todo.todo_type,
      title: todo.title,
      description: todo.description || '',
      scheduled_date: todo.scheduled_date,
      scheduled_time: todo.scheduled_time || '',
      priority: todo.priority,
      teilnehmer_name: todo.teilnehmer_name || '',
      teilnehmer_email: todo.teilnehmer_email || '',
      teilnehmer_phone: todo.teilnehmer_phone || '',
      notes: todo.notes || '',
    });
    setEditingId(todo.id);
    setShowForm(true);
  };

  const updateStatus = async (id: string, status: SalesTodo['status']) => {
    await supabase.from('sales_todos').update({ status }).eq('id', id);
    await fetchTodos();
  };

  const deleteTodo = async (id: string) => {
    await supabase.from('sales_todos').delete().eq('id', id);
    await fetchTodos();
  };

  // Calendar helpers
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const startDay = firstDay === 0 ? 6 : firstDay - 1;
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  const navigate = (dir: number) => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'day') newDate.setDate(newDate.getDate() + dir);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() + (dir * 7));
    else { newDate.setMonth(newDate.getMonth() + dir); }
    setSelectedDate(newDate);
    setCalMonth(newDate.getMonth());
    setCalYear(newDate.getFullYear());
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCalMonth(today.getMonth());
    setCalYear(today.getFullYear());
  };

  const isTodayCal = (day: number) => {
    const t = new Date();
    return day === t.getDate() && calMonth === t.getMonth() && calYear === t.getFullYear();
  };

  const getTodosForDate = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return allTodos.filter(t => t.scheduled_date === dateStr && t.status === 'pending' && visibleTypes.has(t.todo_type) && (filterType === 'all' || t.todo_type === filterType));
  };

  const getTodosForDateStr = (dateStr: string) => {
    return allTodos.filter(t => t.scheduled_date === dateStr && t.status === 'pending' && visibleTypes.has(t.todo_type) && (filterType === 'all' || t.todo_type === filterType));
  };

  const getWeekDates = () => {
    const start = new Date(selectedDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const formatDateStr = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const isToday = (date: Date) => {
    const t = new Date();
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
  };

  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const weekDaysFull = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

  const getTypeConfig = (type: string) => TODO_TYPES.find(t => t.id === type) || TODO_TYPES[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pendingTodos = allTodos.filter(t => t.status === 'pending');
  const upcomingTodos = pendingTodos.filter(t => new Date(t.scheduled_date) >= today).sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Vertriebskalender</h2>
            <span className="ml-2 bg-primary text-white text-xs px-2 py-0.5 rounded-full">{pendingTodos.length}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button onClick={() => setViewMode('day')} className={`px-3 py-1 text-sm rounded ${viewMode === 'day' ? 'bg-white shadow text-primary' : 'text-gray-600'}`}>Tag</button>
              <button onClick={() => setViewMode('week')} className={`px-3 py-1 text-sm rounded ${viewMode === 'week' ? 'bg-white shadow text-primary' : 'text-gray-600'}`}>Woche</button>
              <button onClick={() => setViewMode('month')} className={`px-3 py-1 text-sm rounded ${viewMode === 'month' ? 'bg-white shadow text-primary' : 'text-gray-600'}`}>Monat</button>
            </div>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5">
              <option value="all">Alle Typen</option>
              {TODO_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button onClick={() => setShowForm(true)} className="flex items-center px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition">
              <Plus className="h-4 w-4 mr-1" />Neu
            </button>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ *</label>
                <select value={formData.todo_type} onChange={(e) => setFormData({ ...formData, todo_type: e.target.value as SalesTodo['todo_type'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  {TODO_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priorität</label>
                <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as SalesTodo['priority'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
                <input type="date" required value={formData.scheduled_date} onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Uhrzeit</label>
                <input type="time" value={formData.scheduled_time} onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teilnehmer Name</label>
                <input type="text" value={formData.teilnehmer_name} onChange={(e) => setFormData({ ...formData, teilnehmer_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input type="tel" value={formData.teilnehmer_phone} onChange={(e) => setFormData({ ...formData, teilnehmer_phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input type="email" value={formData.teilnehmer_email} onChange={(e) => setFormData({ ...formData, teilnehmer_email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Abbrechen</button>
              <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">{editingId ? 'Speichern' : 'Erstellen'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-white rounded-lg shadow p-4">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={goToToday} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Heute</button>
            <button onClick={() => navigate(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <h3 className="text-lg font-semibold">
            {viewMode === 'day' && `${selectedDate.getDate()}. ${months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`}
            {viewMode === 'week' && `KW ${Math.ceil((selectedDate.getDate() + new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay()) / 7)} - ${months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`}
            {viewMode === 'month' && `${months[calMonth]} ${calYear}`}
          </h3>
          <div className="w-24" />
        </div>

        {/* Legend - Clickable to toggle visibility */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TODO_TYPES.map(t => {
            const isVisible = visibleTypes.has(t.id);
            return (
              <button
                key={t.id}
                onClick={() => {
                  const newSet = new Set(visibleTypes);
                  if (isVisible) newSet.delete(t.id);
                  else newSet.add(t.id);
                  setVisibleTypes(newSet);
                }}
                className={`flex items-center text-xs px-2 py-1 rounded border cursor-pointer transition ${isVisible ? t.color : 'bg-gray-100 text-gray-400 border-gray-200 opacity-50'}`}
              >
                <t.icon className="h-3 w-3 mr-1" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* DAY VIEW */}
        {viewMode === 'day' && (
          <div className="space-y-2">
            <div className="text-center py-2 text-sm font-medium text-gray-600">
              {weekDaysFull[selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1]}
              {isToday(selectedDate) && <span className="ml-2 text-primary">(Heute)</span>}
            </div>
            {getTodosForDateStr(formatDateStr(selectedDate)).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-12">Keine Einträge für diesen Tag</p>
            ) : (
              getTodosForDateStr(formatDateStr(selectedDate)).map(todo => {
                const config = getTypeConfig(todo.todo_type);
                const IconComponent = config.icon;
                return (
                  <div key={todo.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg ${config.color}`}><IconComponent className="h-5 w-5" /></div>
                      <div>
                        <h4 className="font-medium text-gray-900">{todo.title}</h4>
                        <p className="text-sm text-gray-600">{config.label}</p>
                        <div className="mt-1 text-sm text-gray-500 space-y-0.5">
                          {todo.scheduled_time && <div>Uhrzeit: {todo.scheduled_time.slice(0, 5)}</div>}
                          {todo.teilnehmer_name && <div>Teilnehmer: {todo.teilnehmer_name}</div>}
                          {todo.teilnehmer_phone && <div>Tel: <a href={`tel:${todo.teilnehmer_phone}`} className="text-primary hover:underline">{todo.teilnehmer_phone}</a></div>}
                          {todo.teilnehmer_email && <div>E-Mail: <a href={`mailto:${todo.teilnehmer_email}`} className="text-primary hover:underline">{todo.teilnehmer_email}</a></div>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {!todo.isCalBooking && (
                        <>
                          <button onClick={() => updateStatus(todo.id, 'completed')} className="p-2 text-green-600 hover:bg-green-100 rounded"><Check className="h-5 w-5" /></button>
                          <button onClick={() => startEdit(todo)} className="p-2 text-gray-600 hover:bg-gray-100 rounded"><Edit2 className="h-5 w-5" /></button>
                          <button onClick={() => deleteTodo(todo.id)} className="p-2 text-red-600 hover:bg-red-100 rounded"><Trash2 className="h-5 w-5" /></button>
                        </>
                      )}
                      {todo.isCalBooking && <span className="text-xs text-gray-400">Cal.com</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* WEEK VIEW */}
        {viewMode === 'week' && (
          <>
            {/* Desktop: 7 columns */}
            <div className="hidden md:grid grid-cols-7 gap-3">
              {getWeekDates().map((date, idx) => {
                const dateStr = formatDateStr(date);
                const dayTodos = getTodosForDateStr(dateStr);
                return (
                  <div key={idx} className={`min-h-[280px] p-3 border-2 rounded-xl bg-white ${isToday(date) ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100'}`}>
                    <div className={`text-center pb-2 mb-2 border-b ${isToday(date) ? 'border-primary/20' : 'border-gray-100'}`}>
                      <div className={`text-xs font-medium uppercase tracking-wide ${isToday(date) ? 'text-primary' : 'text-gray-400'}`}>{weekDays[idx]}</div>
                      <div className={`text-2xl font-bold ${isToday(date) ? 'text-primary' : 'text-gray-700'}`}>{date.getDate()}</div>
                    </div>
                    <div className="space-y-2 overflow-y-auto max-h-[220px]">
                      {dayTodos.length === 0 && (
                        <p className="text-xs text-gray-300 text-center py-4">-</p>
                      )}
                      {dayTodos.map(todo => {
                        const config = getTypeConfig(todo.todo_type);
                        return (
                          <div key={todo.id} onClick={() => startEdit(todo)} className={`p-2 rounded-lg border cursor-pointer hover:shadow-sm transition ${config.color}`}>
                            <div className="font-semibold text-xs">{todo.scheduled_time?.slice(0, 5) || ''}</div>
                            <div className="text-xs mt-0.5 line-clamp-2">{todo.title}</div>
                            {todo.teilnehmer_name && <div className="text-xs mt-1 opacity-75 truncate">{todo.teilnehmer_name}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Mobile: Stacked list */}
            <div className="md:hidden space-y-3">
              {getWeekDates().map((date, idx) => {
                const dateStr = formatDateStr(date);
                const dayTodos = getTodosForDateStr(dateStr);
                if (dayTodos.length === 0) return null;
                return (
                  <div key={idx} className={`p-3 border-2 rounded-xl ${isToday(date) ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white'}`}>
                    <div className={`flex items-center space-x-2 pb-2 mb-2 border-b ${isToday(date) ? 'border-primary/20' : 'border-gray-100'}`}>
                      <span className={`text-xs font-medium uppercase ${isToday(date) ? 'text-primary' : 'text-gray-400'}`}>{weekDays[idx]}</span>
                      <span className={`text-lg font-bold ${isToday(date) ? 'text-primary' : 'text-gray-700'}`}>{date.getDate()}</span>
                      {isToday(date) && <span className="text-xs text-primary">(Heute)</span>}
                    </div>
                    <div className="space-y-2">
                      {dayTodos.map(todo => {
                        const config = getTypeConfig(todo.todo_type);
                        return (
                          <div key={todo.id} onClick={() => startEdit(todo)} className={`p-3 rounded-lg border cursor-pointer ${config.color}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm">{todo.scheduled_time?.slice(0, 5) || ''}</span>
                              {todo.isCalBooking && <span className="text-xs opacity-60">Cal.com</span>}
                            </div>
                            <div className="text-sm mt-1">{todo.title}</div>
                            {todo.teilnehmer_name && <div className="text-xs mt-1 opacity-75">{todo.teilnehmer_name}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {getWeekDates().every(date => getTodosForDateStr(formatDateStr(date)).length === 0) && (
                <p className="text-sm text-gray-500 text-center py-8">Keine Einträge diese Woche</p>
              )}
            </div>
          </>
        )}

        {/* MONTH VIEW */}
        {viewMode === 'month' && (
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map(d => <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>)}
            {Array.from({ length: startDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayTodos = getTodosForDate(day);
              return (
                <div key={day} onClick={() => { setSelectedDate(new Date(calYear, calMonth, day)); setViewMode('day'); }} className={`min-h-[80px] p-1 border rounded-lg cursor-pointer hover:bg-gray-50 ${isTodayCal(day) ? 'bg-primary/10 border-primary' : 'border-gray-200'}`}>
                  <div className={`text-xs font-medium mb-1 ${isTodayCal(day) ? 'text-primary' : 'text-gray-700'}`}>{day}</div>
                  <div className="space-y-0.5">
                    {dayTodos.slice(0, 3).map(todo => {
                      const config = getTypeConfig(todo.todo_type);
                      return <div key={todo.id} className={`text-xs px-1 py-0.5 rounded truncate border ${config.color}`}>{todo.scheduled_time && <span className="font-medium">{todo.scheduled_time.slice(0, 5)} </span>}{todo.title}</div>;
                    })}
                    {dayTodos.length > 3 && <div className="text-xs text-gray-500">+{dayTodos.length - 3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming ToDos List */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Anstehende Aufgaben</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {upcomingTodos.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Keine anstehenden Aufgaben</p>
          ) : (
            upcomingTodos.slice(0, 10).map(todo => {
              const config = getTypeConfig(todo.todo_type);
              const IconComponent = config.icon;
              return (
                <div key={todo.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{todo.title}</h4>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div>{new Date(todo.scheduled_date).toLocaleDateString('de-DE')} {todo.scheduled_time && `um ${todo.scheduled_time.slice(0, 5)}`}</div>
                        {todo.teilnehmer_name && <div>{todo.teilnehmer_name}</div>}
                        {todo.teilnehmer_phone && <a href={`tel:${todo.teilnehmer_phone}`} className="text-primary hover:underline">{todo.teilnehmer_phone}</a>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button onClick={() => updateStatus(todo.id, 'completed')} className="p-1.5 text-green-600 hover:bg-green-100 rounded" title="Erledigt"><Check className="h-4 w-4" /></button>
                    <button onClick={() => updateStatus(todo.id, 'cancelled')} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Abbrechen"><X className="h-4 w-4" /></button>
                    <button onClick={() => startEdit(todo)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Bearbeiten"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => deleteTodo(todo.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="Löschen"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
