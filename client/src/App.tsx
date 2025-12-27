import { useEffect } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { useGlobalLoadingIndicator } from "@/hooks/use-global-loading";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import NuevaFactura from "@/pages/nueva-factura";
import Historial from "@/pages/historial";
import Emisor from "@/pages/emisor";
import Configuracion from "@/pages/configuracion";
import NotaCreditoDebito from "@/pages/nota-credito-debito";
import Reportes from "@/pages/reportes";
import { cn } from "@/lib/utils";
import { User, FileText } from "lucide-react";
import type { Factura } from "@shared/schema";
import Login from "@/pages/login";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

function Protected({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  if (isLoading) return <div className="p-6 text-center">Cargando...</div>;
  if (!isAuthenticated && location !== "/login") {
    navigate("/login");
    return <div className="p-6 text-center">Redirigiendo...</div>;
  }
  return children;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => (<Protected><Dashboard /></Protected>)} />
      <Route path="/factura/nueva" component={() => (<Protected><NuevaFactura /></Protected>)} />
      <Route path="/notas" component={() => (<Protected><NotaCreditoDebito /></Protected>)} />
      <Route path="/historial" component={() => (<Protected><Historial /></Protected>)} />
      <Route path="/reportes" component={() => (<Protected><Reportes /></Protected>)} />
      <Route path="/emisor" component={() => (<Protected><Emisor /></Protected>)} />
      <Route path="/configuracion" component={() => (<Protected><Configuracion /></Protected>)} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, logout } = useAuth();
  const navItems = [
    { label: "Panel de Control", href: "/" },
    { label: "Facturas", href: "/factura/nueva" },
    { label: "Notas", href: "/notas" },
    { label: "Reportes", href: "/reportes" },
    { label: "Configuración", href: "/configuracion" },
  ];

  const [location, navigate] = useLocation();

  const { data: facturas } = useQuery<Factura[]>({
    queryKey: ["/api/facturas"],
  });

  const { data: emisor } = useQuery<any>({
    queryKey: ["/api/emisor"],
  });

  const facturasTotal = facturas?.length || 0;
  const facturasPendientes = facturas?.filter(
    (f) => f.estado === "generada" && !f.selloRecibido
  ).length || 0;

  // Barra de progreso global
  useGlobalLoadingIndicator();

  // Atajos de teclado globales
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            navigate('/factura/nueva');
            break;
          case 'h':
            e.preventDefault();
            navigate('/historial');
            break;
          case 'k':
            e.preventDefault();
            // Focus en búsqueda si estamos en historial
            const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
            if (searchInput) searchInput.focus();
            break;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_20%_20%,#f7f2ea_0,#f0ebe3_45%,#e6dfd5_100%)] p-6">
      <div className="flex justify-center">
        <div className="flex items-center gap-3 rounded-full border border-white/70 bg-white/90 px-6 py-3 shadow-2xl backdrop-blur-2xl transition-all duration-200 hover:shadow-[0_24px_60px_rgba(42,32,20,0.20)] hover:translate-y-[-2px] scale-[1.1]">
          {emisor?.logo && (
            <>
              <img 
                src={emisor.logo} 
                alt="Logo" 
                className="h-8 object-contain"
              />
              <div className="h-5 w-px bg-white/70" />
            </>
          )}
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3.5 py-2 text-sm font-medium rounded-full transition-all duration-150",
                location === item.href
                  ? "bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200/30 scale-[1.02]"
                  : "text-foreground/80 hover:text-foreground hover:bg-white/70 hover:shadow-sm"
              )}
            >
              {item.label}
            </Link>
          ))}
          <div className="h-5 w-px bg-white/70" />
          <div className="flex items-center gap-3 pl-2">
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-xs font-medium">
                  {facturasTotal}
                </Badge>
                {facturasPendientes > 0 && (
                  <Badge variant="default" className="text-xs font-medium bg-amber-500 hover:bg-amber-600">
                    {facturasPendientes}
                  </Badge>
                )}
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-sm font-semibold">
                  <User className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="font-medium text-foreground capitalize">{user.username}</p>
                  <p className="text-muted-foreground">Conectado</p>
                </div>
              </div>
            )}
          </div>
          <div className="h-5 w-px bg-white/70" />
          <ThemeToggle />
          {user && (
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => logout.mutate()}
            >
              Salir
            </Button>
          )}
        </div>
      </div>

      <main className="mt-6 flex justify-center">
        <div className="w-full max-w-7xl">
          <Router />
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="dte-sv-theme">
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
