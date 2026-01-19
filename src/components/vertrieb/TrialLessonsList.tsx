import { useState, useEffect } from 'react';
import { GraduationCap, Calendar, User, Check, X, Plus, Edit2, Trash2, UserPlus, Clock, CheckCircle, CalendarClock, Search, AlertCircle, Mail, Phone, MessageCircle } from 'lucide-react';
import { TrialLesson, Lead, useSalesStore } from '../../store/salesStore';
import { supabase } from '../../lib/supabase';

interface Dozent {
  id: string;
  name: string;
  email: string;
  legal_areas: string[];
}

interface TrialLessonsListProps {
  trialLessons: TrialLesson[];
  onUpdate: (id: string, data: Partial<TrialLesson>) => Promise<void>;
  onCreate: (data: Partial<TrialLesson>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TrialLessonsList({ trialLessons, onUpdate, onCreate, onDelete }: TrialLessonsListProps) {
  const { leads: allLeads, updateLead } = useSalesStore();
  const [showForm, setShowForm] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dozenten, setDozenten] = useState<Dozent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  
  // Leads with trial_pending status (waiting for trial lesson to be created)
  // Exclude leads that already have a trial lesson created
  const leadsWithTrialLessons = new Set(trialLessons.map(t => t.lead_id).filter(Boolean));
  const pendingTrialLeads = allLeads.filter(l => l.status === 'trial_pending' && !leadsWithTrialLessons.has(l.id));
  const [selectedDozent, setSelectedDozent] = useState<string>('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [formData, setFormData] = useState({
    teilnehmer_name: '',
    teilnehmer_email: '',
    teilnehmer_phone: '',
    scheduled_date: '',
    notes: '',
    rechtsgebiet: '',
    dozent_id: '',
    duration: '60',
    uni_standort: '',
    landesrecht: '',
    lead_id: '' as string | undefined,
  });

  useEffect(() => {
    fetchDozenten();
    fetchLeads();
  }, []);

  const fetchDozenten = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, email, legal_areas').eq('role', 'dozent');
    setDozenten((data || []).map(d => ({ id: d.id, name: d.full_name, email: d.email, legal_areas: d.legal_areas || [] })));
  };

  const fetchLeads = async () => {
    const { data } = await supabase.from('leads').select('*').order('name');
    setLeads(data || []);
  };

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(leadSearchQuery.toLowerCase()) ||
    (lead.email && lead.email.toLowerCase().includes(leadSearchQuery.toLowerCase()))
  );

  const selectLead = (lead: Lead) => {
    setFormData({
      ...formData,
      teilnehmer_name: lead.name,
      teilnehmer_email: lead.email || '',
      teilnehmer_phone: lead.phone || '',
    });
    setLeadSearchQuery(lead.name);
    setShowLeadDropdown(false);
  };

  // Helper to check if a date has passed
  const isDatePassed = (dateStr: string | null) => {
    if (!dateStr) return false;
    const lessonDate = new Date(dateStr);
    const now = new Date();
    return lessonDate < now;
  };

  // Filter by stages
  // Requested without dozent = Stage 1, Requested with dozent or dozent_assigned = Stage 2
  const requestedLessons = trialLessons.filter(t => t.status === 'requested' && !t.dozent_id);
  const assignedLessons = trialLessons.filter(t => t.status === 'dozent_assigned' || (t.status === 'requested' && t.dozent_id));
  // Stage 3: confirmed but no scheduled_date yet (waiting for dozent to enter date)
  const pendingSchedulingLessons = trialLessons.filter(t => t.status === 'confirmed' && !t.scheduled_date);
  // Stage 4: scheduled or confirmed with scheduled_date (only if date not passed)
  const scheduledLessons = trialLessons.filter(t => 
    (t.status === 'scheduled' || (t.status === 'confirmed' && t.scheduled_date)) && 
    !isDatePassed(t.scheduled_date)
  );
  // Stage 5: completed, no_show, cancelled, converted OR date has passed
  const completedLessons = trialLessons.filter(t => 
    ['completed', 'no_show', 'cancelled', 'converted'].includes(t.status) ||
    ((t.status === 'scheduled' || (t.status === 'confirmed' && t.scheduled_date)) && isDatePassed(t.scheduled_date))
  );

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
      const submitData = {
        ...formData,
        duration: parseInt(formData.duration, 10),
      };
      if (editingId) {
        await onUpdate(editingId, submitData);
      } else {
        await onCreate({ ...submitData, status: 'requested' });
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
      rechtsgebiet: '',
      dozent_id: '',
      duration: '60',
      uni_standort: '',
      landesrecht: '',
      lead_id: undefined,
    });
    setLeadSearchQuery('');
    setShowForm(false);
    setShowRequestForm(false);
    setEditingId(null);
  };

  const startEdit = (lesson: TrialLesson) => {
    setFormData({
      teilnehmer_name: lesson.teilnehmer_name,
      teilnehmer_email: lesson.teilnehmer_email || '',
      teilnehmer_phone: lesson.teilnehmer_phone || '',
      scheduled_date: lesson.scheduled_date.split('T')[0],
      notes: lesson.notes || '',
      rechtsgebiet: lesson.rechtsgebiet || '',
      dozent_id: lesson.dozent_id || '',
      duration: lesson.duration?.toString() || '60',
      uni_standort: lesson.uni_standort || '',
      landesrecht: lesson.landesrecht || '',
      lead_id: lesson.lead_id || undefined,
    });
    setLeadSearchQuery(lesson.teilnehmer_name);
    setEditingId(lesson.id);
    setShowForm(true);
  };

  const updateStatus = async (id: string, status: TrialLesson['status']) => {
    await onUpdate(id, { status });
    
    // When trial lesson is completed, just mark it - Finalgespräch is already scheduled at booking time
    if (status === 'completed') {
      const lesson = trialLessons.find(t => t.id === id);
      // Only update lead status if not already in post_trial_call
      if (lesson?.lead_id) {
        const lead = allLeads.find(l => l.id === lesson.lead_id);
        if (lead && lead.status !== 'post_trial_call' && lead.status !== 'finalgespraech') {
          await updateLead(lesson.lead_id, { status: 'post_trial_call' });
        }
      }
    }
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
            {lesson.scheduled_date && (
              <div className="flex items-center text-blue-600">
                <MessageCircle className="h-3 w-3 mr-1" />
                <span>Finalgespräch: {(() => {
                  const trialDate = new Date(lesson.scheduled_date);
                  const duration = lesson.duration || 60;
                  trialDate.setMinutes(trialDate.getMinutes() + duration + 60);
                  return trialDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ', ' + 
                         trialDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                })()}</span>
              </div>
            )}
            {lesson.dozent_name && (
              <div className="flex items-center"><User className="h-3 w-3 mr-1" />{lesson.dozent_name}</div>
            )}
            {lesson.rechtsgebiet && (
              <div className="flex items-center">
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{lesson.rechtsgebiet}</span>
              </div>
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
          <button onClick={() => {
            if (window.confirm(`Möchten Sie die Probestunde von "${lesson.teilnehmer_name}" wirklich löschen?`)) {
              onDelete(lesson.id);
            }
          }} className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="Löschen"><Trash2 className="h-4 w-4" /></button>
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

      {/* Vertical Layout - 5 Stages */}
      <div className="space-y-4">
        {/* Stage 0: Ausstehend - Leads waiting for trial lesson */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <AlertCircle className="h-4 w-4 text-gray-600 mr-2" />
            <h3 className="font-semibold text-gray-800">0. Ausstehend</h3>
            <span className="ml-2 bg-gray-200 text-gray-800 text-xs px-2 py-0.5 rounded-full">{pendingTrialLeads.length}</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">Leads mit Status "Probestunde angefordert" - warten auf Anlage einer Probestunde</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {pendingTrialLeads.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">Keine ausstehenden Leads</p>
            ) : (
              pendingTrialLeads.map(lead => (
                <div key={lead.id} className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{lead.name}</h4>
                      <div className="mt-1 text-xs text-gray-500 space-y-1">
                        {lead.email && (
                          <div className="flex items-center"><Mail className="h-3 w-3 mr-1" />{lead.email}</div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center"><Phone className="h-3 w-3 mr-1" />{lead.phone}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setFormData({
                          ...formData,
                          teilnehmer_name: lead.name,
                          teilnehmer_email: lead.email || '',
                          teilnehmer_phone: lead.phone || '',
                          lead_id: lead.id,
                        });
                        setLeadSearchQuery(lead.name);
                        setShowRequestForm(true);
                      }}
                      className="p-1.5 text-orange-600 hover:bg-orange-100 rounded"
                      title="Probestunde anlegen"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stage 1: Angefragt */}
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Clock className="h-4 w-4 text-orange-600 mr-2" />
            <h3 className="font-semibold text-orange-800">1. Probestunde angefragt</h3>
            <span className="ml-2 bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded-full">{requestedLessons.length}</span>
            <button
              onClick={() => setShowRequestForm(!showRequestForm)}
              className="ml-auto flex items-center px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
            >
              <Plus className="h-4 w-4 mr-1" />
              Anfragen
            </button>
          </div>

          {/* Request Form */}
          {showRequestForm && (
            <div className="mb-4 p-4 bg-white rounded-lg border border-orange-200">
              <h4 className="font-medium text-gray-900 mb-3">Neue Probestunde anfragen</h4>
              <form onSubmit={async (e) => {
                e.preventDefault();
                await onCreate({
                  ...formData,
                  duration: parseInt(formData.duration, 10),
                  scheduled_date: formData.scheduled_date || undefined,
                  dozent_id: formData.dozent_id || undefined,
                  rechtsgebiet: formData.rechtsgebiet || undefined,
                  uni_standort: formData.uni_standort || undefined,
                  landesrecht: formData.landesrecht || undefined,
                  notes: formData.notes || undefined,
                  lead_id: formData.lead_id || undefined,
                  status: 'requested',
                });
                
                // If a scheduled_date is set, automatically set the Finalgespräch date on the lead
                if (formData.scheduled_date && formData.lead_id) {
                  const trialDate = new Date(formData.scheduled_date);
                  const duration = parseInt(formData.duration, 10) || 60;
                  trialDate.setMinutes(trialDate.getMinutes() + duration + 60); // End of trial + 1 hour
                  const finalCallDate = trialDate.toISOString();
                  
                  await updateLead(formData.lead_id, { 
                    status: 'post_trial_call',
                    final_call_date: finalCallDate
                  });
                }
                
                resetForm();
              }} className="space-y-4">
                {/* Teilnehmer Selection */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Search className="h-4 w-4 inline mr-1" />
                    Teilnehmer suchen *
                  </label>
                  <input
                    type="text"
                    value={leadSearchQuery}
                    onChange={(e) => {
                      setLeadSearchQuery(e.target.value);
                      setShowLeadDropdown(true);
                    }}
                    onFocus={() => setShowLeadDropdown(true)}
                    placeholder="Name oder E-Mail eingeben..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  {showLeadDropdown && leadSearchQuery && filteredLeads.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredLeads.slice(0, 10).map(lead => (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => selectLead(lead)}
                          className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{lead.name}</div>
                          <div className="text-xs text-gray-500">{lead.email} {lead.phone && `• ${lead.phone}`}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Auto-filled Teilnehmer Data */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.teilnehmer_name}
                      onChange={(e) => setFormData({ ...formData, teilnehmer_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                    <input
                      type="email"
                      value={formData.teilnehmer_email}
                      onChange={(e) => setFormData({ ...formData, teilnehmer_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input
                      type="tel"
                      value={formData.teilnehmer_phone}
                      onChange={(e) => setFormData({ ...formData, teilnehmer_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                    />
                  </div>
                </div>

                {/* Dozent and Rechtsgebiet */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <User className="h-4 w-4 inline mr-1" />
                      Anfrage bei Dozent
                    </label>
                    <select
                      value={formData.dozent_id}
                      onChange={(e) => setFormData({ ...formData, dozent_id: e.target.value, rechtsgebiet: '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Dozent auswählen...</option>
                      {dozenten.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rechtsgebiet</label>
                    <select
                      value={formData.rechtsgebiet}
                      onChange={(e) => setFormData({ ...formData, rechtsgebiet: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      disabled={!formData.dozent_id}
                    >
                      <option value="">{formData.dozent_id ? 'Rechtsgebiet auswählen...' : 'Erst Dozent auswählen...'}</option>
                      {formData.dozent_id && dozenten.find(d => d.id === formData.dozent_id)?.legal_areas.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Uni-Standort and Landesrecht */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Uni-Standort</label>
                    <input
                      type="text"
                      value={formData.uni_standort}
                      onChange={(e) => setFormData({ ...formData, uni_standort: e.target.value })}
                      placeholder="z.B. Köln, München, Berlin..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Landesrecht</label>
                    <select
                      value={formData.landesrecht}
                      onChange={(e) => setFormData({ ...formData, landesrecht: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Bundesland auswählen...</option>
                      <option value="Baden-Württemberg">Baden-Württemberg</option>
                      <option value="Bayern">Bayern</option>
                      <option value="Berlin">Berlin</option>
                      <option value="Brandenburg">Brandenburg</option>
                      <option value="Bremen">Bremen</option>
                      <option value="Hamburg">Hamburg</option>
                      <option value="Hessen">Hessen</option>
                      <option value="Mecklenburg-Vorpommern">Mecklenburg-Vorpommern</option>
                      <option value="Niedersachsen">Niedersachsen</option>
                      <option value="Nordrhein-Westfalen">Nordrhein-Westfalen</option>
                      <option value="Rheinland-Pfalz">Rheinland-Pfalz</option>
                      <option value="Saarland">Saarland</option>
                      <option value="Sachsen">Sachsen</option>
                      <option value="Sachsen-Anhalt">Sachsen-Anhalt</option>
                      <option value="Schleswig-Holstein">Schleswig-Holstein</option>
                      <option value="Thüringen">Thüringen</option>
                    </select>
                  </div>
                </div>

                {/* Date, Duration and Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gewünschtes Datum</label>
                    <input
                      type="datetime-local"
                      value={formData.scheduled_date}
                      onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Clock className="h-4 w-4 inline mr-1" />
                      Dauer (Minuten)
                    </label>
                    <select
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="30">30 Min</option>
                      <option value="45">45 Min</option>
                      <option value="60">60 Min</option>
                      <option value="90">90 Min</option>
                      <option value="120">120 Min</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Zusätzliche Informationen..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
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
                    className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                  >
                    Probestunde anfragen
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {requestedLessons.length === 0 && !showRequestForm ? (
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

        {/* Stage 5: Abgeschlossen */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Check className="h-4 w-4 text-gray-600 mr-2" />
            <h3 className="font-semibold text-gray-800">5. Abgeschlossen</h3>
            <span className="ml-auto bg-gray-200 text-gray-800 text-xs px-2 py-0.5 rounded-full">{completedLessons.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {completedLessons.length === 0 ? (
              <p className="text-sm text-gray-600 py-2">Keine abgeschlossenen Probestunden</p>
            ) : (
              completedLessons.map(lesson => (
                <div key={lesson.id} className="p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{lesson.teilnehmer_name}</h4>
                      <div className="mt-1 text-xs text-gray-500 space-y-1">
                        {lesson.scheduled_date && (
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(lesson.scheduled_date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {lesson.dozent_name && (
                          <div className="flex items-center"><User className="h-3 w-3 mr-1" />{lesson.dozent_name}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <select
                        value={lesson.status}
                        onChange={(e) => updateStatus(lesson.id, e.target.value as TrialLesson['status'])}
                        className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${
                          lesson.status === 'completed' ? 'bg-green-100 text-green-800' :
                          lesson.status === 'converted' ? 'bg-purple-100 text-purple-800' :
                          lesson.status === 'no_show' ? 'bg-red-100 text-red-800' :
                          lesson.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                          'bg-blue-100 text-blue-800'
                        }`}
                      >
                        <option value="completed">Durchgeführt</option>
                        <option value="no_show">Nicht erschienen</option>
                        <option value="converted">Konvertiert</option>
                        <option value="cancelled">Abgesagt</option>
                        <option value="scheduled">Zurück zu Vereinbart</option>
                      </select>
                      <button 
                        onClick={() => {
                          if (window.confirm(`Möchten Sie die Probestunde von "${lesson.teilnehmer_name}" wirklich löschen?`)) {
                            onDelete(lesson.id);
                          }
                        }} 
                        className="p-1 text-red-600 hover:bg-red-100 rounded" 
                        title="Löschen"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
