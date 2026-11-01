import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Lead, useSalesStore } from '../store/salesStore';
import { useOfferTemplateStore } from '../store/offerTemplateStore';
import { SalesKanbanOverview } from './vertrieb/SalesKanbanOverview';
import { SalesCalendar } from './vertrieb/SalesCalendar';
import { FinalgespraechList } from './vertrieb/FinalgespraechList';
import { AfterSalesList } from './vertrieb/AfterSalesList';

type TabType = 'overview' | 'calendar' | 'finalgespraech' | 'aftersales';
const VALID_TABS: TabType[] = ['overview', 'calendar', 'finalgespraech', 'aftersales'];

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
    fetchPackages,
    fetchFollowUps,
    fetchTrialLessons,
    fetchUpsells,
    fetchCalBookings,
    fetchLeads,
    fetchSales,
    fetchActiveTeilnehmer,
    createTrialLesson,
    createLead,
    updateLead,
    subscribeToChanges,
  } = useSalesStore();

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const fetchOfferTemplates = useOfferTemplateStore(s => s.fetchTemplates);

  useEffect(() => {
    // Angebots-Vorlagen vorab laden, damit das Angebots-Modal sofort gefüllt öffnet
    void fetchOfferTemplates('angebot');
    void fetchOfferTemplates('kraatzclub');
    loadAllData().finally(() => setIsInitialLoading(false));
    
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

  const tabs = [
    { id: 'overview' as TabType, label: 'Übersicht' },
    { id: 'calendar' as TabType, label: 'Kalender' },
    { id: 'finalgespraech' as TabType, label: 'Finalgespräch', badge: leads.filter(l => l.status === 'finalgespraech' || l.status === 'post_trial_call').length },
    { id: 'aftersales' as TabType, label: 'After Sales', badge: leads.filter(l => l.status === 'contract_closed').length },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="w-full px-4 sm:px-6 lg:px-10">
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
      <main className="w-full py-4 sm:py-6 px-4 sm:px-6 lg:px-10">
        {isInitialLoading && activeTab !== 'calendar' ? (
          <DashboardSkeleton />
        ) : (
        <>
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
        </>
        )}
      </main>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Vertriebsdaten werden geladen">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <div className="h-6 w-32 rounded bg-gray-200" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-gray-100" />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {[0, 1].map(i => (
            <div key={i} className="space-y-2 rounded-lg border border-gray-100 p-4">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="h-14 rounded-lg bg-gray-100" />
              <div className="h-14 rounded-lg bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="min-h-[330px] space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-3 h-4 w-24 rounded bg-gray-200" />
            <div className="h-16 rounded-md bg-white" />
            <div className="h-16 rounded-md bg-white" />
          </div>
        ))}
      </div>
    </div>
  );
}
