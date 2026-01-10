import { useState } from 'react';
import { Package as PackageIcon, Plus, Edit2, Trash2 } from 'lucide-react';
import { Package } from '../../store/salesStore';

interface PackageManagementProps {
  packages: Package[];
  onCreate: (data: Partial<Package>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Package>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function PackageManagement({ packages, onCreate, onUpdate, onDelete }: PackageManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hours: 0,
    price: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await onUpdate(editingId, formData);
      } else {
        await onCreate({ ...formData, is_active: true });
      }
      resetForm();
    } catch (error) {
      console.error('Error saving package:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      hours: 0,
      price: 0,
    });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (pkg: Package) => {
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      hours: pkg.hours,
      price: pkg.price,
    });
    setEditingId(pkg.id);
    setShowForm(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const pricePerHour = (price: number, hours: number) => {
    if (hours === 0) return 0;
    return price / hours;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <PackageIcon className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Pakete</h2>
            <span className="ml-2 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
              {packages.length}
            </span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4 mr-1" />
            Neu
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="z.B. Starter-Paket"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stunden *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preis (€) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Optionale Beschreibung des Pakets..."
                />
              </div>
            </div>
            {formData.hours > 0 && formData.price > 0 && (
              <div className="text-sm text-gray-600">
                Preis pro Stunde: {formatCurrency(pricePerHour(formData.price, formData.hours))}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition"
              >
                {editingId ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {packages.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Keine Pakete vorhanden
          </div>
        ) : (
          packages.map((pkg) => (
            <div key={pkg.id} className="p-4 hover:bg-gray-50 transition">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-gray-900">{pkg.name}</h3>
                    {pkg.is_active ? (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                        Aktiv
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                        Inaktiv
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center text-sm text-gray-600 space-x-4">
                    <span className="font-medium text-primary">{formatCurrency(pkg.price)}</span>
                    <span>{pkg.hours} Stunden</span>
                    <span className="text-gray-400">
                      ({formatCurrency(pricePerHour(pkg.price, pkg.hours))}/Std.)
                    </span>
                  </div>
                  {pkg.description && (
                    <p className="mt-1 text-sm text-gray-500">{pkg.description}</p>
                  )}
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={() => startEdit(pkg)}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition"
                    title="Bearbeiten"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(pkg.id)}
                    className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                    title="Deaktivieren"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
