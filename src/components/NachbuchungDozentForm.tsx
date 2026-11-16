import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm';

const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const VIDEO_URL =
  'https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/Ansprache%20Dozentenmp4.mp4';

type Reason = 'invalid' | 'expired' | 'already_answered' | 'error';

interface LoadedData {
  ok: boolean;
  reason?: Reason;
  teilnehmer_name?: string;
  rechtsgebiet?: string;
  dozent_name?: string;
}

function tokenFromUrl(): string {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

export function NachbuchungDozentForm() {
  const token = tokenFromUrl();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LoadedData | null>(null);
  const [bedarf, setBedarf] = useState<boolean | null>(null);
  const [stunden, setStunden] = useState('');
  const [erreichbar, setErreichbar] = useState('');
  const [notiz, setNotiz] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data: res, error: invokeError } = await supabase.functions.invoke('nachbuchung-abrufen', {
          body: { token },
        });
        if (invokeError) throw invokeError;
        setData(res as LoadedData);
      } catch (err) {
        console.error(err);
        setData({ ok: false, reason: 'error' });
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bedarf === null) {
      setError('Bitte auswählen, ob Nachbuchungsbedarf besteht.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const { data: res, error: invokeError } = await supabase.functions.invoke('nachbuchung-antworten', {
        body: { token, bedarf, stunden, erreichbar, notiz },
      });
      if (invokeError) throw invokeError;
      if (res?.ok) {
        setSubmitted(true);
      } else if (res?.reason === 'already_answered') {
        setData({ ok: false, reason: 'already_answered' });
      } else if (res?.reason === 'expired') {
        setData({ ok: false, reason: 'expired' });
      } else {
        setError('Das Formular konnte nicht gespeichert werden. Bitte erneut versuchen.');
      }
    } catch (err) {
      console.error(err);
      setError('Das Formular konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Formular wird geladen…</p>
        </div>
      </div>
    );
  }

  if (!data?.ok) {
    const reason = data?.reason;
    const config = {
      invalid: { icon: AlertCircle, title: 'Link ungültig', text: 'Dieser Link ist ungültig. Bitte wenden Sie sich an die Verwaltung.' },
      expired: { icon: Clock, title: 'Link abgelaufen', text: 'Dieser Link ist nicht mehr gültig (14 Tage). Bitte wenden Sie sich an die Verwaltung für einen neuen Link.' },
      already_answered: { icon: CheckCircle, title: 'Bereits beantwortet', text: 'Dieses Formular wurde bereits ausgefüllt. Vielen Dank!' },
      error: { icon: AlertCircle, title: 'Fehler', text: 'Beim Laden ist ein Fehler aufgetreten. Bitte erneut versuchen.' },
    }[reason || 'error'];

    const Icon = config.icon;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <Icon className="h-10 w-10 mx-auto mb-4 text-primary" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">{config.title}</h1>
          <p className="text-sm text-gray-600">{config.text}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <CheckCircle className="h-10 w-10 mx-auto mb-4 text-green-500" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Vielen Dank!</h1>
          <p className="text-sm text-gray-600">Ihre Rückmeldung wurde erfolgreich übermittelt.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Nachbuchungsbedarf</h1>
          <p className="text-sm text-gray-500 mb-6">
            Hallo {data.dozent_name || ''} — bitte geben Sie uns eine kurze Rückmeldung.
          </p>

          <video
            controls
            preload="metadata"
            src={VIDEO_URL}
            className="w-full rounded-lg mb-6 bg-black"
          />

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 space-y-1 text-sm">
            <p>
              <span className="text-gray-500">Teilnehmer:</span>{' '}
              <span className="font-medium text-gray-900">{data.teilnehmer_name}</span>
            </p>
            <p>
              <span className="text-gray-500">Rechtsgebiet:</span>{' '}
              <span className="font-medium text-gray-900">{data.rechtsgebiet}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <span className={labelClass}>Gibt es Nachbuchungsbedarf?</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: true, label: 'Ja' },
                  { value: false, label: 'Nein' },
                ].map((option) => (
                  <label
                    key={String(option.value)}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm transition-colors ${
                      bedarf === option.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bedarf"
                      checked={bedarf === option.value}
                      onChange={() => setBedarf(option.value)}
                      className="h-4 w-4 text-primary focus:ring-primary"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {bedarf && (
              <>
                <div>
                  <label className={labelClass}>Wie viel Nachbuchungsbedarf (Stunden)?</label>
                  <input
                    type="number"
                    min="0"
                    value={stunden}
                    onChange={(e) => setStunden(e.target.value)}
                    placeholder="z. B. 10"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Wann ist der Teilnehmer erreichbar?</label>
                  <input
                    type="text"
                    value={erreichbar}
                    onChange={(e) => setErreichbar(e.target.value)}
                    placeholder="z. B. Mo–Fr, 9–17 Uhr"
                    className={inputClass}
                  />
                </div>
              </>
            )}

            <div>
              <label className={labelClass}>Weitere Mitteilung (optional)</label>
              <textarea
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                rows={4}
                placeholder="Freitext…"
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Abschicken
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}