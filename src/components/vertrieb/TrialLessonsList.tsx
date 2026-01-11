import { useState, useEffect } from 'react';
import { GraduationCap, Calendar, User, Check, X, Plus, Edit2, Trash2, UserPlus, Clock, CheckCircle, CalendarClock } from 'lucide-react';
import { TrialLesson } from '../../store/salesStore';
import { supabase } from '../../lib/supabase';

interface Dozent {
  id: string;
  name: string;
  email: string;
}

interface TrialLessonsListProps {
  trialLessons: TrialLesson[];
  onUpdate: (id: string, data: Partial<TrialLesson>) => Promise<void>;
  onCreate: (data: Partial<TrialLesson>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TrialLessonsList({ trialLessons, onUpdate, onCreate, onDelete }: TrialLessonsListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dozenten, setDozenten] = useState<Dozent[]>([]);
  const [selectedDozent, setSelectedDozent] = useState<string>('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    teilnehmer_name: '',
    teilnehmer_email: '',
    teilnehmer_phone: '',
    scheduled_date: '',
    notes: '',
  });

  useEffect(() => {
    fetchDozenten();
  }, []);

  const fetchDozenten = async () => {
    const { data } = await supabase.from('users').select('id, name, email').eq('role', 'dozent');
    setDozenten(data || []);
  };

  // Filter by stages
  const requestedLessons = trialLessons.filter(t => t.status === 'requested');
  const assignedLessons = trialLessons.filter(t => t.status === 'dozent_assigned');
  const pendingSchedulingLessons = trialLessons.filter(t => t.status === 'confirmed');
  const scheduledLessons = trialLessons.filter(t => t.status === 'scheduled');

  const assignDozent = async (lessonId: string, dozentId: string) => {
    const dozent = dozenten.find(d => d.id === dozentId);
    await onUpdate(lessonId, { 
      dozent_id: dozentId, 
      dozent_name: dozent?.name,
      status: 'dozent_assigned' 
    });
    setAssigningId(null);
    setSelectedDozent('');
  };

  const confirmLesson = async (lessonId: string) => {
    await onUpdate(lessonId, { status: 'confirmed', dozent_confirmed: true });
  };

  const scheduleLesson = async (lessonId: string) => {
    await onUpdate(lessonId, { status: 'scheduled' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await onUpdate(editingId, formData);
      } else {
        await onCreate({ ...formData, status: 'requested' });
      }
      resetForm();
    } catch (error) {
      console.error('Error saving trial lesson:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      teilnehmer_name: '',
      teilnehmer_email: '',
      teilnehmer_phone: '',
      scheduled_date: '',
      notes: '',
    });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (lesson: TrialLesson) => {
    setFormData({
      teilnehmer_name: lesson.teilnehmer_name,
      teilnehmer_email: lesson.teilnehmer_email || '',
      teilnehmer_phone: lesson.teilnehmer_phone || '',
      scheduled_date: lesson.scheduled_date.split('T')[0],
      notes: lesson.notes || '',
    });
    setEditingId(lesson.id);
    setShowForm(true);
  };

  const updateStatus = async (id: string, status: TrialLesson['status']) => {
    await onUpdate(id, { status });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderLessonCard = (lesson: TrialLesson, showActions: 'assign' | 'confirm' | 'schedule' | 'complete') => (
    <div key={lesson.id} className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{lesson.teilnehmer_name}</h4>
          <div className="mt-1 text-xs text-gray-500 space-y-1">
            {lesson.scheduled_date && (
              <div className="flex items-center"><Calendar className="h-3 w-3 mr-1" />{formatDate(lesson.scheduled_date)}</div>
            )}
            {lesson.dozent_name && (
              <div className="flex items-center"><User className="h-3 w-3 mr-1" />{lesson.dozent_name}</div>
            )}
            {lesson.teilnehmer_phone && (
              <a href={`tel:${lesson.teilnehmer_phone}`} className="text-primary hover:underline">{lesson.teilnehmer_phone}</a>
            )}
          </div>
        </div>
        <div className="flex flex-col space-y-1 ml-2">
          {showActions === 'assign' && (
            assigningId === lesson.id ? (
              <div className="flex flex-col space-y-1">
                <select value={selectedDozent} onChange={(e) => setSelectedDozent(e.target.value)} className="text-xs border rounded px-1 py-0.5">
                  <option value="">Dozent wählen...</option>
                  {dozenten.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <div className="flex space-x-1">
                  <button onClick={() => selectedDozent && assignDozent(lesson.id, selectedDozent)} disabled={!selectedDozent} className="p-1 text-green-600 hover:bg-green-100 rounded disabled:opacity-50"><Check className="h-3 w-3" /></button>
                  <button onClick={() => setAssigningId(null)} className="p-1 text-gray-600 hover:bg-gray-100 rounded"><X className="h-3 w-3" /></button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAssigningId(lesson.id)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded" title="Dozent zuweisen"><UserPlus className="h-4 w-4" /></button>
            )
          )}
          {showActions === 'confirm' && (
            <button onClick={() => confirmLesson(lesson.id)} className="p-1.5 text-green-600 hover:bg-green-100 rounded" title="Bestätigen"><CheckCircle className="h-4 w-4" /></button>
          )}
          {showActions === 'schedule' && (
            <button onClick={() => scheduleLesson(lesson.id)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded" title="Termin vereinbart"><CalendarClock className="h-4 w-4" /></button>
          )}
          {showActions === 'complete' && lesson.status !== 'completed' && (
            <>
              <button onClick={() => updateStatus(lesson.id, 'completed')} className="p-1.5 text-green-600 hover:bg-green-100 rounded" title="Durchgeführt"><Check className="h-4 w-4" /></button>
              <button onClick={() => updateStatus(lesson.id, 'no_show')} className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="Nicht erschienen"><X className="h-4 w-4" /></button>
            </>
          )}
          <button onClick={() => startEdit(lesson)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Bearbeiten"><Edit2 className="h-4 w-4" /></button>
          <button onClick={() => onDelete(lesson.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="Löschen"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <GraduationCap className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Probestunden</h2>
            <span className="ml-2 bg-primary text-white text-xs px-2 py-0.5 rounded-full">
              {trialLessons.filter(t => !['completed', 'cancelled', 'no_show', 'converted'].includes(t.status)).length}
            </span>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition">
            <Plus className="h-4 w-4 mr-1" />Neu
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.teilnehmer_name}
                  onChange={(e) => setFormData({ ...formData, teilnehmer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={formData.teilnehmer_phone}
                  onChange={(e) => setFormData({ ...formData, teilnehmer_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail
                </label>
                <input
                  type="email"
                  value={formData.teilnehmer_email}
                  onChange={(e) => setFormData({ ...formData, teilnehmer_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Datum & Uhrzeit *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notizen
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition"
              >
                {editingId ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vertical Layout - 4 Stages */}
      <div className="space-y-4">
        {/* Stage 1: Angefragt */}
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Clock className="h-4 w-4 text-orange-600 mr-2" />
            <h3 className="font-semibold text-orange-800">1. Probestunde angefragt</h3>
            <span className="ml-auto bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded-full">{requestedLessons.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {requestedLessons.length === 0 ? (
              <p className="text-sm text-orange-600 py-2">Keine Anfragen</p>
            ) : (
              requestedLessons.map(lesson => renderLessonCard(lesson, 'assign'))
            )}
          </div>
        </div>

        {/* Stage 2: Dozent zugewiesen */}
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <UserPlus className="h-4 w-4 text-yellow-600 mr-2" />
            <h3 className="font-semibold text-yellow-800">2. Dozent zugewiesen</h3>
            <span className="ml-auto bg-yellow-200 text-yellow-800 text-xs px-2 py-0.5 rounded-full">{assignedLessons.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {assignedLessons.length === 0 ? (
              <p className="text-sm text-yellow-600 py-2">Keine zugewiesenen</p>
            ) : (
              assignedLessons.map(lesson => renderLessonCard(lesson, 'confirm'))
            )}
          </div>
        </div>

        {/* Stage 3: Terminvereinbarung ausstehend */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <CalendarClock className="h-4 w-4 text-blue-600 mr-2" />
            <h3 className="font-semibold text-blue-800">3. Terminvereinbarung ausstehend</h3>
            <span className="ml-auto bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full">{pendingSchedulingLessons.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {pendingSchedulingLessons.length === 0 ? (
              <p className="text-sm text-blue-600 py-2">Keine ausstehenden Termine</p>
            ) : (
              pendingSchedulingLessons.map(lesson => renderLessonCard(lesson, 'schedule'))
            )}
          </div>
        </div>

        {/* Stage 4: Vereinbart */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
            <h3 className="font-semibold text-green-800">4. Probestunde vereinbart</h3>
            <span className="ml-auto bg-green-200 text-green-800 text-xs px-2 py-0.5 rounded-full">{scheduledLessons.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {scheduledLessons.length === 0 ? (
              <p className="text-sm text-green-600 py-2">Keine vereinbarten Probestunden</p>
            ) : (
              scheduledLessons.map(lesson => renderLessonCard(lesson, 'complete'))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
