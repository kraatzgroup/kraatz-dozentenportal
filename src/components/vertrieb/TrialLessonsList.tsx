import { useState } from 'react';
import { GraduationCap, Calendar, User, Check, X, Plus, Edit2, Trash2 } from 'lucide-react';
import { TrialLesson } from '../../store/salesStore';

interface TrialLessonsListProps {
  trialLessons: TrialLesson[];
  onUpdate: (id: string, data: Partial<TrialLesson>) => Promise<void>;
  onCreate: (data: Partial<TrialLesson>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TrialLessonsList({ trialLessons, onUpdate, onCreate, onDelete }: TrialLessonsListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    teilnehmer_name: '',
    teilnehmer_email: '',
    teilnehmer_phone: '',
    scheduled_date: '',
    notes: '',
  });

  const upcomingLessons = trialLessons.filter(t => 
    t.status === 'scheduled' && new Date(t.scheduled_date) >= new Date()
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'converted': return 'bg-purple-100 text-purple-800';
      case 'no_show': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Geplant';
      case 'completed': return 'Durchgeführt';
      case 'converted': return 'Konvertiert';
      case 'no_show': return 'Nicht erschienen';
      case 'cancelled': return 'Abgesagt';
      default: return status;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await onUpdate(editingId, formData);
      } else {
        await onCreate({ ...formData, status: 'scheduled' });
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

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <GraduationCap className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Probestunden</h2>
            {upcomingLessons.length > 0 && (
              <span className="ml-2 bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                {upcomingLessons.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4 mr-1" />
            Neu
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

      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {upcomingLessons.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Keine anstehenden Probestunden
          </div>
        ) : (
          upcomingLessons.map((lesson) => (
            <div key={lesson.id} className="p-4 hover:bg-gray-50 transition">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-gray-900 truncate">
                      {lesson.teilnehmer_name}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(lesson.status)}`}>
                      {getStatusLabel(lesson.status)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center text-sm text-gray-500 space-x-3">
                    <span className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(lesson.scheduled_date)}
                    </span>
                    {lesson.dozent_name && (
                      <span className="flex items-center">
                        <User className="h-3 w-3 mr-1" />
                        {lesson.dozent_name}
                      </span>
                    )}
                  </div>
                  {lesson.teilnehmer_phone && (
                    <a href={`tel:${lesson.teilnehmer_phone}`} className="text-sm text-primary hover:underline">
                      {lesson.teilnehmer_phone}
                    </a>
                  )}
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  {lesson.status === 'scheduled' && (
                    <>
                      <button
                        onClick={() => updateStatus(lesson.id, 'completed')}
                        className="p-1.5 text-green-600 hover:bg-green-100 rounded transition"
                        title="Als durchgeführt markieren"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => updateStatus(lesson.id, 'no_show')}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                        title="Nicht erschienen"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => startEdit(lesson)}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition"
                    title="Bearbeiten"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(lesson.id)}
                    className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                    title="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
