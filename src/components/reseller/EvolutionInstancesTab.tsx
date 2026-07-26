import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useResellerRestaurants } from '@/hooks/useReseller';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, QrCode, RefreshCw, Power, Trash2, Star, Webhook, Send } from 'lucide-react';
import { QrCodeImage } from '@/components/whatsapp/QrCodeImage';
import { getFunctionErrorMessage } from '@/lib/functionErrors';

type Instance = {
  id: string;
  restaurant_id: string;
  instance_name: string;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  is_default: boolean;
  last_connected_at: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    connected: { label: 'Conectado', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    waiting_qr: { label: 'Aguardando QR', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    disconnected: { label: 'Desconectado', cls: 'bg-muted text-muted-foreground' },
  };
  const s = map[status] ?? map.disconnected;
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}

export function EvolutionInstancesTab() {
  const { toast } = useToast();
  const { data: restaurants = [], isLoading: loadingRest } = useResellerRestaurants();
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [instances, setInstances] = useState<Instance[]>([]);
  const [limit, setLimit] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrInstance, setQrInstance] = useState<Instance | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testInstance, setTestInstance] = useState<Instance | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    if (!restaurantId && restaurants[0]) setRestaurantId(restaurants[0].id);
  }, [restaurants, restaurantId]);

  async function load() {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('evolution-proxy', {
      body: { action: 'list_instances', restaurant_id: restaurantId },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: 'Erro', description: await getFunctionErrorMessage(data, error, 'Não foi possível carregar as instâncias.'), variant: 'destructive' });
      return;
    }
    setInstances((data?.instances || []) as Instance[]);
    setLimit(data?.limit ?? 1);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [restaurantId]);

  // Realtime updates
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`evo-inst-${restaurantId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'evolution_instances',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line
  }, [restaurantId]);

  async function call(action: string, body: Record<string, unknown> = {}, id?: string) {
    if (id) setBusyId(id);
    const { data, error } = await supabase.functions.invoke('evolution-proxy', {
      body: { action, ...body },
    });
    if (id) setBusyId(null);
    if (error || data?.error) {
      const description = await getFunctionErrorMessage(data, error, 'A Evolution não concluiu a ação.');
      toast({ title: 'Erro', description, variant: 'destructive' });
      return null;
    }
    return data;
  }

  async function handleCreate() {
    if (!createName.trim() || !restaurantId) return;
    setCreating(true);
    const res = await call('create_instance', { restaurant_id: restaurantId, instance_name: createName });
    setCreating(false);
    if (res) {
      toast({ title: 'Instância criada' });
      setCreateOpen(false);
      setCreateName('');
      load();
    }
  }

  async function handleConnect(inst: Instance) {
    setQrInstance(inst);
    setQrOpen(true);
    setQrCode(null);
    setQrLoading(true);
    const res = await call('connect_instance', { instance_id: inst.id });
    setQrLoading(false);
    if (!res) {
      // erro já notificado por call(); fecha o dialog para não mostrar estado vazio
      setQrOpen(false);
      return;
    }
    if (res.connected || res.already_connected) {
      toast({ title: res.already_connected ? 'WhatsApp já conectado' : 'Conectado!' });
      setQrOpen(false);
      load();
      return;
    }
    if (res.qr_code) setQrCode(res.qr_code);
  }

  // Poll while QR dialog is open
  useEffect(() => {
    if (!qrOpen || !qrInstance) return;
    const t = setInterval(async () => {
      const { data } = await supabase
        .from('evolution_instances')
        .select('status, qr_code')
        .eq('id', qrInstance.id)
        .maybeSingle();
      if (data?.status === 'connected') {
        toast({ title: 'WhatsApp conectado!' });
        setQrOpen(false);
        load();
      } else if (data?.qr_code && data.qr_code !== qrCode) {
        setQrCode(data.qr_code);
      }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [qrOpen, qrInstance, qrCode]);

  async function handleDisconnect(inst: Instance) {
    if (await call('disconnect_instance', { instance_id: inst.id }, inst.id)) {
      toast({ title: 'Desconectado' });
      load();
    }
  }

  async function handleDelete(inst: Instance) {
    if (await call('delete_instance', { instance_id: inst.id }, inst.id)) {
      toast({ title: 'Instância removida' });
      load();
    }
  }

  async function handleSetDefault(inst: Instance) {
    if (await call('set_default', { instance_id: inst.id }, inst.id)) load();
  }

  async function handleSync() {
    if (await call('sync_instances', { restaurant_id: restaurantId })) {
      toast({ title: 'Sincronizado' });
      load();
    }
  }

  async function handleReconfigureWebhook(inst: Instance) {
    const res = await call('reconfigure_webhook', { instance_id: inst.id }, inst.id);
    if (res) {
      toast({
        title: 'Webhook re-registrado',
        description: 'A Evolution agora envia eventos para o sistema. Mande uma mensagem de teste para confirmar.',
      });
    }
  }

  function openTestDialog(inst: Instance) {
    setTestInstance(inst);
    setTestPhone('');
    setTestOpen(true);
  }

  async function handleSendTest() {
    if (!restaurantId || !testInstance) return;
    const digits = testPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      toast({ title: 'Telefone inválido', description: 'Informe DDI, DDD e número. Ex.: 5511999998888', variant: 'destructive' });
      return;
    }
    setTestSending(true);
    const { data, error } = await supabase.functions.invoke('evolution-send', {
      body: {
        action: 'send_direct',
        restaurant_id: restaurantId,
        instance_id: testInstance.id,
        type: 'text',
        to: digits,
        payload: { text: 'Mensagem de teste do VoeFood: se você recebeu esta mensagem, o envio pelo WhatsApp está funcionando.' },
      },
    });
    setTestSending(false);
    if (error || data?.error || data?.ok === false) {
      toast({ title: 'Teste não enviado', description: await getFunctionErrorMessage(data, error, 'A mensagem de teste não foi aceita pela Evolution.'), variant: 'destructive' });
      return;
    }
    toast({ title: 'Mensagem de teste enviada', description: 'Confira se ela chegou no WhatsApp informado.' });
    setTestOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label>Estabelecimento</Label>
          <Select value={restaurantId} onValueChange={setRestaurantId} disabled={loadingRest}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {restaurants.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync} disabled={!restaurantId || loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Sincronizar
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={!restaurantId || instances.length >= limit}
          >
            <Plus className="h-4 w-4 mr-2" /> Nova instância
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {instances.length} / {limit} instâncias usadas neste estabelecimento.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : instances.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Nenhuma instância criada ainda. Clique em "Nova instância" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {instances.map((inst) => (
            <Card key={inst.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{inst.instance_name}</span>
                    {inst.is_default && (
                      <Badge variant="outline" className="bg-primary/10 text-primary">
                        <Star className="h-3 w-3 mr-1" /> Padrão
                      </Badge>
                    )}
                    <StatusBadge status={inst.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {inst.phone_number ? `+${inst.phone_number}` : 'Sem número conectado'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {inst.status !== 'connected' ? (
                    <Button size="sm" variant="outline" onClick={() => handleConnect(inst)} disabled={busyId === inst.id}>
                      <QrCode className="h-4 w-4 mr-1" /> Conectar
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openTestDialog(inst)} disabled={busyId === inst.id}>
                        <Send className="h-4 w-4 mr-1" /> Teste
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDisconnect(inst)} disabled={busyId === inst.id}>
                        <Power className="h-4 w-4 mr-1" /> Desconectar
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReconfigureWebhook(inst)}
                    disabled={busyId === inst.id}
                    title="Re-registrar webhook na Evolution"
                  >
                    <Webhook className="h-4 w-4" />
                  </Button>
                  {!inst.is_default && (
                    <Button size="sm" variant="ghost" onClick={() => handleSetDefault(inst)} disabled={busyId === inst.id}>
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover instância?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação removerá "{inst.instance_name}" do servidor Evolution e do banco. Conversas existentes ficarão sem origem ativa.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(inst)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova instância</DialogTitle>
            <DialogDescription>
              Use apenas letras, números, hífen e underscore. Ex.: <code>pizzaria-centro</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="iname">Nome da instância</Label>
            <Input
              id="iname"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="meu-whatsapp"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !createName.trim()}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp → Aparelhos conectados → Conectar um aparelho, e escaneie o código abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-4 min-h-[280px]">
            {qrLoading && !qrCode ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : qrCode ? (
              <QrCodeImage value={qrCode} className="w-64 h-64 rounded-lg border bg-background p-2" />
            ) : (
              <div className="text-sm text-muted-foreground text-center max-w-xs">
                Aguardando QR do servidor Evolution… Se demorar, clique em "Gerar novo QR".
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => qrInstance && handleConnect(qrInstance)} disabled={qrLoading}>
              <RefreshCw className="h-4 w-4 mr-2" /> Gerar novo QR
            </Button>
            <Button onClick={() => setQrOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar mensagem de teste</DialogTitle>
            <DialogDescription>
              A mensagem será enviada pela instância {testInstance?.instance_name}. Use um número com DDI e DDD.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="test-phone">Telefone</Label>
            <Input
              id="test-phone"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="5511999998888"
              inputMode="tel"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)} disabled={testSending}>Cancelar</Button>
            <Button onClick={handleSendTest} disabled={testSending || testPhone.replace(/\D/g, '').length < 10}>
              {testSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}