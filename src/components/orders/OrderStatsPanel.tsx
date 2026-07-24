import { Package, DollarSign, CheckCircle2, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: string;
  icon: typeof Package;
  trend?: string;
  color: string;
}

function StatsCard({ title, value, icon: Icon, trend, color }: StatsCardProps) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{value}</p>
            {trend && (
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{trend}</span>
              </p>
            )}
          </div>
          <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface OrderStatsPanelProps {
  stats: {
    totalOrders: number;
    totalRevenue: number;
    completedOrders: number;
    avgOrderValue: number;
  };
  formatCurrency: (value: number) => string;
}

export function OrderStatsPanel({ stats, formatCurrency }: OrderStatsPanelProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
      <StatsCard title="Total Pedidos" value={stats.totalOrders.toString()} icon={Package} color="bg-primary" />
      <StatsCard title="Receita" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} color="bg-green-500" />
      <StatsCard title="Finalizados" value={stats.completedOrders.toString()} icon={CheckCircle2} color="bg-blue-500" />
      <StatsCard title="Ticket Médio" value={formatCurrency(stats.avgOrderValue)} icon={TrendingUp} color="bg-purple-500" />
    </div>
  );
}
