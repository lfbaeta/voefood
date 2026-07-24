import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { Helmet } from 'react-helmet-async';
import { UserCheck, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PinPad } from '@/components/auth/PinPad';
import { useStoreConfig } from '@/hooks/useStore';
import { useTheme } from '@/hooks/useTheme';
import { usePublicRestaurantId } from '@/hooks/usePublicRestaurantId';
import { supabase } from '@/integrations/supabase/client';

interface PublicWaiter {
  id: string;
  name: string;
  has_pin: boolean;
}

export default function WaiterAccess() {
  const navigate = useNavigate();
  const slug = useSlug();
  const basePath = useBasePath(slug);
  const { data: store } = useStoreConfig();
  const { restaurantId } = usePublicRestaurantId();
  const [waiters, setWaiters] = useState<PublicWaiter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWaiter, setSelectedWaiter] = useState<PublicWaiter | null>(null);
  const [showPinPad, setShowPinPad] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [pinError, setPinError] = useState('');

  useTheme();

  useEffect(() => {
    if (restaurantId) {
      loadWaiters();
    }
  }, [restaurantId]);

  const loadWaiters = async () => {
    if (!restaurantId) return;
    
    setIsLoading(true);
    // Use secure RPC that only returns id, name, and has_pin (no PIN value!)
    const { data, error } = await supabase.rpc('get_active_waiters', {
      p_restaurant_id: restaurantId
    });

    if (!error && data) {
      setWaiters(data as PublicWaiter[]);
    }
    setIsLoading(false);
  };

  const handleSelectWaiter = (waiter: PublicWaiter) => {
    setSelectedWaiter(waiter);
    setPinError('');
    
    // If waiter has PIN, show PIN pad
    if (waiter.has_pin) {
      setShowPinPad(true);
    } else {
      // No PIN configured, allow direct access
      completeLogin(waiter.id, waiter.name);
    }
  };

  const handlePinSubmit = async (pin: string) => {
    if (!selectedWaiter || !restaurantId) return;
    
    setIsVerifying(true);
    setPinError('');
    
    // Use secure RPC to validate PIN (PIN never exposed to client)
    const { data, error } = await supabase.rpc('validate_waiter_pin', {
      p_restaurant_id: restaurantId,
      p_pin: pin
    });

    if (error || !data || data.length === 0) {
      setPinError('PIN incorreto. Tente novamente.');
      setIsVerifying(false);
      return;
    }

    // Verify the validated waiter matches the selected one
    const validatedWaiter = data[0];
    if (validatedWaiter.waiter_id === selectedWaiter.id) {
      completeLogin(selectedWaiter.id, selectedWaiter.name);
    } else {
      setPinError('PIN incorreto. Tente novamente.');
      setIsVerifying(false);
    }
  };

  const completeLogin = (waiterId: string, waiterName: string) => {
    // Store waiter info in localStorage
    localStorage.setItem('waiter_id', waiterId);
    localStorage.setItem('waiter_name', waiterName);
    
    // Navigate to dashboard with slug
    setTimeout(() => {
      navigate(`${basePath}/waiter/dashboard`);
    }, 300);
  };

  const handleBackToList = () => {
    setSelectedWaiter(null);
    setShowPinPad(false);
    setPinError('');
    setIsVerifying(false);
  };

  // Show PIN pad view
  if (showPinPad && selectedWaiter) {
    return (
      <>
        <Helmet>
          <title>{`Acesso Garçom - ${store?.name || 'Restaurante'}`}</title>
        </Helmet>

        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-4 top-4"
                onClick={handleBackToList}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCheck className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Olá, {selectedWaiter.name}!</CardTitle>
              <CardDescription>
                Digite seu PIN para acessar o sistema
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <PinPad 
                onSubmit={handlePinSubmit}
                isLoading={isVerifying}
                error={pinError}
              />
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`Acesso Garçom - ${store?.name || 'Restaurante'}`}</title>
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              {store?.logo_url ? (
                <img 
                  src={store.logo_url} 
                  alt="Logo" 
                  className="h-12 w-12 object-contain rounded-full"
                />
              ) : (
                <UserCheck className="h-8 w-8 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl">Olá, Garçom!</CardTitle>
            <CardDescription>
              Selecione seu nome para acessar o sistema
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : waiters.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Nenhum garçom cadastrado ainda.
                </p>
                <Button variant="outline" onClick={() => navigate(`${basePath}`)}>
                  Voltar ao cardápio
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {waiters.map((waiter) => (
                  <Button
                    key={waiter.id}
                    variant="outline"
                    className="w-full h-14 text-lg justify-start px-4"
                    onClick={() => handleSelectWaiter(waiter)}
                    disabled={selectedWaiter !== null && !showPinPad}
                  >
                    {selectedWaiter?.id === waiter.id && !showPinPad ? (
                      <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    ) : (
                      <UserCheck className="h-5 w-5 mr-3" />
                    )}
                    {waiter.name}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
