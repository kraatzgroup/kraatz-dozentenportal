import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, Award, ArrowRight } from 'lucide-react';

export const VbHomePage: React.FC = () => {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-8 sm:py-16 px-4">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">
          Willkommen bei Deiner Video-Klausurbesprechung
        </h1>
        <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto mb-6 sm:mb-8">
          Perfektioniere Deine juristischen Fähigkeiten mit erprobten Sachverhalten 
          und persönlichem Video-Feedback von erfahrenen Dozenten der Akademie Kraatz.
          Einzigartig und modern: Fordere ganz einfach Deine eigene Video-Klausurbesprechung an.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link
            to="/vb/packages"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
          >
            <span>Pakete ansehen</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <BookOpen className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            Erprobte Sachverhalte
          </h3>
          <p className="text-gray-600">
            Wählen aus verschiedenen Rechtsgebieten und erhalte einen passenden Sachverhalt 
            passend zu Deinen Lernzielen und Problemen.
          </p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <Users className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            Persönliches Video-Feedback
          </h3>
          <p className="text-gray-600">
            Erhalte detailliertes Feedback von Deinem erfahrenen Dozenten 
            durch personalisierte Korrektur-Videos.
          </p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <Award className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            Flexible Pakete
          </h3>
          <p className="text-gray-600">
            Profitiere von der einfachen Buchung und unseren Bundle-Paketen.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white rounded-lg p-8">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
          So funktioniert's
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              1
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Paket kaufen</h4>
            <p className="text-sm text-gray-600">
              Wähle ein Paket und erhalte Klausuren für Sachverhalte
            </p>
          </div>
          <div className="text-center">
            <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              2
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Sachverhalt anfordern</h4>
            <p className="text-sm text-gray-600">
              Wähle Rechtsgebiet und Schwerpunkt für Deinen Sachverhalt
            </p>
          </div>
          <div className="text-center">
            <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              3
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Lösung einreichen</h4>
            <p className="text-sm text-gray-600">
              Bearbeite den Sachverhalt und reiche Deine Lösung ein
            </p>
          </div>
          <div className="text-center">
            <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              4
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Feedback erhalten</h4>
            <p className="text-sm text-gray-600">
              Erhalte persönliches Video-Feedback zu Deiner Lösung
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
