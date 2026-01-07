import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderIcon, Edit2, Info, Mail, Phone, MapPin, X, GraduationCap, Scale, Trash2, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProfilePicture } from './ProfilePicture';
import { AvailabilitySection } from './AvailabilitySection';

interface DozentCardProps {
  dozent: {
    id: string;
    full_name: string;
    role: string;
    profile_picture_url?: string | null;
    title?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    legal_areas?: string[] | null;
    street?: string | null;
    house_number?: string | null;
    postal_code?: string | null;
    city?: string | null;
  };
  userRole?: string | null;
  onEdit?: (dozent: any) => void;
  onDelete?: (dozent: any) => void;
  onFolderClick?: (dozent: any, folderType: string) => void;
}

interface FileCount {
  type: string;
  count: number;
}

export function DozentCard({ dozent, userRole, onEdit, onDelete, onFolderClick }: DozentCardProps) {
  const navigate = useNavigate();
  const [fileCounts, setFileCounts] = useState<FileCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showAvailabilityPopup, setShowAvailabilityPopup] = useState(false);
  const [currentAvailability, setCurrentAvailability] = useState<{status: string; notes?: string} | null>(null);

  const hasContactInfo = dozent.email || dozent.phone || dozent.street || dozent.city || dozent.title || (dozent.legal_areas && dozent.legal_areas.length > 0);

  useEffect(() => {
    fetchFileCounts();
    fetchCurrentAvailability();
  }, [dozent.id]);

  const fetchCurrentAvailability = async () => {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const { data, error } = await supabase
        .from('dozent_availability')
        .select('capacity_status, notes')
        .eq('dozent_id', dozent.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .single();
      
      if (!error && data) {
        setCurrentAvailability({ status: data.capacity_status, notes: data.notes });
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
  };

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
      let folderTypes = ['Rechnungen', 'Tätigkeitsbericht', 'Aktive Teilnehmer', 'Verfügbarkeit'];
      
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
            url={dozent.profile_picture_url || null}
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
        {/* Contact Info Button */}
        {hasContactInfo && (
          <div className="relative">
            <button
              onClick={() => setShowContactInfo(!showContactInfo)}
              className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
              title="Kontaktdaten anzeigen"
            >
              <Info className="h-4 w-4" />
            </button>
            
            {/* Contact Info Popup */}
            {showContactInfo && (
              <div className="absolute right-0 top-8 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-72">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">Stammdaten</span>
                  <button
                    onClick={() => setShowContactInfo(false)}
                    className="p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-2 text-sm">
                  {/* Title */}
                  {dozent.title && (
                    <div className="flex items-center text-gray-600">
                      <GraduationCap className="h-3.5 w-3.5 mr-2 text-gray-400 flex-shrink-0" />
                      <span>{dozent.title}</span>
                    </div>
                  )}
                  {/* Legal Areas */}
                  {dozent.legal_areas && dozent.legal_areas.length > 0 && (
                    <div className="flex items-start text-gray-600">
                      <Scale className="h-3.5 w-3.5 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {dozent.legal_areas.map((area, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs">
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Email */}
                  {dozent.email && (
                    <div className="flex items-center text-gray-600">
                      <Mail className="h-3.5 w-3.5 mr-2 text-gray-400 flex-shrink-0" />
                      <a href={`mailto:${dozent.email}`} className="truncate hover:text-primary">
                        {dozent.email}
                      </a>
                    </div>
                  )}
                  {/* Phone */}
                  {dozent.phone && (
                    <div className="flex items-center text-gray-600">
                      <Phone className="h-3.5 w-3.5 mr-2 text-gray-400 flex-shrink-0" />
                      <a href={`tel:${dozent.phone}`} className="hover:text-primary">
                        {dozent.phone}
                      </a>
                    </div>
                  )}
                  {/* Address */}
                  {(dozent.street || dozent.city) && (
                    <div className="flex items-start text-gray-600">
                      <MapPin className="h-3.5 w-3.5 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                      <div>
                        {dozent.street && (
                          <div>{dozent.street} {dozent.house_number || ''}</div>
                        )}
                        {(dozent.postal_code || dozent.city) && (
                          <div>{dozent.postal_code || ''} {dozent.city || ''}</div>
                        )}
                      </div>
                    </div>
                  )}
                  {!dozent.title && !dozent.email && !dozent.phone && !dozent.street && !dozent.city && (!dozent.legal_areas || dozent.legal_areas.length === 0) && (
                    <p className="text-gray-400 text-xs">Keine Stammdaten hinterlegt</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="space-y-2 sm:space-y-3 flex-1">
        {isLoading ? (
          <div className="flex justify-center py-3 sm:py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Availability Badge */}
            <button
              onClick={() => setShowAvailabilityPopup(true)}
              className="flex items-center justify-between w-full text-left hover:bg-gray-50 rounded-md p-1 -m-1 cursor-pointer transition-colors"
            >
              <div className="flex items-center text-sm text-gray-500">
                <span>Verfügbarkeit</span>
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                currentAvailability?.status === 'available' 
                  ? 'bg-green-100 text-green-800 border-green-300'
                  : currentAvailability?.status === 'limited'
                  ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                  : currentAvailability?.status === 'full'
                  ? 'bg-red-100 text-red-800 border-red-300'
                  : 'bg-gray-100 text-gray-600 border-gray-300'
              }`}>
                {currentAvailability?.status === 'available' && <CheckCircle className="h-3 w-3" />}
                {currentAvailability?.status === 'limited' && <AlertCircle className="h-3 w-3" />}
                {currentAvailability?.status === 'full' && <XCircle className="h-3 w-3" />}
                <span>
                  {currentAvailability?.status === 'available' ? 'Verfügbar' 
                    : currentAvailability?.status === 'limited' ? 'Begrenzt'
                    : currentAvailability?.status === 'full' ? 'Ausgelastet'
                    : 'Nicht angegeben'}
                </span>
              </div>
            </button>
            
            {/* Other folders */}
            {fileCounts.filter(({ type }) => type !== 'Verfügbarkeit').map(({ type, count }) => (
              <button
                key={type}
                onClick={() => onFolderClick && onFolderClick(dozent, type)}
                className={`flex items-center justify-between relative text-sm sm:text-base w-full text-left ${onFolderClick ? 'hover:bg-gray-50 rounded-md p-1 -m-1 cursor-pointer transition-colors' : ''}`}
                disabled={!onFolderClick}
              >
                <div className="flex items-center text-sm text-gray-500">
                  <FolderIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-primary/60" />
                  <span>{type}</span>
                </div>
                <div className="flex items-center">
                  {count > 0 && (
                    <div className="relative">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {count > 99 ? '99+' : count}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="mt-3 sm:mt-4 flex flex-col gap-2">
        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(dozent)}
              className="flex-1 flex items-center justify-center bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 px-3 sm:px-4 rounded-md text-sm font-medium transition-colors"
            >
              <Edit2 className="h-4 w-4 mr-1.5" />
              Bearbeiten
            </button>
          )}
          <button
            onClick={() => navigate(`/dozent/${dozent.id}`)}
            className={`${onEdit ? 'flex-1' : 'w-full'} bg-primary/5 text-primary hover:bg-primary/10 py-2 px-3 sm:px-4 rounded-md text-sm font-medium transition-colors`}
          >
            Details anzeigen
          </button>
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(dozent)}
            className="w-full flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 py-2 px-3 sm:px-4 rounded-md text-sm font-medium transition-colors"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Löschen
          </button>
        )}
      </div>

      {/* Availability Popup */}
      {showAvailabilityPopup && (
        <div className="fixed z-50 inset-0 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowAvailabilityPopup(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full relative">
              <button
                onClick={() => setShowAvailabilityPopup(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none z-10"
              >
                <X className="h-6 w-6" />
              </button>
              <div className="bg-white">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Verfügbarkeit - {dozent.full_name}</h3>
                </div>
                <AvailabilitySection 
                  dozentId={dozent.id}
                  isAdmin={true}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}