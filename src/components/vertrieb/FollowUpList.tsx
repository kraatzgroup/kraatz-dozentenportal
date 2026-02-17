import { useState } from 'react';
import { Phone, Calendar, Clock, Check, X, Plus, Edit2, Trash2, AlertCircle, ChevronLeft, ChevronRight, List, CalendarDays } from 'lucide-react';
import { FollowUp } from '../../store/salesStore';

interface FollowUpListProps {
  followUps: FollowUp[];
  onUpdate: (id: string, data: Partial<FollowUp>) => Promise<void>;
  onCreate: (data: Partial<FollowUp>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function FollowUpList({ followUps, onUpdate, onCreate, onDelete }: FollowUpListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    teilnehmer_name: '',
    teilnehmer_email: '',
    teilnehmer_phone: '',
    follow_up_date: '',
    follow_up_time: '',
    reason: '',
    notes: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
  });

  const pendingFollowUps = followUps.filter(f => f.status === 'pending').sort((a, b) => {
    const dateCompare = new Date(a.follow_up_date).getTime() - new Date(b.follow_up_date).getTime();
    if (dateCompare !== 0) return dateCompare;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Hoch';
      case 'medium': return 'Mittel';
      case 'low': return 'Niedrig';
      default: return priority;
    }
  };

  const isOverdue = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const followUpDate = new Date(dateStr);
    followUpDate.setHours(0, 0, 0, 0);
    return followUpDate < today;
  };

  const isToday = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const followUpDate = new Date(dateStr);
    followUpDate.setHours(0, 0, 0, 0);
    return followUpDate.getTime() === today.getTime();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await onUpdate(editingId, formData);
      } else {
        await onCreate({ ...formData, status: 'pending' });
      }
      resetForm();
    } catch (error) {
      console.error('Error saving follow-up:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      teilnehmer_name: '',
      teilnehmer_email: '',
      teilnehmer_phone: '',
      follow_up_date: '',
      follow_up_time: '',
      reason: '',
      notes: '',
      priority: 'medium',
    });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (followUp: FollowUp) => {
    setFormData({
      teilnehmer_name: followUp.teilnehmer_name,
      teilnehmer_email: followUp.teilnehmer_email || '',
      teilnehmer_phone: followUp.teilnehmer_phone || '',
      follow_up_date: followUp.follow_up_date,
      follow_up_time: followUp.follow_up_time || '',
      reason: followUp.reason || '',
      notes: followUp.notes || '',
      priority: followUp.priority,
    });
    setEditingId(followUp.id);
    setShowForm(true);
  };

  const markAsCompleted = async (id: string) => {
    await onUpdate(id, { status: 'completed' });
  };

  const markAsCancelled = async (id: string) => {
    await onUpdate(id, { status: 'cancelled' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
  };

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const startDay = firstDay === 0 ? 6 : firstDay - 1;
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const getDateFollowUps = (day: number) => {
    const d = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return pendingFollowUps.filter(f => f.follow_up_date === d);
  };
  const navMonth = (dir: number) => {
    let m = calMonth + dir, y = calYear;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setCalMonth(m); setCalYear(y);
  };
  const isTodayCal = (day: number) => {
    const t = new Date();
    return day === t.getDate() && calMonth === t.getMonth() && calYear === t.getFullYear();
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Phone className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Follow-Ups</h2>
            {pendingFollowUps.length > 0 && (
              <span className="ml-2 bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                {pendingFollowUps.length}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow text-primary' : 'text-gray-500'}`} title="Liste"><List className="h-4 w-4" /></button>
              <button onClick={() => setViewMode('calendar')} className={`p-1.5 rounded ${viewMode === 'calendar' ? 'bg-white shadow text-primary' : 'text-gray-500'}`} title="Kalender"><CalendarDays className="h-4 w-4" /></button>
            </div>
            <button onClick={() => setShowForm(true)} className="flex items-center px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition"><Plus className="h-4 w-4 mr-1" />Neu</button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" required value={formData.teilnehmer_name} onChange={(e) => setFormData({ ...formData, teilnehmer_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input type="tel" value={formData.teilnehmer_phone} onChange={(e) => setFormData({ ...formData, teilnehmer_phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input type="email" value={formData.teilnehmer_email} onChange={(e) => setFormData({ ...formData, teilnehmer_email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
                <input type="date" required value={formData.follow_up_date} onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Uhrzeit</label>
                <input type="time" value={formData.follow_up_time} onChange={(e) => setFormData({ ...formData, follow_up_time: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioritaet</label>
                <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'low' | 'medium' | 'high' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grund</label>
              <input type="text" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="z.B. Rueckruf nach Beratungsgespraech" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition">Abbrechen</button>
              <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition">{editingId ? 'Speichern' : 'Erstellen'}</button>
            </div>
          </form>
        </div>
      )}

      {viewMode === 'calendar' ? (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
            <h3 className="text-lg font-semibold">{months[calMonth]} {calYear}</h3>
            <button onClick={() => navMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>)}
            {Array.from({length: startDay}).map((_,i) => <div key={`e${i}`} />)}
            {Array.from({length: daysInMonth}).map((_,i) => {
              const day = i + 1;
              const fups = getDateFollowUps(day);
              return (
                <div key={day} className={`min-h-[60px] p-1 border rounded-lg ${isTodayCal(day) ? 'bg-primary/10 border-primary' : 'border-gray-200'}`}>
                  <div className={`text-xs font-medium ${isTodayCal(day) ? 'text-primary' : 'text-gray-700'}`}>{day}</div>
                  {fups.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {fups.slice(0,2).map(f => (
                        <div key={f.id} className={`text-xs px-1 py-0.5 rounded truncate ${f.priority === 'high' ? 'bg-red-100 text-red-800' : f.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{f.teilnehmer_name}</div>
                      ))}
                      {fups.length > 2 && <div className="text-xs text-gray-500">+{fups.length - 2}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {pendingFollowUps.length === 0 ? (
            <div className="p-6 text-center text-gray-500">Keine ausstehenden Follow-Ups</div>
          ) : (
            pendingFollowUps.map((followUp) => (
              <div key={followUp.id} className={`p-4 hover:bg-gray-50 transition ${isOverdue(followUp.follow_up_date) ? 'bg-red-50' : isToday(followUp.follow_up_date) ? 'bg-yellow-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-gray-900 truncate">{followUp.teilnehmer_name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${getPriorityColor(followUp.priority)}`}>{getPriorityLabel(followUp.priority)}</span>
                    {isOverdue(followUp.follow_up_date) && (<span className="flex items-center text-red-600 text-xs"><AlertCircle className="h-3 w-3 mr-1" />Ueberfaellig</span>)}
                    {isToday(followUp.follow_up_date) && !isOverdue(followUp.follow_up_date) && (<span className="text-yellow-600 text-xs font-medium">Heute</span>)}
                  </div>
                  <div className="mt-1 flex items-center text-sm text-gray-500 space-x-3">
                    <span className="flex items-center"><Calendar className="h-3 w-3 mr-1" />{formatDate(followUp.follow_up_date)}</span>
                    {followUp.follow_up_time && (<span className="flex items-center"><Clock className="h-3 w-3 mr-1" />{followUp.follow_up_time}</span>)}
                  </div>
                  {followUp.reason && <p className="mt-1 text-sm text-gray-600">{followUp.reason}</p>}
                  {followUp.teilnehmer_phone && (<a href={`tel:${followUp.teilnehmer_phone}`} className="text-sm text-primary hover:underline">{followUp.teilnehmer_phone}</a>)}
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  <button onClick={() => markAsCompleted(followUp.id)} className="p-1.5 text-green-600 hover:bg-green-100 rounded transition" title="Als erledigt markieren"><Check className="h-4 w-4" /></button>
                  <button onClick={() => markAsCancelled(followUp.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition" title="Abbrechen"><X className="h-4 w-4" /></button>
                  <button onClick={() => startEdit(followUp)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition" title="Bearbeiten"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => onDelete(followUp.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition" title="Loeschen"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
