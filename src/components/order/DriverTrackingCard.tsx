import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bike, Phone, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

// Fix default marker icons (Leaflet + Vite)
const driverIcon = L.divIcon({
  className: 'driver-marker',
  html: `<div style="background:hsl(var(--primary));color:hsl(var(--primary-foreground));width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.25);border:3px solid white;font-size:20px;">🛵</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

interface DriverInfo {
  order_status: string;
  driver_status: string | null;
  driver_name: string | null;
  driver_photo: string | null;
  vehicle_type: string | null;
  driver_phone: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  location_updated_at: string | null;
}

interface Props {
  orderId: number;
  customerPhone: string;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

export function DriverTrackingCard({ orderId, customerPhone }: Props) {
  const [info, setInfo] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const driverIdRef = useRef<string | null>(null);

  const fetchTracking = async () => {
    const { data, error } = await supabase.rpc('get_public_driver_tracking', {
      p_order_id: orderId,
      p_customer_phone: customerPhone,
    });
    if (!error && data && (data as any).length > 0) {
      setInfo((data as any)[0]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, customerPhone]);

  // Realtime subscription to driver location updates
  useEffect(() => {
    if (!info?.driver_name) return;
    // We don't know the driver_id from RPC (privacy), but the RPC re-runs every 15s.
    // Additionally, listen to orders table changes for status shifts.
    const channel = supabase
      .channel(`driver-tracking-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => fetchTracking()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      driverIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, info?.driver_name]);

  if (loading) return null;
  if (!info || !info.driver_name) return null;

  const driverStatusLabel: Record<string, string> = {
    offered: 'Aguardando aceite do entregador',
    accepted: 'Entregador aceitou o pedido',
    picked_up: 'Entregador saiu para entrega',
    delivered: 'Pedido entregue',
  };

  const hasLocation = info.driver_lat != null && info.driver_lng != null;
  const lastUpdate = info.location_updated_at
    ? new Date(info.location_updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <section className="rounded-2xl bg-card shadow-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          {info.driver_photo ? (
            <img
              src={info.driver_photo}
              alt={info.driver_name}
              className="h-12 w-12 rounded-full object-cover border-2 border-primary"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{info.driver_name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Bike className="h-3 w-3" />
              {info.vehicle_type || 'Entregador'}
              {info.driver_status && (
                <span className="ml-1">
                  · {driverStatusLabel[info.driver_status] || info.driver_status}
                </span>
              )}
            </p>
          </div>
          {info.driver_phone && (
            <Button size="sm" variant="outline" asChild>
              <a href={`tel:${info.driver_phone}`}>
                <Phone className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {hasLocation ? (
        <div className="relative">
          <MapContainer
            center={[info.driver_lat!, info.driver_lng!]}
            zoom={16}
            style={{ height: '280px', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[info.driver_lat!, info.driver_lng!]} icon={driverIcon}>
              <Popup>{info.driver_name}</Popup>
            </Marker>
            <RecenterMap lat={info.driver_lat!} lng={info.driver_lng!} />
          </MapContainer>
          {lastUpdate && (
            <div className="absolute bottom-2 right-2 z-[400] bg-background/90 backdrop-blur px-2 py-1 rounded text-[11px] text-muted-foreground shadow">
              Atualizado às {lastUpdate}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Aguardando localização do entregador...
        </div>
      )}
    </section>
  );
}
