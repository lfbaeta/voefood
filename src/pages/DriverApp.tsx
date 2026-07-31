import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { usePublicRestaurantId } from '@/hooks/usePublicRestaurantId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Bike, MapPin, Phone, LogOut, Loader2, Check, X, Package, CheckCircle2, Navigation, Play, Square } from 'lucide-react';

const client: any = supabase;
const STORAGE_KEY = 'driver_session';

interface DriverSession {
  driver_id: string;
  driver_name: string;
  pin: string;
  restaurant_id: string;
  vehicle_type: string;
  photo_url: string | null;
}

interface DriverOrder {
  id: number;
  customer_name: string;
  customer_phone: string;
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_complement: string | null;
  address_reference: string | null;
  total_amount: number;
  payment_method: string;
  change_for: number | null;
  driver_status: string;
  status: string;
  created_at: string;
}

function loadSession(): DriverSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function DriverApp() {
  const slug = useSlug();
  const basePath = useBasePath(slug);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { restaurantId } = usePublicRestaurantId();

  const [session, setSession] = useState<DriverSession | null>(() => loadSession());
  const [pin, setPin] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [togglingShift, setTogglingShift] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const toggleShift = async () => {
    if (!session) return;
    setTogglingShift(true);
    try {
      const fn = shiftOpen ? 'driver_close_shift' : 'driver_open_shift';
      const { error } = await client.rpc(fn, {
        p_driver_id: session.driver_id,
        p_pin: session.pin,
      });
      if (error) throw error;
      setShiftOpen(!shiftOpen);
      toast({ title: shiftOpen ? 'Turno encerrado' : 'Turno iniciado' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setTogglingShift(false);
    }
  };

  const login = async () => {
    if (!restaurantId || !/^\d{4,6}$/.test(pin)) {
      toast({ title: 'PIN inválido', variant: 'destructive' });
      return;
    }
    setLoggingIn(true);
    try {
      const { data, error } = await client.rpc('validate_driver_pin', {
        p_restaurant_id: restaurantId,
        p_pin: pin,
      });
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: 'PIN não encontrado', variant: 'destructive' });
        return;
      }
      const row = data[0];
      const sess: DriverSession = {
        driver_id: row.driver_id,
        driver_name: row.driver_name,
        pin,
        restaurant_id: restaurantId,
        vehicle_type: row.vehicle_type,
        photo_url: row.photo_url,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
      setSession(sess);
      setPin('');
    } catch (e: any) {
      toast({ title: 'Erro no login', description: e.message, variant: 'destructive' });
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setSession(null);
  };

  const fetchOrders = useCallback(async () => {
    if (!session) return;
    setLoadingOrders(true);
    try {
      const { data, error } = await client.rpc('get_driver_orders', {
        p_driver_id: session.driver_id,
        p_pin: session.pin,
      });
      if (error) throw error;
      setOrders(data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingOrders(false);
    }
  }, [session]);

  const act = async (orderId: number, action: 'accept' | 'refuse' | 'pickup' | 'deliver') => {
    if (!session) return;
    try {
      const { error } = await client.rpc('driver_action_order', {
        p_driver_id: session.driver_id,
        p_pin: session.pin,
        p_order_id: orderId,
        p_action: action,
      });
      if (error) throw error;
      toast({ title: 'Atualizado' });
      await fetchOrders();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  // Poll orders
  useEffect(() => {
    if (!session) return;
    fetchOrders();
    const iv = setInterval(fetchOrders, 15000);
    return () => clearInterval(iv);
  }, [session, fetchOrders]);

  // GPS tracking while logged in
  useEffect(() => {
    if (!session || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await client.rpc('driver_update_location', {
            p_driver_id: session.driver_id,
            p_pin: session.pin,
            p_lat: pos.coords.latitude,
            p_lng: pos.coords.longitude,
            p_heading: pos.coords.heading,
            p_speed: pos.coords.speed,
            p_accuracy: pos.coords.accuracy,
          });
        } catch (e) {
          console.error('location update failed', e);
        }
      },
      (err) => console.warn('geolocation error', err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    );
    watchIdRef.current = id;
    return () => {
      navigator.geolocation.clearWatch(id);
      watchIdRef.current = null;
    };
  }, [session]);

  if (!session) {
    return (
      <>
        <Helmet><title>Entregador — Login</title></Helmet>
        <main className="min-h-screen bg-background flex items-center justify-center p-6">
          <Card className="w-full max-w-sm p-6 space-y-4">
            <div className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 mx-auto mb-3 flex items-center justify-center">
                <Bike className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Área do Entregador</h1>
              <p className="text-sm text-muted-foreground">Digite seu PIN para entrar</p>
            </div>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && login()}
              className="text-center text-2xl tracking-widest"
            />
            <Button className="w-full" onClick={login} disabled={loggingIn}>
              {loggingIn && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Entrar
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate(basePath || '/')}>
              Voltar ao cardápio
            </Button>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Entregador — {session.driver_name}</title></Helmet>
      <main className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 bg-card border-b border-border">
          <div className="max-w-2xl mx-auto flex items-center gap-3 p-4">
            {session.photo_url ? (
              <img src={session.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Bike className="h-5 w-5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{session.driver_name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Navigation className="h-3 w-3" /> GPS ativo
                {shiftOpen && <span className="ml-1 text-green-600">· Turno aberto</span>}
              </p>
            </div>
            <Button
              variant={shiftOpen ? 'destructive' : 'default'}
              size="sm"
              onClick={toggleShift}
              disabled={togglingShift}
            >
              {togglingShift ? <Loader2 className="h-4 w-4 animate-spin" /> : shiftOpen ? <><Square className="h-4 w-4 mr-1" /> Encerrar</> : <><Play className="h-4 w-4 mr-1" /> Iniciar</>}
            </Button>
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <div className="max-w-2xl mx-auto p-4 space-y-3">
          {loadingOrders && orders.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum pedido no momento</p>
              <p className="text-xs text-muted-foreground mt-1">Aguarde novos pedidos aparecerem aqui</p>
            </div>
          ) : (
            orders.map((o) => (
              <Card key={o.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">Pedido #{o.id}</p>
                    <p className="text-sm text-muted-foreground">{o.customer_name}</p>
                  </div>
                  <Badge variant={o.driver_status === 'offered' ? 'default' : 'secondary'}>
                    {o.driver_status === 'offered' ? 'Novo' :
                     o.driver_status === 'accepted' ? 'Aceito' :
                     o.driver_status === 'picked_up' ? 'Em rota' : o.driver_status}
                  </Badge>
                </div>

                <div className="text-sm space-y-1 border-t border-border pt-3">
                  <p className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                    <span>
                      {o.address_street}, {o.address_number}
                      {o.address_complement ? ` — ${o.address_complement}` : ''}
                      <br />
                      <span className="text-muted-foreground">{o.address_neighborhood}</span>
                      {o.address_reference && (
                        <><br /><span className="text-xs text-muted-foreground">Ref: {o.address_reference}</span></>
                      )}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <a href={`tel:${o.customer_phone}`} className="underline">{o.customer_phone}</a>
                  </p>
                </div>

                <div className="text-sm bg-muted/50 rounded-lg p-2">
                  <p><strong>Valor:</strong> R$ {Number(o.total_amount).toFixed(2)}</p>
                  <p><strong>Pagamento:</strong> {o.payment_method}
                    {o.change_for ? ` — Troco para R$ ${Number(o.change_for).toFixed(2)}` : ''}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const addr = encodeURIComponent(`${o.address_street}, ${o.address_number}, ${o.address_neighborhood}`);
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, '_blank');
                    }}
                  >
                    <Navigation className="h-4 w-4 mr-1" /> Rotas
                  </Button>

                  {o.driver_status === 'offered' && (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => act(o.id, 'refuse')}>
                        <X className="h-4 w-4 mr-1" /> Recusar
                      </Button>
                      <Button size="sm" onClick={() => act(o.id, 'accept')}>
                        <Check className="h-4 w-4 mr-1" /> Aceitar
                      </Button>
                    </>
                  )}
                  {o.driver_status === 'accepted' && (
                    <Button size="sm" onClick={() => act(o.id, 'pickup')}>
                      <Package className="h-4 w-4 mr-1" /> Retirei
                    </Button>
                  )}
                  {o.driver_status === 'picked_up' && (
                    <Button size="sm" onClick={() => act(o.id, 'deliver')}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Entregue
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
