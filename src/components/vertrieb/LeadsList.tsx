import React, { useState, useEffect } from 'react';
import { Users, Mail, Phone, MapPin, GraduationCap, Calendar, Search, Filter, Plus, X, Edit2, ChevronDown, MessageSquare, FileText, Clock, CheckCircle } from 'lucide-react';
import { Lead, LeadNote, useSalesStore } from '../../store/salesStore';
import { supabase } from '../../lib/supabase';

interface LeadsListProps {
  leads: Lead[];
  onUpdateStatus: (id: string, status: Lead['status']) => Promise<void>;
  onCreateLead: (data: Partial<Lead>) => Promise<void>;
  onUpdateLead: (id: string, data: Partial<Lead>) => Promise<void>;
}

interface TrialLesson {
  id: string;
  teilnehmer_name: string;
  scheduled_date: string;
  status: string;
  dozent_name: string | null;
  rechtsgebiet: string | null;
}

interface ActivityItem {
  type: 'note' | 'status_change' | 'trial_lesson' | 'final_call' | 'created';
  date: string;
  title: string;
  description?: string;
  icon: 'message' | 'status' | 'lesson' | 'call' | 'created';
}

export function LeadsList({ leads, onUpdateStatus, onCreateLead, onUpdateLead }: LeadsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Lead['status'] | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [trialLessons, setTrialLessons] = useState<TrialLesson[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  
  const { leadNotes, fetchLeadNotes, addLeadNote } = useSalesStore();
  
  useEffect(() => {
    fetchLeadNotes();
    fetchTrialLessons();
  }, [fetchLeadNotes]);
  
  const fetchTrialLessons = async () => {
    const { data } = await supabase.from('trial_lessons').select('id, teilnehmer_name, scheduled_date, status, dozent_name, rechtsgebiet, lead_id');
    if (data) setTrialLessons(data);
  };
  
  const getNotesForLead = (leadId: string): LeadNote[] => {
    return leadNotes.filter(n => n.lead_id === leadId);
  };
  
  const getTrialLessonsForLead = (leadId: string) => {
    return trialLessons.filter((t: any) => t.lead_id === leadId);
  };
  
  const getActivityTimeline = (lead: Lead): ActivityItem[] => {
    const activities: ActivityItem[] = [];
    
    // Lead created
    if (lead.created_at) {
      activities.push({
        type: 'created',
        date: lead.created_at,
        title: 'Lead erstellt',
        description: `Quelle: ${lead.source || 'Unbekannt'}`,
        icon: 'created'
      });
    }
    
    // Booking date
    if (lead.booking_date) {
      activities.push({
        type: 'status_change',
        date: lead.booking_date,
        title: 'Beratungsgespräch',
        description: 'Termin gebucht',
        icon: 'call'
      });
    }
    
    // Trial lessons
    getTrialLessonsForLead(lead.id).forEach((lesson: any) => {
      activities.push({
        type: 'trial_lesson',
        date: lesson.scheduled_date,
        title: 'Probestunde',
        description: `${lesson.rechtsgebiet || ''} ${lesson.dozent_name ? `mit ${lesson.dozent_name}` : ''} - Status: ${lesson.status}`,
        icon: 'lesson'
      });
    });
    
    // Final call date
    if (lead.final_call_date) {
      activities.push({
        type: 'final_call',
        date: lead.final_call_date,
        title: 'Finalgespräch',
        description: 'Geplant',
        icon: 'call'
      });
    }
    
    // Contract requested
    if (lead.contract_requested_at) {
      activities.push({
        type: 'status_change',
        date: lead.contract_requested_at,
        title: 'Vertrag angefordert',
        icon: 'status'
      });
    }
    
    // Notes
    getNotesForLead(lead.id).forEach(note => {
      activities.push({
        type: 'note',
        date: note.created_at,
        title: 'Notiz',
        description: note.note,
        icon: 'message'
      });
    });
    
    // Legacy notes
    if (lead.notes) {
      activities.push({
        type: 'note',
        date: lead.created_at,
        title: 'Ursprüngliche Notiz',
        description: lead.notes,
        icon: 'message'
      });
    }
    
    // Sort by date ascending (chronological order: oldest first)
    return activities.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };
  
  const handleAddNote = async (leadId: string) => {
    if (newNoteText.trim()) {
      await addLeadNote(leadId, newNoteText.trim());
      setNewNoteText('');
    }
  };
  
  const [newLead, setNewLead] = useState({
    name: '',
    email: '',
    phone: '',
    study_goal: '',
    study_location: '',
    notes: '',
    booking_date: '',
    source: '',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    study_goal: '',
    study_location: '',
    notes: '',
    booking_date: '',
    source: '',
  });

  const getStatusColor = (status: Lead['status']) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'offer_sent': return 'bg-yellow-100 text-yellow-800';
      case 'post_offer_call': return 'bg-orange-100 text-orange-800';
      case 'trial_pending': return 'bg-purple-100 text-purple-800';
      case 'post_trial_call': return 'bg-indigo-100 text-indigo-800';
      case 'finalgespraech': return 'bg-red-100 text-red-800';
      case 'vertragsanforderung': return 'bg-green-100 text-green-800';
      case 'contract_closed': return 'bg-green-100 text-green-800';
      case 'downsell': return 'bg-teal-100 text-teal-800';
      case 'unqualified': return 'bg-gray-100 text-gray-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const statusOptions: { id: Lead['status']; label: string }[] = [
    { id: 'new', label: 'Beratungsgespräch' },
    { id: 'offer_sent', label: 'Angebot versendet' },
    { id: 'post_offer_call', label: 'Gespräch nach Angebot' },
    { id: 'trial_pending', label: 'Probestunde' },
    { id: 'post_trial_call', label: 'Finalgespräch nach Probestunde' },
    { id: 'vertragsanforderung', label: 'Vertragsanforderung' },
    { id: 'downsell', label: 'Kraatz Club Downsell' },
    { id: 'closed', label: 'Closed' },
    { id: 'contract_closed', label: 'Abgeschlossen' },
  ];

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.phone && lead.phone.includes(searchTerm)) ||
      (lead.study_location && lead.study_location.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const leadCounts: Record<string, number> = {
    all: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    offer_sent: leads.filter(l => l.status === 'offer_sent').length,
    post_offer_call: leads.filter(l => l.status === 'post_offer_call').length,
    trial_pending: leads.filter(l => l.status === 'trial_pending').length,
    post_trial_call: leads.filter(l => l.status === 'post_trial_call').length,
    finalgespraech: leads.filter(l => l.status === 'finalgespraech').length,
    vertragsanforderung: leads.filter(l => l.status === 'vertragsanforderung').length,
    contract_closed: leads.filter(l => l.status === 'contract_closed').length,
    downsell: leads.filter(l => l.status === 'downsell').length,
    unqualified: leads.filter(l => l.status === 'unqualified').length,
    closed: leads.filter(l => l.status === 'closed').length,
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.name || !newLead.email) return;
    
    setIsSubmitting(true);
    try {
      await onCreateLead({
        name: newLead.name,
        email: newLead.email,
        phone: newLead.phone || null,
        study_goal: newLead.study_goal || null,
        study_location: newLead.study_location || null,
        notes: newLead.notes || null,
        booking_date: newLead.booking_date || null,
        source: newLead.source || 'manual',
      });
      setNewLead({ name: '', email: '', phone: '', study_goal: '', study_location: '', notes: '', booking_date: '', source: '' });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error creating lead:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (lead: Lead) => {
    setEditingLead(lead);
    setEditFormData({
      name: lead.name,
      email: lead.email,
      phone: lead.phone || '',
      study_goal: lead.study_goal || '',
      study_location: lead.study_location || '',
      notes: lead.notes || '',
      booking_date: lead.booking_date ? lead.booking_date.slice(0, 16) : '',
      source: lead.source || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead || !editFormData.name || !editFormData.email) return;
    
    setIsSubmitting(true);
    try {
      await onUpdateLead(editingLead.id, {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone || null,
        study_goal: editFormData.study_goal || null,
        study_location: editFormData.study_location || null,
        notes: editFormData.notes || null,
        booking_date: editFormData.booking_date || null,
        source: editFormData.source || editingLead.source,
      });
      setShowEditModal(false);
      setEditingLead(null);
    } catch (error) {
      console.error('Error updating lead:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Leads Pipeline</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-lg transition bg-green-500 hover:bg-green-600 text-white flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          <span className="font-medium">Lead hinzufügen</span>
        </button>
      </div>

      {/* Stats Cards - Horizontal scrollable on mobile */}
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-shrink-0 px-4 py-2 rounded-lg transition flex flex-col items-center min-w-[80px] ${
              statusFilter === 'all' 
                ? 'bg-primary text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <span className="text-lg font-bold">{leadCounts.all}</span>
            <span className="text-xs whitespace-nowrap">Gesamt</span>
          </button>
          {statusOptions.map(option => (
            <button
              key={option.id}
              onClick={() => setStatusFilter(option.id)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg transition flex flex-col items-center min-w-[70px] ${
                statusFilter === option.id 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <span className="text-lg font-bold">{leadCounts[option.id]}</span>
              <span className="text-xs whitespace-nowrap">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Suche nach Name, E-Mail, Telefon oder Standort..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Lead['status'] | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">Alle Status</option>
              {statusOptions.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Leads List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Leads</h2>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-gray-200">
          {filteredLeads.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-2" />
              <p>Keine Leads gefunden</p>
            </div>
          ) : (
            filteredLeads.map((lead) => (
              <div key={lead.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{lead.name}</h3>
                    <p className="text-sm text-gray-500">{lead.email}</p>
                  </div>
                  <select
                    value={lead.status}
                    onChange={(e) => onUpdateStatus(lead.id, e.target.value as Lead['status'])}
                    className={`text-xs px-2 py-1 rounded-full border-0 ${getStatusColor(lead.status)}`}
                  >
                    {statusOptions.map(option => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="flex items-center text-primary">
                      <Phone className="h-3 w-3 mr-1" />
                      {lead.phone}
                    </a>
                  )}
                  {lead.study_goal && (
                    <p className="flex items-center">
                      <GraduationCap className="h-3 w-3 mr-1" />
                      {lead.study_goal}
                    </p>
                  )}
                  {lead.study_location && (
                    <p className="flex items-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      {lead.study_location}
                    </p>
                  )}
                  {lead.booking_date && (
                    <p className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(lead.booking_date)}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kontakt</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Studienziel</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Standort</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Termin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Keine Leads gefunden
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <React.Fragment key={lead.id}>
                    <tr 
                      className={`hover:bg-gray-50 cursor-pointer ${expandedLeadId === lead.id ? 'bg-primary/5' : ''}`}
                      onClick={() => setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <ChevronDown className={`h-4 w-4 mr-2 text-gray-400 transition ${expandedLeadId === lead.id ? 'rotate-180' : ''}`} />
                          <div>
                            <p className="font-medium text-gray-900">{lead.name}</p>
                            <p className="text-sm text-gray-500">{lead.source}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1">
                          <a href={`mailto:${lead.email}`} className="flex items-center text-sm text-primary hover:underline">
                            <Mail className="h-3 w-3 mr-1" />
                            {lead.email}
                          </a>
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="flex items-center text-sm text-primary hover:underline">
                              <Phone className="h-3 w-3 mr-1" />
                              {lead.phone}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {lead.study_goal || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {lead.study_location || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(lead.booking_date)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={lead.status}
                          onChange={(e) => onUpdateStatus(lead.id, e.target.value as Lead['status'])}
                          className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${getStatusColor(lead.status)}`}
                        >
                          {statusOptions.map(option => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => startEdit(lead)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition"
                          title="Bearbeiten"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {/* Expanded Activity Timeline */}
                    {expandedLeadId === lead.id && (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 bg-gray-50 border-t border-b">
                          <div className="max-w-4xl">
                            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-primary" />
                              Aktivitätenprotokoll
                            </h4>
                            
                            {/* Add Note Input */}
                            <div className="flex gap-2 mb-4">
                              <input
                                type="text"
                                value={newNoteText}
                                onChange={(e) => setNewNoteText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddNote(lead.id);
                                }}
                                placeholder="Neue Notiz hinzufügen..."
                                className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-lg"
                              />
                              <button
                                onClick={() => handleAddNote(lead.id)}
                                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                              >
                                Hinzufügen
                              </button>
                            </div>
                            
                            {/* Timeline */}
                            <div className="relative">
                              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                              <div className="space-y-4">
                                {getActivityTimeline(lead).map((activity, idx) => (
                                  <div key={idx} className="relative flex items-start pl-10">
                                    <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${
                                      activity.icon === 'message' ? 'bg-blue-100' :
                                      activity.icon === 'lesson' ? 'bg-green-100' :
                                      activity.icon === 'call' ? 'bg-purple-100' :
                                      activity.icon === 'status' ? 'bg-yellow-100' :
                                      'bg-gray-100'
                                    }`}>
                                      {activity.icon === 'message' && <MessageSquare className="h-3 w-3 text-blue-600" />}
                                      {activity.icon === 'lesson' && <GraduationCap className="h-3 w-3 text-green-600" />}
                                      {activity.icon === 'call' && <Phone className="h-3 w-3 text-purple-600" />}
                                      {activity.icon === 'status' && <FileText className="h-3 w-3 text-yellow-600" />}
                                      {activity.icon === 'created' && <CheckCircle className="h-3 w-3 text-gray-600" />}
                                    </div>
                                    <div className="flex-1 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-sm text-gray-900">{activity.title}</span>
                                        <span className="text-xs text-gray-500">
                                          {new Date(activity.date).toLocaleString('de-DE', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                      </div>
                                      {activity.description && (
                                        <p className="text-sm text-gray-600">{activity.description}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {getActivityTimeline(lead).length === 0 && (
                                  <p className="text-sm text-gray-500 pl-10">Keine Aktivitäten vorhanden</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Neuen Lead hinzufügen</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Max Mustermann"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="max@beispiel.de"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="+49 123 456789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Studienziel</label>
                <input
                  type="text"
                  value={newLead.study_goal}
                  onChange={(e) => setNewLead({ ...newLead, study_goal: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="z.B. Staatsexamen, Bachelor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Standort</label>
                <input
                  type="text"
                  value={newLead.study_location}
                  onChange={(e) => setNewLead({ ...newLead, study_location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="z.B. München, Berlin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quelle</label>
                <input
                  type="text"
                  value={newLead.source}
                  onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="z.B. Instagram, Empfehlung, Website"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Termin</label>
                <input
                  type="datetime-local"
                  value={newLead.booking_date}
                  onChange={(e) => setNewLead({ ...newLead, booking_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                <textarea
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  rows={3}
                  placeholder="Zusätzliche Informationen..."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newLead.name || !newLead.email}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Speichern...' : 'Lead erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {showEditModal && editingLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Lead bearbeiten</h3>
              <button
                onClick={() => { setShowEditModal(false); setEditingLead(null); }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Studienziel</label>
                <input
                  type="text"
                  value={editFormData.study_goal}
                  onChange={(e) => setEditFormData({ ...editFormData, study_goal: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Standort</label>
                <input
                  type="text"
                  value={editFormData.study_location}
                  onChange={(e) => setEditFormData({ ...editFormData, study_location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quelle</label>
                <input
                  type="text"
                  value={editFormData.source}
                  onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Termin</label>
                <input
                  type="datetime-local"
                  value={editFormData.booking_date}
                  onChange={(e) => setEditFormData({ ...editFormData, booking_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingLead(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !editFormData.name || !editFormData.email}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Speichern...' : 'Änderungen speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
