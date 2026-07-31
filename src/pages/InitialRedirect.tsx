import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Landing from './Landing';
import { useHasResellerSetupStatus } from '@/hooks/useHasResellerSetupStatus';

const InitialRedirect = () => {
  const { data: hasReseller, isLoading } = useHasResellerSetupStatus();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se não há reseller, redireciona para setup
  if (!hasReseller) {
    return <Navigate to="/setup" replace />;
  }

  // Se há reseller, mostra a landing page
  return <Landing />;
};

export default InitialRedirect;
