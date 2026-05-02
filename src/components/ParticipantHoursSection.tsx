import React, { useState, useEffect } from 'react';
import { Users, Clock, Calendar, User, Plus } from 'lucide-react';
import { Teilnehmer } from '../store/teilnehmerStore';
import { useHoursStore } from '../store/hoursStore';
import { TeilnehmerManagement } from './TeilnehmerManagement';
import { TeilnehmerDetailView } from './TeilnehmerDetailView';
import { supabase } from '../lib/supabase';

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
  studyGoal?: '1. Staatsexamen' | '2. Staatsexamen';
  dozentId?: string;
  refreshKey?: number;
  onRefresh?: () => void;
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
  isAdmin = false,
  studyGoal = '1. Staatsexamen',
  dozentId,
  refreshKey,
  onRefresh
}: ParticipantHoursSectionProps) {
  const { monthlySummary } = useHoursStore();
  const [showTeilnehmerManagement, setShowTeilnehmerManagement] = useState(false);
  const [selectedTeilnehmer, setSelectedTeilnehmer] = useState<{ id: string; name: string } | null>(null);
  const [contractData, setContractData] = useState<{ [teilnehmerId: string]: { totalHours: number; usedHours: number } }>({});
  const [teilnehmerWithHoursInMonth, setTeilnehmerWithHoursInMonth] = useState<Set<string>>(new Set());

  // Fetch contract data for all participants
  useEffect(() => {
    const fetchContractData = async () => {
      const data: { [teilnehmerId: string]: { totalHours: number; usedHours: number } } = {};

      for (const t of teilnehmer) {
        const { data: contracts, error } = await supabase
          .from('contracts')
          .select('id, start_date, end_date, status, contract_packages(hours_total, hours_used), free_hours(hours, hours_used)')
          .eq('teilnehmer_id', t.id);

        if (error) {
          console.error('Error fetching contract data:', error);
          continue;
        }

        let totalHours = 0;
        let usedHours = 0;

        if (contracts) {
          for (const c of contracts) {
            if (c.contract_packages) {
              for (const pkg of c.contract_packages) {
                totalHours += pkg.hours_total || 0;
                usedHours += pkg.hours_used || 0;
              }
            }
            if (c.free_hours) {
              for (const fh of c.free_hours) {
                totalHours += fh.hours || 0;
                usedHours += fh.hours_used || 0;
              }
            }
          }
        }

        data[t.id] = { totalHours, usedHours };
      }

      console.log('📦 Final contractData:', data);
      setContractData(data);
    };

    if (teilnehmer.length > 0) {
      fetchContractData();
    }

    // Real-time subscription for contract_packages changes
    const subscription = supabase
      .channel('contract-packages-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contract_packages'
      }, () => {
        fetchContractData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [teilnehmer, refreshKey]);

  // Fetch hours added by dozent in selected month/year
  useEffect(() => {
    if (!dozentId) return;

    const fetchTeilnehmerWithHours = async () => {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);

      const { data: hoursEntries, error } = await supabase
        .from('participant_hours')
        .select('teilnehmer_id')
        .eq('dozent_id', dozentId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (error) {
        console.error('Error fetching hours entries:', error);
        return;
      }

      const teilnehmerIds = new Set(hoursEntries?.map(h => h.teilnehmer_id) || []);
      setTeilnehmerWithHoursInMonth(teilnehmerIds);
      console.log('📋 Teilnehmer with hours in month:', teilnehmerIds);
    };

    fetchTeilnehmerWithHours();
  }, [dozentId, selectedMonth, selectedYear]);

  const getMonthName = (month: number) => {
    return new Date(2023, month - 1).toLocaleDateString('de-DE', { month: 'long' });
  };

  const handleBackToTeilnehmer = () => {
    setShowTeilnehmerManagement(false);
    setSelectedTeilnehmer(null);
    onRefresh?.();
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
            onBack={() => {
              setSelectedTeilnehmer(null);
              onRefresh?.();
            }}
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
            Stunden pro Teilnehmer ({studyGoal})
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
          // Filter active teilnehmer by study goal and dozent assignment
          const isContractActive = (t: Teilnehmer) => {
            if (!t.contract_start || !t.contract_end) return false;
            const now = new Date();
            const start = new Date(t.contract_start);
            const end = new Date(t.contract_end);
            return now >= start && now <= end;
          };

          const filteredTeilnehmer = teilnehmer.filter(t => {
            // If dozentId is provided, check if dozent added hours in current month
            let hasHoursInMonth = false;
            if (dozentId) {
              hasHoursInMonth = teilnehmerWithHoursInMonth.has(t.id);
            }
            
            // Filter by active contract, unless dozent added hours in current month
            if (!hasHoursInMonth && !isContractActive(t)) return false;
            
            // If dozentId is provided, filter by dozent assignment OR hours added in current month
            if (dozentId) {
              const isAssigned = 
                t.dozent_zivilrecht_id === dozentId ||
                t.dozent_strafrecht_id === dozentId ||
                t.dozent_oeffentliches_recht_id === dozentId;
              if (!isAssigned && !hasHoursInMonth) return false;
            }
            
            // Filter by study goal
            if (studyGoal === '2. Staatsexamen') {
              // Only show if study_goal includes "2. Staatsexamen" and NOT elite_kleingruppe
              return !t.elite_kleingruppe && t.study_goal && t.study_goal.includes('2. Staatsexamen');
            } else if (studyGoal === '1. Staatsexamen') {
              // Show if: elite_kleingruppe OR study_goal includes "1. Staatsexamen" OR no study_goal OR study_goal doesn't include "2. Staatsexamen"
              if (t.elite_kleingruppe) return true;
              if (!t.study_goal) return true;
              if (t.study_goal.includes('1. Staatsexamen')) return true;
              // Exclude only if explicitly "2. Staatsexamen"
              return !t.study_goal.includes('2. Staatsexamen');
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
                  const contractInfo = contractData[teilnehmer.id] || { totalHours: 0, usedHours: 0 };
                  const bookedHours = contractInfo.totalHours;
                  const completedHours = contractInfo.usedHours;
                  const progressPercent = bookedHours > 0 ? Math.min((completedHours / bookedHours) * 100, 100) : 0;
                  const hasMonthlyHours = teilnehmer.monthly_hours > 0;

                  return (
                    <div key={teilnehmer.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                      <button
                        onClick={() => setSelectedTeilnehmer({ id: teilnehmer.id, name: teilnehmer.name })}
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
                              <h4 className="text-sm font-medium text-gray-900">{teilnehmer.name}</h4>
                            </div>
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
                            {(() => {
                              console.log('📊 Progress bar values for', teilnehmer.name, ':', { bookedHours, completedHours, progressPercent });
                              return bookedHours > 0;
                            })() && (
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
                          {hasMonthlyHours ? (
                            <>
                              <div className="text-lg font-semibold text-primary">
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
          
          // No active participants for this study goal
          return (
            <div className="text-center py-8 text-gray-500">
              <Users className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p>Keine aktiven Teilnehmer ({studyGoal})</p>
              <p className="text-xs mt-2">Es sind derzeit keine Teilnehmer mit diesem Studienziel zugewiesen.</p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}