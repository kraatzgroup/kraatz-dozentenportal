import { useState, useEffect } from 'react';
import { RefreshCw, Check, X, Clock, Settings, Link2, Link2Off, LogOut, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { Logo } from './Logo';

interface IntegrationSetting {
  id: string;
  name: string;
  enabled: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  sync_count: number;
}

export function IntegrationsTab() {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const [integrations, setIntegrations] = useState<IntegrationSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .order('name');

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleIntegration = async (id: string, currentEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from('integration_settings')
        .update({ 
          enabled: !currentEnabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      setIntegrations(prev => 
        prev.map(i => i.id === id ? { ...i, enabled: !currentEnabled } : i)
      );
    } catch (error) {
      console.error('Error toggling integration:', error);
    }
  };

  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('de-DE');
    setSyncLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const syncIntegration = async (id: string) => {
    setSyncingId(id);
    setSyncLogs([]);
    
    const integrationName = id === 'monday' ? 'Monday.com' : 'Cal.com';
    addLog(`Starte Synchronisierung für ${integrationName}...`);
    
    try {
      let endpoint = '';
      if (id === 'monday') {
        endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-monday`;
      } else if (id === 'cal') {
        endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-cal-bookings`;
      }

      addLog(`Sende Anfrage an ${endpoint}...`);

      // Pass manual=true to bypass the enabled check for manual syncs
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ manual: true }),
      });

      addLog(`Antwort erhalten: Status ${response.status}`);

      const result = await response.json();
      
      const syncStatus = response.ok ? 'success' : 'error';
      const syncMessage = response.ok 
        ? `Synchronisiert: ${JSON.stringify(result)}` 
        : result.error || 'Fehler bei der Synchronisierung';

      if (response.ok) {
        addLog(`✓ Erfolgreich synchronisiert`);
        if (result.synced !== undefined) addLog(`  - ${result.synced} Einträge synchronisiert`);
        if (result.leads !== undefined) addLog(`  - ${result.leads} Leads aktualisiert`);
        if (result.followUps !== undefined) addLog(`  - ${result.followUps} Follow-Ups`);
        if (result.probestunden !== undefined) addLog(`  - ${result.probestunden} Probestunden`);
        if (result.upsells !== undefined) addLog(`  - ${result.upsells} Upsells`);
        if (result.closed !== undefined) addLog(`  - ${result.closed} Abschlüsse`);
      } else {
        addLog(`✗ Fehler: ${syncMessage}`);
      }

      // Update sync status in database
      await supabase
        .from('integration_settings')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: syncStatus,
          last_sync_message: syncMessage,
          sync_count: integrations.find(i => i.id === id)?.sync_count || 0 + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      // Refresh integrations
      await fetchIntegrations();
    } catch (error: any) {
      console.error('Error syncing integration:', error);
      
      await supabase
        .from('integration_settings')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'error',
          last_sync_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      await fetchIntegrations();
    } finally {
      setSyncingId(null);
    }
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Noch nie synchronisiert';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `Vor ${diffMins} Minute${diffMins > 1 ? 'n' : ''}`;
    if (diffHours < 24) return `Vor ${diffHours} Stunde${diffHours > 1 ? 'n' : ''}`;
    if (diffDays < 7) return `Vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
    
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getIntegrationIcon = (id: string) => {
    if (id === 'monday') {
      return (
        <img 
          src="https://cdn.worldvectorlogo.com/logos/monday-1.svg" 
          alt="Monday.com" 
          className="w-10 h-10 rounded-lg"
        />
      );
    }
    if (id === 'cal') {
      return (
        <img 
          src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/cal-com.svg" 
          alt="Cal.com" 
          className="w-10 h-10 rounded-lg object-contain"
        />
      );
    }
    return (
      <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
        <Settings className="h-5 w-5 text-gray-600" />
      </div>
    );
  };

  const getIntegrationDescription = (id: string) => {
    if (id === 'monday') {
      return 'Synchronisiert Follow-Ups, Probestunden, Upsells und Sales aus Monday.com';
    }
    if (id === 'cal') {
      return 'Synchronisiert Buchungen und Leads aus Cal.com';
    }
    return '';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Navigation Bar */}
        <nav className="bg-white shadow-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <button
                  onClick={() => navigate('/admin?tab=uebersicht')}
                  className="mr-3 p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Logo />
                <span className="ml-2 text-lg sm:text-xl font-semibold text-gray-900">
                  Integrationen
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => signOut()}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-500 hover:text-red-700 transition"
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  <span className="hidden sm:inline">Abmelden</span>
                </button>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/admin?tab=uebersicht')}
                className="mr-3 p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Logo />
              <span className="ml-2 text-lg sm:text-xl font-semibold text-gray-900">
                Integrationen
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => signOut()}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-500 hover:text-red-700 transition"
              >
                <LogOut className="h-5 w-5 mr-2" />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Link2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Integrationen</h2>
                <p className="text-sm text-gray-500">
                  Verwalten Sie die Verbindungen zu externen Diensten
                </p>
              </div>
            </div>
          </div>

          {/* Integration Cards */}
          <div className="grid gap-4">
        {integrations.map((integration) => (
          <div 
            key={integration.id}
            className="bg-white rounded-lg shadow overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  {getIntegrationIcon(integration.id)}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {integration.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {getIntegrationDescription(integration.id)}
                    </p>
                  </div>
                </div>
                
                {/* Toggle Switch */}
                <button
                  onClick={() => toggleIntegration(integration.id, integration.enabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    integration.enabled ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      integration.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Status Section */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-4 text-sm">
                    {/* Status Badge */}
                    <div className="flex items-center space-x-2">
                      {integration.enabled ? (
                        <span className="flex items-center text-green-600">
                          <Link2 className="h-4 w-4 mr-1" />
                          Aktiv
                        </span>
                      ) : (
                        <span className="flex items-center text-gray-500">
                          <Link2Off className="h-4 w-4 mr-1" />
                          Inaktiv
                        </span>
                      )}
                    </div>
                    
                    {/* Last Sync */}
                    <div className="flex items-center text-gray-500">
                      <Clock className="h-4 w-4 mr-1" />
                      {formatLastSync(integration.last_sync_at)}
                    </div>

                    {/* Sync Status */}
                    {integration.last_sync_status && (
                      <div className="flex items-center">
                        {integration.last_sync_status === 'success' ? (
                          <span className="flex items-center text-green-600">
                            <Check className="h-4 w-4 mr-1" />
                            Erfolgreich
                          </span>
                        ) : (
                          <span className="flex items-center text-red-600">
                            <X className="h-4 w-4 mr-1" />
                            Fehler
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sync Button */}
                  <button
                    onClick={() => syncIntegration(integration.id)}
                    disabled={syncingId === integration.id}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncingId === integration.id ? 'animate-spin' : ''}`} />
                    {syncingId === integration.id ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
                  </button>
                </div>

                {/* Live Sync Logs */}
                {syncingId === integration.id && syncLogs.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-gray-900 text-green-400 font-mono text-xs max-h-40 overflow-y-auto">
                    {syncLogs.map((log, index) => (
                      <div key={index} className="py-0.5">{log}</div>
                    ))}
                  </div>
                )}

                {/* Last Sync Message */}
                {integration.last_sync_message && (
                  <div className={`mt-3 p-3 rounded-lg text-sm ${
                    integration.last_sync_status === 'success' 
                      ? 'bg-green-50 text-green-800' 
                      : 'bg-red-50 text-red-800'
                  }`}>
                    <p className="font-medium mb-1">
                      {integration.last_sync_status === 'success' ? 'Letzte Synchronisierung:' : 'Fehlermeldung:'}
                    </p>
                    <p className="text-xs break-all">{integration.last_sync_message}</p>
                  </div>
                )}

                {/* Sync Count */}
                {integration.sync_count > 0 && (
                  <p className="mt-2 text-xs text-gray-400">
                    Insgesamt {integration.sync_count} Synchronisierung{integration.sync_count > 1 ? 'en' : ''} durchgefuehrt
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        </div>

        {/* Additional Info */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <h4 className="font-medium text-gray-900 mb-2">Automatische Synchronisierung</h4>
          <p>
            Wenn eine Integration aktiviert ist, werden Daten automatisch beim Laden des Dashboards 
            und regelmäßig im Hintergrund synchronisiert. Manuelle Einträge (ohne externe ID) 
            werden dabei niemals überschrieben oder gelöscht.
          </p>
        </div>
      </div>
      </main>
    </div>
  );
}
