import { TrendingUp, TrendingDown, Phone, Users, Target, Euro, CheckCircle, FileText } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

function KPICard({ title, value, subtitle, icon, trend, trendValue, color = 'blue' }: KPICardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className={`p-2 sm:p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        {trend && trendValue && (
          <div className={`flex items-center text-xs sm:text-sm ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
          }`}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> : 
             trend === 'down' ? <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> : null}
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-3 sm:mt-4">
        <h3 className="text-xs sm:text-sm font-medium text-gray-500">{title}</h3>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && (
          <p className="text-xs sm:text-sm text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

interface SalesKPICardsProps {
  totalCalls: number;
  closedTotal: number;
  closeRate: number;
  totalRevenue: number;
  avgDealSize: number;
  pendingFinalgespraeche: number;
  upcomingTrials: number;
}

export function SalesKPICards({
  totalCalls,
  closedTotal,
  closeRate,
  totalRevenue,
  avgDealSize,
  pendingFinalgespraeche,
  upcomingTrials,
}: SalesKPICardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <KPICard
        title="Termine"
        value={totalCalls}
        icon={<Phone className="h-5 w-5 sm:h-6 sm:w-6" />}
        color="blue"
      />
      <KPICard
        title="Closed Total"
        value={closedTotal}
        subtitle="Abgeschlossene Deals"
        icon={<CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />}
        color="blue"
      />
      <KPICard
        title="Abschlussrate"
        value={`${closeRate.toFixed(1)}%`}
        subtitle="Erfolgreiche Abschlüsse"
        icon={<Target className="h-5 w-5 sm:h-6 sm:w-6" />}
        color="blue"
      />
      <KPICard
        title="Gesamtumsatz"
        value={formatCurrency(totalRevenue)}
        subtitle={`Ø ${formatCurrency(avgDealSize)} pro Abschluss`}
        icon={<Euro className="h-5 w-5 sm:h-6 sm:w-6" />}
        color="blue"
      />
      <KPICard
        title="Finalgespräche"
        value={pendingFinalgespraeche}
        icon={<FileText className="h-5 w-5 sm:h-6 sm:w-6" />}
        color="red"
      />
      <KPICard
        title="Anstehende Probestunden"
        value={upcomingTrials}
        icon={<Users className="h-5 w-5 sm:h-6 sm:w-6" />}
        color="blue"
      />
    </div>
  );
}
