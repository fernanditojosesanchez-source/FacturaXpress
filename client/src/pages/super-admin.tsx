import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useAdminMetrics, useSuspendTenant, useDeleteTenant, useCreateTenant } from "@/hooks/use-admin";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Plus } from "lucide-react";

// Atomic Components
import { TenantCards } from "@/components/admin/TenantCards";
import { TenantTable, Tenant } from "@/components/admin/TenantTable";
import { CreateTenantDialog } from "@/components/admin/CreateTenantDialog";
import { EditTenantDialog } from "@/components/admin/EditTenantDialog";
import { TenantDetailsDialog } from "@/components/admin/TenantDetailsDialog";
import { CredentialsDialog } from "@/components/admin/CredentialsDialog";

export default function SuperAdminPage() {
  const { user } = useAuth();

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [credentialsTenant, setCredentialsTenant] = useState<Tenant | null>(null);
  const [viewDetailsTenant, setViewDetailsTenant] = useState<Tenant | null>(null);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

  // Proteger acceso solo para super_admin
  if (user?.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Alert variant="destructive" className="max-w-md border-red-500/50 bg-red-500/10 backdrop-blur-xl rounded-[2rem]">
          <AlertCircle className="h-6 w-6" />
          <AlertDescription className="font-bold text-lg">
            Acceso restringido. Solo administradores autorizados pueden acceder a este núcleo.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Data Fetching
  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ["admin", "tenants"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tenants", { credentials: "include" });
      if (!res.ok) throw new Error("Error al listar empresas");
      return res.json();
    },
    retry: false,
  });

  const { data: metrics, isLoading: isLoadingMetrics } = useAdminMetrics();

  // Management Hooks
  const createMutation = useCreateTenant(() => setIsCreateOpen(false));
  const suspendMutation = useSuspendTenant();
  const deleteMutation = useDeleteTenant(() => setTenantToDelete(null));

  const handleToggleStatus = (tenant: Tenant) => {
    const nuevoEstado = tenant.estado === "activo" ? "suspendido" : "activo";
    suspendMutation.mutate({ tenantId: tenant.id, estado: nuevoEstado });
  };

  return (
    <div className="min-h-screen text-slate-800 selection:bg-blue-500/30">
      {/* Super Admin specific overlay - Subtle glass effect for the whole page */}
      <div className="fixed inset-0 -z-10 bg-white/10 dark:bg-black/20 pointer-events-none" />

      <div className="relative p-6 sm:p-12 space-y-12 max-w-7xl mx-auto">

        {/* Dashboard Cards Component */}
        <TenantCards 
          metrics={metrics} 
          isLoading={isLoadingMetrics} 
          onNewTenant={() => setIsCreateOpen(true)} 
        />

        {/* Main Data Table Component */}
        <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <TenantTable
            tenants={tenants}
            isLoading={isLoading}
            onViewDetails={setViewDetailsTenant}
            onEdit={setEditTenant}
            onCredentials={setCredentialsTenant}
            onToggleStatus={handleToggleStatus}
            onDelete={setTenantToDelete}
          />
        </div>
      </div>

      {/* Orchestrated Management Dialogs */}
      <CreateTenantDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={createMutation.mutate}
        isPending={createMutation.isPending}
      />

      <EditTenantDialog
        open={!!editTenant}
        onOpenChange={(open) => !open && setEditTenant(null)}
        tenant={editTenant}
      />

      <TenantDetailsDialog
        open={!!viewDetailsTenant}
        onOpenChange={(open) => !open && setViewDetailsTenant(null)}
        tenant={viewDetailsTenant}
      />

      <CredentialsDialog
        open={!!credentialsTenant}
        onOpenChange={(open) => !open && setCredentialsTenant(null)}
        tenant={credentialsTenant}
      />

      {/* Confirmation Dialogs */}
      <AlertDialog open={!!tenantToDelete} onOpenChange={(open) => !open && setTenantToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-white/10 text-white rounded-3xl backdrop-blur-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black">¿Confirmar Eliminación?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta operación eliminará permanentemente a <strong>{tenantToDelete?.nombre}</strong> del ecosistema.
              Todos los datos relacionados (DTEs, usuarios, inventario) se perderán irremediablemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tenantToDelete && deleteMutation.mutate(tenantToDelete.id)}
              className="bg-red-500 hover:bg-red-600 font-bold"
            >
              Eliminar Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
