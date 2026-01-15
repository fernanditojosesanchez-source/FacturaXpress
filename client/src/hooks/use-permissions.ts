import { useAuth } from "./use-auth.js";

export type Permission =
  | "create_invoice"
  | "view_invoices"
  | "transmit_invoice"
  | "invalidate_invoice"
  | "cancel_invoice"
  | "manage_clients"
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

export type Role = "super_admin" | "tenant_admin" | "manager" | "cashier" | "accountant" | "sigma_readonly";

/**
 * Hook para validar permisos y módulos en componentes React
 */
export function usePermissions() {
  const { user } = useAuth();
  const tenant: any = undefined;

  /**
   * Verificar si usuario tiene un permiso específico
   */
  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;

    const permissions = getPermissionsByRole(user.role);
    return permissions.includes(permission);
  };

  /**
   * Verificar si módulo está habilitado para el usuario
   */
  const canAccessModule = (module: Module): boolean => {
    if (!user) return false;

    // Si el usuario tiene módulos personalizados, usar esos
    if (user.modulos_habilitados && typeof user.modulos_habilitados === "object") {
      return user.modulos_habilitados[module] !== false;
    }

    // Si no, usar los módulos del tenant
    if (tenant?.modules && typeof tenant.modules === "object") {
      return tenant.modules[module] !== false;
    }

    // Si no hay información, asumir habilitado
    return true;
  };

  /**
   * Verificar si usuario tiene acceso a una sucursal específica
   */
  const canAccessBranch = (branchId: string): boolean => {
    if (!user) return false;

    // tenant_admin y super_admin acceden a todas
    if (user.role && ["tenant_admin", "super_admin"].includes(user.role)) {
      return true;
    }

    // Si sucursales_asignadas es null, acceso a todas
    if (user.sucursales_asignadas === null) {
      return true;
    }

    // Si es array, verificar si está en la lista
    if (Array.isArray(user.sucursales_asignadas)) {
      return user.sucursales_asignadas.includes(branchId);
    }

    return false;
  };

  /**
   * Obtener lista de módulos disponibles para el usuario
   */
  const getAvailableModules = (): Module[] => {
    if (!user) return [];

    const allModules: Module[] = [
      "inventario",
      "facturacion",
      "reportes",
      "contabilidad",
      "multi_sucursal",
    ];

    return allModules.filter((mod) => canAccessModule(mod));
  };

  /**
   * Obtener lista de permisos del usuario
   */
  const getUserPermissions = (): Permission[] => {
    if (!user) return [];
    return getPermissionsByRole(user.role);
  };

  /**
   * Verificar si el rol es específico
   */
  const isRole = (role: Role): boolean => {
    return user?.role === role;
  };

  /**
   * Verificar si el rol es alguno de los especificados
   */
  const isAnyRole = (roles: Role[]): boolean => {
    if (!user || !user.role) return false;
    return roles.includes(user.role);
  };

  return {
    user,
    tenant,
    hasPermission,
    canAccessModule,
    canAccessBranch,
    getAvailableModules,
    getUserPermissions,
    isRole,
    isAnyRole,
  };
}

/**
 * Obtener permisos por rol (espejo del backend)
 */
export function getPermissionsByRole(role?: Role): Permission[] {
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
        "transmit_invoice",
        "invalidate_invoice",
        "cancel_invoice",
        "manage_clients",
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
        "transmit_invoice",
        "invalidate_invoice",
        "cancel_invoice",
        "manage_clients",
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
        "transmit_invoice",
        "invalidate_invoice",
        "cancel_invoice",
        "manage_clients",
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

/**
 * Componente protegido: Solo renderiza si usuario tiene permiso
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return fallback;
  }

  return children;
}

/**
 * Componente protegido: Solo renderiza si módulo está habilitado
 */
export function ModuleGate({
  module,
  children,
  fallback = null,
}: {
  module: Module;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { canAccessModule } = usePermissions();

  if (!canAccessModule(module)) {
    return fallback;
  }

  return children;
}

/**
 * Componente protegido: Solo renderiza si user tiene rol específico
 */
export function RoleGate({
  role,
  children,
  fallback = null,
}: {
  role: Role | Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isRole, isAnyRole } = usePermissions();

  const hasRole = Array.isArray(role) ? isAnyRole(role) : isRole(role);

  if (!hasRole) {
    return fallback;
  }

  return children;
}
