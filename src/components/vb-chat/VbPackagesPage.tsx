import React, { useState, useEffect } from 'react';
import { Check, CreditCard, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
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
}

export const VbPackagesPage: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [packages, setPackages] = useState<VbPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const { data, error } = await supabase
          .from('vb_packages')
          .select('*')
          .eq('active', true)
          .order('case_study_count', { ascending: true });

        if (error) throw error;

        const packagesWithPopular = (data || []).map((pkg: VbPackage) => ({
          ...pkg,
          popular: pkg.package_key === '10er'
        }));
        setPackages(packagesWithPopular);
      } catch (error) {
        console.error('Error fetching VB packages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

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

  const handlePurchase = async (packageId: string) => {
    setProcessingPayment(packageId);
    
    try {
      // TODO: Implement Stripe checkout integration
      alert('Checkout-Integration wird noch migriert. Bitte kontaktieren Sie support@kraatz-group.de für Buchungen.');
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Fehler beim Erstellen der Checkout-Session. Bitte versuchen Sie es erneut.');
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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className={`bg-white rounded-lg shadow-lg p-6 relative ${
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

            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {pkg.name}
              </h3>
              <p className="text-gray-600 mb-4">
                {pkg.description}
              </p>

              <div className="mb-6">
                <span className="text-3xl font-bold text-blue-600">
                  €{(pkg.price_cents / 100).toLocaleString('de-DE')}
                </span>
                <span className="text-gray-600 ml-2">
                  für {pkg.case_study_count} Klausuren
                </span>
              </div>

              <div className="space-y-2 mb-6 text-left">
                <div className="flex items-start space-x-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 text-sm">
                    {pkg.case_study_count} ausgewählte Sachverhalte
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

              <button
                onClick={() => handlePurchase(pkg.id)}
                disabled={processingPayment === pkg.id}
                className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  pkg.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
                }`}
              >
                {processingPayment === pkg.id ? (
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
        ))}
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
