import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { Helmet } from 'react-helmet-async';
import {
  ChefHat,
  Clock,
  CheckCircle,
  RefreshCw,
  Volume2,
  VolumeX,
  Loader2,
  ArrowLeft,
  LogOut,
  Search,
  LayoutGrid,
  List,
  Maximize,
  Minimize,
  Timer,
  Wine,
  UtensilsCrossed,
  Truck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { KitchenItemCard } from '@/components/kitchen/KitchenItemCard';
import { KitchenTicketCard, KitchenTicket } from '@/components/kitchen/KitchenTicketCard';
import { useKitchenItems, KitchenItem } from '@/hooks/useKitchenItems';
import { useStoreConfig } from '@/hooks/useStore';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface KitchenProps {
  department?: 'kitchen' | 'bar';
}

type StatusTab = 'all' | 'pending' | 'preparing' | 'ready';
type SourceFilter = 'all' | 'table' | 'delivery';

const LATE_MINUTES = 15;

export default function Kitchen({ department = 'kitchen' }: KitchenProps = {}) {
  const navigate = useNavigate();
  const slug = useSlug();
  const basePath = useBasePath(slug);
  const { data: store, isLoading: isLoadingStore } = useStoreConfig();
  const { items, isLoading } = useKitchenItems(undefined, department);

  const stationLabel = department === 'bar' ? 'Bar' : 'Cozinha';
  const StationIcon = department === 'bar' ? Wine : ChefHat;

  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'tickets' | 'items'>(
    () => (localStorage.getItem('kds_view_mode') as 'tickets' | 'items') || 'tickets'
  );
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem('kds_sound') !== 'off'
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [lastItemCount, setLastItemCount] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useTheme();

  useEffect(() => {
    localStorage.setItem('kds_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('kds_sound', soundEnabled ? 'on' : 'off');
  }, [soundEnabled]);

  // Live clock for elapsed timers
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ---- Auth (PIN) ----
  useEffect(() => {
    checkAuthentication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const checkAuthentication = async () => {
    if (!store?.id) return;
    setIsCheckingAuth(true);

    const { data, error } = await supabase
      .from('store_config')
      .select('kitchen_pin_enabled')
      .eq('id', store.id)
      .single();

    if (error) {
      setIsAuthenticated(true);
      setIsCheckingAuth(false);
      return;
    }

    if (!data?.kitchen_pin_enabled) {
      setIsAuthenticated(true);
      setIsCheckingAuth(false);
      return;
    }

    const savedAuth = localStorage.getItem(`kitchen_auth_${store.id}`);
    if (savedAuth) {
      const authData = JSON.parse(savedAuth);
      if (Date.now() - authData.timestamp < 24 * 60 * 60 * 1000) {
        setIsAuthenticated(true);
        setIsCheckingAuth(false);
        return;
      }
    }

    navigate(`${basePath}/kitchen/login`);
  };

  const handleLogout = () => {
    if (store?.id) localStorage.removeItem(`kitchen_auth_${store.id}`);
    navigate(`${basePath}/kitchen/login`);
  };

  // ---- Sound on new items ----
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');
  }, []);

  useEffect(() => {
    const pendingCount = items.filter((i) => i.status === 'pending').length;
    if (lastItemCount !== null && pendingCount > lastItemCount && soundEnabled) {
      try {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioContext.close();
        }, 250);
      } catch {
        /* audio not supported */
      }
    }
    setLastItemCount(pendingCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, soundEnabled]);

  // ---- Wake lock ----
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
      } catch {
        /* not supported */
      }
    };
    requestWakeLock();
    return () => {
      wakeLock?.release();
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      /* ignore */
    }
  };

  // ---- Derived data ----
  const pendingItems = items.filter((i) => i.status === 'pending');
  const preparingItems = items.filter((i) => i.status === 'preparing');
  const readyItems = items.filter((i) => i.status === 'ready');

  const lateCount = items.filter(
    (i) => i.status !== 'ready' && (now - new Date(i.ordered_at).getTime()) / 60000 >= LATE_MINUTES
  ).length;

  const avgWait = useMemo(() => {
    const open = items.filter((i) => i.status !== 'ready');
    if (open.length === 0) return 0;
    const total = open.reduce((sum, i) => sum + (now - new Date(i.ordered_at).getTime()), 0);
    return Math.round(total / open.length / 60000);
  }, [items, now]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (activeTab !== 'all' && item.status !== activeTab) return false;
      if (sourceFilter !== 'all' && item.order_type !== sourceFilter) return false;
      if (!term) return true;
      const haystack = [
        item.product_name,
        item.observation,
        item.customer_name,
        item.table_name,
        item.table_number != null ? `mesa ${item.table_number}` : '',
        item.order_id != null ? `#${item.order_id}` : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [items, activeTab, sourceFilter, search]);

  const tickets: KitchenTicket[] = useMemo(() => {
    const map = new Map<string, KitchenTicket>();
    filteredItems.forEach((item: KitchenItem) => {
      const key =
        item.order_type === 'table'
          ? `table-${item.table_order_id}`
          : `delivery-${item.order_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
        if (new Date(item.ordered_at) < new Date(existing.ordered_at)) {
          existing.ordered_at = item.ordered_at;
        }
      } else {
        map.set(key, {
          key,
          order_type: item.order_type,
          table_number: item.table_number,
          table_name: item.table_name,
          order_id: item.order_id,
          customer_name: item.customer_name,
          waiter_name: item.waiter_name,
          ordered_at: item.ordered_at,
          items: [item],
        });
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.ordered_at).getTime() - new Date(b.ordered_at).getTime()
    );
  }, [filteredItems]);

  if (isCheckingAuth || isLoadingStore) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const statCards: { id: StatusTab; label: string; value: number; icon: typeof Clock }[] = [
    { id: 'all', label: 'Total', value: items.length, icon: LayoutGrid },
    { id: 'pending', label: 'Pendentes', value: pendingItems.length, icon: Clock },
    { id: 'preparing', label: 'Preparando', value: preparingItems.length, icon: ChefHat },
    { id: 'ready', label: 'Prontos', value: readyItems.length, icon: CheckCircle },
  ];

  return (
    <>
      <Helmet>
        <title>{stationLabel} - {store?.name || 'Restaurante'}</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StationIcon className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">{stationLabel}</h1>
                <p className="text-sm text-muted-foreground">{store?.name}</p>
              </div>
              <Badge variant="outline" className="ml-2 gap-1 tabular-nums">
                <Timer className="h-3.5 w-3.5" />
                Espera média {avgWait} min
              </Badge>
              {lateCount > 0 && (
                <Badge variant="destructive" className="tabular-nums">
                  {lateCount} atrasado{lateCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden text-sm tabular-nums text-muted-foreground sm:inline">
                {new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <Button
                variant="outline"
                size="icon"
                title={viewMode === 'tickets' ? 'Ver por item' : 'Ver por comanda'}
                onClick={() => setViewMode(viewMode === 'tickets' ? 'items' : 'tickets')}
              >
                {viewMode === 'tickets' ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
              </Button>
              <Button variant="outline" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} title="Som">
                {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </Button>
              <Button variant="outline" size="icon" onClick={toggleFullscreen} title="Tela cheia">
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </Button>
              <Button variant="outline" size="icon" onClick={() => window.location.reload()} title="Atualizar">
                <RefreshCw className="h-5 w-5" />
              </Button>
              <Button variant="outline" onClick={() => navigate(`${basePath}/admin`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Admin
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Stats / status filters */}
        <div className="grid grid-cols-2 gap-3 bg-muted/40 p-4 lg:grid-cols-4">
          {statCards.map((card) => (
            <button
              key={card.id}
              onClick={() => setActiveTab(card.id)}
              className={cn(
                'rounded-xl border p-4 text-center transition-all',
                activeTab === card.id
                  ? 'border-primary bg-primary/15 ring-2 ring-primary'
                  : 'border-border bg-card hover:bg-muted'
              )}
            >
              <card.icon className="mx-auto mb-2 h-7 w-7 text-primary" />
              <p className="text-3xl font-bold tabular-nums text-foreground">{card.value}</p>
              <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar item, mesa, cliente ou pedido..."
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {([
              { id: 'all', label: 'Todos', icon: LayoutGrid },
              { id: 'table', label: 'Mesas', icon: UtensilsCrossed },
              { id: 'delivery', label: 'Delivery', icon: Truck },
            ] as { id: SourceFilter; label: string; icon: typeof Truck }[]).map((f) => (
              <Button
                key={f.id}
                variant={sourceFilter === f.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSourceFilter(f.id)}
              >
                <f.icon className="mr-1 h-4 w-4" />
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <StationIcon className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-xl text-muted-foreground">Nenhum item nesta visão</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Novos pedidos aparecem aqui automaticamente.
              </p>
            </div>
          ) : viewMode === 'tickets' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tickets.map((ticket) => (
                <KitchenTicketCard
                  key={ticket.key}
                  ticket={ticket}
                  now={now}
                  lateAfterMinutes={LATE_MINUTES}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => (
                <KitchenItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
