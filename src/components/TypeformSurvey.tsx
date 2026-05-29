import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface Question {
  id: number;
  text: string;
  description?: string;
  type: 'text' | 'long_text' | 'select' | 'rating' | 'yes_no' | 'name';
  options?: string[];
  required?: boolean;
  showIf?: (formData: FormData) => boolean;
}

interface FormData {
  [key: string]: string;
}

const questions: Question[] = [
  {
    id: 1,
    text: 'Bitte teilen Sie uns Ihren vollständigen Namen mit, damit wir Ihre Erfahrung bei der Kraatz Group optimal gestalten können.',
    description: '(Alle Antworten werden vertraulich und diskret zum internen Qualitätsmanagement verwertet und stellen für Sie keinerlei Nachteil dar!)',
    type: 'name',
    required: false
  },
  {
    id: 2,
    text: 'Wie sind Sie auf den Einzelunterricht bei der Kraatz Group aufmerksam geworden?',
    type: 'select',
    options: ['Google', 'Social Media', 'Werbung', 'YouTube', 'Empfehlung', 'Kostenloses Angebot (Newsletter, Crashkurse)'],
    required: true
  },
  {
    id: 3,
    text: 'Welche Qualität haben für Sie die unterrichtsbegleitenden Klausuren (ohne Zusatzmaterialien)?',
    description: 'Bitte geben Sie die Antwort in Schulnoten an (1 = Sehr gut, 6 = ungenügend)',
    type: 'rating',
    required: true
  },
  {
    id: 4,
    text: 'Sind Ihnen diese eine Hilfe beim Verstehen der Themenkomplexe?',
    type: 'select',
    options: ['Ja', 'Teilweise', 'Nein'],
    required: false
  },
  {
    id: 5,
    text: 'Was hätte besser gemacht werden können und sollen?',
    type: 'text',
    required: false,
    showIf: (data) => data[4] === 'Teilweise' || data[4] === 'Nein'
  },
  {
    id: 6,
    text: 'Welche Qualität haben für Sie die unterrichtsbegleitenden Zusatzmaterialien (ohne Klausuren)?',
    description: 'Bitte geben Sie die Antwort in Schulnoten an (1 = Sehr gut, 6 = Ungenügend)',
    type: 'rating',
    required: true
  },
  {
    id: 7,
    text: 'Sind Ihnen diese eine Hilfe beim Verstehen der Themenkomplexe?',
    type: 'select',
    options: ['Ja', 'Teilweise', 'Nein'],
    required: false
  },
  {
    id: 8,
    text: 'Genießen Sie den Vorteil des Einzel-Unterrichts?',
    type: 'select',
    options: ['Ja', 'Nein'],
    required: false
  },
  {
    id: 9,
    text: 'Würden Sie sagen, durch den Einzel-Unterricht mehr zu lernen und vom Unterricht mitzunehmen als in einem Gruppen-Rep-Kurs?',
    type: 'select',
    options: ['Ja', 'Nein'],
    required: false
  },
  {
    id: 10,
    text: 'Wie gefallen Ihnen die Videos aus dem Kraatz Club?',
    description: 'Bitte geben Sie die Bewertung in Schulnoten an (1 = Sehr gut, 6 = Ungenügend)',
    type: 'rating',
    required: false
  },
  {
    id: 11,
    text: 'Was hätte besser gemacht werden können und sollen?',
    type: 'text',
    required: false,
    showIf: (data) => {
      const rating = parseInt(data[10] || '0');
      return rating >= 3 && rating <= 6;
    }
  },
  {
    id: 12,
    text: 'Funktioniert die Terminabsprache mit den Dozenten? Erhalten Sie die Materialien pünktlich?',
    type: 'select',
    options: ['Ja', 'Nein'],
    required: false
  },
  {
    id: 13,
    text: 'Was hätte besser gemacht werden können und sollen?',
    description: '(Wir behandeln Ihre Antwort diskret und vertraulich)',
    type: 'text',
    required: false,
    showIf: (data) => data[12] === 'Nein'
  },
  {
    id: 14,
    text: 'Bewerten Sie den / die Dozenten, bei dem Sie Unterricht im Zivilrecht haben!',
    description: 'Didaktik - Wie gelingt es dem Dozenten, die teils schwierigen Themen zu vermitteln und "rüberzubringen"? Wie ist seine Unterrichtsführung? (Bitte geben Sie die Antwort in Schulnoten an)',
    type: 'rating',
    required: false
  },
  {
    id: 15,
    text: 'Bewerten Sie den / die Dozenten, bei dem Sie Unterricht im Zivilrecht haben!',
    description: 'Freundlichkeit - Hat der Dozent immer ein "offenes Ohr" für Sie und wie geht er mit Ihren individuellen Problemen bzgl. der anstehenden Prüfung um?',
    type: 'rating',
    required: false
  },
  {
    id: 16,
    text: 'Bewerten Sie den / die Dozenten, bei dem Sie Unterricht im Zivilrecht haben!',
    description: 'Souveränität - Wie souverän wirkt Dozent auf Sie? Behält der Dozent auch bei schwierigen Themenkomplexen und Nachfragen Ihrerseits stets die Souveränität und gerät nicht ins "Wanken"?',
    type: 'rating',
    required: false
  },
  {
    id: 17,
    text: 'Sonstige Anmerkungen',
    description: 'Möchten Sie sonst etwas zu dem Dozenten anmerken, was Ihnen positiv aufgefallen ist, oder was er in Zukunft besser machen kann? Haben Sie keine Scheu – Wir möchten uns immer verbessern!',
    type: 'text',
    required: false
  },
  {
    id: 18,
    text: 'Bewerten Sie den / die Dozenten, bei dem Sie Unterricht im öffentl. Recht haben!',
    description: 'Didaktik - Wie gelingt es dem Dozenten, die teils schwierigen Themen zu vermitteln und "rüberzubringen"? Wie ist seine Unterrichtsführung? (Bitte geben Sie die Antwort in Schulnoten an)',
    type: 'rating',
    required: false
  },
  {
    id: 19,
    text: 'Bewerten Sie den / die Dozenten, bei dem Sie Unterricht im öffentl. Recht haben!',
    description: 'Freundlichkeit - Hat der Dozent immer ein "offenes Ohr" für Sie und wie geht er mit Ihren individuellen Problemen bzgl. der anstehenden Prüfung um? (Bitte geben Sie die Antwort in Schulnoten an)',
    type: 'rating',
    required: false
  },
  {
    id: 20,
    text: 'Bewerten Sie den / die Dozenten, bei dem Sie Unterricht im öffentl. Recht haben!',
    description: 'Souveränität - Wie souverän wirkt der Dozent auf Sie? Behält der Dozent auch bei schwierigen Themenkomplexen und Nachfragen Ihrerseits stets die Souveränität und gerät nicht ins "Wanken"? (Bitte geben Sie die Antwort in Schulnoten an)',
    type: 'rating',
    required: false
  },
  {
    id: 21,
    text: 'Sonstige Anmerkungen',
    description: 'Möchten Sie sonst etwas zu dem Dozenten im öffentl. Recht anmerken, was Ihnen positiv aufgefallen ist, oder was er in Zukunft besser machen kann? Haben Sie keine Scheu – Wir möchten uns immer verbessern!',
    type: 'text',
    required: false
  },
  {
    id: 22,
    text: 'Bewerten Sie den / die Dozenten, bei dem Sie Unterricht im Strafrecht haben!',
    description: 'Didaktik - Wie gelingt es dem Dozenten, die teils schwierigen Themen zu vermitteln und "rüberzubringen"? Wie ist seine Unterrichtsführung? (Bitte geben Sie die Antwort in Schulnoten an)',
    type: 'rating',
    required: false
  },
  {
    id: 23,
    text: 'Bewerten Sie den / die Dozenten, bei dem Sie Unterricht im Strafrecht haben!',
    description: 'Freundlichkeit - Hat der Dozent immer ein "offenes Ohr" für Sie und wie geht er mit Ihren individuellen Problemen bzgl. der anstehenden Prüfung um?',
    type: 'rating',
    required: false
  },
  {
    id: 24,
    text: 'Bewerten Sie den / die Dozenten, bei dem Sie Unterricht im Strafrecht haben!',
    description: 'Souveränität - Wie souverän wirkt der Dozent auf Sie? Behält der Dozent auch bei schwierigen Themenkomplexen und Nachfragen Ihrerseits stets die Souveränität und gerät ist nicht ins "Wanken"?',
    type: 'rating',
    required: false
  },
  {
    id: 25,
    text: 'Sonstige Anmerkungen',
    description: 'Möchten Sie sonst etwas zu dem Dozenten im Strafrecht anmerken, was Ihnen positiv aufgefallen ist, oder was er in Zukunft besser machen kann? Haben Sie keine Scheu – Wir möchten uns immer verbessern!',
    type: 'text',
    required: false
  },
  {
    id: 26,
    text: 'Würden Sie den Einzelunterricht an bei der Kraatz Group zum jetzigen Zeitpunkt weiterempfehlen?',
    type: 'yes_no',
    required: false
  },
  {
    id: 27,
    text: 'Was hätte besser gemacht werden können und sollen?',
    type: 'text',
    required: false,
    showIf: (data) => data[26] === 'Nein'
  },
  {
    id: 28,
    text: 'Abschließend haben Sie hier die Möglichkeit für sonstige Bemerkungen, sei es Lob, Kritik oder Verbesserungsvorschläge:',
    type: 'long_text',
    required: false
  }
];

export const TypeformSurvey = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [formData, setFormData] = useState<FormData>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { fullName } = useAuthStore();

  // Pre-fill name fields if user is logged in
  useEffect(() => {
    if (fullName && !formData['1_first'] && !formData['1_last']) {
      // Remove common academic titles with optional dots
      const titlePattern = /(?:Dipl\.?|jur\.?|Dr\.?|Prof\.?|M\.A\.?|B\.A\.?|M\.Sc\.?|B\.Sc\.?|LL\.M\.?|PhD|MBA)\s*/gi;
      
      let cleanName = fullName.replace(titlePattern, '');
      
      // Clean up extra spaces
      cleanName = cleanName.replace(/\s+/g, ' ').trim();
      
      const nameParts = cleanName.split(' ');
      
      // Handle case where we might have only first name or only last name
      let firstName = '';
      let lastName = '';
      
      if (nameParts.length === 1) {
        firstName = nameParts[0];
      } else if (nameParts.length === 2) {
        firstName = nameParts[0];
        lastName = nameParts[1];
      } else {
        // For names with 3+ parts, assume first word is first name, rest is last name
        // This handles double last names like "Beßelmann Calvo"
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      }
      
      setFormData(prev => ({
        ...prev,
        '1_first': firstName,
        '1_last': lastName
      }));
    }
  }, [fullName]);

  // Get visible questions based on branching logic
  const getVisibleQuestions = () => {
    return questions.filter(q => !q.showIf || q.showIf(formData));
  };

  const visibleQuestions = getVisibleQuestions();
  const currentQ = visibleQuestions[currentQuestion];

  const saveToSupabase = async () => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const { error } = await supabase
        .from('feedback_responses')
        .insert({
          q1_first_name: formData['1_first'] || null,
          q1_last_name: formData['1_last'] || null,
          q2_source: formData['2'] || null,
          q3_exam_quality: formData['3'] ? parseInt(formData['3']) : null,
          q4_exam_help: formData['4'] || null,
          q5_exam_improvement: formData['5'] || null,
          q6_material_quality: formData['6'] ? parseInt(formData['6']) : null,
          q7_material_help: formData['7'] || null,
          q8_enjoy_individual: formData['8'] || null,
          q9_more_than_group: formData['9'] || null,
          q10_video_quality: formData['10'] ? parseInt(formData['10']) : null,
          q11_video_improvement: formData['11'] || null,
          q12_timing_works: formData['12'] || null,
          q13_timing_improvement: formData['13'] || null,
          q14_zivil_didaktik: formData['14'] ? parseInt(formData['14']) : null,
          q15_zivil_freundlichkeit: formData['15'] ? parseInt(formData['15']) : null,
          q16_zivil_souveranitaet: formData['16'] ? parseInt(formData['16']) : null,
          q17_zivil_comments: formData['17'] || null,
          q18_oef_didaktik: formData['18'] ? parseInt(formData['18']) : null,
          q19_oef_freundlichkeit: formData['19'] ? parseInt(formData['19']) : null,
          q20_oef_souveranitaet: formData['20'] ? parseInt(formData['20']) : null,
          q21_oef_comments: formData['21'] || null,
          q22_straf_didaktik: formData['22'] ? parseInt(formData['22']) : null,
          q23_straf_freundlichkeit: formData['23'] ? parseInt(formData['23']) : null,
          q24_straf_souveranitaet: formData['24'] ? parseInt(formData['24']) : null,
          q25_straf_comments: formData['25'] || null,
          q26_recommend: formData['26'] || null,
          q27_not_recommend_reason: formData['27'] || null,
          q28_final_comments: formData['28'] || null,
        });

      if (error) throw error;
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error saving feedback:', error);
      setSubmitError('Fehler beim Speichern Ihrer Antworten. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentQuestion < visibleQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      saveToSupabase();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleAnswer = (value: string, key?: string) => {
    setFormData({ ...formData, [key || currentQ.id]: value });
  };

  const canProceed = currentQ.required 
    ? formData[currentQ.id]?.length > 0 
    : true;

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-2xl w-full text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Vielen Dank!</h2>
            <p className="text-gray-600">Ihre Antworten wurden erfolgreich übermittelt.</p>
          </div>
          <button
            onClick={() => {
              setCurrentQuestion(0);
              setFormData({});
              setIsSubmitted(false);
            }}
            className="mt-6 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors font-medium"
          >
            Neue Umfrage starten
          </button>
        </div>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-2xl w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Ihre Antworten werden gespeichert...</h2>
          <p className="text-gray-600">Bitte warten Sie einen Moment.</p>
        </div>
      </div>
    );
  }

  if (submitError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-2xl w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Fehler</h2>
          <p className="text-gray-600 mb-6">{submitError}</p>
          <button
            onClick={() => {
              setSubmitError(null);
            }}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors font-medium"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / visibleQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-3xl w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-500">
              Frage {currentQuestion + 1} von {visibleQuestions.length}
            </span>
            <span className="text-sm font-medium text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="mb-8">
          {currentQ.description && (
            <p className="text-sm text-gray-600 mb-4 italic">{currentQ.description}</p>
          )}
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 leading-tight">
            {currentQ.text}
          </h2>

          {currentQ.type === 'name' && (
            <div className="space-y-4">
              <input
                type="text"
                value={formData[`${currentQ.id}_first`] || ''}
                onChange={(e) => handleAnswer(`${currentQ.id}_first`, e.target.value)}
                placeholder="Vorname"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-lg"
                autoFocus
              />
              <input
                type="text"
                value={formData[`${currentQ.id}_last`] || ''}
                onChange={(e) => handleAnswer(`${currentQ.id}_last`, e.target.value)}
                placeholder="Nachname"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-lg"
              />
            </div>
          )}

          {currentQ.type === 'text' && (
            <input
              type="text"
              value={formData[currentQ.id] || ''}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Ihre Antwort..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-lg"
              autoFocus
            />
          )}

          {currentQ.type === 'long_text' && (
            <textarea
              value={formData[currentQ.id] || ''}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Ihre Antwort..."
              rows={5}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-lg resize-none"
              autoFocus
            />
          )}

          {currentQ.type === 'select' && currentQ.options && (
            <div className="space-y-3">
              {currentQ.options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  className={`w-full text-left px-6 py-4 rounded-lg border-2 transition-all text-lg font-medium ${
                    formData[currentQ.id] === option
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-300 hover:border-primary hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {currentQ.type === 'rating' && (
            <div className="flex gap-2 justify-center flex-wrap">
              {[1, 2, 3, 4, 5, 6].map((rating) => (
                <button
                  key={rating}
                  onClick={() => handleAnswer(rating.toString())}
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-lg transition-all ${
                    formData[currentQ.id] === rating.toString()
                      ? 'border-primary bg-primary text-white'
                      : 'border-gray-300 hover:border-primary text-gray-700'
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>
          )}

          {currentQ.type === 'yes_no' && (
            <div className="flex gap-4">
              <button
                onClick={() => handleAnswer('Ja')}
                className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all text-lg font-medium ${
                  formData[currentQ.id] === 'Ja'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-300 hover:border-primary hover:bg-gray-50 text-gray-700'
                }`}
              >
                Ja
              </button>
              <button
                onClick={() => handleAnswer('Nein')}
                className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all text-lg font-medium ${
                  formData[currentQ.id] === 'Nein'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-300 hover:border-primary hover:bg-gray-50 text-gray-700'
                }`}
              >
                Nein
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              currentQuestion === 0
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Zurück
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-medium transition-colors ${
              canProceed
                ? 'bg-primary text-white hover:bg-primary/80'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {currentQuestion === visibleQuestions.length - 1 ? 'Absenden' : 'Weiter'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
