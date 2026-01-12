import { useEffect, useMemo, Suspense, lazy } from "react";
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
import { cn } from "@/lib/utils";
import { User, FileText, Package, Users } from "lucide-react";
import type { Factura } from "@shared/schema";
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
      <Route path="/" component={() => (<Protected><Dashboard /></Protected>)} />
      <Route path="/admin" component={() => (
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <SuperAdminPage />
          </Suspense>
        </Protected>
      )} />
      <Route path="/factura/nueva" component={() => (<Protected><NuevaFactura /></Protected>)} />
      <Route path="/notas" component={() => (
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <NotaCreditoDebito />
          </Suspense>
        </Protected>
      )} />
      <Route path="/historial" component={() => (
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <Historial />
          </Suspense>
        </Protected>
      )} />
      <Route path="/productos" component={() => (
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <ProductosPage />
          </Suspense>
        </Protected>
      )} />
      <Route path="/clientes" component={() => (
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <ClientesPage />
          </Suspense>
        </Protected>
      )} />
      <Route path="/reportes" component={() => (
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <Reportes />
          </Suspense>
        </Protected>
      )} />
      <Route path="/emisor" component={() => (<Protected><Emisor /></Protected>)} />
      <Route path="/configuracion" component={() => (<Protected><Configuracion /></Protected>)} />
      <Route path="/certificados" component={() => (
        <Protected>
          <Suspense fallback={<PageLoader />}>
            <CertificadosPage />
          </Suspense>
        </Protected>
      )} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  
  // Lógica de filtrado de roles aplicada directamente al Header
  const navItems = useMemo(() => {
    const role = user?.role || "cashier"; // Fallback seguro
    
    const allItems = [
      { label: "Dashboard", href: "/", roles: ["super_admin", "tenant_admin", "manager", "cashier"] },
      { label: "Facturas", href: "/factura/nueva", roles: ["super_admin", "tenant_admin", "manager", "cashier"] },
      { label: "Historial", href: "/historial", roles: ["super_admin", "tenant_admin", "manager", "cashier"] },
      { label: "Clientes", href: "/clientes", roles: ["super_admin", "tenant_admin", "manager", "cashier"] },
      { label: "Productos", href: "/productos", roles: ["super_admin", "tenant_admin", "manager"] },
      { label: "Notas", href: "/notas", roles: ["super_admin", "tenant_admin", "manager"] }, 
      { label: "Reportes", href: "/reportes", roles: ["super_admin", "tenant_admin", "manager"] },
      { label: "Certificados", href: "/certificados", roles: ["super_admin", "tenant_admin"] },
      { label: "Configuración", href: "/configuracion", roles: ["super_admin", "tenant_admin"] },
    ];

    const filtered = allItems.filter(item => item.roles.includes(role));

    if (role === "super_admin") {
      filtered.unshift({ label: "Admin SaaS", href: "/admin", roles: ["super_admin"] });
    }

    return filtered;
  }, [user]);

  const [location, navigate] = useLocation();

  const { data: facturas } = useQuery<Factura[]> ({
    queryKey: ["/api/facturas"],
    enabled: !!user,
  });

  const { data: emisor } = useQuery<any>({
    queryKey: ["/api/emisor"],
    enabled: !!user,
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
  }, [navigate]);

  // Determinar el fondo según el tema
  const bgClass = theme === 'dark' 
    ? 'bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900' 
    : 'relative';
  
  const navBgClass = theme === 'dark'
    ? 'border-slate-700/40 bg-slate-800/60'
    : 'border-slate-200/60 bg-white/70';

  return (
    <div className={cn("min-h-screen w-full transition-colors duration-500 ease-out p-6", bgClass)}>
      {theme === 'light' && (
        <svg className="fixed inset-0 w-full h-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: 'none', zIndex: 0, filter: 'blur(5px)' }}>
          <defs>
            <radialGradient id="lightRadial1" cx="30%" cy="20%" r="50%">
              <stop offset="0%" stopColor="#d9d3c8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#c9bfb4" stopOpacity="0.3" />
            </radialGradient>
            <radialGradient id="lightRadial2" cx="70%" cy="75%" r="45%">
              <stop offset="0%" stopColor="#cfc9be" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#b8b3a8" stopOpacity="0.2" />
            </radialGradient>
            <radialGradient id="lightRadial3" cx="80%" cy="30%" r="40%">
              <stop offset="0%" stopColor="#d4cfc4" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#c9bfb4" stopOpacity="0.15" />
            </radialGradient>
            <linearGradient id="lightWave1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c9bfb4" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#a8a39a" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          
          {/* Background base */}
          <rect width="1440" height="900" fill="#e8e3dc" />
          
          {/* Large flowing shapes - similar to template */}
          <circle cx="-200" cy="100" r="450" fill="url(#lightRadial1)" />
          <circle cx="1300" cy="800" r="500" fill="url(#lightRadial2)" />
          <circle cx="1400" cy="-100" r="400" fill="url(#lightRadial3)" />
          
          {/* Wavy organic paths */}
          <path d="M0,350 Q360,250 720,350 T1440,350 L1440,500 Q1080,600 720,500 T0,500 Z" fill="url(#lightWave1)" opacity="0.5" />
          <path d="M0,600 Q240,500 480,600 T960,550 Q1200,580 1440,600 L1440,900 L0,900 Z" fill="#d4cfc4" opacity="0.35" />
          
          {/* Subtle accent curves */}
          <path d="M0,200 Q300,150 600,200 T1440,180" stroke="#c9bfb4" strokeWidth="2" fill="none" opacity="0.2" />
          <path d="M0,750 Q400,700 800,750 T1440,720" stroke="#a8a39a" strokeWidth="1.5" fill="none" opacity="0.15" />
        </svg>
      )}
      {theme === 'dark' && (
        <svg className="fixed inset-0 w-full h-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: 'none', zIndex: 0, filter: 'blur(6px)' }}>
          <defs>
            <linearGradient id="darkGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="darkGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0c4a6e" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          
          {/* Background base - Dark slate */}
          <rect width="1440" height="900" fill="#0f172a" />
          
          {/* Elegant dark silhouettes with blue accents */}
          <path d="M0,150 Q300,80 600,120 T1440,100 L1440,0 L0,0 Z" fill="url(#darkGrad1)" opacity="0.6" />
          <path d="M1440,650 Q1100,550 700,600 T0,550 L0,900 L1440,900 Z" fill="url(#darkGrad1)" opacity="0.5" />
          <path d="M0,400 Q200,350 400,380 T800,360 Q1000,355 1440,400 L1440,600 Q1200,630 900,610 T300,650 L0,620 Z" fill="url(#darkGrad2)" opacity="0.4" />
          
          {/* Elegant shapes with glow effect */}
          <circle cx="150" cy="750" r="280" fill="#1e3a8a" opacity="0.15" />
          <circle cx="1350" cy="200" r="320" fill="#0c4a6e" opacity="0.12" />
          <ellipse cx="700" cy="450" rx="380" ry="180" fill="#1e293b" opacity="0.08" />
          
          {/* Accent lines for elegance */}
          <line x1="0" y1="200" x2="1440" y2="200" stroke="#1e3a8a" strokeWidth="1" opacity="0.1" />
          <line x1="0" y1="700" x2="1440" y2="700" stroke="#1e3a8a" strokeWidth="1" opacity="0.08" />
        </svg>
      )}
      <div className="relative z-10 flex justify-center">
        <div className={cn(
          "flex items-center gap-2.5 rounded-2xl border px-5 py-3 backdrop-blur-xl transition-all duration-300",
          navBgClass,
          theme === 'dark' 
            ? 'shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30' 
            : 'shadow-md shadow-slate-200/50 hover:shadow-lg hover:shadow-slate-300/60'
        )}>
          {emisor?.logo && (
            <>
              <img 
                src={emisor.logo} 
                alt="Logo" 
                className="h-6 object-contain"
              />
              <div className={cn(
                "h-5 w-px",
                theme === 'dark' ? 'bg-slate-600/60' : 'bg-slate-300/60'
              )} />
            </>
          )}
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-2 text-sm font-500 rounded-lg transition-all duration-200",
                location === item.href
                  ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md"
                  : theme === 'dark'
                  ? "text-slate-300/90 hover:text-slate-100 hover:bg-slate-700/50"
                  : "text-slate-600 hover:text-slate-800 hover:bg-slate-200/50"
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
              variant="outline"
              size="sm"
              className="ml-1 text-xs px-2.5"
              onClick={(e) => {
                e.preventDefault();
                logout.mutate();
              }}
            >
              Salir
            </Button>
          )}
        </div>
      </div>

      <main className="mt-6 flex justify-center relative z-10">
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
          <OfflineIndicator />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;