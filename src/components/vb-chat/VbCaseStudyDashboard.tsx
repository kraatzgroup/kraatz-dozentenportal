import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CreditCard, BookOpen, Plus, Download, Upload, FileText, Video, X, Clock, CheckCircle, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { useVbCaseStudies, VbCaseStudyRequest } from '../../hooks/useVbCaseStudies';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

export const VbCaseStudyDashboard: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { caseStudies, loading, accountCredits, refetch } = useVbCaseStudies();
  const [searchParams, setSearchParams] = useSearchParams();
  const [uploadFiles, setUploadFiles] = useState<Map<string, File>>(new Map());
  const [uploadingCaseId, setUploadingCaseId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [highlightedCaseId, setHighlightedCaseId] = useState<string | null>(null);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const [legalAreaFilter, setLegalAreaFilter] = useState<string>('all');

  const toggleCaseExpansion = (caseId: string) => {
    setExpandedCases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

  const handleDragOver = (e: React.DragEvent, caseStudyId: string) => {
    e.preventDefault();
    setDragOver(caseStudyId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, caseStudyId: string) => {
    e.preventDefault();
    setDragOver(null);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf' || 
          file.type === 'application/msword' || 
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        setUploadFiles(prev => new Map(prev).set(caseStudyId, file));
      }
    }
  };

  const handleFileUpload = async (caseStudyId: string) => {
    const uploadFile = uploadFiles.get(caseStudyId);
    if (!uploadFile) return;

    setUploadingCaseId(caseStudyId);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${caseStudyId}_submission_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('case-studies')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('case-studies')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('vb_case_study_requests')
        .update({ 
          submission_url: urlData.publicUrl,
          status: 'submitted'
        })
        .eq('id', caseStudyId);

      if (updateError) throw updateError;
      
      setUploadFiles(prev => { const next = new Map(prev); next.delete(caseStudyId); return next });
      refetch();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert(`Upload failed: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setUploadingCaseId(null);
    }
  };

  const requestedCases = caseStudies.filter(cs => cs.status === 'requested');
  const materialsReadyCases = caseStudies.filter(cs => cs.status === 'materials_ready');
  const submittedCases = caseStudies.filter(cs => cs.status === 'submitted');
  const completedCases = caseStudies.filter(cs => ['corrected', 'completed'].includes(cs.status));
  
  const filteredCompletedCases = completedCases.filter(cs => 
    legalAreaFilter === 'all' || cs.legal_area === legalAreaFilter
  );
  
  const newCorrections = filteredCompletedCases.filter(cs => !cs.correction_viewed_at);
  const viewedCorrections = filteredCompletedCases.filter(cs => cs.correction_viewed_at);

  // Handle highlight parameter from notifications
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId) {
      setHighlightedCaseId(highlightId);
      setTimeout(() => {
        setHighlightedCaseId(null);
        setSearchParams({});
      }, 5000);
      
      setTimeout(() => {
        const element = document.getElementById(`case-study-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [searchParams, setSearchParams]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Willkommen, {user?.user_metadata?.first_name || 'Benutzer'}!
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">Hier ist dein persönliches Dashboard für Klausurbearbeitungen.</p>
        </div>

        {/* 1. Verfügbare Klausuren */}
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
            {accountCredits > 0 && (
              <Link
                to="/vb/case-studies/request"
                className="bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Sachverhalt anfordern</span>
              </Link>
            )}
          </div>
          {accountCredits === 0 && (
            <div className="text-center py-4">
              <p className="text-gray-600 mb-4">Keine verfügbaren Credits.</p>
              <Link
                to="/vb/packages"
                className="bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
              >
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Weitere Klausuren buchen</span>
              </Link>
            </div>
          )}
        </div>

        {/* 2. Sachverhalt angefordert */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Sachverhalt angefordert</h2>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <span className="font-bold text-yellow-600">{requestedCases.length}</span>
            </div>
          </div>
          {requestedCases.length > 0 ? (
            <div className="space-y-3">
              {requestedCases.map((caseStudy, index) => (
                <div 
                  key={caseStudy.id} 
                  id={`case-study-${caseStudy.id}`}
                  className={`border rounded-lg p-3 transition-all duration-1000 ${
                    highlightedCaseId === caseStudy.id 
                      ? 'border-blue-400 bg-blue-100 shadow-lg ring-2 ring-blue-300' 
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap">
                          #{index + 1}
                        </span>
                        <h3 className="font-medium text-gray-900 text-sm sm:text-base truncate">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">Schwerpunkt: {caseStudy.focus_area}</p>
                      <p className="text-xs text-gray-500">Angefordert: {formatDate(caseStudy.created_at)}</p>
                    </div>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium whitespace-nowrap self-start sm:self-center">
                      Warten auf Dozent
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-4">Keine angeforderten Sachverhalte.</p>
          )}
        </div>

        {/* 3. Sachverhalt verfügbar */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Sachverhalt verfügbar</h2>
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-blue-600">{materialsReadyCases.length}</span>
            </div>
          </div>
          {materialsReadyCases.length > 0 ? (
            <div className="space-y-3">
              {materialsReadyCases.map((caseStudy) => (
                <div 
                  key={caseStudy.id} 
                  id={`case-study-${caseStudy.id}`}
                  className={`border rounded-lg p-3 transition-all duration-1000 ${
                    highlightedCaseId === caseStudy.id 
                      ? 'border-blue-400 bg-blue-100 shadow-lg ring-2 ring-blue-300' 
                      : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <div className="mb-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap">
                        #{caseStudy.case_study_number}
                      </span>
                      <h3 className="font-medium text-gray-900 text-sm sm:text-base break-words">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 break-words">Schwerpunkt: {caseStudy.focus_area}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                    {caseStudy.case_study_material_url && (
                      <a
                        href={caseStudy.case_study_material_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors flex items-center justify-center space-x-2 whitespace-nowrap"
                        style={{ backgroundColor: '#2e83c2' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                      >
                        <Download className="w-4 h-4" />
                        <span>Sachverhalt</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-4">Keine verfügbaren Sachverhalte.</p>
          )}
        </div>

        {/* 4. Upload Bearbeitung */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Upload Bearbeitung</h2>
            <div className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-orange-600" />
              <span className="font-bold text-orange-600">{materialsReadyCases.length + submittedCases.length}</span>
            </div>
          </div>
          {(materialsReadyCases.length > 0 || submittedCases.length > 0) ? (
            <div className="space-y-4">
              {materialsReadyCases.map((caseStudy) => (
                <div 
                  key={caseStudy.id} 
                  id={`case-study-${caseStudy.id}`}
                  className={`border rounded-lg p-4 transition-all duration-1000 ${
                    highlightedCaseId === caseStudy.id 
                      ? 'border-blue-400 bg-blue-100 shadow-lg ring-2 ring-blue-300' 
                      : 'border-orange-200 bg-orange-50'
                  }`}
                >
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                        #{caseStudy.case_study_number}
                      </span>
                      <h3 className="font-medium text-gray-900">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                    </div>
                    <p className="text-sm text-gray-600">Schwerpunkt: {caseStudy.focus_area}</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bearbeitung hochladen (PDF oder Word)
                      </label>
                      <div
                        onDragOver={(e) => handleDragOver(e, caseStudy.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, caseStudy.id)}
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          dragOver === caseStudy.id
                            ? 'border-blue-600 bg-blue-50'
                            : uploadFiles.get(caseStudy.id)
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-300 bg-gray-50'
                        }`}
                      >
                        {uploadFiles.get(caseStudy.id) ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center space-x-2">
                              <FileText className="w-8 h-8 text-green-600" />
                              <div>
                                <p className="text-sm font-medium text-green-800">{uploadFiles.get(caseStudy.id)!.name}</p>
                                <p className="text-xs text-green-600">
                                  {(uploadFiles.get(caseStudy.id)!.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                              <button
                                onClick={() => setUploadFiles(prev => { const next = new Map(prev); next.delete(caseStudy.id); return next })}
                                className="p-1 hover:bg-green-200 rounded-full"
                              >
                                <X className="w-4 h-4 text-green-600" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                            <div>
                              <p className="text-sm text-gray-600">
                                Datei hier ablegen oder{' '}
                                <label className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
                                  durchsuchen
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadFiles(prev => new Map(prev).set(caseStudy.id, f)) }}
                                    className="hidden"
                                  />
                                </label>
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                PDF, DOC oder DOCX (max. 50MB)
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleFileUpload(caseStudy.id)}
                      disabled={!uploadFiles.get(caseStudy.id) || uploadingCaseId === caseStudy.id}
                      className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                        uploadFiles.get(caseStudy.id) && uploadingCaseId !== caseStudy.id
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      <span>
                        {uploadingCaseId === caseStudy.id 
                          ? 'Wird hochgeladen...' 
                          : 'Bearbeitung einreichen'
                        }
                      </span>
                    </button>
                  </div>
                </div>
              ))}
              
              {submittedCases.map((caseStudy) => (
                <div 
                  key={caseStudy.id} 
                  id={`case-study-${caseStudy.id}`}
                  className={`border rounded-lg p-4 transition-all duration-1000 ${
                    highlightedCaseId === caseStudy.id 
                      ? 'border-blue-400 bg-blue-100 shadow-lg ring-2 ring-blue-300' 
                      : 'border-gray-300 bg-gray-100'
                  }`}
                >
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                        #{caseStudy.case_study_number}
                      </span>
                      <h3 className="font-medium text-gray-900">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
                    </div>
                    <p className="text-sm text-gray-600">Schwerpunkt: {caseStudy.focus_area}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-800">
                          Klausurbearbeitung erfolgreich hochgeladen
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Die Video-Klausurkorrektur steht in 48 Stunden zur Verfügung.
                        </p>
                      </div>
                    </div>
                    {caseStudy.submission_url && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="text-xs text-gray-600">
                          Eingereicht: {formatDate(caseStudy.created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-4">Keine Klausuren bereit für Upload.</p>
          )}
        </div>

        {/* 5. Video-Klausurenkorrektur verfügbar */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Video-Klausurenkorrektur verfügbar</h2>
              <div className="flex items-center space-x-2 sm:hidden">
                <Video className="w-5 h-5 text-green-600" />
                <span className="font-bold text-green-600">{filteredCompletedCases.length}</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">Filter:</span>
                <select
                  value={legalAreaFilter}
                  onChange={(e) => setLegalAreaFilter(e.target.value)}
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
                <span className="font-bold text-green-600">{filteredCompletedCases.length}</span>
              </div>
            </div>
          </div>
          
          {filteredCompletedCases.length > 0 ? (
            <>
              {newCorrections.length > 0 && (
                <div className="mb-6">
                  <div className="mb-4 p-4 bg-green-100 border border-green-300 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <div>
                        <h3 className="text-sm font-semibold text-green-800">🎉 Eine neue Klausur-Korrektur ist ab sofort für Dich verfügbar.</h3>
                      </div>
                    </div>
                  </div>
                  
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Neue Video-Klausurenkorrekturen</h3>
                  <div className="space-y-3">
                    {newCorrections.map((caseStudy) => (
                      <CaseStudyCard 
                        key={caseStudy.id} 
                        caseStudy={caseStudy} 
                        isExpanded={expandedCases.has(caseStudy.id)} 
                        onToggle={() => toggleCaseExpansion(caseStudy.id)}
                        highlighted={highlightedCaseId === caseStudy.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-md font-semibold text-gray-900 mb-3">Vergangene Video-Klausurenkorrekturen</h3>
                <div className="space-y-3">
                  {viewedCorrections.map((caseStudy) => (
                    <CaseStudyCard 
                      key={caseStudy.id} 
                      caseStudy={caseStudy} 
                      isExpanded={expandedCases.has(caseStudy.id)} 
                      onToggle={() => toggleCaseExpansion(caseStudy.id)}
                      highlighted={highlightedCaseId === caseStudy.id}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-600 text-center py-4">Keine Video-Klausurenkorrekturen verfügbar.</p>
          )}
        </div>
      </div>
    </div>
  );
};

interface CaseStudyCardProps {
  caseStudy: VbCaseStudyRequest;
  isExpanded: boolean;
  onToggle: () => void;
  highlighted: boolean;
}

const CaseStudyCard: React.FC<CaseStudyCardProps> = ({ caseStudy, isExpanded, onToggle, highlighted }) => {
  const getCompletedCaseStyle = () => {
    const hasVideo = !!caseStudy.video_correction_url;
    const hasPdf = !!caseStudy.written_correction_url;
    const videoViewed = !!caseStudy.video_viewed_at;
    const pdfDownloaded = !!caseStudy.pdf_downloaded_at;
    
    const isNew = !videoViewed && !pdfDownloaded;
    const fullyAccessed = (!hasVideo || videoViewed) && (!hasPdf || pdfDownloaded);
    const partiallyAccessed = (videoViewed || pdfDownloaded) && !fullyAccessed;
    
    if (fullyAccessed) {
      return {
        containerClass: "border border-green-200 rounded-lg p-4 bg-green-50",
        badgeClass: "px-2 py-1 bg-green-600 text-white text-xs rounded-full font-medium",
        badgeText: "✓ Vollständig angesehen",
        showNewBadge: false
      };
    } else if (partiallyAccessed) {
      return {
        containerClass: "border border-gray-200 rounded-lg p-4 bg-gray-50",
        badgeClass: "px-2 py-1 bg-gray-600 text-white text-xs rounded-full font-medium",
        badgeText: "◐ Teilweise angesehen",
        showNewBadge: false
      };
    } else {
      return {
        containerClass: "border border-blue-200 rounded-lg p-4 bg-blue-50",
        badgeClass: "px-2 py-1 bg-green-600 text-white text-xs rounded-full font-medium",
        badgeText: "✓ Abgeschlossen",
        showNewBadge: isNew
      };
    }
  };

  const style = getCompletedCaseStyle();

  return (
    <div 
      id={`case-study-${caseStudy.id}`}
      className={`${style.containerClass} transition-all duration-1000 relative ${
        highlighted ? 'ring-4 ring-blue-300 shadow-xl' : ''
      }`}
    >
      {style.showNewBadge && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10">
          1
        </div>
      )}
      <div className="cursor-pointer" onClick={onToggle}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
              #{caseStudy.case_study_number}
            </span>
            <h3 className="font-medium text-gray-900 text-sm sm:text-base">{caseStudy.legal_area} - {caseStudy.sub_area}</h3>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={style.badgeClass}>
              {style.badgeText}
            </span>
            {caseStudy.updated_at && (
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {new Date(caseStudy.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs sm:text-sm text-gray-600">Schwerpunkt: {caseStudy.focus_area}</p>
        </div>
      </div>
      
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap"></div>
        <button className="flex items-center justify-center gap-1 px-3 py-2 sm:py-1 bg-yellow-600 text-white text-xs rounded-lg hover:bg-yellow-700 transition-colors w-full sm:w-auto">
          <Star className="w-3 h-3" />
          Jetzt bewerten
        </button>
      </div>
      
      {isExpanded && (
        <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-gray-50 p-3 rounded border border-gray-200">
            <p className="text-sm text-gray-800 font-medium mb-2">📚 Deine Unterlagen:</p>
            <div className="flex flex-col gap-2 max-w-xs">
              {caseStudy.case_study_material_url && (
                <a
                  href={caseStudy.case_study_material_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                  style={{ backgroundColor: '#2e83c2' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                >
                  <FileText className="w-4 h-4" />
                  <span>Sachverhalt</span>
                </a>
              )}
              {caseStudy.submission_url && (
                <a
                  href={caseStudy.submission_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg text-sm text-white transition-colors flex items-center space-x-2"
                  style={{ backgroundColor: '#2e83c2' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a1f44'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2e83c2'}
                >
                  <Upload className="w-4 h-4" />
                  <span>Meine Bearbeitung</span>
                </a>
              )}
            </div>
          </div>
          
          <div className="bg-white p-3 rounded border border-green-200">
            <p className="text-sm text-green-800 font-medium mb-2">🎓 Deine Korrekturen:</p>
            <div className="flex flex-col gap-2 max-w-xs">
              {caseStudy.video_correction_url && (
                <a
                  href={caseStudy.video_correction_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 text-white"
                  style={{ backgroundColor: caseStudy.video_viewed_at ? '#10b981' : '#2e83c2' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = caseStudy.video_viewed_at ? '#059669' : '#0a1f44'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = caseStudy.video_viewed_at ? '#10b981' : '#2e83c2'}
                >
                  <Video className="w-4 h-4" />
                  <span>Video ansehen</span>
                  {caseStudy.video_viewed_at && <span className="text-xs">✓</span>}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
