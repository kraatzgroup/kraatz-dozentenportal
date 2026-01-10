import { useState } from 'react';
import { TrendingUp, Check, X, Plus, Euro } from 'lucide-react';
import { Upsell, Package } from '../../store/salesStore';

interface UpsellOpportunitiesProps {
  upsells: Upsell[];
  packages: Package[];
  onUpdate: (id: string, data: Partial<Upsell>) => Promise<void>;
  onCreate: (data: Partial<Upsell>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function UpsellOpportunities({ upsells, packages, onUpdate, onCreate }: UpsellOpportunitiesProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    teilnehmer_id: '',
    teilnehmer_name: '',
    new_package_id: '',
    additional_hours: 0,
    additional_amount: 0,
    notes: '',
  });

  const proposedUpsells = upsells.filter(u => u.status === 'proposed');
  const acceptedUpsells = upsells.filter(u => u.status === 'accepted');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proposed': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'proposed': return 'Vorgeschlagen';
      case 'accepted': return 'Akzeptiert';
      case 'declined': return 'Abgelehnt';
      default: return status;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreate({
        ...formData,
        status: 'proposed',
        upsell_date: new Date().toISOString().split('T')[0],
      });
      resetForm();
    } catch (error) {
      console.error('Error creating upsell:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      teilnehmer_id: '',
      teilnehmer_name: '',
      new_package_id: '',
      additional_hours: 0,
      additional_amount: 0,
      notes: '',
    });
    setShowForm(false);
  };

  const updateStatus = async (id: string, status: Upsell['status']) => {
    await onUpdate(id, { status });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handlePackageSelect = (packageId: string) => {
    const selectedPackage = packages.find(p => p.id === packageId);
    if (selectedPackage) {
      setFormData({
        ...formData,
        new_package_id: packageId,
        additional_hours: selectedPackage.hours,
        additional_amount: selectedPackage.price,
      });
    }
  };

  const totalPotential = proposedUpsells.reduce((sum, u) => sum + Number(u.additional_amount), 0);
  const totalAccepted = acceptedUpsells.reduce((sum, u) => sum + Number(u.additional_amount), 0);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Upsell-Möglichkeiten</h2>
            {proposedUpsells.length > 0 && (
              <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                {proposedUpsells.length} offen
              </span>
            )}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Plus className="h-4 w-4 mr-1" />
            Neu
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-xs text-yellow-600">Potenzial (offen)</p>
            <p className="text-lg font-bold text-yellow-700">{formatCurrency(totalPotential)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600">Akzeptiert</p>
            <p className="text-lg font-bold text-green-700">{formatCurrency(totalAccepted)}</p>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teilnehmer Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.teilnehmer_name}
                  onChange={(e) => setFormData({ ...formData, teilnehmer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Neues Paket
                </label>
                <select
                  value={formData.new_package_id}
                  onChange={(e) => handlePackageSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Paket wählen...</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - {pkg.hours} Std. - {formatCurrency(pkg.price)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zusätzliche Stunden
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.additional_hours}
                  onChange={(e) => setFormData({ ...formData, additional_hours: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zusätzlicher Betrag (€)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.additional_amount}
                  onChange={(e) => setFormData({ ...formData, additional_amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notizen
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
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
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Erstellen
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {proposedUpsells.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Keine offenen Upsell-Möglichkeiten
          </div>
        ) : (
          proposedUpsells.map((upsell) => (
            <div key={upsell.id} className="p-4 hover:bg-gray-50 transition">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-gray-900 truncate">
                      {upsell.teilnehmer_name}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(upsell.status)}`}>
                      {getStatusLabel(upsell.status)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center text-sm text-gray-600 space-x-3">
                    <span className="flex items-center">
                      <Euro className="h-3 w-3 mr-1" />
                      {formatCurrency(upsell.additional_amount)}
                    </span>
                    <span>+{upsell.additional_hours} Stunden</span>
                  </div>
                  {upsell.notes && (
                    <p className="mt-1 text-sm text-gray-500">{upsell.notes}</p>
                  )}
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={() => updateStatus(upsell.id, 'accepted')}
                    className="p-1.5 text-green-600 hover:bg-green-100 rounded transition"
                    title="Akzeptiert"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => updateStatus(upsell.id, 'declined')}
                    className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                    title="Abgelehnt"
                  >
                    <X className="h-4 w-4" />
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
