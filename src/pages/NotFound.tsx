import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";

const NotFound = () => {
  const location = useLocation();

  // Apply theme colors dynamically
  useTheme();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-primary">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Página não encontrada</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Voltar ao Início
        </a>
      </div>
    </div>
  );
};

export default NotFound;