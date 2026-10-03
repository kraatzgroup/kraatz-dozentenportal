import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Lead, useSalesStore } from '../store/salesStore';
import { SalesKanbanOverview } from './vertrieb/SalesKanbanOverview';
import { TrialLessonsList } from './vertrieb/TrialLessonsList';
import { CalBookingsList } from './vertrieb/CalBookingsList';
import { SalesCalendar } from './vertrieb/SalesCalendar';
import { FinalgespraechList } from './vertrieb/FinalgespraechList';
import { AfterSalesList } from './vertrieb/AfterSalesList';

type TabType = 'overview' | 'calendar' | 'calls' | 'trials' | 'finalgespraech' | 'aftersales';
const VALID_TABS: TabType[] = ['overview', 'calendar', 'calls', 'trials', 'finalgespraech', 'aftersales'];

export function VertriebDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'leads') return 'overview';
    if (tabParam && VALID_TABS.includes(tabParam as TabType)) return tabParam as TabType;
    const saved = localStorage.getItem('vertriebDashboardTab');
    return saved && VALID_TABS.includes(saved as TabType) ? saved as TabType : 'overview';
  });

  
  // Helper function to change tab and update URL
  const setActiveTab = useCallback((tab: TabType) => {
    setActiveTabState(tab);
    localStorage.setItem('vertriebDashboardTab', tab);
    setSearchParams({ tab });
  }, [setSearchParams]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && !VALID_TABS.includes(tabParam as TabType)) {
      localStorage.setItem('vertriebDashboardTab', activeTab);
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

  const {
    trialLessons,
    calBookings,
    leads,
    isLoading,
    fetchPackages,
    fetchFollowUps,
    fetchTrialLessons,
    fetchUpsells,
    fetchCalBookings,
    refreshCalBookings,
    fetchLeads,
    fetchSales,
    fetchActiveTeilnehmer,
    createTrialLesson,
    createLead,
    updateTrialLesson,
    updateLead,
    deleteTrialLesson,
    subscribeToChanges,
  } = useSalesStore();

  useEffect(() => {
    loadAllData();
    
    // Subscribe to real-time changes for synchronization
    const unsubscribe = subscribeToChanges();
    
    return () => {
      unsubscribe();
    };
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      fetchPackages(),
      fetchFollowUps(),
      fetchTrialLessons(),
      fetchSales(),
      fetchUpsells(),
      fetchCalBookings(),
      fetchLeads(),
      fetchActiveTeilnehmer(),
    ]);
  };

  const upcomingTrials = trialLessons.filter(t => t.status === 'scheduled').length;

  const tabs = [
    { id: 'overview' as TabType, label: 'Übersicht' },
    { id: 'calendar' as TabType, label: 'Kalender' },
    { id: 'calls' as TabType, label: 'Calls', badge: calBookings.filter(b => new Date(b.end_time) >= new Date()).length },
    { id: 'trials' as TabType, label: 'Probestunden', badge: upcomingTrials },
    { id: 'finalgespraech' as TabType, label: 'Finalgespräch', badge: leads.filter(l => l.status === 'finalgespraech' || l.status === 'post_trial_call').length },
    { id: 'aftersales' as TabType, label: 'After Sales', badge: leads.filter(l => l.status === 'contract_closed').length },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="w-full px-10">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-2 bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full py-6 px-10">
        {activeTab === 'overview' && (
          <SalesKanbanOverview
            calBookings={calBookings}
            leads={leads}
            onCreateLead={createLead}
            onUpdateLead={updateLead}
            trialLessons={trialLessons}
            onCreateTrialLesson={createTrialLesson}
          />
        )}

        {activeTab === 'calendar' && (
          <SalesCalendar />
        )}

        {activeTab === 'calls' && (
          <CalBookingsList
            bookings={calBookings}
            onRefresh={refreshCalBookings}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'trials' && (
          <TrialLessonsList
            trialLessons={trialLessons}
            onUpdate={updateTrialLesson}
            onCreate={createTrialLesson}
            onDelete={deleteTrialLesson}
          />
        )}

        {activeTab === 'finalgespraech' && (
          <FinalgespraechList
            leads={leads}
            onUpdateStatus={(id, status, contractRequestedAt) => updateLead(id, { 
              status: status as Lead['status'],
              ...(contractRequestedAt && { contract_requested_at: contractRequestedAt })
            })}
            onUpdateLead={(id, data) => updateLead(id, data as Partial<Lead>)}
            onRefresh={fetchLeads}
          />
        )}

        {activeTab === 'aftersales' && (
          <AfterSalesList
            leads={leads}
            onUpdateLead={(id, data) => updateLead(id, data as Partial<Lead>)}
          />
        )}

      </main>
    </div>
  );
}
