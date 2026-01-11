import { useEffect, useState, useMemo } from 'react';
import { Settings, Calendar, ChevronDown } from 'lucide-react';
import { useSalesStore } from '../store/salesStore';
import { Logo } from './Logo';
import { SalesKPICards } from './vertrieb/SalesKPICards';
import { TrialLessonsList } from './vertrieb/TrialLessonsList';
import { CalBookingsList } from './vertrieb/CalBookingsList';
import { LeadsList } from './vertrieb/LeadsList';
import { SalesCalendar } from './vertrieb/SalesCalendar';
import { FinalgespraechList } from './vertrieb/FinalgespraechList';

type TabType = 'overview' | 'calendar' | 'calls' | 'leads' | 'trials' | 'finalgespraech';

export function VertriebDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = localStorage.getItem('vertriebDashboardTab');
    return (saved as TabType) || 'overview';
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<'maximum' | 'today' | 'week' | 'month' | 'lastWeek' | 'lastMonth' | 'year' | 'lastYear'>('maximum');
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const {
    followUps,
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
    getKPISummary,
  } = useSalesStore();

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsRefreshing(true);
    try {
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
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    localStorage.setItem('vertriebDashboardTab', tab);
  };

  // Date range calculations
  const dateRangeOptions = [
    { id: 'maximum' as const, label: 'Maximum' },
    { id: 'today' as const, label: 'Heute' },
    { id: 'week' as const, label: 'Diese Woche' },
    { id: 'month' as const, label: 'Dieser Monat' },
    { id: 'lastWeek' as const, label: 'Letzte Woche' },
    { id: 'lastMonth' as const, label: 'Letzter Monat' },
    { id: 'year' as const, label: 'Dieses Jahr' },
    { id: 'lastYear' as const, label: 'Letztes Jahr' },
  ];

  const getDateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateRange) {
      case 'maximum':
        return { start: new Date(2020, 0, 1), end: now };
      case 'today':
        return { start: today, end: now };
      case 'week': {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        return { start: monday, end: now };
      }
      case 'month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: monthStart, end: now };
      }
      case 'lastWeek': {
        const dayOfWeek = today.getDay();
        const thisMonday = new Date(today);
        thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const lastMonday = new Date(thisMonday);
        lastMonday.setDate(thisMonday.getDate() - 7);
        const lastSunday = new Date(thisMonday);
        lastSunday.setDate(thisMonday.getDate() - 1);
        lastSunday.setHours(23, 59, 59, 999);
        return { start: lastMonday, end: lastSunday };
      }
      case 'lastMonth': {
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { start: lastMonthStart, end: lastMonthEnd };
      }
      case 'year': {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return { start: yearStart, end: now };
      }
      case 'lastYear': {
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        return { start: lastYearStart, end: lastYearEnd };
      }
      default:
        return { start: today, end: now };
    }
  }, [dateRange]);

  const kpiSummary = getKPISummary();
  const pendingFollowUps = followUps.filter(f => f.status === 'pending').length;
  const upcomingTrials = trialLessons.filter(t => t.status === 'scheduled').length;

  const selectedDateLabel = dateRangeOptions.find(o => o.id === dateRange)?.label || 'Heute';

  const tabs = [
    { id: 'overview' as TabType, label: 'Übersicht' },
    { id: 'leads' as TabType, label: 'Leads', badge: leads.filter(l => l.status === 'new').length },
    { id: 'calendar' as TabType, label: 'Kalender' },
    { id: 'calls' as TabType, label: 'Calls', badge: calBookings.filter(b => new Date(b.end_time) >= new Date()).length },
    { id: 'trials' as TabType, label: 'Probestunden', badge: upcomingTrials },
    { id: 'finalgespraech' as TabType, label: 'Finalgespräch', badge: leads.filter(l => l.status === 'finalgespraech').length },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#05161f' }}>
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Logo />
              <span className="ml-2 text-lg sm:text-xl font-semibold text-gray-900">
                Vertrieb Dashboard
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  window.location.href = '/integrationen';
                }}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                title="Integrationen verwalten"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
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
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Date Range Selector */}
            <div className="flex justify-end">
              <div className="relative">
                <button
                  onClick={() => setShowDateDropdown(!showDateDropdown)}
                  className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition"
                >
                  <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{selectedDateLabel}</span>
                  <ChevronDown className="h-4 w-4 ml-2 text-gray-500" />
                </button>
                
                {showDateDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    {dateRangeOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setDateRange(option.id);
                          setShowDateDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg ${
                          dateRange === option.id ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* KPI Cards */}
            <SalesKPICards
              totalCalls={kpiSummary.totalCalls}
              closedTotal={kpiSummary.closedTotal}
              closeRate={kpiSummary.closeRate}
              totalRevenue={kpiSummary.totalRevenue}
              avgDealSize={kpiSummary.avgDealSize}
              pendingFollowUps={pendingFollowUps}
              upcomingTrials={upcomingTrials}
            />

          </div>
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

        {activeTab === 'leads' && (
          <LeadsList
            leads={leads}
            onUpdateStatus={(id, status) => updateLead(id, { status })}
            onCreateLead={createLead}
            onUpdateLead={updateLead}
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
              status: status as any,
              ...(contractRequestedAt && { contract_requested_at: contractRequestedAt })
            })}
            onUpdateLead={(id, data) => updateLead(id, data as any)}
          />
        )}

      </main>
    </div>
  );
}
