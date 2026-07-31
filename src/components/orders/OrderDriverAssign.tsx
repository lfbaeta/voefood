import { useState } from 'react';
import { Bike, Loader2, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useDrivers, useAssignDriver } from '@/hooks/useDrivers';
import { useSuggestNearestDriver } from '@/hooks/useDeliveryOps';

interface Props {
  orderId: number;
  currentDriverId: string | null;
  currentDriverStatus: string | null;
}

export function OrderDriverAssign({ orderId, currentDriverId, currentDriverStatus }: Props) {
  const { data: drivers } = useDrivers();
  const assign = useAssignDriver();
  const suggest = useSuggestNearestDriver();
  const [selected, setSelected] = useState<string>(currentDriverId || '');

  const current = drivers?.find((d) => d.id === currentDriverId);

  const handleAssign = async (id: string) => {
    if (!id) return;
    try {
      await assign.mutateAsync({ orderId, driverId: id });
      toast.success('Entregador atribuído');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atribuir');
    }
  };

  const handleSuggest = async () => {
    try {
      const result = await suggest.mutateAsync(orderId);
      if (!result || result.length === 0) {
        toast.warning('Nenhum entregador disponível no momento');
        return;
      }
      const best = result[0];
      setSelected(best.driver_id);
      await handleAssign(best.driver_id);
      toast.success(
        `${best.driver_name}${best.distance_km ? ` (${best.distance_km} km)` : ''} atribuído automaticamente`,
      );
    } catch (e: any) {
      toast.error(e.message || 'Erro ao sugerir entregador');
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm text-muted-foreground">ENTREGADOR</h3>
      {current ? (
        <div className="flex items-center gap-2 rounded-lg border border-border p-2">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            {current.photo_url ? (
              <img src={current.photo_url} className="h-9 w-9 rounded-full object-cover" alt="" />
            ) : (
              <User className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{current.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {current.vehicle_type}
              {currentDriverStatus && ` · ${currentDriverStatus}`}
            </p>
          </div>
          <Badge variant="secondary">Atribuído</Badge>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Bike className="h-4 w-4" /> Nenhum entregador atribuído
        </p>
      )}

      <div className="flex gap-2">
        <Select
          value={selected}
          onValueChange={(v) => {
            setSelected(v);
            handleAssign(v);
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Escolher entregador…" />
          </SelectTrigger>
          <SelectContent>
            {(drivers || [])
              .filter((d) => d.is_active)
              .map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} · {d.status}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSuggest}
          disabled={suggest.isPending || assign.isPending}
        >
          {suggest.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <><Sparkles className="h-4 w-4 mr-1" /> Sugerir</>
          )}
        </Button>
      </div>
    </div>
  );
}
