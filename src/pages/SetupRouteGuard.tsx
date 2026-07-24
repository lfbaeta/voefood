import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useHasResellerSetupStatus } from "@/hooks/useHasResellerSetupStatus";

export default function SetupRouteGuard({ children }: { children: ReactNode }) {
  const { data: hasReseller, isLoading } = useHasResellerSetupStatus();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasReseller) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
