import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useVbCaseStudies } from '../../hooks/useVbCaseStudies';
import { useAuthStore } from '../../store/authStore';

const LEGAL_AREAS = {
  'Zivilrecht': ['BGB AT', 'BGB BT', 'Schuldrecht AT', 'Schuldrecht BT', 'Sachenrecht', 'Familienrecht', 'Erbrecht'],
  'Strafrecht': ['Strafrecht AT', 'Strafrecht BT'],
  'Öffentliches Recht': ['Staatsorganisationsrecht', 'Grundrechte', 'Verwaltungsrecht AT', 'Verwaltungsrecht BT', 'Baurecht', 'Kommunalrecht']
};

const STUDY_PHASES = ['Grund- und Hauptstudium', '1. Examensvorbereitung'];

export const VbCaseStudyRequest: React.FC = () => {
  const navigate = useNavigate();
  const { accountCredits, createCaseStudyRequest } = useVbCaseStudies();
  const additionalRoles = useAuthStore(state => state.additionalRoles);
  const isCrashkurs = (additionalRoles || []).includes('vb_crashkurs');
  const [loading, setLoading] = useState(false);
  const [studyPhase, setStudyPhase] = useState('');
  const [legalArea, setLegalArea] = useState('');
  const [subArea, setSubArea] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [randomAssignment, setRandomAssignment] = useState(false);

  const subAreas = legalArea ? LEGAL_AREAS[legalArea as keyof typeof LEGAL_AREAS] || [] : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((!isCrashkurs && !studyPhase) || !legalArea || (!isCrashkurs && !subArea && !randomAssignment)) {
      alert('Bitte füllen Sie alle Pflichtfelder aus.');
      return;
    }

    setLoading(true);
    try {
      await createCaseStudyRequest({
        study_phase: isCrashkurs ? '1. Examensvorbereitung' : studyPhase,
        legal_area: legalArea,
        sub_area: isCrashkurs ? 'Crashkurs' : (randomAssignment ? 'Beliebig' : subArea),
        focus_area: isCrashkurs ? '' : focusArea
      });
      navigate('/klausurenbesprechung/dashboard');
    } catch (error) {
      console.error('Error creating case study request:', error);
      alert(error instanceof Error ? error.message : 'Fehler beim Anfordern des Sachverhalts.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="flex items-center space-x-3 mb-6">
          <BookOpen className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Neuen Sachverhalt anfordern</h1>
            <p className="text-gray-600">Verfügbare Credits: {accountCredits}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isCrashkurs && (
          <div>
            <label htmlFor="studyPhase" className="block text-sm font-medium text-gray-700 mb-2">
              In welcher Phase des Studiums befindest Du Dich? *
            </label>
            <select
              id="studyPhase"
              value={studyPhase}
              onChange={(e) => setStudyPhase(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            >
              <option value="">Bitte wähle Deine Studienphase</option>
              {STUDY_PHASES.map(phase => (
                <option key={phase} value={phase}>{phase}</option>
              ))}
            </select>
          </div>
          )}

          <div>
            <label htmlFor="legalArea" className="block text-sm font-medium text-gray-700 mb-2">
              Rechtsgebiet *
            </label>
            <select
              id="legalArea"
              value={legalArea}
              onChange={(e) => {
                setLegalArea(e.target.value);
                setSubArea('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            >
              <option value="">Bitte wähle ein Rechtsgebiet</option>
              {Object.keys(LEGAL_AREAS).map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>

          {!isCrashkurs && (
          <div className="flex items-start space-x-3">
            <input
              id="randomAssignment"
              type="checkbox"
              checked={randomAssignment}
              onChange={(e) => setRandomAssignment(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
            />
            <label htmlFor="randomAssignment" className="text-sm text-gray-600">
              Mein Dozent soll eine beliebige Klausur aus dem gewählten Rechtsgebiet auswählen
            </label>
          </div>
          )}

          {!isCrashkurs && (
          <div>
            <label htmlFor="subArea" className="block text-sm font-medium text-gray-700 mb-2">
              Teilrechtsgebiet *
            </label>
            <select
              id="subArea"
              value={subArea}
              onChange={(e) => setSubArea(e.target.value)}
              disabled={!legalArea || randomAssignment}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              required={!randomAssignment}
            >
              <option value="">
                {legalArea ? 'Bitte wähle ein Teilrechtsgebiet' : 'Zuerst Rechtsgebiet wählen'}
              </option>
              {subAreas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
          )}

          {!isCrashkurs && (
          <div>
            <label htmlFor="focusArea" className="block text-sm font-medium text-gray-700 mb-2">
              Schwerpunkt / Spezifische Anforderungen
            </label>
            <textarea
              id="focusArea"
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Gebe einen Schwerpunkt pro Klausur an, bspw.: Vertreter ohne Vertretungsmacht"
            />
            <p className="text-xs text-gray-500 mt-1">
              Bitte beachte, dass wir nur einen Wunschschwerpunkt berücksichtigen können.
            </p>
          </div>
          )}

          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md text-sm">
            <p className="font-medium mb-1">Was passiert als nächstes?</p>
            <ul className="text-xs space-y-1">
              <li>• Dein Dozent wählt eine passende Klausur für Dich aus</li>
              <li>• Du erhältst eine Benachrichtigung, sobald der Sachverhalt zum Download bereit ist</li>
              <li>• Nach der Klausurbearbeitung kannst Du Deine Lösung hochladen und erhältst Dein Video-Feedback</li>
            </ul>
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => navigate('/klausurenbesprechung/dashboard')}
              className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading || accountCredits < 1}
              className="flex-1 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Wird gesendet...' : 'Sachverhalt anfordern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
