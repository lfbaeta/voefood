import { useEffect, useState } from 'react';
import { Loader2, BarChart3, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useStoreConfig, useUpdateStoreConfig } from '@/hooks/useStore';
import { useToast } from '@/hooks/use-toast';
import { useDemoGuard } from '@/hooks/useDemoGuard';

export function MarketingPixelsSettings() {
  const { data: store, isLoading } = useStoreConfig();
  const updateStore = useUpdateStoreConfig();
  const { toast } = useToast();
  const { checkDemoMode } = useDemoGuard();

  const [form, setForm] = useState({
    meta_pixel_id: '',
    meta_capi_token: '',
    meta_test_event_code: '',
    google_ads_id: '',
    google_ads_conversion_label_purchase: '',
    google_analytics_id: '',
    tracking_enabled: true,
  });

  useEffect(() => {
    if (!store) return;
    const s: any = store;
    setForm({
      meta_pixel_id: s.meta_pixel_id || '',
      meta_capi_token: s.meta_capi_token || '',
      meta_test_event_code: s.meta_test_event_code || '',
      google_ads_id: s.google_ads_id || '',
      google_ads_conversion_label_purchase: s.google_ads_conversion_label_purchase || '',
      google_analytics_id: s.google_analytics_id || '',
      tracking_enabled: s.tracking_enabled !== false,
    });
  }, [store]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkDemoMode()) return;
    if (!store?.id) return;

    // validações leves
    if (form.meta_pixel_id && !/^\d{10,20}$/.test(form.meta_pixel_id)) {
      toast({ title: 'Meta Pixel ID inválido', description: 'Deve conter apenas números (15–16 dígitos).', variant: 'destructive' });
      return;
    }
    if (form.google_ads_id && !/^AW-\d+$/.test(form.google_ads_id)) {
      toast({ title: 'Google Ads ID inválido', description: 'Formato esperado: AW-XXXXXXXXXX', variant: 'destructive' });
      return;
    }
    if (form.google_analytics_id && !/^G-[A-Z0-9]+$/.test(form.google_analytics_id)) {
      toast({ title: 'GA4 ID inválido', description: 'Formato esperado: G-XXXXXXXXXX', variant: 'destructive' });
      return;
    }

    try {
      await updateStore.mutateAsync({
        id: store.id,
        ...(form as any),
        meta_pixel_id: form.meta_pixel_id || null,
        meta_capi_token: form.meta_capi_token || null,
        meta_test_event_code: form.meta_test_event_code || null,
        google_ads_id: form.google_ads_id || null,
        google_ads_conversion_label_purchase: form.google_ads_conversion_label_purchase || null,
        google_analytics_id: form.google_analytics_id || null,
      });
      toast({ title: 'Configurações de tracking salvas!' });
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="bg-card rounded-xl p-4 sm:p-6 shadow-card space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm sm:text-base">Marketing &amp; Tracking</h3>
            <p className="text-xs text-muted-foreground">
              Conecte o Meta Pixel e o Google Ads para acompanhar conversões do seu cardápio.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Ativo</span>
          <Switch
            checked={form.tracking_enabled}
            onCheckedChange={(v) => setForm({ ...form, tracking_enabled: v })}
          />
        </div>
      </div>

      <div className="space-y-4 pt-2 border-t border-border">
        <h4 className="text-sm font-semibold">Meta (Facebook / Instagram)</h4>
        <div>
          <label className="text-xs text-muted-foreground">Pixel ID</label>
          <Input
            value={form.meta_pixel_id}
            onChange={(e) => setForm({ ...form, meta_pixel_id: e.target.value.trim() })}
            placeholder="Ex: 1234567890123456"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Encontre em Gerenciador de Eventos do Meta → Configurações do Pixel.
          </p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Test Event Code (opcional)</label>
          <Input
            value={form.meta_test_event_code}
            onChange={(e) => setForm({ ...form, meta_test_event_code: e.target.value.trim() })}
            placeholder="TEST12345"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">CAPI Access Token (opcional)</label>
          <Input
            type="password"
            value={form.meta_capi_token}
            onChange={(e) => setForm({ ...form, meta_capi_token: e.target.value.trim() })}
            placeholder="Usado para Conversion API server-side"
            className="mt-1"
          />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-border">
        <h4 className="text-sm font-semibold">Google Ads / Analytics</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Google Ads ID</label>
            <Input
              value={form.google_ads_id}
              onChange={(e) => setForm({ ...form, google_ads_id: e.target.value.trim() })}
              placeholder="AW-1234567890"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Conversion Label (Compra)</label>
            <Input
              value={form.google_ads_conversion_label_purchase}
              onChange={(e) => setForm({ ...form, google_ads_conversion_label_purchase: e.target.value.trim() })}
              placeholder="abCdEfGh1234"
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Google Analytics 4 ID (opcional)</label>
          <Input
            value={form.google_analytics_id}
            onChange={(e) => setForm({ ...form, google_analytics_id: e.target.value.trim() })}
            placeholder="G-XXXXXXXXXX"
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={updateStore.isPending}>
          {updateStore.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}