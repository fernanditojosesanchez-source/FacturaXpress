import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FileText,
  Building2,
  History,
  Settings,
  Receipt,
  FileMinus,
  BarChart3,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Panel de Control",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Nueva Factura",
    url: "/factura/nueva",
    icon: FileText,
  },
  {
    title: "Notas Crédito/Débito",
    url: "/notas",
    icon: FileMinus,
  },
  {
    title: "Historial",
    url: "/historial",
    icon: History,
  },
  {
    title: "Reportes",
    url: "/reportes",
    icon: BarChart3,
  },
];

const configItems = [
  {
    title: "Datos del Emisor",
    url: "/emisor",
    icon: Building2,
  },
  {
    title: "Configuración",
    url: "/configuracion",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar
      variant="floating"
      collapsible="icon"
      className="m-0 mr-4 rounded-2xl border border-white/70 bg-white/85 p-3 shadow-2xl backdrop-blur-xl"
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-500 to-cyan-400 shadow-lg shadow-blue-600/25">
            <Receipt className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold" data-testid="text-app-name">
              FacturaElectrónica
            </span>
            <span className="text-xs text-muted-foreground">
              El Salvador - DTE
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Facturación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace(/\//g, "-").slice(1) || "dashboard"}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace(/\//g, "-").slice(1)}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="rounded-xl border border-white/70 bg-white/80 p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Sistema de facturación electrónica conforme a normativas DGII El Salvador
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
