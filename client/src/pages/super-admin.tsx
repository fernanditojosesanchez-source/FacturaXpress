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
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 animate-fade-in-up">
          <div className="space-y-2">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter italic bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 bg-clip-text text-transparent drop-shadow-2xl dark:from-white dark:via-white/80 dark:to-white/20">
              NEEXUM ADMIN
            </h1>
            <p className="text-blue-600 dark:text-blue-400 font-black tracking-[0.5em] uppercase text-xs opacity-80">NEEXUM Ecosystem // Control Core</p>
          </div>

          <Button
            onClick={() => setIsCreateOpen(true)}
            size="lg"
            className="h-20 px-10 rounded-[2rem] bg-gradient-to-br from-blue-500 to-purple-600 text-white hover:scale-105 active:scale-95 transition-all duration-500 font-black italic tracking-tighter text-2xl shadow-[0_20px_50px_rgba(59,130,246,0.5)] border border-white/20 backdrop-blur-xl"
          >
            <Plus className="h-8 w-8 mr-3 stroke-[4px]" />
            NUEVA EMPRESA
          </Button>
        </div>

        {/* Dashboard Cards Component */}
        <TenantCards metrics={metrics} isLoading={isLoadingMetrics} />

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
