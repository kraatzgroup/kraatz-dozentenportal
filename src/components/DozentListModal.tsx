import { useState } from 'react';
import { X, Users, Mail, Phone, Scale } from 'lucide-react';

interface Dozent {
  id: string;
  full_name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  legal_areas?: string[] | null;
}

interface DozentListModalProps {
  dozenten: Dozent[];
  onClose: () => void;
  onEdit?: (dozent: Dozent) => void;
}

export function DozentListModal({ dozenten, onClose, onEdit }: DozentListModalProps) {
  const [filter, setFilter] = useState<'alle' | 'Zivilrecht' | 'Strafrecht' | 'Öffentliches Recht'>('alle');

  const filteredDozenten = dozenten.filter(d => {
    if (filter === 'alle') return true;
    return d.legal_areas && d.legal_areas.includes(filter);
  });

  const getCountByArea = (area: string) => {
    return dozenten.filter(d => d.legal_areas && d.legal_areas.includes(area)).length;
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-primary mr-2" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Dozenten Übersicht</h2>
              <p className="text-sm text-gray-500">{dozenten.length} Dozenten insgesamt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pt-4 pb-2 border-b bg-white">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('alle')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'alle'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Alle ({dozenten.length})
            </button>
            <button
              onClick={() => setFilter('Zivilrecht')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'Zivilrecht'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Zivilrecht ({getCountByArea('Zivilrecht')})
            </button>
            <button
              onClick={() => setFilter('Strafrecht')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'Strafrecht'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              Strafrecht ({getCountByArea('Strafrecht')})
            </button>
            <button
              onClick={() => setFilter('Öffentliches Recht')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'Öffentliches Recht'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              Öffentliches Recht ({getCountByArea('Öffentliches Recht')})
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {filteredDozenten.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Scale className="h-12 w-12 mb-3 text-gray-300" />
              <p>Keine Dozenten für dieses Rechtsgebiet</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Rechtsgebiete
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Kontakt
                  </th>
                  {onEdit && (
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aktion
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDozenten.map((dozent) => (
                  <tr key={dozent.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-medium text-sm">
                            {dozent.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {dozent.title && <span className="text-gray-500">{dozent.title} </span>}
                            {dozent.full_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {dozent.legal_areas && dozent.legal_areas.length > 0 ? (
                          dozent.legal_areas.map((area, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                area === 'Zivilrecht' ? 'bg-blue-100 text-blue-800' :
                                area === 'Strafrecht' ? 'bg-red-100 text-red-800' :
                                'bg-green-100 text-green-800'
                              }`}
                            >
                              {area === 'Zivilrecht' ? 'ZR' : area === 'Strafrecht' ? 'SR' : 'ÖR'}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-xs text-gray-500 space-y-0.5">
                        {dozent.email && (
                          <div className="flex items-center">
                            <Mail className="h-3 w-3 mr-1.5 text-gray-400" />
                            <a href={`mailto:${dozent.email}`} className="hover:text-primary truncate max-w-[200px]">
                              {dozent.email}
                            </a>
                          </div>
                        )}
                        {dozent.phone && (
                          <div className="flex items-center">
                            <Phone className="h-3 w-3 mr-1.5 text-gray-400" />
                            <a href={`tel:${dozent.phone}`} className="hover:text-primary">
                              {dozent.phone}
                            </a>
                          </div>
                        )}
                        {!dozent.email && !dozent.phone && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    {onEdit && (
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => onEdit(dozent)}
                          className="text-primary hover:text-primary/80 text-sm font-medium"
                        >
                          Bearbeiten
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
