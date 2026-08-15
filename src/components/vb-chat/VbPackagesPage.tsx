import React, { useState, useEffect, useMemo } from 'react';
import { Check, CreditCard, ChevronDown, ChevronUp, Loader2, Mail, User as UserIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

interface VbPackage {
  id: string;
  package_key: string;
  name: string;
  description: string;
  case_study_count: number;
  price_cents: number;
  stripe_price_id: string;
  active: boolean;
  popular?: boolean;
  isIntro?: boolean;
  savingsCents?: number;
}

const EMAIL_STORAGE_KEY = 'vb_checkout_email';

export const VbPackagesPage: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const fullName = useAuthStore(state => state.fullName);

  const [packages, setPackages] = useState<VbPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [guestEmail, setGuestEmail] = useState<string>(() => {
    try {
      return localStorage.getItem(EMAIL_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [guestName, setGuestName] = useState<string>('');

  // Bereits gekaufte Pakete (nur für eingeloggte User prüfbar)
  const [purchasedPackageKeys, setPurchasedPackageKeys] = useState<Set<string>>(new Set());
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isLoggedIn = !!user;
  const checkoutEmail = user?.email ?? guestEmail.trim();

  // Erfolg/Abruch-Status aus der URL auslesen
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      setSuccessMessage(
        'Zahlung erfolgreich! Deine Credits werden in Kürze gutgeschrieben.' +
        (isLoggedIn ? '' : ' Du erhältst zusätzlich eine E-Mail mit Deinem Portal-Zugang.')
      );
      // Status-Parameter aus der URL entfernen (Refresh soll nichts erneut anzeigen)
      const url = new URL(window.location.href);
      url.searchParams.delete('status');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
    } else if (status === 'cancelled') {
      setErrorMessage('Der Kauf wurde abgebrochen. Du kannst es jederzeit erneut versuchen.');
      const url = new URL(window.location.href);
      url.searchParams.delete('status');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const { data, error } = await supabase
          .from('vb_packages')
          .select('*')
          .eq('active', true)
          .order('case_study_count', { ascending: true });

        if (error) throw error;

        const decorated = (data || []).map((pkg: VbPackage) => ({
          ...pkg,
          popular: pkg.package_key === '10er',
          isIntro: pkg.package_key === 'neukunden',
        }));

        // Ersparnis relativ zum Basispaket (teuerstes Paket pro Klausur = 5er Paket)
        const regularPackagesRaw = decorated.filter(p => !p.isIntro);
        const baselinePerCreditCents = regularPackagesRaw.length > 0
          ? Math.max(...regularPackagesRaw.map(p => p.price_cents / p.case_study_count))
          : 0;

        const withSavings = decorated.map((pkg) => {
          const regularPriceCents = Math.round(pkg.case_study_count * baselinePerCreditCents);
          return {
            ...pkg,
            savingsCents: Math.max(regularPriceCents - pkg.price_cents, 0),
          };
        });
        setPackages(withSavings);
      } catch (error) {
        console.error('Error fetching VB packages:', error);
        setErrorMessage('Pakete konnten nicht geladen werden. Bitte Seite neu laden.');
      } finally {
        setLoading(false);
      }
    };

    const fetchPurchases = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('vb_orders')
          .select('package_id, status')
          .eq('profile_id', user.id)
          .eq('status', 'completed');
        if (error) throw error;

        const completedPackageIds = (data || []).map(o => o.package_id);
        if (completedPackageIds.length === 0) return;

        const { data: purchasedPkgs } = await supabase
          .from('vb_packages')
          .select('id, package_key')
          .in('id', completedPackageIds);
        setPurchasedPackageKeys(
          new Set((purchasedPkgs || []).map(p => p.package_key))
        );
      } catch (error) {
        console.error('Error fetching purchases:', error);
      }
    };

    fetchPackages();
    fetchPurchases();
  }, [user]);

  const introPackage = useMemo(() => packages.find(p => p.isIntro), [packages]);
  const regularPackages = useMemo(() => packages.filter(p => !p.isIntro), [packages]);

  const faqData = [
    {
      question: "Wie funktioniert das Klausur-System?",
      answer: "Du erhältst nach erfolgreicher Buchung einen Link mit einem Zugang zu unserem Dashboard. Hier kannst Du Dich mit Deiner Buchungs-Mail einloggen und siehst Dein gebuchtest Kontingent im Dashboard. Du definierst, welche Klausuren Du erhalten willst und bekommst Deinen Sachverhalt direkt im Dashboard zur Verfügung gestellt. Unser Anspruch ist es, Dir eine übersichtliche Darstellung Deiner Klausurergebnisse zu liefern."
    },
    {
      question: "Wie läuft die Bearbeitung ab?",
      answer: "Du definierst Rechtsgebiet, Teilgebiet und Problemschwerpunkt für jede gebuchte Klausur. Anschließend wählen unsere Dozenten Deine Klausur aus und stelle Dir diese zur Verfügung. Du kannst nun mit der Bearbeitung beginnen und im Anschluss die Dateien als Word- oder PDF-Datei hochladen. Innerhalb von 48 Stunden erhältst Du Deine Korrektur mit wertvollen Tipps von Deinem Dozenten."
    },
    {
      question: "Muss ich alle Klausuren direkt anfordern?",
      answer: "Nein, Du kannst die Klausuren nacheinander bearbeiten und ein Rechtsgebiet auswählen. So bist Du absolut flexibel in Deiner Planung!"
    },
    {
      question: "Wann erhalte ich meine Videoklausurenkorrektur?",
      answer: "Innerhalb von 48 Stunden stellen Dir unsere Dozenten die Klausurbearbeitung als Video-Datei zur Verfügung."
    },
    {
      question: "Kann ich besondere Wünsche mitteilen?",
      answer: "Klar! Du definierst in erster Linie das Rechtsgebeit und das Teilrechtsgebiet. Im Anschluss kannst Du einen Problemschwerpunkt pro Klausur mitteilen. Somit kann Deine Anforderung wie folgt aussehen: Zivilrecht, BGB AT, Stellvertretung. Alternativ kannst Du Dich auch überraschen lassen und eine beliebige Klausur von Deinem Dozenten erhalten."
    },
    {
      question: "Welche Zahlungsmethoden werden akzeptiert?",
      answer: "Du kannst bei uns mit allen gängigen Zahlungsmethoden bezahlen: Kreditkarte, PayPal, Klarna, Google-Pay, Apple-Pay und Sofort-Überweisung"
    }
  ];

  const handlePurchase = async (pkg: VbPackage) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const email = checkoutEmail;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage('Bitte gib eine gültige E-Mail-Adresse an – unter dieser E-Mail erhältst Du Deinen Portal-Zugang.');
      return;
    }

    setProcessingPayment(pkg.id);

    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          email: isLoggedIn ? undefined : email,
          priceId: pkg.stripe_price_id,
          fullName: isLoggedIn ? (fullName ?? undefined) : (guestName.trim() || undefined),
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        // E-Mail für Gäste merken
        if (!isLoggedIn) {
          try {
            localStorage.setItem(EMAIL_STORAGE_KEY, email);
          } catch {
            // ignore storage errors
          }
        }
        window.location.href = data.url;
      } else if (data?.error) {
        setErrorMessage(data.error);
      } else {
        setErrorMessage('Unbekannte Antwort vom Checkout-Server. Bitte erneut versuchen.');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setErrorMessage('Fehler beim Erstellen der Checkout-Session. Bitte versuche es erneut.');
    } finally {
      setProcessingPayment(null);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Pakete werden geladen...</span>
      </div>
    );
  }

  const renderPackageCard = (pkg: VbPackage) => {
    const isProcessing = processingPayment === pkg.id;

    return (
      <div
        key={pkg.id}
        className={`bg-white rounded-lg shadow-lg p-6 relative flex flex-col ${
          pkg.popular ? 'ring-2 ring-blue-600 transform scale-105' : ''
        }`}
      >
        {pkg.popular && (
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
            <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
              Beliebteste Wahl
            </span>
          </div>
        )}

        <div className="text-center flex flex-col flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {pkg.name}
          </h3>
          <p className="text-gray-600 mb-4">
            {pkg.isIntro
              ? 'Deine erste Korrektur zum Kennenlernen – ohne Risiko, ohne Abo.'
              : pkg.description}
          </p>

          <div className="mb-6">
            <span className="text-3xl font-bold text-blue-600">
              €{(pkg.price_cents / 100).toLocaleString('de-DE')}
            </span>
            <span className="text-gray-600 ml-2">
              für {pkg.case_study_count} {pkg.case_study_count === 1 ? 'Klausur' : 'Klausuren'}
            </span>
            {!!pkg.savingsCents && pkg.savingsCents > 0 && (
              <div className="mt-1">
                <span className="inline-block text-sm font-semibold text-green-600">
                  Du sparst €{(pkg.savingsCents / 100).toLocaleString('de-DE')}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2 mb-6 text-left">
            <div className="flex items-start space-x-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 text-sm">
                {pkg.case_study_count} {pkg.case_study_count === 1 ? 'ausgewählter Sachverhalt' : 'ausgewählte Sachverhalte'}
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 text-sm">
                Persönliches Videofeedback innerhalb von 48 Stunden von einem Fach-Dozenten der Akademie Kraatz
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 text-sm">
                Alle Rechtsgebiete verfügbar
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 text-sm">
                Problemschwerpunkte können vorab mitgeteilt werden
              </span>
            </div>
          </div>

          <div className="mt-auto">
            <button
              onClick={() => handlePurchase(pkg)}
              disabled={isProcessing}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                pkg.popular
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Weiterleitung...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>{user ? 'Jetzt kaufen' : 'Jetzt durchstarten!'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Wähle Dein Klausur-Paket
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Spare mit unseren Bundlen und erlebe den maximalen Erfolg in Deiner Klausurpraxis!
        </p>
      </div>

      {successMessage && (
        <div className="max-w-4xl mx-auto bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="max-w-4xl mx-auto bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Gast-E-Mail-Eingabe (eingeloggte User sind bereits zugeordnet) */}
      {!user && (
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Deine Buchungs-E-Mail
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Unter dieser E-Mail erhältst Du nach dem Kauf Deinen Portal-Zugang und siehst dort Dein Kontingent.
            Schon Kunde? Dann nutze einfach Deine bereits registrierte E-Mail – Deine Credits werden dem
            bestehenden Konto gutgeschrieben.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="E-Mail-Adresse"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Vor- und Nachname (optional)"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {/* Neukunden-Angebot nur zeigen, solange es noch nicht genutzt wurde */}
        {introPackage && !purchasedPackageKeys.has('neukunden') && renderPackageCard(introPackage)}
        {regularPackages.map(renderPackageCard)}
      </div>

      <div className="bg-white rounded-lg p-6 max-w-4xl mx-auto">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">
          Häufig gestellte Fragen
        </h3>
        <div className="space-y-4">
          {faqData.map((faq, index) => (
            <div key={index} className="border-b border-gray-200 pb-4">
              <button
                onClick={() => toggleFaq(index)}
                className="w-full flex justify-between items-center text-left py-2 hover:text-blue-600 transition-colors"
              >
                <h4 className="font-medium text-gray-900">
                  {faq.question}
                </h4>
                {openFaq === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </button>
              {openFaq === index && (
                <div className="mt-3 text-gray-600 text-sm leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
