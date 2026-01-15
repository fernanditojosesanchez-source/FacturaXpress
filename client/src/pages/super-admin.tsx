import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useAdminMetrics, useSuspendTenant, useDeleteTenant } from "@/hooks/use-admin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Key,
  Loader2,
  Plus,
  Shield,
  MoreHorizontal,
  Eye,
  Edit,
  Pause,
  Play,
  Trash2,
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Tenant = {
  id: string;
  nombre: string;
  slug: string;
  tipo: string;
  estado: string;
  createdAt: string;
};

export default function SuperAdminPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [viewDetailsTenant, setViewDetailsTenant] = useState<Tenant | null>(null);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);

  // Proteger acceso solo para super_admin
  if (user?.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-white">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Acceso denegado. Este panel es solo para administradores SaaS.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Queries
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

  // Mutations
  const createTenantMutation = useMutation({
    mutationFn: async (data: { nombre: string; slug: string; tipo: string }) => {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
      setIsCreateOpen(false);
      toast({ title: "Éxito", description: "Empresa creada correctamente" });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    },
  });

  const suspendTenantMutation = useSuspendTenant();
  const deleteTenantMutation = useDeleteTenant();

  const handleToggleStatus = (tenant: Tenant) => {
    const nuevoEstado = tenant.estado === "activo" ? "suspendido" : "activo";
    suspendTenantMutation.mutate({ tenantId: tenant.id, estado: nuevoEstado });
  };

  const handleDeleteTenant = () => {
    if (tenantToDelete) {
      deleteTenantMutation.mutate(tenantToDelete.id);
      setTenantToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
      {/* Formas fluidas de fondo - Orbes animadas */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-40 right-1/4 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative p-6 sm:p-8 lg:p-12 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 animate-fade-in-up">
          <div>
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight bg-gradient-to-r from-blue-200 via-purple-200 to-emerald-200 bg-clip-text text-transparent">
              Panel SaaS
            </h1>
            <p className="text-lg text-blue-200/70 mt-3">
              Gestión completa de empresas y usuarios
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button 
                size="lg"
                className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 text-white shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 font-bold text-lg"
              >
                <Plus className="h-6 w-6 mr-2" />
                Nueva Empresa
              </Button>
            </DialogTrigger>
            {/* Dialog content continues below */}
          </Dialog>
        </div>

        {/* Métricas Dashboard - ULTRA PREMIUM */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <Card className="relative overflow-hidden backdrop-blur-2xl rounded-3xl border border-blue-400/30 shadow-[0_35px_60px_-15px_rgba(59,130,246,0.4)] hover:shadow-[0_50px_80px_-20px_rgba(59,130,246,0.5)] transition-all duration-500 group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 to-blue-600/5 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent opacity-60 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent opacity-50 pointer-events-none" />
            <div className="absolute inset-0 rounded-3xl border border-white/40 pointer-events-none" />
            
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0 pt-8 px-8">
              <CardTitle className="text-xs font-bold text-white/90 tracking-widest uppercase opacity-90">
                Total Empresas
              </CardTitle>
              <div className="p-4 rounded-2xl backdrop-blur-lg bg-blue-500/15 border border-white/40 shadow-2xl">
                <Building2 className="h-6 w-6 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent className="relative pt-6 px-8 pb-8">
              <div className="text-6xl font-black tracking-tight text-white drop-shadow-lg mb-3">
                {isLoadingMetrics ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  metrics?.totalEmpresas || 0
                )}
              </div>
              <p className="text-sm text-white/80 font-medium">Clientes registrados</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden backdrop-blur-2xl rounded-3xl border border-emerald-400/30 shadow-[0_35px_60px_-15px_rgba(16,185,129,0.4)] hover:shadow-[0_50px_80px_-20px_rgba(16,185,129,0.5)] transition-all duration-500 group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-60 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent opacity-50 pointer-events-none" />
            <div className="absolute inset-0 rounded-3xl border border-white/40 pointer-events-none" />
            
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0 pt-8 px-8">
              <CardTitle className="text-xs font-bold text-white/90 tracking-widest uppercase opacity-90">
                Empresas Activas
              </CardTitle>
              <div className="p-4 rounded-2xl backdrop-blur-lg bg-emerald-500/15 border border-white/40 shadow-2xl">
                <TrendingUp className="h-6 w-6 text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent className="relative pt-6 px-8 pb-8">
              <div className="text-6xl font-black tracking-tight text-white drop-shadow-lg mb-3">
                {isLoadingMetrics ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  metrics?.empresasActivas || 0
                )}
              </div>
              <p className="text-sm text-white/80 font-medium">En operación actual</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden backdrop-blur-2xl rounded-3xl border border-purple-400/30 shadow-[0_35px_60px_-15px_rgba(168,85,247,0.4)] hover:shadow-[0_50px_80px_-20px_rgba(168,85,247,0.5)] transition-all duration-500 group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/15 to-purple-600/5 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent opacity-60 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent opacity-50 pointer-events-none" />
            <div className="absolute inset-0 rounded-3xl border border-white/40 pointer-events-none" />
            
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0 pt-8 px-8">
              <CardTitle className="text-xs font-bold text-white/90 tracking-widest uppercase opacity-90">
                Total Usuarios
              </CardTitle>
              <div className="p-4 rounded-2xl backdrop-blur-lg bg-purple-500/15 border border-white/40 shadow-2xl">
                <Users className="h-6 w-6 text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="relative pt-6 px-8 pb-8">
              <div className="text-6xl font-black tracking-tight text-white drop-shadow-lg mb-3">
                {isLoadingMetrics ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  metrics?.totalUsuarios || 0
                )}
              </div>
              <p className="text-sm text-white/80 font-medium">Usuarios del sistema</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden backdrop-blur-2xl rounded-3xl border border-amber-400/30 shadow-[0_35px_60px_-15px_rgba(217,119,6,0.4)] hover:shadow-[0_50px_80px_-20px_rgba(217,119,6,0.5)] transition-all duration-500 group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 to-amber-600/5 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent opacity-60 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent opacity-50 pointer-events-none" />
            <div className="absolute inset-0 rounded-3xl border border-white/40 pointer-events-none" />
            
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0 pt-8 px-8">
              <CardTitle className="text-xs font-bold text-white/90 tracking-widest uppercase opacity-90">
                Total Facturas
              </CardTitle>
              <div className="p-4 rounded-2xl backdrop-blur-lg bg-amber-500/15 border border-white/40 shadow-2xl">
                <FileText className="h-6 w-6 text-amber-400" />
              </div>
            </CardHeader>
            <CardContent className="relative pt-6 px-8 pb-8">
              <div className="text-6xl font-black tracking-tight text-white drop-shadow-lg mb-3">
                {isLoadingMetrics ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  metrics?.totalFacturas || 0
                )}
              </div>
              <p className="text-sm text-white/80 font-medium">Documentos emitidos</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 relative z-10">
            <div className="flex justify-end">
              <Button 
                onClick={() => setIsCreateOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-[0_25px_50px_-12px_rgba(59,130,246,0.4)] text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
              >
                <Plus className="mr-2 h-5 w-5" /> Nueva Empresa
              </Button>
            </div>

            <Card className="relative overflow-hidden backdrop-blur-3xl rounded-3xl border border-white/20 shadow-[0_35px_60px_-15px_rgba(59,130,246,0.3)] hover:shadow-[0_50px_80px_-20px_rgba(59,130,246,0.4)] transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-600/5 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 to-transparent opacity-40 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-40 pointer-events-none" />
              <div className="absolute inset-0 rounded-3xl border border-white/30 pointer-events-none" />
              
              <CardHeader className="relative border-b border-white/10">
                <CardTitle className="text-2xl font-black text-white drop-shadow-lg">Empresas Registradas</CardTitle>
              </CardHeader>
              <CardContent className="relative overflow-x-auto pt-6">
                <Table>
                  <TableHeader className="sticky top-0 z-20">
                    <TableRow className="border-b border-white/15 hover:bg-white/5">
                      <TableHead className="font-bold text-white drop-shadow-md">Nombre</TableHead>
                      <TableHead className="font-bold text-white drop-shadow-md">Slug (URL)</TableHead>
                      <TableHead className="font-bold text-white drop-shadow-md">Tipo</TableHead>
                      <TableHead className="font-bold text-white drop-shadow-md">Estado</TableHead>
                      <TableHead className="font-bold text-white drop-shadow-md">Registro</TableHead>
                      <TableHead className="text-right font-bold text-white drop-shadow-md">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : tenants?.map((tenant) => (
                      <TableRow key={tenant.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                        <TableCell className="font-semibold text-white drop-shadow-sm">
                          {tenant.nombre}
                        </TableCell>
                        <TableCell className="text-white/80 font-mono text-sm drop-shadow-sm">{tenant.slug}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-500/20 text-blue-200 border-blue-400/50">{tenant.tipo}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              tenant.estado === "activo"
                                ? "bg-gradient-to-r from-emerald-500/30 to-emerald-600/30 text-emerald-200 border border-emerald-400/50 shadow-md shadow-emerald-500/20"
                                : "bg-gradient-to-r from-red-500/30 to-red-600/30 text-red-200 border border-red-400/50 shadow-md shadow-red-500/20"
                            }
                          >
                            {tenant.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white/70 text-sm drop-shadow-sm">
                          {new Date(tenant.createdAt).toLocaleDateString("es-ES")}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="hover:bg-white/10 hover:text-white text-white/70 transition-colors">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-slate-800/95 backdrop-blur-xl border border-white/20">
                              <DropdownMenuItem onClick={() => setViewDetailsTenant(tenant)} className="text-white/90 focus:bg-white/10 focus:text-white cursor-pointer">
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalles
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditTenant(tenant)} className="text-white/90 focus:bg-white/10 focus:text-white cursor-pointer">
                                <Edit className="h-4 w-4 mr-2" />
                                Editar Información
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSelectedTenant(tenant)} className="text-white/90 focus:bg-white/10 focus:text-white cursor-pointer">
                                <Key className="h-4 w-4 mr-2" />
                                Credenciales MH
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleToggleStatus(tenant)}>
                                {tenant.estado === "activo" ? (
                                  <>
                                    <Pause className="h-4 w-4 mr-2" />
                                    Suspender
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-4 w-4 mr-2" />
                                    Activar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setTenantToDelete(tenant)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Modal Crear Tenant */}
          <CreateTenantDialog
            open={isCreateOpen}
            onOpenChange={setIsCreateOpen}
            onSubmit={createTenantMutation.mutate}
            isPending={createTenantMutation.isPending}
          />

          {/* Modal Credenciales */}
          {selectedTenant && (
            <CredentialsDialog
              tenant={selectedTenant}
              open={!!selectedTenant}
              onOpenChange={(open) => !open && setSelectedTenant(null)}
            />
          )}

          {/* Modal Ver Detalles */}
          {viewDetailsTenant && (
            <TenantDetailsDialog
              tenant={viewDetailsTenant}
              open={!!viewDetailsTenant}
              onOpenChange={(open) => !open && setViewDetailsTenant(null)}
            />
          )}

          {/* Modal Editar Empresa */}
          {editTenant && (
            <EditTenantDialog
              tenant={editTenant}
              open={!!editTenant}
              onOpenChange={(open) => !open && setEditTenant(null)}
            />
          )}

          {/* Alert Dialog Confirmar Eliminación */}
          <AlertDialog open={!!tenantToDelete} onOpenChange={(open) => !open && setTenantToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminarán todos los datos de{" "}
                  <strong>{tenantToDelete?.nombre}</strong>: usuarios, facturas, productos, etc.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteTenant}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Eliminar Permanentemente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }
function CreateTenantDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [data, setData] = useState({
    nombre: "",
    slug: "",
    tipo: "clinic",
    estado: "activo",
    contactoNombre: "",
    contactoEmail: "",
    contactoTelefono: "",
    planPago: "mensual",
    estadoPago: "activo",
    modules: {
      facturacion: true,
      inventario: false,
      reportes: true,
      contabilidad: false,
      multi_sucursal: false,
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(data);
  };

  const handleModuleToggle = (module: string) => {
    setData({
      ...data,
      modules: { ...data.modules, [module]: !data.modules[module as keyof typeof data.modules] },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Empresa SaaS</DialogTitle>
          <DialogDescription>
            Crea un nuevo inquilino (tenant) con configuración completa. Se generará un usuario administrador automáticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información Básica */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Información Básica</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre Comercial *</Label>
                <Input
                  value={data.nombre}
                  onChange={(e) => setData({ ...data, nombre: e.target.value })}
                  placeholder="Ej: Ferretería El Clavo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Slug (Identificador único) *</Label>
                <Input
                  value={data.slug}
                  onChange={(e) => setData({ ...data, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="ej: ferreteria-el-clavo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Negocio</Label>
                <Select
                  value={data.tipo}
                  onValueChange={(val) => setData({ ...data, tipo: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clinic">Clínica Médica</SelectItem>
                    <SelectItem value="hospital">Hospital</SelectItem>
                    <SelectItem value="lab">Laboratorio</SelectItem>
                    <SelectItem value="store">Comercio General</SelectItem>
                    <SelectItem value="restaurant">Restaurante</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado Inicial</Label>
                <Select
                  value={data.estado}
                  onValueChange={(val) => setData({ ...data, estado: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="prueba">Prueba (30 días)</SelectItem>
                    <SelectItem value="suspendido">Suspendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Información de Contacto */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Contacto Principal</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nombre Completo</Label>
                <Input
                  value={data.contactoNombre}
                  onChange={(e) => setData({ ...data, contactoNombre: e.target.value })}
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={data.contactoEmail}
                  onChange={(e) => setData({ ...data, contactoEmail: e.target.value })}
                  placeholder="admin@empresa.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={data.contactoTelefono}
                  onChange={(e) => setData({ ...data, contactoTelefono: e.target.value })}
                  placeholder="+503 7123-4567"
                />
              </div>
            </div>
          </div>

          {/* Módulos del Sistema */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Módulos Habilitados</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent transition-colors">
                <input
                  type="checkbox"
                  id="mod-facturacion"
                  checked={data.modules.facturacion}
                  onChange={() => handleModuleToggle('facturacion')}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="mod-facturacion" className="text-sm font-medium cursor-pointer">
                  Facturación Electrónica
                </label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent transition-colors">
                <input
                  type="checkbox"
                  id="mod-inventario"
                  checked={data.modules.inventario}
                  onChange={() => handleModuleToggle('inventario')}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="mod-inventario" className="text-sm font-medium cursor-pointer">
                  Inventario
                </label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent transition-colors">
                <input
                  type="checkbox"
                  id="mod-reportes"
                  checked={data.modules.reportes}
                  onChange={() => handleModuleToggle('reportes')}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="mod-reportes" className="text-sm font-medium cursor-pointer">
                  Reportes y Analytics
                </label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent transition-colors">
                <input
                  type="checkbox"
                  id="mod-contabilidad"
                  checked={data.modules.contabilidad}
                  onChange={() => handleModuleToggle('contabilidad')}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="mod-contabilidad" className="text-sm font-medium cursor-pointer">
                  Contabilidad
                </label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent transition-colors">
                <input
                  type="checkbox"
                  id="mod-sucursales"
                  checked={data.modules.multi_sucursal}
                  onChange={() => handleModuleToggle('multi_sucursal')}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="mod-sucursales" className="text-sm font-medium cursor-pointer">
                  Multi-Sucursal
                </label>
              </div>
            </div>
          </div>

          {/* Configuración de Pagos */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Configuración de Pago</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan de Facturación</Label>
                <Select
                  value={data.planPago}
                  onValueChange={(val) => setData({ ...data, planPago: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Mensual ($49/mes)</SelectItem>
                    <SelectItem value="trimestral">Trimestral ($120/3 meses)</SelectItem>
                    <SelectItem value="anual">Anual ($450/año)</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado de Pago</Label>
                <Select
                  value={data.estadoPago}
                  onValueChange={(val) => setData({ ...data, estadoPago: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo (Al día)</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="cortesia">Cortesía/Gratis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Empresa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CredentialsDialog({
  tenant,
  open,
  onOpenChange,
}: {
  tenant: Tenant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [mhPass, setMhPass] = useState("");
  const [certPass, setCertPass] = useState("");
  const [p12File, setP12File] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!p12File) throw new Error("Debes seleccionar un archivo .p12");

      // Convertir archivo a Base64
      const p12Base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(p12File);
        reader.onload = () => {
          const result = reader.result as string;
          // Remover el prefijo "data:application/x-pkcs12;base64,"
          resolve(result.split(",")[1]);
        };
        reader.onerror = (error) => reject(error);
      });

      const res = await fetch(`/api/admin/tenants/${tenant.id}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mhUsuario: "", // Opcional por ahora
          mhPass,
          certificadoPass: certPass,
          certificadoP12: p12Base64,
          ambiente: "pruebas", // Default
        }),
      });

      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Configurado", description: "Credenciales guardadas y encriptadas." });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar Hacienda - {tenant.nombre}</DialogTitle>
          <DialogDescription>
            Sube el certificado digital y la contraseña. Se guardarán con encriptación militar (AES-256).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Contraseña API Hacienda</Label>
            <Input
              type="password"
              value={mhPass}
              onChange={(e) => setMhPass(e.target.value)}
              placeholder="Clave de acceso al sistema MH"
            />
          </div>
          <div className="space-y-2">
            <Label>Archivo Certificado (.p12)</Label>
            <Input
              type="file"
              accept=".p12,.pfx"
              onChange={(e) => setP12File(e.target.files?.[0] || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Contraseña del Certificado</Label>
            <Input
              type="password"
              value={certPass}
              onChange={(e) => setCertPass(e.target.value)}
              placeholder="PIN del archivo .p12"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Configuración
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TenantDetailsDialog({
  tenant,
  open,
  onOpenChange,
}: {
  tenant: Tenant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalles de {tenant.nombre}</DialogTitle>
          <DialogDescription>
            Información detallada de la empresa
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Nombre Comercial</Label>
              <p className="text-sm font-medium mt-1">{tenant.nombre}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Slug</Label>
              <p className="text-sm font-medium mt-1">{tenant.slug}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Tipo</Label>
              <p className="text-sm font-medium mt-1">{tenant.tipo}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Estado</Label>
              <Badge
                className={
                  tenant.estado === "activo"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }
              >
                {tenant.estado}
              </Badge>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Fecha de Registro</Label>
              <p className="text-sm font-medium mt-1">
                {new Date(tenant.createdAt).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">ID</Label>
              <p className="text-xs font-mono mt-1 text-muted-foreground">{tenant.id}</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTenantDialog({
  tenant,
  open,
  onOpenChange,
}: {
  tenant: Tenant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState({
    nombre: tenant.nombre,
    slug: tenant.slug,
    tipo: tenant.tipo,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      toast({
        title: "Actualizado",
        description: "Información de la empresa actualizada correctamente",
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Empresa</DialogTitle>
          <DialogDescription>
            Actualiza la información de {tenant.nombre}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nombre Comercial</Label>
            <Input
              value={data.nombre}
              onChange={(e) => setData({ ...data, nombre: e.target.value })}
              placeholder="Ej: Ferretería El Clavo"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Slug (Identificador único)</Label>
            <Input
              value={data.slug}
              onChange={(e) =>
                setData({
                  ...data,
                  slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                })
              }
              placeholder="ej: ferreteria-el-clavo"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de Negocio</Label>
            <Select
              value={data.tipo}
              onValueChange={(val) => setData({ ...data, tipo: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clinic">Clínica Médica</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
                <SelectItem value="lab">Laboratorio</SelectItem>
                <SelectItem value="store">Comercio General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
