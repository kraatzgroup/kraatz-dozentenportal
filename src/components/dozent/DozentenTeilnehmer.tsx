import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { ArrowLeft, Users, Mail, Phone, Calendar } from 'lucide-react';

interface Teilnehmer {
  id: string;
  dozent_id: string;
  name: string;
  email: string;
  phone: string | null;
  start_date: string;
  status: 'aktiv' | 'pausiert' | 'beendet';
  notes: string | null;
  created_at: string;
}

export function DozentenTeilnehmer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isBuchhaltung, isVerwaltung } = useAuthStore();
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dozentName, setDozentName] = useState('');
  
  const canEdit = isAdmin || isBuchhaltung || isVerwaltung;
  const isOwnProfile = user?.id === id;

  useEffect(() => {
    if (!id) return;
    fetchTeilnehmer();
    fetchDozentName();
  }, [id]);

  const fetchDozentName = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', id)
      .single();
    if (data) setDozentName(data.full_name || 'Dozent');
  };

  const fetchTeilnehmer = async () => {
    const { data, error } = await supabase
      .from('dozent_teilnehmer')
      .select('*')
      .eq('dozent_id', id)
      .eq('status', 'aktiv')
      .order('name');
    
    if (!error && data) {
      setTeilnehmer(data);
    }
    setLoading(false);
  };

  if (!isOwnProfile && !canEdit) {
    return (
      <div className="p-6 text-center text-gray-500">
        Sie haben keine Berechtigung, diese Seite zu sehen.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aktive Teilnehmer</h1>
          <p className="text-sm text-gray-500">{dozentName}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : teilnehmer.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Keine aktiven Teilnehmer</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teilnehmer.map(t => (
            <div key={t.id} className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-semibold">{t.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <div className="mt-2 space-y-1">
                    {t.email && (
                      <a href={`mailto:${t.email}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{t.email}</span>
                      </a>
                    )}
                    {t.phone && (
                      <a href={`tel:${t.phone}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary">
                        <Phone className="h-4 w-4" />
                        <span>{t.phone}</span>
                      </a>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar className="h-4 w-4" />
                      <span>Seit {new Date(t.start_date).toLocaleDateString('de-DE')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
