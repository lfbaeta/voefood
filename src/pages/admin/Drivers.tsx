import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Bike, Car, Truck, Footprints, Loader2 } from 'lucide-react';
import { useDrivers, useSaveDriver, useDeleteDriver, DeliveryDriver } from '@/hooks/useDrivers';
import { useToast } from '@/hooks/use-toast';
import { DriverSettingsCard } from '@/components/admin/DriverSettingsCard';

const VEHICLE_ICONS: Record<string, any> = {
  motorcycle: Bike,
  bicycle: Bike,
  car: Car,
  foot: Footprints,
};

const VEHICLE_LABELS: Record<string, string> = {
  motorcycle: 'Moto',
  bicycle: 'Bicicleta',
  car: 'Carro',
  foot: 'A pé',
};

const STATUS_LABELS: Record<string, string> = {
  offline: 'Offline',
  available: 'Disponível',
  on_delivery: 'Em entrega',
  returning: 'Retornando',
  paused: 'Pausado',
};

const STATUS_VARIANTS: Record<string, any> = {
  offline: 'secondary',
  available: 'default',
  on_delivery: 'default',
  returning: 'secondary',
  paused: 'outline',
};

const EMPTY: Partial<DeliveryDriver> = {
  name: '',
  phone: '',
  cpf: '',
  vehicle_type: 'motorcycle',
  vehicle_plate: '',
  vehicle_model: '',
  pin: '',
  is_active: true,
  commission_type: 'fixed',
  commission_value: 5,
  pix_key: '',
};

export default function AdminDrivers() {
  const { data: drivers = [], isLoading } = useDrivers();
  const save = useSaveDriver();
  const del = useDeleteDriver();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (d: DeliveryDriver) => {
    setForm(d);
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name?.trim() || !form.phone?.trim() || !form.pin?.trim()) {
      toast({ title: 'Preencha nome, telefone e PIN', variant: 'destructive' });
      return;
    }
    if (!/^\d{4,6}$/.test(form.pin)) {
      toast({ title: 'PIN deve ter 4 a 6 dígitos', variant: 'destructive' });
      return;
    }
    try {
      await save.mutateAsync(form);
      toast({ title: 'Entregador salvo' });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    }
  };

  const remove = async (d: DeliveryDriver) => {
    if (!confirm(`Excluir entregador "${d.name}"?`)) return;
    try {
      await del.mutateAsync(d.id);
      toast({ title: 'Entregador excluído' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <AdminLayout title="Entregadores">
      <DriverSettingsCard />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Equipe de entregadores</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre os motoboys e entregadores que fazem parte da sua operação.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Novo entregador
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : drivers.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <p className="text-muted-foreground mb-4">Nenhum entregador cadastrado</p>
          <Button onClick={openNew} variant="outline">
            <Plus className="h-4 w-4 mr-2" /> Cadastrar primeiro entregador
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((d) => {
            const Icon = VEHICLE_ICONS[d.vehicle_type] || Truck;
            return (
              <div key={d.id} className="bg-card rounded-xl p-4 shadow-card border border-border">
                <div className="flex items-start gap-3">
                  {d.photo_url ? (
                    <img src={d.photo_url} alt={d.name} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Icon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.phone}</p>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        <Icon className="h-3 w-3 mr-1" />
                        {VEHICLE_LABELS[d.vehicle_type]}
                      </Badge>
                      <Badge variant={STATUS_VARIANTS[d.status]} className="text-xs">
                        {STATUS_LABELS[d.status]}
                      </Badge>
                      {!d.is_active && <Badge variant="destructive" className="text-xs">Inativo</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
                  <p>PIN: <span className="font-mono font-semibold text-foreground">{d.pin}</span></p>
                  <p>
                    Comissão: {d.commission_type === 'percent' ? `${d.commission_value}%` :
                      d.commission_type === 'per_km' ? `R$ ${d.commission_value.toFixed(2)}/km` :
                      `R$ ${d.commission_value.toFixed(2)}/entrega`}
                  </p>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(d)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(d)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar entregador' : 'Novo entregador'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Telefone / WhatsApp *</Label>
                <Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>CPF</Label>
                <Input value={form.cpf || ''} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              </div>
              <div>
                <Label>URL da foto</Label>
                <Input value={form.photo_url || ''} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
              </div>
              <div>
                <Label>PIN de acesso *</Label>
                <Input maxLength={6} value={form.pin || ''} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} />
              </div>
              <div>
                <Label>Veículo</Label>
                <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorcycle">Moto</SelectItem>
                    <SelectItem value="bicycle">Bicicleta</SelectItem>
                    <SelectItem value="car">Carro</SelectItem>
                    <SelectItem value="foot">A pé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Placa</Label>
                <Input value={form.vehicle_plate || ''} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })} />
              </div>
              <div>
                <Label>Modelo</Label>
                <Input value={form.vehicle_model || ''} onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })} />
              </div>
              <div>
                <Label>Tipo de comissão</Label>
                <Select value={form.commission_type} onValueChange={(v) => setForm({ ...form, commission_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Valor fixo / entrega</SelectItem>
                    <SelectItem value="percent">% do pedido</SelectItem>
                    <SelectItem value="per_km">Por km</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor</Label>
                <Input type="number" step="0.01" value={form.commission_value ?? 0} onChange={(e) => setForm({ ...form, commission_value: Number(e.target.value) })} />
              </div>
              <div className="col-span-2">
                <Label>Chave PIX (para pagamento)</Label>
                <Input value={form.pix_key || ''} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
