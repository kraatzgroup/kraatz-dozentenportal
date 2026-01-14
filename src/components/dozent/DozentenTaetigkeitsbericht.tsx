import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { ArrowLeft, FileText, Download, Trash2, Upload } from 'lucide-react';

interface Taetigkeitsbericht {
  id: string;
  dozent_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  month: string;
  year: number;
  created_at: string;
}

export function DozentenTaetigkeitsbericht() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isBuchhaltung } = useAuthStore();
  const [berichte, setBerichte] = useState<Taetigkeitsbericht[]>([]);
  const [loading, setLoading] = useState(true);
  const [dozentName, setDozentName] = useState('');
  
  const canEdit = isAdmin || isBuchhaltung;
  const isOwnProfile = user?.id === id;

  useEffect(() => {
    if (!id) return;
    fetchBerichte();
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

  const fetchBerichte = async () => {
    const { data, error } = await supabase
      .from('dozent_taetigkeitsberichte')
      .select('*')
      .eq('dozent_id', id)
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    
    if (!error && data) {
      setBerichte(data);
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `taetigkeitsberichte/${id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('masterclass')
      .upload(filePath, file, { contentType: file.type });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('masterclass').getPublicUrl(filePath);

    const now = new Date();
    await supabase.from('dozent_taetigkeitsberichte').insert({
      dozent_id: id,
      file_name: file.name,
      file_url: publicUrl,
      file_type: file.type,
      month: now.toLocaleString('de-DE', { month: 'long' }),
      year: now.getFullYear()
    });

    fetchBerichte();
  };

  const deleteBericht = async (bericht: Taetigkeitsbericht) => {
    if (!confirm('Tätigkeitsbericht wirklich löschen?')) return;
    await supabase.from('dozent_taetigkeitsberichte').delete().eq('id', bericht.id);
    fetchBerichte();
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
          <h1 className="text-2xl font-bold text-gray-900">Tätigkeitsberichte</h1>
          <p className="text-sm text-gray-500">{dozentName}</p>
        </div>
      </div>

      {(canEdit || isOwnProfile) && (
        <div className="mb-6">
          <label className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg cursor-pointer hover:bg-primary/90">
            <Upload className="h-5 w-5" />
            <span>Tätigkeitsbericht hochladen</span>
            <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : berichte.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Keine Tätigkeitsberichte vorhanden</p>
        </div>
      ) : (
        <div className="space-y-3">
          {berichte.map(b => (
            <div key={b.id} className="flex items-center justify-between bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium text-gray-900">{b.file_name}</p>
                  <p className="text-sm text-gray-500">{b.month} {b.year}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={b.file_url} 
                  target="_blank" 
                  download 
                  className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg"
                >
                  <Download className="h-5 w-5" />
                </a>
                {(canEdit || isOwnProfile) && (
                  <button 
                    onClick={() => deleteBericht(b)} 
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
