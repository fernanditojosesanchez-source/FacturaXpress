import { useEffect, useMemo, Suspense, lazy } from "react";
import { cn } from "@/lib/utils";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { useGlobalLoadingIndicator } from "@/hooks/use-global-loading";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import NuevaFactura from "@/pages/nueva-factura";
import Emisor from "@/pages/emisor";
import Configuracion from "@/pages/configuracion";
import { VibrantBackground } from "@/components/VibrantBackground";
import { User, FileText, Loader2 } from "lucide-react";
import Login from "@/pages/login";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy loading para páginas pesadas
const Historial = lazy(() => import("@/pages/historial"));
const NotaCreditoDebito = lazy(() => import("@/pages/nota-credito-debito"));
const Reportes = lazy(() => import("@/pages/reportes"));
const ProductosPage = lazy(() => import("@/pages/productos"));
const ClientesPage = lazy(() => import("@/pages/clientes"));
const CertificadosPage = lazy(() => import("@/pages/certificados"));
const SuperAdminPage = lazy(() => import("@/pages/super-admin"));
const UsuariosPage = lazy(() => import("@/pages/usuarios"));
const StockTransitoPage = lazy(() => import("@/pages/stock-transito"));
const SigmaSupportPage = lazy(() => import("@/pages/sigma-support"));

// Componente skeleton para loading
function PageLoader() {
  return (
    <div className="space-y-4 p-8">
      <Skeleton className="h-12 w-1/3" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function Protected({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && location !== "/login") {
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, location, navigate]);

  if (isLoading) return <div className="p-6 text-center">Cargando...</div>;
  if (!isAuthenticated && location !== "/login") {
    return <div className="p-6 text-center">Redirigiendo...</div>;
  }
  return children;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/">
        <Protected>
          <Dashboard />
        </Protected>
      </Route>

      <Route path="/factura/nueva">
        <Protected>
          <NuevaFactura />
        </Protected>
      </Route>

      <Route path="/historial">
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <Historial />
          </Suspense>
        </Protected>
      </Route>

      <Route path="/notas">
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <NotaCreditoDebito />
          </Suspense>
        </Protected>
      </Route>

      <Route path="/productos">
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <ProductosPage />
          </Suspense>
        </Protected>
      </Route>

      <Route path="/clientes">
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <ClientesPage />
          </Suspense>
        </Protected>
      </Route>

      <Route path="/reportes">
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <Reportes />
          </Suspense>
        </Protected>
      </Route>

      <Route path="/emisor">
        <Protected>
          <Emisor />
        </Protected>
      </Route>

      <Route path="/configuracion">
        <Protected>
          <Configuracion />
        </Protected>
      </Route>

      <Route path="/stock-transito">
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <StockTransitoPage />
          </Suspense>
        </Protected>
      </Route>

      <Route path="/sigma-support">
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <SigmaSupportPage />
          </Suspense>
        </Protected>
      </Route>

      <Route path="/usuarios">
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <UsuariosPage />
          </Suspense>
        </Protected>
      </Route>

      <Route path="/certificados">
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <CertificadosPage />
          </Suspense>
        </Protected>
      </Route>

      <Route path="/super-admin">
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <SuperAdminPage />
          </Suspense>
        </Protected>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();
  const [location, navigate] = useLocation();

  // Consultas deben declararse SIEMPRE; controlar con `enabled`
  // Solo cargar datos de negocio si NO es super_admin
  const isSuperAdmin = user?.role === "super_admin";

  const { data: facturasResponse } = useQuery<any>({
    queryKey: ["/api/facturas"],
    queryFn: async () => {
      const res = await fetch("/api/facturas?limit=25", { credentials: "include" });
      if (!res.ok) throw new Error("Error fetching facturas for app state");
      return res.json();
    },
    enabled: !authLoading && !!user && !isSuperAdmin,
    staleTime: 30000,
  });


  // Extraer array de facturas de forma estable
  const facturas = useMemo(() =>
    Array.isArray(facturasResponse?.data) ? facturasResponse.data : [],
    [facturasResponse?.data]
  );

  const facturasTotal = facturasResponse?.pagination?.total ?? facturas.length;
  const facturasPendientes = useMemo(() =>
    facturas.filter((f: any) => f.estado === "generada" && !f.selloRecibido).length,
    [facturas]
  );

  // Barra de progreso global (siempre declarada)
  useGlobalLoadingIndicator();

  // Atajos de teclado globales (solo para usuarios no super_admin)
  useEffect(() => {
    if (isSuperAdmin) return; // No aplicar atajos a super_admin

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
          case 'p':
            e.preventDefault();
            navigate('/productos');
            break;
          case 'c':
            e.preventDefault();
            navigate('/clientes');
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
  }, [navigate, isSuperAdmin]);

  // Lógica de filtrado de roles aplicada directamente al Header
  const navItems = useMemo(() => {
    const role = user?.role || "cashier"; // Fallback seguro

    // Super admin tiene su propio panel SaaS, NO acceso a facturas/ventas
    if (role === "super_admin") {
      return [
        { label: "Gestión de Clientes", href: "/super-admin", roles: ["super_admin"] },
      ];
    }

    const allItems = [
      { label: "Dashboard", href: "/", roles: ["tenant_admin", "manager", "cashier"] },
      { label: "Facturas", href: "/factura/nueva", roles: ["tenant_admin", "manager", "cashier"] },
      { label: "Historial", href: "/historial", roles: ["tenant_admin", "manager", "cashier"] },
      { label: "Clientes", href: "/clientes", roles: ["tenant_admin", "manager", "cashier"] },
      { label: "Productos", href: "/productos", roles: ["tenant_admin", "manager"] },
      { label: "Stock en Tránsito", href: "/stock-transito", roles: ["tenant_admin", "manager"] },
      { label: "Notas", href: "/notas", roles: ["tenant_admin", "manager"] },
      { label: "Reportes", href: "/reportes", roles: ["tenant_admin", "manager"] },
      { label: "Soporte Sigma", href: "/sigma-support", roles: ["tenant_admin"] },
      { label: "Certificados", href: "/certificados", roles: ["tenant_admin"] },
      { label: "Configuración", href: "/configuracion", roles: ["tenant_admin"] },
    ];

    return allItems.filter((item) => item.roles.includes(role));
  }, [user]);

  // Early-returns DESPUÉS de declarar todos los hooks
  if (authLoading) {
    return (
      <VibrantBackground className="flex items-center justify-center">
        <div className="space-y-4 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="font-black italic tracking-tighter text-xl text-blue-500/50 uppercase">Iniciando NEEXUM...</p>
        </div>
      </VibrantBackground>
    );
  }

  if (!user) {
    return (
      <VibrantBackground>
        <Login />
      </VibrantBackground>
    );
  }

  // Redirigir super_admin a su panel
  if (user.role === "super_admin" && location === "/") {
    navigate("/super-admin");
    return null;
  }

  // Redirigir a home si super_admin intenta acceder a rutas de negocio
  const businessRoutes = ["/factura/nueva", "/historial", "/clientes", "/productos", "/notas", "/reportes", "/certificados"];
  if (isSuperAdmin && businessRoutes.includes(location)) {
    navigate("/super-admin");
    return null;
  }

  // Determinar el fondo según el tema
  const navBgClass = theme === 'dark'
    ? 'border-white/10 bg-white/5'
    : 'border-white/40 bg-white/60';

  return (
    <VibrantBackground className="p-4 sm:p-8">
      <div className="relative z-50 flex justify-center mb-8">
        <div className={cn(
          "flex items-center gap-3 rounded-2xl border px-4 py-2.5 backdrop-blur-3xl transition-all duration-500",
          navBgClass,
          theme === 'dark'
            ? 'shadow-xl shadow-black/20 border-white/10'
            : 'shadow-sm shadow-black/5 border-white/80'
        )}>
          {/* Usando el ícono sugerido en el header */}
          <div className="flex items-center">
            <img
              src="/neexum_app_icon.png"
              alt="NX"
              className="h-7 w-auto object-contain"
            />
            <div className={cn(
              "h-5 w-px mx-3",
              theme === 'dark' ? 'bg-white/10' : 'bg-slate-300/60'
            )} />
          </div>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-2 text-[13px] font-bold rounded-xl transition-all duration-300 whitespace-nowrap",
                location === item.href
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : theme === 'dark'
                    ? "text-slate-300 hover:text-white hover:bg-white/5"
                    : "text-slate-600 hover:text-slate-900 hover:bg-black/5"
              )}
            >
              {item.label}
            </Link>
          ))}
          <div className={cn(
            "h-5 w-px",
            theme === 'dark' ? 'bg-slate-600/60' : 'bg-slate-300/60'
          )} />
          <div className="flex items-center gap-2.5 pl-1">
            {!isSuperAdmin && (
              <div className="flex items-center gap-1">
                <FileText className={cn(
                  "h-4 w-4",
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                )} />
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
            )}
            {user && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-xs font-semibold">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col text-xs hidden sm:flex">
                  <p className={cn(
                    "font-medium capitalize",
                    theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
                  )}>{user.username}</p>
                  <p className={cn(
                    "text-[10px] capitalize opacity-70",
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                  )}>{user.role?.replace("_", " ") || "User"}</p>
                </div>
              </div>
            )}
          </div>
          <div className={cn(
            "h-5 w-px",
            theme === 'dark' ? 'bg-slate-600/60' : 'bg-slate-300/60'
          )} />
          <ThemeToggle />
          {user && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "ml-1 text-[11px] px-2.5 h-8 rounded-lg font-black uppercase tracking-tight transition-all",
                theme === 'dark'
                  ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  : "text-red-500 hover:text-red-600 hover:bg-red-500/5"
              )}
              onClick={(e) => {
                e.preventDefault();
                logout.mutate();
              }}
            >
              SALIR
            </Button>
          )}
        </div>
      </div>

      <main className="mt-4 flex justify-center relative z-10 animate-in fade-in duration-700">
        <div className="w-full max-w-7xl px-4">
          <Router />
        </div>
      </main>
    </VibrantBackground>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="dte-sv-theme">
        <TooltipProvider>
          <AppContent />
          <Toaster />
          <OfflineIndicator />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;