import { Users, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

interface ActiveParticipant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  booked_hours: number;
  completed_hours: number;
  remaining_hours: number;
  contract_start?: string;
  contract_end?: string;
  package?: {
    name: string;
    hours: number;
    price: number;
  };
}

interface ActiveParticipantsListProps {
  participants: ActiveParticipant[];
  onUpsellClick?: (participant: ActiveParticipant) => void;
}

export function ActiveParticipantsList({ participants, onUpsellClick }: ActiveParticipantsListProps) {
  const getProgressColor = (remaining: number, total: number) => {
    const percent = (remaining / total) * 100;
    if (percent <= 20) return 'bg-red-500';
    if (percent <= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getProgressBgColor = (remaining: number, total: number) => {
    const percent = (remaining / total) * 100;
    if (percent <= 20) return 'bg-red-100';
    if (percent <= 40) return 'bg-yellow-100';
    return 'bg-green-100';
  };

  const lowHoursParticipants = participants.filter(p => {
    if (!p.booked_hours) return false;
    const percent = (p.remaining_hours / p.booked_hours) * 100;
    return percent <= 30 && p.remaining_hours > 0;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Aktive Teilnehmer</h2>
            <span className="ml-2 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
              {participants.length}
            </span>
          </div>
          {lowHoursParticipants.length > 0 && (
            <span className="flex items-center text-sm text-yellow-600">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {lowHoursParticipants.length} mit wenig Stunden
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
        {participants.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Keine aktiven Teilnehmer
          </div>
        ) : (
          participants.map((participant) => {
            const progressPercent = participant.booked_hours 
              ? Math.round((participant.completed_hours / participant.booked_hours) * 100)
              : 0;
            const isLowHours = participant.booked_hours && 
              (participant.remaining_hours / participant.booked_hours) * 100 <= 30;

            return (
              <div 
                key={participant.id} 
                className={`p-4 hover:bg-gray-50 transition ${isLowHours ? 'bg-yellow-50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-gray-900 truncate">
                        {participant.name}
                      </h3>
                      {participant.package?.name && (
                        <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                          {participant.package.name}
                        </span>
                      )}
                      {isLowHours && (
                        <span className="flex items-center text-xs text-yellow-600">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Wenig Stunden
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {participant.completed_hours} / {participant.booked_hours || 0} Std.
                        </span>
                        <span className="text-xs">
                          {participant.remaining_hours} Std. übrig
                        </span>
                      </div>
                      <div className={`h-2 rounded-full ${getProgressBgColor(participant.remaining_hours, participant.booked_hours || 1)}`}>
                        <div
                          className={`h-full rounded-full transition-all ${getProgressColor(participant.remaining_hours, participant.booked_hours || 1)}`}
                          style={{ width: `${Math.min(progressPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex items-center text-xs text-gray-500 space-x-3">
                      {participant.contract_start && participant.contract_end && (
                        <span>
                          Vertrag: {formatDate(participant.contract_start)} - {formatDate(participant.contract_end)}
                        </span>
                      )}
                      {participant.phone && (
                        <a href={`tel:${participant.phone}`} className="text-primary hover:underline">
                          {participant.phone}
                        </a>
                      )}
                    </div>
                  </div>

                  {isLowHours && onUpsellClick && (
                    <button
                      onClick={() => onUpsellClick(participant)}
                      className="ml-3 flex items-center px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Upsell
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
