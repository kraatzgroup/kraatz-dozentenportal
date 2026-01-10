import { useState } from 'react';
import { Calendar, Clock, User, Mail, Phone, RefreshCw, ExternalLink, History } from 'lucide-react';
import { CalBooking } from '../../store/salesStore';

interface CalBookingsListProps {
  bookings: CalBooking[];
  onRefresh: () => Promise<void>;
  isLoading: boolean;
}

export function CalBookingsList({ bookings, onRefresh, isLoading }: CalBookingsListProps) {
  const [activeSection, setActiveSection] = useState<'upcoming' | 'past'>('upcoming');

  const handleRefresh = async () => {
    await onRefresh();
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'accepted': return 'Bestätigt';
      case 'pending': return 'Ausstehend';
      case 'cancelled': return 'Abgesagt';
      default: return status || 'Unbekannt';
    }
  };

  // Split bookings into upcoming and past based on end_time
  const now = new Date();
  const upcomingBookings = bookings.filter(b => new Date(b.end_time) >= now);
  const pastBookings = bookings.filter(b => new Date(b.end_time) < now).reverse(); // Most recent first

  const displayedBookings = activeSection === 'upcoming' ? upcomingBookings : pastBookings;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Beratungsgespräche</h2>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
        </div>

        {/* Section Toggle */}
        <div className="mt-4 flex space-x-2">
          <button
            onClick={() => setActiveSection('upcoming')}
            className={`flex items-center px-4 py-2 text-sm rounded-lg transition ${
              activeSection === 'upcoming'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Termine
            {upcomingBookings.length > 0 && (
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                activeSection === 'upcoming' ? 'bg-white/20' : 'bg-primary text-white'
              }`}>
                {upcomingBookings.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSection('past')}
            className={`flex items-center px-4 py-2 text-sm rounded-lg transition ${
              activeSection === 'past'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <History className="h-4 w-4 mr-2" />
            Vergangene Termine
            {pastBookings.length > 0 && (
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                activeSection === 'past' ? 'bg-white/20' : 'bg-gray-500 text-white'
              }`}>
                {pastBookings.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
        {displayedBookings.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <p>{activeSection === 'upcoming' ? 'Keine anstehenden Termine' : 'Keine vergangenen Termine'}</p>
            {activeSection === 'upcoming' && (
              <p className="text-xs mt-1">Klicken Sie auf "Aktualisieren" um Termine zu laden</p>
            )}
          </div>
        ) : (
          displayedBookings.map((booking) => (
            <div key={booking.id} className="p-4 hover:bg-gray-50 transition">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-gray-900 truncate">
                      {booking.title || 'Beratungsgespräch'}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(booking.status)}`}>
                      {getStatusLabel(booking.status)}
                    </span>
                  </div>
                  
                  <div className="mt-1 flex items-center text-sm text-gray-500 space-x-3">
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDateTime(booking.start_time)}
                    </span>
                  </div>

                  {booking.attendee_name && (
                    <div className="mt-2 flex items-center text-sm text-gray-600 space-x-3">
                      <span className="flex items-center">
                        <User className="h-3 w-3 mr-1" />
                        {booking.attendee_name}
                      </span>
                      {booking.attendee_email && (
                        <a href={`mailto:${booking.attendee_email}`} className="flex items-center text-primary hover:underline">
                          <Mail className="h-3 w-3 mr-1" />
                          {booking.attendee_email}
                        </a>
                      )}
                      {booking.attendee_phone && (
                        <a href={`tel:${booking.attendee_phone}`} className="flex items-center text-primary hover:underline">
                          <Phone className="h-3 w-3 mr-1" />
                          {booking.attendee_phone}
                        </a>
                      )}
                    </div>
                  )}

                  {booking.location && (
                    <p className="mt-1 text-xs text-gray-500">{booking.location}</p>
                  )}
                </div>

                {booking.meeting_url && (
                  <a
                    href={booking.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-3 flex items-center px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Meeting
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
