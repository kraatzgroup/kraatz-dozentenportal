import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { ArrowLeft, GraduationCap, Calendar, Clock, User, CheckCircle, XCircle } from 'lucide-react';

interface Probestunde {
  id: string;
  dozent_id: string;
  teilnehmer_name: string;
  teilnehmer_email: string | null;
  teilnehmer_phone: string | null;
  scheduled_date: string;
  scheduled_time: string;
  status: 'geplant' | 'durchgefuehrt' | 'abgesagt' | 'no_show';
  notes: string | null;
  created_at: string;
}

export function DozentenProbestunden() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isBuchhaltung, isVerwaltung } = useAuthStore();
  const [probestunden, setProbestunden] = useState<Probestunde[]>([]);
  const [loading, setLoading] = useState(true);
  const [dozentName, setDozentName] = useState('');
  
  const canEdit = isAdmin || isBuchhaltung || isVerwaltung;
  const isOwnProfile = user?.id === id;

  useEffect(() => {
    if (!id) return;
    fetchProbestunden();
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

  const fetchProbestunden = async () => {
    const { data, error } = await supabase
      .from('dozent_probestunden')
      .select('*')
      .eq('dozent_id', id)
      .order('scheduled_date', { ascending: false });
    
    if (!error && data) {
      setProbestunden(data);
    }
    setLoading(false);
  };

  const updateStatus = async (probestunde: Probestunde, newStatus: Probestunde['status']) => {
    await supabase
      .from('dozent_probestunden')
      .update({ status: newStatus })
      .eq('id', probestunde.id);
    fetchProbestunden();
  };

  const getStatusBadge = (status: Probestunde['status']) => {
    switch (status) {
      case 'geplant':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Geplant</span>;
      case 'durchgefuehrt':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Durchgeführt</span>;
      case 'abgesagt':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Abgesagt</span>;
      case 'no_show':
        return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">No-Show</span>;
      default:
        return null;
    }
  };

  const pendingCount = probestunden.filter(p => p.status === 'geplant').length;

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
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Probestunden</h1>
            {pendingCount > 0 && (
              <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </div>
          <p className="text-sm text-gray-500">{dozentName}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : probestunden.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Keine Probestunden vorhanden</p>
        </div>
      ) : (
        <div className="space-y-4">
          {probestunden.map(p => (
            <div key={p.id} className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{p.teilnehmer_name}</p>
                    {p.teilnehmer_email && (
                      <p className="text-sm text-gray-500">{p.teilnehmer_email}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(p.scheduled_date).toLocaleDateString('de-DE')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {p.scheduled_time}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(p.status)}
                </div>
              </div>
              
              {p.status === 'geplant' && (isOwnProfile || canEdit) && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                  <button 
                    onClick={() => updateStatus(p, 'durchgefuehrt')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Durchgeführt
                  </button>
                  <button 
                    onClick={() => updateStatus(p, 'no_show')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm hover:bg-orange-200"
                  >
                    <XCircle className="h-4 w-4" />
                    No-Show
                  </button>
                  <button 
                    onClick={() => updateStatus(p, 'abgesagt')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                  >
                    <XCircle className="h-4 w-4" />
                    Abgesagt
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
