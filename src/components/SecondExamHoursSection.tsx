import React, { useState } from 'react';
import { Users, Clock, Calendar, GraduationCap } from 'lucide-react';
import { Teilnehmer } from '../store/teilnehmerStore';
import { useHoursStore } from '../store/hoursStore';
import { TeilnehmerManagement } from './TeilnehmerManagement';
import { TeilnehmerDetailView } from './TeilnehmerDetailView';

interface SecondExamHoursSectionProps {
  teilnehmer: Teilnehmer[];
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onShowTeilnehmerManagement: () => void;
  onShowHoursDialog: () => void;
  getCurrentMonthHours: (teilnehmerId: string) => number;
  isAdmin?: boolean;
  dozentId?: string;
}

export function SecondExamHoursSection({
  teilnehmer,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  onShowTeilnehmerManagement,
  onShowHoursDialog,
  getCurrentMonthHours,
  isAdmin = false,
  dozentId
}: SecondExamHoursSectionProps) {
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
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <GraduationCap className="h-5 w-5 mr-2 text-amber-600" />
            Stunden pro Teilnehmer (2. Staatsexamen)
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
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700"
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
              <Calendar className="h-5 w-5 text-amber-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="text-xs text-gray-500">2. Staatsexamen Teilnehmer</div>
          </div>
        </div>

        {(() => {
          // Filter active teilnehmer by study goal and dozent assignment
          const isContractActive = (t: Teilnehmer) => {
            if (!t.contract_start || !t.contract_end) return false;
            const now = new Date();
            const start = new Date(t.contract_start);
            const end = new Date(t.contract_end);
            return now >= start && now <= end;
          };

          const filteredTeilnehmer = teilnehmer.filter(t => {
            // Filter by study goal (2. Staatsexamen)
            if (t.study_goal !== '2. Staatsexamen') return false;
            
            // Filter by active contract
            if (!isContractActive(t)) return false;
            
            // If dozentId is provided, filter by dozent assignment
            if (dozentId) {
              const isAssigned = 
                t.dozent_zivilrecht_id === dozentId ||
                t.dozent_strafrecht_id === dozentId ||
                t.dozent_oeffentliches_recht_id === dozentId;
              if (!isAssigned) return false;
            }
            
            return true;
          });

          // Get hours from monthlySummary for each teilnehmer
          const teilnehmerWithHours = filteredTeilnehmer.map(t => {
            const summary = monthlySummary.find(s => s.teilnehmer_id === t.id);
            return {
              ...t,
              monthly_hours: summary?.total_hours || 0,
              days_worked: summary?.days_worked || 0
            };
          });
          
          if (teilnehmerWithHours.length > 0) {
            // Show all active participants
            return (
              <div className="space-y-4">
                {teilnehmerWithHours.map((teilnehmer) => {
                  const bookedHours = teilnehmer.booked_hours || 0;
                  const completedHours = teilnehmer.completed_hours || 0;
                  const progressPercent = bookedHours > 0 ? Math.min((completedHours / bookedHours) * 100, 100) : 0;
                  const hasMonthlyHours = teilnehmer.monthly_hours > 0;
                  const referendariatsstandort = (teilnehmer as any)?.referendariatsstandort;
                  
                  return (
                    <div key={teilnehmer.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                      <button
                        onClick={() => setSelectedTeilnehmer({ id: teilnehmer.id, name: teilnehmer.name })}
                        className="w-full flex items-center justify-between hover:bg-amber-50 transition-colors rounded-lg p-2 -m-2 border border-transparent hover:border-amber-200"
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                              <GraduationCap className="h-5 w-5 text-amber-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <h4 className="text-sm font-medium text-gray-900">{teilnehmer.name}</h4>
                            </div>
                            {/* Referendariatsstandort */}
                            {referendariatsstandort && (
                              <div className="text-xs text-amber-700 font-medium">
                                📍 {referendariatsstandort}
                              </div>
                            )}
                            {/* Contract dates */}
                            {teilnehmer.contract_start && teilnehmer.contract_end ? (
                              <div className="text-sm text-gray-500">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                {new Date(teilnehmer.contract_start).toLocaleDateString('de-DE')} - {new Date(teilnehmer.contract_end).toLocaleDateString('de-DE')}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">
                                {teilnehmer.days_worked} Tag(e) gearbeitet
                              </div>
                            )}
                            {/* Hours progress bar */}
                            {bookedHours > 0 && (
                              <div className="mt-1">
                                <div className="flex items-center space-x-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-1.5">
                                    <div 
                                      className={`h-1.5 rounded-full ${progressPercent >= 100 ? 'bg-green-500' : progressPercent >= 75 ? 'bg-yellow-500' : 'bg-amber-600'}`}
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
                          {hasMonthlyHours ? (
                            <>
                              <div className="text-lg font-semibold text-amber-600">
                                {teilnehmer.monthly_hours}h
                              </div>
                              <div className="text-xs text-gray-500">
                                {getMonthName(selectedMonth)}
                              </div>
                              <div className="text-xs text-green-600">
                                Stunden eingetragen
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-lg font-semibold text-gray-400">
                                0h
                              </div>
                              <div className="text-xs text-gray-500">
                                {getMonthName(selectedMonth)}
                              </div>
                              <div className="text-xs text-gray-400">
                                Keine Stunden
                              </div>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          }
          
          // No active participants for 2. Staatsexamen
          return (
            <div className="text-center py-8 text-gray-500">
              <GraduationCap className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p>Keine aktiven Teilnehmer (2. Staatsexamen)</p>
              <p className="text-xs mt-2">Es sind derzeit keine Teilnehmer mit diesem Studienziel zugewiesen.</p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
