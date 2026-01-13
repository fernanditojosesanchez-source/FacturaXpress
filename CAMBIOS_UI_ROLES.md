# 🎨 Cambios de UI Requeridos

## 1️⃣ Componente: Sidebar Dinámico por Rol

**Archivo:** `client/src/components/app-sidebar.tsx`

Cambios requeridos:

```typescript
// Importar hook
import { useAuth } from "@/hooks/use-auth";

// En el componente:
export function AppSidebar() {
  const { user } = useAuth();

  // Obtener módulos disponibles
  const canAccessModule = (module: string) => {
    if (!user?.modulos_habilitados) return true; // Heredar del tenant
    return user.modulos_habilitados[module] !== false;
  };

  return (
    <SidebarContent>
      {/* Siempre visible */}
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link to="/dashboard">
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Mostrar si rol permite */}
      {["tenant_admin", "manager", "cashier"].includes(user?.role) && (
        <SidebarMenu>
          <SidebarMenuSub>
            <h3 className="text-xs font-semibold uppercase tracking-wider px-4 py-2">
              Facturación
            </h3>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/nueva-factura">
                  <FileText className="w-4 h-4" />
                  <span>Nueva Factura</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/historial">
                  <History className="w-4 h-4" />
                  <span>Historial</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenuSub>
        </SidebarMenu>
      )}

      {/* Mostrar solo si módulo "inventario" está habilitado */}
      {canAccessModule("inventario") && (
        <SidebarMenu>
          <SidebarMenuSub>
            <h3 className="text-xs font-semibold uppercase tracking-wider px-4 py-2">
              Inventario
            </h3>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/productos">
                  <Package className="w-4 h-4" />
                  <span>Productos</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenuSub>
        </SidebarMenu>
      )}

      {/* Mostrar solo si módulo "reportes" está habilitado */}
      {canAccessModule("reportes") && (
        <SidebarMenu>
          <SidebarMenuSub>
            <h3 className="text-xs font-semibold uppercase tracking-wider px-4 py-2">
              Reportes
            </h3>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/reportes">
                  <BarChart3 className="w-4 h-4" />
                  <span>Reportes</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {/* Mostrar solo si rol permite descargar */}
            {["tenant_admin", "accountant"].includes(user?.role) && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/reportes/libros">
                      <Download className="w-4 h-4" />
                      <span>Descargar Libros</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenuSub>
        </SidebarMenu>
      )}

      {/* Mostrar solo si rol es tenant_admin */}
      {user?.role === "tenant_admin" && (
        <SidebarMenu>
          <SidebarMenuSub>
            <h3 className="text-xs font-semibold uppercase tracking-wider px-4 py-2">
              Administración
            </h3>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/configuracion">
                  <Settings className="w-4 h-4" />
                  <span>Configuración</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/usuarios">
                  <Users className="w-4 h-4" />
                  <span>Usuarios</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenuSub>
        </SidebarMenu>
      )}

      {/* Mostrar solo si rol es super_admin */}
      {user?.role === "super_admin" && (
        <SidebarMenu>
          <SidebarMenuSub>
            <h3 className="text-xs font-semibold uppercase tracking-wider px-4 py-2">
              SaaS Admin
            </h3>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/super-admin">
                  <Shield className="w-4 h-4" />
                  <span>Administración</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/planes">
                  <CreditCard className="w-4 h-4" />
                  <span>Planes</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenuSub>
        </SidebarMenu>
      )}
    </SidebarContent>
  );
}
```

---

## 2️⃣ Hook: `usePermissions`

**Archivo:** `client/src/hooks/use-permissions.ts`

```typescript
import { useAuth } from "./use-auth";

export type Permission =
  | "create_invoice"
  | "view_invoices"
  | "cancel_invoice"
  | "manage_inventory"
  | "manage_products"
  | "manage_branches"
  | "manage_users"
  | "assign_roles"
  | "view_reports"
  | "download_books"
  | "export_data"
  | "configure_company"
  | "configure_mh_credentials"
  | "view_dashboard"
  | "view_global_metrics"
  | "manage_all_tenants"
  | "manage_plans"
  | "view_financial_dashboard"
  | "view_inventory_branch"
  | "request_transfers"
  | "view_reports_branch"
  | "view_dashboard_branch"
  | "view_stock"
  | "search_products"
  | "search_invoices"
  | "download_pdf"
  | "view_audit_logs"
  | "manage_integrations";

export type Module = "inventario" | "facturacion" | "reportes" | "contabilidad" | "multi_sucursal";

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    
    const permissions = getPermissionsByRole(user.role);
    return permissions.includes(permission);
  };

  const canAccessModule = (module: Module): boolean => {
    if (!user) return false;
    
    // Si el usuario tiene módulos personalizados, usar esos
    if (user.modulos_habilitados && typeof user.modulos_habilitados === "object") {
      return user.modulos_habilitados[module] !== false;
    }
    
    // Si no, asumir que están habilitados (hereda del tenant)
    return true;
  };

  const canAccessBranch = (branchId: string): boolean => {
    if (!user) return false;
    
    // tenant_admin y super_admin acceden a todas
    if (["tenant_admin", "super_admin"].includes(user.role)) {
      return true;
    }
    
    // manager y cashier solo a sus asignadas
    if (user.sucursales_asignadas === null) return true; // null = acceso a todas
    if (Array.isArray(user.sucursales_asignadas)) {
      return user.sucursales_asignadas.includes(branchId);
    }
    
    return false;
  };

  return {
    hasPermission,
    canAccessModule,
    canAccessBranch,
    user,
  };
}

function getPermissionsByRole(role: string): Permission[] {
  switch (role) {
    case "super_admin":
      return [
        "view_global_metrics",
        "manage_all_tenants",
        "manage_plans",
        "manage_integrations",
        "view_audit_logs",
        "create_invoice",
        "view_invoices",
        "cancel_invoice",
        "manage_inventory",
        "manage_products",
        "manage_branches",
        "manage_users",
        "assign_roles",
        "view_reports",
        "download_books",
        "export_data",
        "configure_company",
        "configure_mh_credentials",
        "view_dashboard",
      ];

    case "tenant_admin":
      return [
        "create_invoice",
        "view_invoices",
        "cancel_invoice",
        "manage_inventory",
        "manage_products",
        "manage_branches",
        "manage_users",
        "assign_roles",
        "view_reports",
        "download_books",
        "export_data",
        "configure_company",
        "configure_mh_credentials",
        "view_dashboard",
        "view_audit_logs",
      ];

    case "manager":
      return [
        "create_invoice",
        "view_invoices",
        "cancel_invoice",
        "view_inventory_branch",
        "request_transfers",
        "view_reports_branch",
        "view_dashboard_branch",
      ];

    case "cashier":
      return [
        "create_invoice",
        "view_invoices",
        "view_stock",
        "search_products",
      ];

    case "accountant":
      return [
        "view_invoices",
        "view_reports",
        "download_books",
        "export_data",
        "view_financial_dashboard",
      ];

    case "sigma_readonly":
      return [
        "view_invoices",
        "search_invoices",
        "download_pdf",
      ];

    default:
      return [];
  }
}
```

---

## 3️⃣ Componente: Gestión de Usuarios

**Archivo:** `client/src/pages/usuarios.tsx`

```typescript
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit2, Plus } from "lucide-react";

export default function Usuarios() {
  const { user, tenant } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Verificar permiso
  if (!hasPermission("manage_users")) {
    return (
      <div className="p-6">
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-red-700">No tienes permiso para gestionar usuarios</p>
        </div>
      </div>
    );
  }

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios", tenant?.id],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenant?.id}/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      return res.json();
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/tenants/${tenant?.id}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Usuario creado", description: "El usuario ha sido creado exitosamente" });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      setOpen(false);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/tenants/${tenant?.id}/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Error eliminando usuario");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Usuario eliminado", description: "El usuario ha sido eliminado" });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
        {hasPermission("manage_users") && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Usuario
          </Button>
        )}
      </div>

      {isLoading ? (
        <div>Cargando...</div>
      ) : (
        <div className="grid gap-4">
          {usuarios?.map((u: any) => (
            <Card key={u.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{u.nombre || u.username}</CardTitle>
                    <CardDescription>{u.email || "Sin email"}</CardDescription>
                  </div>
                  <Badge variant={u.activo ? "default" : "destructive"}>
                    {u.role}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Usuario</p>
                    <p className="font-mono">{u.username}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Rol</p>
                    <p className="font-semibold">{u.role}</p>
                  </div>
                  {u.sucursales_asignadas && (
                    <div className="col-span-2">
                      <p className="text-gray-600">Sucursales</p>
                      <p className="text-sm">
                        {Array.isArray(u.sucursales_asignadas) 
                          ? `${u.sucursales_asignadas.length} asignadas`
                          : "Acceso a todas"}
                      </p>
                    </div>
                  )}
                  {u.ultimo_acceso && (
                    <div className="col-span-2">
                      <p className="text-gray-600">Último acceso</p>
                      <p className="text-sm">{new Date(u.ultimo_acceso).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {hasPermission("manage_users") && (
                  <div className="flex gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditingId(u.id)}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => deleteUserMutation.mutate(u.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para crear usuario */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <CrearUsuarioForm
            onSubmit={(data) => createUserMutation.mutate(data)}
            loading={createUserMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CrearUsuarioForm({ onSubmit, loading }: any) {
  const [data, setData] = useState({
    username: "",
    email: "",
    nombre: "",
    password: "",
    role: "cashier",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(data);
      }}
      className="space-y-4"
    >
      <Input
        placeholder="Usuario"
        value={data.username}
        onChange={(e) => setData({ ...data, username: e.target.value })}
        required
      />
      <Input
        type="email"
        placeholder="Email"
        value={data.email}
        onChange={(e) => setData({ ...data, email: e.target.value })}
      />
      <Input
        placeholder="Nombre completo"
        value={data.nombre}
        onChange={(e) => setData({ ...data, nombre: e.target.value })}
      />
      <Input
        type="password"
        placeholder="Contraseña"
        value={data.password}
        onChange={(e) => setData({ ...data, password: e.target.value })}
        required
      />
      <Select value={data.role} onValueChange={(role) => setData({ ...data, role })}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cashier">Cajero</SelectItem>
          <SelectItem value="manager">Gerente</SelectItem>
          <SelectItem value="accountant">Contador</SelectItem>
          <SelectItem value="sigma_readonly">Lectura Solo</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creando..." : "Crear Usuario"}
      </Button>
    </form>
  );
}
```

---

## 4️⃣ Cambios en Rutas Existentes

### Nueva Factura (`client/src/pages/nueva-factura.tsx`)

```typescript
import { usePermissions } from "@/hooks/use-permissions";

export default function NuevaFactura() {
  const { hasPermission, canAccessBranch } = usePermissions();

  if (!hasPermission("create_invoice")) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg">
        <p className="text-yellow-700">
          No tienes permiso para crear facturas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mostrar formulario solo si tiene permiso */}
      <FacturaForm
        onSubmit={handleSubmit}
        canAccessBranch={canAccessBranch}
      />
    </div>
  );
}
```

### Reportes (`client/src/pages/reportes.tsx`)

```typescript
import { usePermissions } from "@/hooks/use-permissions";

export default function Reportes() {
  const { hasPermission, canAccessModule } = usePermissions();

  return (
    <div className="space-y-6">
      {canAccessModule("reportes") ? (
        <>
          {hasPermission("download_books") && (
            <Card>
              <CardHeader>
                <CardTitle>Descargar Libros Contables</CardTitle>
              </CardHeader>
              <CardContent>
                <DescargarLibrosForm />
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="p-6 bg-gray-50 rounded-lg">
          <p className="text-gray-700">Módulo de reportes no disponible</p>
        </div>
      )}
    </div>
  );
}
```

---

## ✅ Checklist de Cambios UI

- [ ] Actualizar `app-sidebar.tsx` con lógica condicional
- [ ] Crear hook `use-permissions.ts`
- [ ] Crear página `usuarios.tsx` para gestión
- [ ] Actualizar `nueva-factura.tsx` con validaciones
- [ ] Actualizar `reportes.tsx` con módulo check
- [ ] Actualizar `configuracion.tsx` (solo tenant_admin)
- [ ] Actualizar `historial.tsx` con permisos
- [ ] Agregar badges de rol en header
- [ ] Mostrar indicador de sucursal asignada (manager)
- [ ] Manejo de errores 403 en todos lados

---

## 🎨 Iconos/Estilos Sugeridos

```typescript
// Mostrar rol como badge
<Badge variant={user.role === "super_admin" ? "destructive" : "default"}>
  {user.role}
</Badge>

// Mostrar permisos como lista
{user.modulos_habilitados && (
  <div className="text-sm space-y-1">
    {Object.entries(user.modulos_habilitados).map(([module, enabled]) => (
      <div key={module} className="flex items-center gap-2">
        {enabled ? (
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600" />
        )}
        <span>{module}</span>
      </div>
    ))}
  </div>
)}
```
