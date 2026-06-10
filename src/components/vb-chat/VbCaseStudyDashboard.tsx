import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Clock, BookOpen, Upload, Video, Plus, Star, ChevronDown, CheckCircle } from 'lucide-react';
import { useVbCaseStudies, VbCaseStudyRequest } from '../../hooks/useVbCaseStudies';

export const VbCaseStudyDashboard: React.FC = () => {
  const { caseStudies, loading, accountCredits } = useVbCaseStudies();
  const [filter, setFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const requested = caseStudies.filter(cs => cs.status === 'requested');
  const available = caseStudies.filter(cs => cs.status === 'materials_ready');
  const uploadReady = caseStudies.filter(cs => cs.status === 'submitted');
  const corrected = caseStudies.filter(cs => ['corrected', 'completed'].includes(cs.status));

  const newCorrections = corrected.filter(cs => !cs.correction_viewed_at);
  const pastCorrections = corrected.filter(cs => cs.correction_viewed_at);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Willkommen, {caseStudies[0]?.profile_id ? 'User' : 'Benutzer'}!
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Hier ist dein persönliches Dashboard für Klausurbearbeitungen.
        </p>
      </div>

      {/* Available Credits */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Verfügbare Klausuren</h2>
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-blue-600">{accountCredits}</span>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-gray-600 text-sm sm:text-base">
            Du hast <span className="font-bold">{accountCredits}</span> verfügbare Klausur-Credits.
          </p>
          <Link
            to="/vb/case-studies/request"
            className="bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Sachverhalt anfordern</span>
          </Link>
        </div>
      </div>

      {/* Requested */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Sachverhalt angefordert</h2>
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="font-bold text-yellow-600">{requested.length}</span>
          </div>
        </div>
        {requested.length === 0 ? (
          <p className="text-gray-600 text-center py-4">Keine angeforderten Sachverhalte.</p>
        ) : (
          <div className="space-y-3">
            {requested.map(cs => (
              <div key={cs.id} className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">{cs.legal_area} - {cs.sub_area}</p>
                <p className="text-xs text-gray-500 mt-1">Schwerpunkt: {cs.focus_area}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Sachverhalt verfügbar</h2>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-blue-600">{available.length}</span>
          </div>
        </div>
        {available.length === 0 ? (
          <p className="text-gray-600 text-center py-4">Keine verfügbaren Sachverhalte.</p>
        ) : (
          <div className="space-y-3">
            {available.map(cs => (
              <div key={cs.id} className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">{cs.legal_area} - {cs.sub_area}</p>
                <a href={cs.case_study_material_url} target="_blank" className="text-blue-600 text-sm mt-2 inline-block">
                  Sachverhalt herunterladen
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Ready */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Upload Bearbeitung</h2>
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-orange-600" />
            <span className="font-bold text-orange-600">{uploadReady.length}</span>
          </div>
        </div>
        {uploadReady.length === 0 ? (
          <p className="text-gray-600 text-center py-4">Keine Klausuren bereit für Upload.</p>
        ) : (
          <div className="space-y-3">
            {uploadReady.map(cs => (
              <div key={cs.id} className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">{cs.legal_area} - {cs.sub_area}</p>
                <button className="text-blue-600 text-sm mt-2">Lösung hochladen</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Video Corrections */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Video-Klausurenkorrektur verfügbar</h2>
            <div className="flex items-center space-x-2 sm:hidden">
              <Video className="w-5 h-5 text-green-600" />
              <span className="font-bold text-green-600">{corrected.length}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">Filter:</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Alle Rechtsgebiete</option>
                <option value="Zivilrecht">Zivilrecht</option>
                <option value="Strafrecht">Strafrecht</option>
                <option value="Öffentliches Recht">Öffentliches Recht</option>
              </select>
            </div>
            <div className="hidden sm:flex items-center space-x-2">
              <Video className="w-5 h-5 text-green-600" />
              <span className="font-bold text-green-600">{corrected.length}</span>
            </div>
          </div>
        </div>

        {newCorrections.length > 0 && (
          <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <div>
                <h3 className="text-sm font-semibold text-green-800">
                  🎉 Eine neue Klausur-Korrektur ist ab sofort für Dich verfügbar.
                </h3>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-md font-semibold text-gray-900 mb-3">Neue Video-Klausurenkorrekturen</h3>
          <div className="space-y-3">
            {newCorrections.map(cs => (
              <CaseStudyCard key={cs.id} caseStudy={cs} isExpanded={expandedIds.has(cs.id)} onToggle={() => toggleExpand(cs.id)} />
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-md font-semibold text-gray-900 mb-3">Vergangene Video-Klausurenkorrekturen</h3>
          <div className="space-y-3">
            {pastCorrections.map(cs => (
              <CaseStudyCard key={cs.id} caseStudy={cs} isExpanded={expandedIds.has(cs.id)} onToggle={() => toggleExpand(cs.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface CaseStudyCardProps {
  caseStudy: VbCaseStudyRequest;
  isExpanded: boolean;
  onToggle: () => void;
}

const CaseStudyCard: React.FC<CaseStudyCardProps> = ({ caseStudy, isExpanded, onToggle }) => {
  return (
    <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 transition-all duration-1000 relative">
      <div className="cursor-pointer" onClick={onToggle}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
              #{caseStudy.case_study_number}
            </span>
            <h3 className="font-medium text-gray-900 text-sm sm:text-base">
              {caseStudy.legal_area} - {caseStudy.sub_area}
            </h3>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full font-medium">
              ✓ Abgeschlossen
            </span>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {new Date(caseStudy.updated_at).toLocaleDateString('de-DE')}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs sm:text-sm text-gray-600">
            Schwerpunkt: {caseStudy.focus_area}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Rating stars could go here */}
        </div>
        <button className="flex items-center justify-center gap-1 px-3 py-2 sm:py-1 bg-yellow-600 text-white text-xs rounded-lg hover:bg-yellow-700 transition-colors w-full sm:w-auto">
          <Star className="w-3 h-3" />
          Jetzt bewerten
        </button>
      </div>
    </div>
  );
};
