import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, User, Mail, Calendar, ArrowLeft, Search, UserPlus } from 'lucide-react';
import { useTeilnehmerStore, Teilnehmer } from '../store/teilnehmerStore';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface TeilnehmerManagementProps {
  onBack: () => void;
  isAdmin?: boolean;
}

export function TeilnehmerManagement({ onBack, isAdmin = false }: TeilnehmerManagementProps) {
  const { teilnehmer, isLoading, error, fetchTeilnehmer, createTeilnehmer, updateTeilnehmer, deleteTeilnehmer } = useTeilnehmerStore();
  const { user } = useAuthStore();
  const [showDialog, setShowDialog] = useState(false);
  const [editingTeilnehmer, setEditingTeilnehmer] = useState<Teilnehmer | null>(null);
  const [searchResults, setSearchResults] = useState<Teilnehmer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAdoptSuggestion, setShowAdoptSuggestion] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    active_since: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchTeilnehmer();
    
    // Setup real-time subscription for teilnehmer
    const { setupRealtimeSubscription, cleanupSubscription } = useTeilnehmerStore.getState();
    setupRealtimeSubscription();
    
    return () => {
      cleanupSubscription();
    };
  }, [fetchTeilnehmer]);

  // Real-time search for existing Teilnehmer
  useEffect(() => {
    const searchExistingTeilnehmer = async () => {
      if (formData.name.length >= 3 && !editingTeilnehmer) {
        setIsSearching(true);
        try {
          const { data, error } = await supabase
            .from('teilnehmer')
            .select(`
              *,
              participant_hours(dozent_id, dozent:profiles!participant_hours_dozent_id_fkey(full_name))
            `)
            .ilike('name', `%${formData.name}%`)
            .limit(5);

          if (error) throw error;

          // Show all matching results (partial matches)
          setSearchResults(data || []);
          setShowAdoptSuggestion((data || []).length > 0);
        } catch (error) {
          console.error('Error searching for existing Teilnehmer:', error);
          setSearchResults([]);
          setShowAdoptSuggestion(false);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowAdoptSuggestion(false);
      }
    };

    const debounceTimer = setTimeout(searchExistingTeilnehmer, 300);
    return () => clearTimeout(debounceTimer);
  }, [formData.name, editingTeilnehmer, user?.id]);

  const handleAdoptTeilnehmer = (existingTeilnehmer: Teilnehmer) => {
    setFormData({
      name: existingTeilnehmer.name,
      email: existingTeilnehmer.email,
      active_since: existingTeilnehmer.active_since
    });
    setShowAdoptSuggestion(false);
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for duplicates before creating
    if (!editingTeilnehmer) {
      try {
        const { data: existingTeilnehmer, error: checkError } = await supabase
          .from('teilnehmer')
          .select('id, name, email')
          .or(`name.ilike.${formData.name},email.ilike.${formData.email}`);

        if (checkError) {
          console.error('Error checking for duplicates:', checkError);
        } else if (existingTeilnehmer && existingTeilnehmer.length > 0) {
          const duplicate = existingTeilnehmer[0];
          alert(`Ein Teilnehmer mit diesem Namen oder dieser E-Mail existiert bereits:\n\nName: ${duplicate.name}\nE-Mail: ${duplicate.email}\n\nBitte verwenden Sie andere Daten oder bearbeiten Sie den vorhandenen Teilnehmer.`);
          return;
        }
      } catch (error) {
        console.error('Error checking for duplicates:', error);
      }
    }
    
    try {
      if (editingTeilnehmer) {
        await updateTeilnehmer(editingTeilnehmer.id, formData);
      } else {
        await createTeilnehmer(formData);
      }
      handleCloseDialog();
    } catch (error) {
      // Error is handled by the store
    }
  };

  const handleEdit = (teilnehmer: Teilnehmer) => {
    setEditingTeilnehmer(teilnehmer);
    setFormData({
      name: teilnehmer.name,
      email: teilnehmer.email,
      active_since: teilnehmer.active_since
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Möchten Sie ${name} wirklich aus der Teilnehmerliste entfernen?`)) {
      await deleteTeilnehmer(id);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingTeilnehmer(null);
    setSearchResults([]);
    setShowAdoptSuggestion(false);
    setFormData({
      name: '',
      email: '',
      active_since: new Date().toISOString().split('T')[0]
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-medium text-gray-900">
            Aktive Teilnehmer verwalten
          </h3>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Teilnehmer hinzufügen
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : teilnehmer.length === 0 ? (
        <div className="text-center py-8">
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Keine Teilnehmer</h3>
          <p className="mt-1 text-sm text-gray-500">
            Fügen Sie Ihren ersten aktiven Teilnehmer hinzu.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowDialog(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Teilnehmer hinzufügen
            </button>
          </div>
        </div>
      ) : (
        /* Teilnehmer List */
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {teilnehmer.map((person) => (
              <li key={person.id}>
                <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <h4 className="text-sm font-medium text-gray-900">{person.name}</h4>
                      </div>
                      <div className="flex items-center mt-1 text-sm text-gray-500">
                        <Mail className="h-4 w-4 mr-1" />
                        <span>{person.email}</span>
                      </div>
                      <div className="flex items-center mt-1 text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>Aktiv seit: {formatDate(person.active_since)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(person)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(person.id, person.name)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Entfernen
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingTeilnehmer ? 'Teilnehmer bearbeiten' : 'Neuen Teilnehmer hinzufügen'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <User className="h-4 w-4 inline mr-1" />
                        Vollständiger Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="Max Mustermann"
                        required
                      />
                      
                      {/* Search indicator */}
                      {isSearching && formData.name.length >= 3 && (
                        <div className="mt-2 flex items-center text-sm text-gray-500">
                          <Search className="h-4 w-4 mr-2 animate-spin" />
                          Suche nach vorhandenen Teilnehmern...
                        </div>
                      )}
                      
                      {/* Adopt suggestion */}
                      {showAdoptSuggestion && searchResults.length > 0 && (
                        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="flex items-start">
                            <UserPlus className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-blue-800 mb-2">
                                Teilnehmer bereits vorhanden
                              </h4>
                              <p className="text-sm text-blue-700 mb-3">
                                Ein Teilnehmer mit diesem Namen existiert bereits. Möchten Sie die Daten übernehmen?
                              </p>
                              {searchResults.map((result) => (
                                <div key={result.id} className="bg-white border border-blue-200 rounded-md p-3 mb-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{result.name}</div>
                                      <div className="text-sm text-gray-600">{result.email}</div>
                                      <div className="text-xs text-gray-500">
                                        Aktiv seit: {new Date(result.active_since).toLocaleDateString('de-DE')}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAdoptTeilnehmer(result)}
                                      className="ml-3 inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                      Daten übernehmen
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <p className="text-xs text-blue-600 mt-2">
                                💡 Tipp: Durch das Übernehmen werden die Kontaktdaten automatisch ausgefüllt.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Mail className="h-4 w-4 inline mr-1" />
                        E-Mail-Adresse
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        placeholder="max.mustermann@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        Aktiv seit
                      </label>
                      <input
                        type="date"
                        value={formData.active_since}
                        onChange={(e) => setFormData({ ...formData, active_since: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20"
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    ) : (
                      editingTeilnehmer ? 'Speichern' : 'Hinzufügen'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseDialog}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}