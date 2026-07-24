import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart3, Loader2, Star } from 'lucide-react';
import { useDriverShiftsReport } from '@/hooks/useDeliveryOps';

export function DriverShiftsReport() {
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useDriverShiftsReport(
    new Date(start + 'T00:00:00').toISOString(),
    new Date(end + 'T23:59:59').toISOString(),
  );

  const money = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Relatório de Entregadores
        </h3>
        <div className="flex items-center gap-2">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-auto" />
          <span className="text-muted-foreground text-sm">até</span>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-auto" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-2">Entregador</th>
                <th className="p-2 text-center">Turnos</th>
                <th className="p-2 text-center">Entregas</th>
                <th className="p-2 text-right">Horas</th>
                <th className="p-2 text-right">Comissão</th>
                <th className="p-2 text-center">Avaliação</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((r) => (
                <tr key={r.driver_id} className="border-b border-border last:border-0">
                  <td className="p-2 font-medium text-foreground">{r.driver_name}</td>
                  <td className="p-2 text-center">{r.shifts_count}</td>
                  <td className="p-2 text-center">{r.total_deliveries}</td>
                  <td className="p-2 text-right">{Number(r.total_hours).toFixed(1)}h</td>
                  <td className="p-2 text-right">{money(r.total_commission)}</td>
                  <td className="p-2 text-center">
                    {r.avg_rating ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {Number(r.avg_rating).toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {(data || []).length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum dado no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
