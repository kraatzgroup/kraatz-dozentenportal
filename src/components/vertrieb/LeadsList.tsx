import { useState } from 'react';
import { Users, Mail, Phone, MapPin, GraduationCap, Calendar, Search, Filter } from 'lucide-react';
import { Lead } from '../../store/salesStore';

interface LeadsListProps {
  leads: Lead[];
  onUpdateStatus: (id: string, status: Lead['status']) => Promise<void>;
}

export function LeadsList({ leads, onUpdateStatus }: LeadsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Lead['status'] | 'all'>('all');

  const getStatusColor = (status: Lead['status']) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-purple-100 text-purple-800';
      case 'converted': return 'bg-green-100 text-green-800';
      case 'lost': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: Lead['status']) => {
    switch (status) {
      case 'new': return 'Neu';
      case 'contacted': return 'Kontaktiert';
      case 'qualified': return 'Qualifiziert';
      case 'converted': return 'Konvertiert';
      case 'lost': return 'Verloren';
      default: return status;
    }
  };

  const statusOptions: { id: Lead['status']; label: string }[] = [
    { id: 'new', label: 'Neu' },
    { id: 'contacted', label: 'Kontaktiert' },
    { id: 'qualified', label: 'Qualifiziert' },
    { id: 'converted', label: 'Konvertiert' },
    { id: 'lost', label: 'Verloren' },
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

  const leadCounts = {
    all: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    converted: leads.filter(l => l.status === 'converted').length,
    lost: leads.filter(l => l.status === 'lost').length,
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-3 rounded-lg text-left transition ${
            statusFilter === 'all' ? 'bg-primary text-white' : 'bg-white shadow hover:shadow-md'
          }`}
        >
          <p className="text-xs opacity-75">Gesamt</p>
          <p className="text-xl font-bold">{leadCounts.all}</p>
        </button>
        {statusOptions.map(option => (
          <button
            key={option.id}
            onClick={() => setStatusFilter(option.id)}
            className={`p-3 rounded-lg text-left transition ${
              statusFilter === option.id ? 'bg-primary text-white' : 'bg-white shadow hover:shadow-md'
            }`}
          >
            <p className="text-xs opacity-75">{option.label}</p>
            <p className="text-xl font-bold">{leadCounts[option.id]}</p>
          </button>
        ))}
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
            <span className="ml-2 bg-primary text-white text-xs px-2 py-0.5 rounded-full">
              {filteredLeads.length}
            </span>
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
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{lead.name}</p>
                        <p className="text-sm text-gray-500">{lead.source}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
