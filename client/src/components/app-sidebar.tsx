import { 
  Home, Receipt, FileText, Settings, Key, Building2, Ticket, Package, 
  Users, BarChart3, Download, Shield, LogOut, CreditCard, AlertCircle
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { data: authData, logout } = useAuth();
  const { user, tenant } = authData || {};
  const { hasPermission, canAccessModule, isRole } = usePermissions();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout.mutateAsync();
  };

  // Definición de secciones del menú
  const sections = [
    {
      title: "Principal",
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: Home,
          permission: "view_dashboard",
        },
      ],
    },
    {
      title: "Facturación",
      items: [
        {
          title: "Nueva Factura",
          url: "/nueva-factura",
          icon: Receipt,
          permission: "create_invoice",
        },
        {
          title: "Historial",
          url: "/historial",
          icon: FileText,
          permission: "view_invoices",
        },
        {
          title: "Notas C/D",
          url: "/nota-credito-debito",
          icon: Ticket,
          permission: "create_invoice",
        },
      ],
      module: "facturacion",
    },
    {
      title: "Negocio",
      items: [
        {
          title: "Clientes",
          url: "/emisor",
          icon: Users,
          permission: "manage_inventory",
        },
        {
          title: "Productos",
          url: "/productos",
          icon: Package,
          permission: "manage_products",
        },
      ],
      module: "inventario",
    },
    {
      title: "Reportes",
      items: [
        {
          title: "Reportes",
          url: "/reportes",
          icon: BarChart3,
          permission: "view_reports",
        },
        {
          title: "Descargar Libros",
          url: "/reportes/libros",
          icon: Download,
          permission: "download_books",
        },
      ],
      module: "reportes",
    },
    {
      title: "Configuración",
      items: [
        {
          title: "Empresa",
          url: "/configuracion",
          icon: Settings,
          permission: "configure_company",
        },
        {
          title: "Usuarios",
          url: "/usuarios",
          icon: Users,
          permission: "manage_users",
        },
      ],
      requireAdmin: true,
    },
    {
      title: "Super Admin",
      items: [
        {
          title: "Administración",
          url: "/super-admin",
          icon: Shield,
          permission: "manage_all_tenants",
        },
        {
          title: "Planes",
          url: "/planes",
          icon: CreditCard,
          permission: "manage_plans",
        },
      ],
      requireSuperAdmin: true,
    },
  ];

  return (
    <Sidebar className="border-r">
      {/* Header */}
      <SidebarHeader className="space-y-4 border-b p-4">
        <div>
          <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            FacturaXpress
          </h2>
          {tenant && (
            <p className="text-xs text-muted-foreground">{tenant.nombre}</p>
          )}
        </div>

        {/* User Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">
                  {user.nombre?.charAt(0) || user.username.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.nombre || user.username}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Role Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {user.role.replace(/_/g, " ").toUpperCase()}
            </Badge>
            {tenant?.origen === "sigma" && (
              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-900">
                SIGMA
              </Badge>
            )}
          </div>
        </div>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent className="flex-1">
        {sections.map((section) => {
          // Filtrar secciones según permisos
          if (section.requireSuperAdmin && !isRole("super_admin")) {
            return null;
          }

          if (section.requireAdmin && !isRole(["tenant_admin", "super_admin"])) {
            return null;
          }

          // Filtrar módulos
          if (section.module && !canAccessModule(section.module as any)) {
            return null;
          }

          // Filtrar items dentro de la sección
          const visibleItems = section.items.filter((item) =>
            hasPermission(item.permission as any)
          );

          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <SidebarGroup key={section.title}>
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.url;

                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={isActive ? "bg-primary/10" : ""}
                          onClick={() => navigate(item.url)}
                        >
                          <a href={item.url} className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t p-4">
        <div className="space-y-2">
          {/* Alerta si hay problemas de acceso */}
          {user.sucursales_asignadas && Array.isArray(user.sucursales_asignadas) && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 rounded text-xs text-amber-900">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>Acceso limitado a {user.sucursales_asignadas.length} sucursal(es)</span>
            </div>
          )}

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start text-left"
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="flex-1 truncate">{user.nombre || user.username}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user.nombre || user.username}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />

              {/* Mostrar opciones según rol */}
              {isRole(["tenant_admin", "super_admin"]) && (
                <>
                  <DropdownMenuItem onClick={() => navigate("/usuarios")}>
                    <Users className="h-4 w-4 mr-2" />
                    Gestionar Usuarios
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuItem onClick={() => navigate("/configuracion")}>
                <Settings className="h-4 w-4 mr-2" />
                Configuración
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="text-red-600"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {isLoggingOut ? "Cerrando..." : "Cerrar Sesión"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
