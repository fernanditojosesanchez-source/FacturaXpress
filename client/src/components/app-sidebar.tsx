import { Home, Receipt, FileText, Settings, Key, Building2, Ticket } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

// Definición de ítems con roles permitidos
const items = [
  {
    title: "Panel de Control",
    url: "/",
    icon: Home,
    roles: ["super_admin", "tenant_admin", "manager", "cashier"],
  },
  {
    title: "Nueva Factura",
    url: "/factura/nueva",
    icon: Receipt,
    roles: ["super_admin", "tenant_admin", "manager", "cashier"],
  },
  {
    title: "Notas C/D",
    url: "/notas",
    icon: Ticket,
    roles: ["super_admin", "tenant_admin", "manager"], // Cajeros no deberían emitir notas libremente
  },
  {
    title: "Historial",
    url: "/historial",
    icon: FileText,
    roles: ["super_admin", "tenant_admin", "manager", "cashier"],
  },
  {
    title: "Reportes",
    url: "/reportes",
    icon: FileText,
    roles: ["super_admin", "tenant_admin", "manager"], // Managers sí, cajeros no
  },
  {
    title: "Configuración",
    url: "/configuracion",
    icon: Settings,
    roles: ["super_admin", "tenant_admin"], // Solo dueños
  },
];

const superAdminItems = [
  {
    title: "Gestión Empresas",
    url: "/admin",
    icon: Building2,
    roles: ["super_admin"],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const userRole = user?.role || "cashier"; // Fallback seguro

  const filteredItems = items.filter(item => item.roles.includes(userRole));
  const adminItems = superAdminItems.filter(item => item.roles.includes(userRole));

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          FacturaXpress
        </h2>
        <p className="text-xs text-muted-foreground capitalize">
          {userRole.replace("_", " ")}
        </p>
      </SidebarHeader>
      <SidebarContent>
        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location === item.url}
                      tooltip={item.title}
                    >
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Operaciones</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    tooltip={item.title}
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
