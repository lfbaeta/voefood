import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bike, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDriversWithLocation } from '@/hooks/useDeliveryOps';
import { useStoreConfig } from '@/hooks/useStore';
import { DriverShiftsReport } from '@/components/admin/DriverShiftsReport';

const iconFor = (status: string) => L.divIcon({
  className: 'driver-map-marker',
  html: `<div style="background:${
    status === 'available' ? '#22c55e' :
    status === 'on_delivery' ? '#f59e0b' :
    status === 'paused' ? '#ef4444' : '#6b7280'
  };color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.25);border:3px solid white;font-size:18px;">🛵</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const storeIcon = L.divIcon({
  className: 'store-marker',
  html: `<div style="background:hsl(var(--primary));color:hsl(var(--primary-foreground));width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.25);border:2px solid white;font-size:18px;">🏪</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const statusLabel: Record<string, string> = {
  available: 'Disponível',
  on_delivery: 'Em entrega',
  returning: 'Retornando',
  paused: 'Pausado',
  offline: 'Offline',
};

export default function DeliveryMap() {
  const { data: drivers, isLoading, refetch, isFetching } = useDriversWithLocation(10000);
  const { data: store } = useStoreConfig();

  const withLoc = (drivers || []).filter((d) => d.lat != null && d.lng != null);
  const storeLat = (store as any)?.address_lat ?? null;
  const storeLng = (store as any)?.address_lng ?? null;

  const center = useMemo<[number, number]>(() => {
    if (withLoc.length > 0) return [withLoc[0].lat!, withLoc[0].lng!];
    if (storeLat && storeLng) return [storeLat, storeLng];
    return [-14.235, -51.9253]; // BR fallback
  }, [withLoc, storeLat, storeLng]);

  return (
    <>
      <Helmet><title>Mapa de Entregadores</title></Helmet>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mapa de Operação</h1>
            <p className="text-sm text-muted-foreground">Localização em tempo real dos entregadores</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="h-[500px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <MapContainer center={center} zoom={13} style={{ height: 500, width: '100%' }} scrollWheelZoom>
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {storeLat && storeLng && (
                  <Marker position={[storeLat, storeLng]} icon={storeIcon}>
                    <Popup>{(store as any)?.name || 'Restaurante'}</Popup>
                  </Marker>
                )}
                {withLoc.map((d) => (
                  <Marker key={d.id} position={[d.lat!, d.lng!]} icon={iconFor(d.status)}>
                    <Popup>
                      <strong>{d.name}</strong>
                      <br />
                      {statusLabel[d.status] || d.status}
                      {d.updated_at && (
                        <><br /><small>{new Date(d.updated_at).toLocaleTimeString('pt-BR')}</small></>
                      )}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </Card>

          <Card className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Bike className="h-4 w-4" /> Entregadores ({drivers?.length || 0})
            </h3>
            {(drivers || []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum entregador cadastrado.</p>
            )}
            {(drivers || []).map((d) => (
              <div key={d.id} className="flex items-start gap-2 border-b border-border pb-3 last:border-0">
                {d.photo_url ? (
                  <img src={d.photo_url} className="h-9 w-9 rounded-full object-cover" alt="" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                    <Bike className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={d.status === 'available' ? 'default' : 'secondary'} className="text-[10px]">
                      {statusLabel[d.status] || d.status}
                    </Badge>
                    {d.lat != null ? (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {d.updated_at ? new Date(d.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">sem GPS</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <DriverShiftsReport />
      </div>
    </>
  );
}
