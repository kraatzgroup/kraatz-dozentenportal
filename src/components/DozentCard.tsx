import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FolderIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProfilePicture } from './ProfilePicture';

interface DozentCardProps {
  dozent: {
    id: string;
    full_name: string;
    role: string;
    profile_picture_url?: string | null;
  };
  userRole?: string | null;
}

interface FileCount {
  type: string;
  count: number;
}

export function DozentCard({ dozent, userRole }: DozentCardProps) {
  const navigate = useNavigate();
  const [fileCounts, setFileCounts] = useState<FileCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFileCounts();
  }, [dozent.id]);

  const fetchFileCounts = async () => {
    try {
      console.log('Fetching file counts for dozent:', dozent.id);
      // Check if we have a valid session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Session error:', sessionError);
        setIsLoading(false);
        return;
      }
      
      if (!session) {
        console.error('No active session');
        setIsLoading(false);
        return;
      }

      // Determine which folder types to check based on user role
      let folderTypes = ['Rechnungen', 'Tätigkeitsbericht', 'Aktive Teilnehmer'];
      
      if (userRole === 'verwaltung') {
        // Verwaltung cannot see Rechnungen and Tätigkeitsbericht
        folderTypes = ['Aktive Teilnehmer'];
      } else if (userRole === 'vertrieb') {
        // Vertrieb can only see Aktive Teilnehmer from others
        folderTypes = ['Aktive Teilnehmer'];
      }
      
      const counts: FileCount[] = [];

      console.log('Checking folders for types:', folderTypes);
      for (const type of folderTypes) {
        const { data: folders, error: folderError } = await supabase
          .from('folders')
          .select('id')
          .eq('user_id', dozent.id)
          .eq('name', type);

        if (folderError) {
          console.error(`Error fetching folder ${type} for dozent ${dozent.id}:`, folderError);
          continue;
        }

        if (folders && folders.length > 0) {
          const folder = folders[0];
          console.log(`Found folder for ${type}:`, folder.id);
          const { count, error: countError } = await supabase
            .from('files')
            .select('*', { count: 'exact', head: true })
            .eq('folder_id', folder.id);

          if (countError) {
            console.error(`Error counting files for ${type} in folder ${folder.id}:`, countError);
            continue;
          }

          console.log(`File count for ${type}:`, count);
          counts.push({ type, count: count || 0 });
        } else {
          console.log(`No folder found for ${type} for dozent ${dozent.id}`);
          counts.push({ type, count: 0 });
        }
      }

      console.log('Final file counts:', counts);
      setFileCounts(counts);
      setIsLoading(false);
    } catch (error) {
      console.error('Network error fetching file counts:', error);
      // Set empty counts on network error to prevent infinite loading
      setFileCounts([]);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 hover:shadow-md transition-shadow flex flex-col">
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <ProfilePicture
            userId={dozent.id}
            url={dozent.profile_picture_url}
            size="sm"
            editable={false}
            isAdmin={false}
            fullName={dozent.full_name}
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">{dozent.full_name}</h3>
            <p className="text-sm text-gray-500">
              {dozent.role === 'admin' ? 'Administrator' : 
               dozent.role === 'buchhaltung' ? 'Buchhaltung' :
               dozent.role === 'verwaltung' ? 'Verwaltung' :
               dozent.role === 'vertrieb' ? 'Vertrieb' : 'Dozent'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="space-y-2 sm:space-y-3 flex-1">
        {isLoading ? (
          <div className="flex justify-center py-3 sm:py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          fileCounts.map(({ type, count }) => (
            <div key={type} className="flex items-center justify-between relative text-sm sm:text-base">
              <div className="flex items-center text-sm text-gray-500">
                <FolderIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-primary/60" />
                <span>{type}</span>
              </div>
              <div className="flex items-center">
                {count > 0 && (
                  <div className="relative">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold text-xs">
                        {count > 99 ? '99+' : count}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <button
          onClick={() => navigate(`/dozent/${dozent.id}`)}
          className="mt-3 sm:mt-4 w-full bg-primary/5 text-primary hover:bg-primary/10 py-2 px-3 sm:px-4 rounded-md text-sm font-medium transition-colors"
        >
          Details anzeigen
        </button>
    </div>
  );
}