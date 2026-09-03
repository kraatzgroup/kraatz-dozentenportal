import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Logo } from './Logo';

type AGBBlock =
  | { type: 'title' | 'heading' | 'subheading' | 'paragraph' | 'item' | 'subitem'; text: string }
  | { type: 'table'; rows: string[][] };

/**
 * Öffentliche AGB-Seite (/agbs). Der Inhalt liegt als strukturiertes JSON in
 * public/agb-content.json und wird mit scripts/extract-agb-content.py aus dem
 * AGB-PDF erzeugt.
 */
export function AGBPage() {
  const [blocks, setBlocks] = useState<AGBBlock[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = 'AGB – Kraatz Club';
    fetch('/agb-content.json')
      .then(res => res.json())
      .then(data => setBlocks(data.blocks ?? []))
      .catch(() => setError(true));
  }, []);

  // Die Seite wird i.d.R. in einem neuen Tab geöffnet (dann gibt es keine
  // History) und kann ausgeloggt außerhalb des Routers gerendert werden –
  // daher bewusst ohne useNavigate.
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = '/dashboard';
  };

  return (
    <div className="flex-1 bg-white">
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-3">
          <button
            onClick={goBack}
            title="Zurück"
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Logo />
          <h1 className="text-sm sm:text-base font-semibold text-gray-900">
            Allgemeine Geschäftsbedingungen
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {error ? (
          <p className="text-gray-500 text-center py-12">AGB konnten nicht geladen werden.</p>
        ) : !blocks ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="text-gray-800">
            {blocks.map((block, i) => {
              switch (block.type) {
                case 'title':
                  return (
                    <h2 key={i} className="text-xl font-bold text-gray-900 mb-8 leading-snug">
                      {block.text}
                    </h2>
                  );
                case 'heading':
                  return (
                    <h3 key={i} className="text-base font-bold text-gray-900 mt-8 mb-2">
                      {block.text}
                    </h3>
                  );
                case 'subheading':
                  return (
                    <h4 key={i} className="text-sm font-semibold text-gray-900 mt-6 mb-2">
                      {block.text}
                    </h4>
                  );
                case 'item':
                  return (
                    <p key={i} className="text-sm leading-relaxed mb-2 pl-4">
                      {block.text}
                    </p>
                  );
                case 'subitem':
                  return (
                    <p key={i} className="text-sm leading-relaxed mb-2 pl-10">
                      {block.text}
                    </p>
                  );
                case 'table':
                  return (
                    <div key={i} className="my-4 overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <tbody>
                          {block.rows.map((row, r) => (
                            <tr key={r}>
                              {row.map((cell, c) => (
                                <td
                                  key={c}
                                  className={`border border-gray-300 px-3 py-2 align-top ${
                                    r === 0 ? 'font-semibold bg-gray-50' : ''
                                  }`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                default:
                  return (
                    <p key={i} className="text-sm leading-relaxed mb-3">
                      {block.text}
                    </p>
                  );
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
}
