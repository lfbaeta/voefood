import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { Helmet } from 'react-helmet-async';
import { ChefHat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PinPad } from '@/components/auth/PinPad';
import { useStoreConfig } from '@/hooks/useStore';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';

export default function KitchenLogin() {
  const navigate = useNavigate();
  const slug = useSlug();
  const basePath = useBasePath(slug);
  const { data: store, isLoading } = useStoreConfig();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [pinRequired, setPinRequired] = useState<boolean | null>(null);

  useTheme();

  useEffect(() => {
    checkPinRequired();
  }, [store]);

  const checkPinRequired = async () => {
    if (!store?.id) return;
    
    // Check if already authenticated
    const savedAuth = localStorage.getItem(`kitchen_auth_${store.id}`);
    if (savedAuth) {
      const authData = JSON.parse(savedAuth);
      // Session valid for 24 hours
      if (Date.now() - authData.timestamp < 24 * 60 * 60 * 1000) {
        navigate(`${basePath}/kitchen`);
        return;
      }
    }
    
    const { data, error } = await supabase
      .from('store_config')
      .select('kitchen_pin_enabled')
      .eq('id', store.id)
      .maybeSingle();
    
    if (error || !data || !data.kitchen_pin_enabled) {
      // No PIN required (or cannot read config as anon) → allow direct access
      navigate(`${basePath}/kitchen`);
      return;
    }
    setPinRequired(true);
  };

  const handlePinSubmit = async (pin: string) => {
    if (!store?.id) return;
    
    setIsVerifying(true);
    setError('');
    
    try {
      // Use server-side PIN validation via RPC (SECURITY FIX)
      // PIN is never sent to client - validation happens in database function
      const { data: isValid, error: validationError } = await supabase.rpc('validate_kitchen_pin', {
        p_restaurant_id: store.id,
        p_pin: pin
      });
      
      if (validationError) {
        console.error('PIN validation error:', validationError);
        setError('Erro ao validar PIN');
        return;
      }
      
      if (isValid) {
        // Save session
        localStorage.setItem(`kitchen_auth_${store.id}`, JSON.stringify({
          timestamp: Date.now(),
          authenticated: true
        }));
        
        navigate(`${basePath}/kitchen`);
      } else {
        setError('PIN incorreto. Tente novamente.');
      }
    } catch (err) {
      console.error('PIN validation error:', err);
      setError('Erro ao verificar PIN');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading || pinRequired === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`Acesso Cozinha - ${store?.name || 'Restaurante'}`}</title>
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
              {store?.logo_url ? (
                <img 
                  src={store.logo_url} 
                  alt="Logo" 
                  className="h-12 w-12 object-contain rounded-full"
                />
              ) : (
                <ChefHat className="h-8 w-8 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl">Acesso à Cozinha</CardTitle>
            <CardDescription>
              Digite o PIN para acessar o painel da cozinha
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <PinPad 
              onSubmit={handlePinSubmit}
              isLoading={isVerifying}
              error={error}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
