import React, { useState } from 'react';
import { Users, Clock, Calendar, User, Plus } from 'lucide-react';
import { Teilnehmer } from '../store/teilnehmerStore';
import { useHoursStore } from '../store/hoursStore';
import { TeilnehmerManagement } from './TeilnehmerManagement';
import { TeilnehmerDetailView } from './TeilnehmerDetailView';

interface ParticipantHoursSectionProps {
  teilnehmer: Teilnehmer[];
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onShowTeilnehmerManagement: () => void;
  onShowHoursDialog: () => void;
  getCurrentMonthHours: (teilnehmerId: string) => number;
  isAdmin?: boolean;
}

export function ParticipantHoursSection({
  teilnehmer,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  onShowTeilnehmerManagement,
  onShowHoursDialog,
  getCurrentMonthHours,
  isAdmin = false
}: ParticipantHoursSectionProps) {
  const { monthlySummary } = useHoursStore();
  const [showTeilnehmerManagement, setShowTeilnehmerManagement] = useState(false);
  const [selectedTeilnehmer, setSelectedTeilnehmer] = useState<{ id: string; name: string } | null>(null);

  const getMonthName = (month: number) => {
    return new Date(2023, month - 1).toLocaleDateString('de-DE', { month: 'long' });
  };

  const handleBackToTeilnehmer = () => {
    setShowTeilnehmerManagement(false);
    setSelectedTeilnehmer(null);
  };

  if (showTeilnehmerManagement) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="p-6">
          <TeilnehmerManagement
            onBack={handleBackToTeilnehmer}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    );
  }

  if (selectedTeilnehmer) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="p-6">
          <TeilnehmerDetailView
            teilnehmerId={selectedTeilnehmer.id}
            teilnehmerName={selectedTeilnehmer.name}
            onBack={() => setSelectedTeilnehmer(null)}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      {/* Header */}
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left: Section Name */}
          <h3 className="text-lg font-medium text-gray-900">
            Stunden pro Teilnehmer
          </h3>
          
          {/* Right: Month/Year Selection + Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 sm:ml-auto">
            {/* Month/Year Selection */}
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monat</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => onMonthChange(parseInt(e.target.value))}
                  className="text-sm rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {getMonthName(i + 1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Jahr</label>
                <select
                  value={selectedYear}
                  onChange={(e) => onYearChange(parseInt(e.target.value))}
                  className="text-sm rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={onShowHoursDialog}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
              >
                <Clock className="h-4 w-4 mr-2" />
                Stunden eintragen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-primary mr-2" />
              <span className="text-sm font-medium text-gray-700">
                {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="text-xs text-gray-500">Aktuelle Teilnehmer</div>
          </div>
        </div>

        {(() => {
          // Use monthlySummary directly - it contains all teilnehmer for which hours were logged
          const participantsWithHours = monthlySummary.filter(s => s.total_hours > 0);
          
          if (participantsWithHours.length > 0) {
            // Show participants with hours
            return (
              <div className="space-y-4">
                {participantsWithHours.map((summary) => {
                  const bookedHours = summary.booked_hours || 0;
                  const completedHours = summary.completed_hours || 0;
                  const progressPercent = bookedHours > 0 ? Math.min((completedHours / bookedHours) * 100, 100) : 0;
                  
                  return (
                    <div key={summary.teilnehmer_id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                      <button
                        onClick={() => setSelectedTeilnehmer({ id: summary.teilnehmer_id, name: summary.teilnehmer_name })}
                        className="w-full flex items-center justify-between hover:bg-gray-100 transition-colors rounded-lg p-2 -m-2"
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <h4 className="text-sm font-medium text-gray-900">{summary.teilnehmer_name}</h4>
                            </div>
                            {/* Contract dates like admin view */}
                            {summary.contract_start && summary.contract_end ? (
                              <div className="text-sm text-gray-500">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                {new Date(summary.contract_start).toLocaleDateString('de-DE')} - {new Date(summary.contract_end).toLocaleDateString('de-DE')}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">
                                {summary.days_worked} Tag(e) gearbeitet
                              </div>
                            )}
                            {/* Hours progress bar */}
                            {bookedHours > 0 && (
                              <div className="mt-1">
                                <div className="flex items-center space-x-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-1.5">
                                    <div 
                                      className={`h-1.5 rounded-full ${progressPercent >= 100 ? 'bg-green-500' : progressPercent >= 75 ? 'bg-yellow-500' : 'bg-primary'}`}
                                      style={{ width: `${progressPercent}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500">{completedHours}/{bookedHours}h</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-primary">
                            {summary.total_hours}h
                          </div>
                          <div className="text-xs text-gray-500">
                            {getMonthName(selectedMonth)}
                          </div>
                          <div className="text-xs text-green-600">
                            Stunden eingetragen
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          }
          
          // No hours for this month - show empty state
          return (
            <div className="text-center py-8 text-gray-500">
              <Clock className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p>Keine Stunden für {getMonthName(selectedMonth)} {selectedYear} eingetragen</p>
              <p className="text-xs mt-2">Klicken Sie auf "Stunden eintragen" um Stunden hinzuzufügen.</p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}