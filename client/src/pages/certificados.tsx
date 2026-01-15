import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Lock, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  MoreVertical,
  Check,
  AlertTriangle,
  Calendar,
  Fingerprint,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Shield,
  ShieldAlert,
  Filter,
  X
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { PaginationCustom } from "@/components/ui/pagination-custom";
import { useCertificadosPaginated } from "@/hooks/use-certificados-paginated";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";

const certificadoFormSchema = z.object({
  nombre: z.string().min(1, "Nombre es requerido"),
  contrasena: z.string().min(1, "Contraseña es requerida"),
  esProductivo: z.boolean().default(false),
});

type CertificadoFormData = z.infer<typeof certificadoFormSchema>;

const estadoColors: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  validado: "bg-blue-100 text-blue-800",
  activo: "bg-green-100 text-green-800",
  expirado: "bg-red-100 text-red-800",
  revocado: "bg-gray-100 text-gray-800",
};

const estadoIcons: Record<string, any> = {
  pendiente: Clock,
  validado: CheckCircle2,
  activo: Shield,
  expirado: XCircle,
  revocado: AlertTriangle,
};

export default function CertificadosPage() {
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isValidateDialogOpen, setIsValidateDialogOpen] = useState(false);
  const [selectedCertificadoId, setSelectedCertificadoId] = useState<string | null>(null);
  const [fileData, setFileData] = useState<string | null>(null);
  
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "tenant_admin";

  const { 
    certificados,
    pagination,
    page,
    setPage,
    limit,
    setLimit,
    isLoading,
    createCertificado,
    deleteCertificado,
    isCreating,
    isDeleting,
    validarCertificado,
    isValidating,
    activarCertificado,
    isActivating,
  } = useCertificadosPaginated();
  
  const form = useForm<CertificadoFormData>({
    resolver: zodResolver(certificadoFormSchema),
    defaultValues: {
      nombre: "",
      contrasena: "",
      esProductivo: false,
    },
  });

  const filteredCertificados = useMemo(() => {
    return certificados.filter((c) => {
      const matchesSearch = 
        c.nombre.toLowerCase().includes(search.toLowerCase()) ||
        c.huella.toLowerCase().includes(search.toLowerCase());
      
      const matchesEstado = estadoFilter === "all" || c.estado === estadoFilter;
      
      return matchesSearch && matchesEstado;
    });
  }, [certificados, search, estadoFilter]);

  const certStats = useMemo(() => {
    return {
      total: certificados.length,
      activos: certificados.filter(c => c.activo).length,
      proximos_expirar: certificados.filter(c => {
        const dias = c.diasParaExpiracion || 0;
        return dias > 0 && dias <= 30;
      }).length,
      expirados: certificados.filter(c => c.estado === "expirado").length,
    };
  }, [certificados]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFileData(content.split(",")[1]); // Obtener solo la parte base64
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: CertificadoFormData) => {
    if (!fileData) {
      form.setError("nombre", { message: "Selecciona un archivo de certificado" });
      return;
    }

    try {
      await createCertificado({
        nombre: data.nombre,
        archivo: fileData,
        contrasena: data.contrasena,
        esProductivo: data.esProductivo,
      });
      setIsDialogOpen(false);
      form.reset();
      setFileData(null);
    } catch (error) {
      // Error manejado por el hook
    }
  };

  const handleDeleteClick = (id: string) => {
    setSelectedCertificadoId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedCertificadoId) {
      await deleteCertificado(selectedCertificadoId);
      setIsDeleteDialogOpen(false);
      setSelectedCertificadoId(null);
    }
  };

  const handleValidate = async () => {
    if (selectedCertificadoId) {
      await validarCertificado(selectedCertificadoId);
      setIsValidateDialogOpen(false);
      setSelectedCertificadoId(null);
    }
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("es-SV");
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-5xl font-black bg-gradient-to-r from-blue-200 via-purple-200 to-emerald-200 bg-clip-text text-transparent drop-shadow-lg">Certificados Digitales</h1>
          <p className="text-white/70 mt-2">
            Gestiona tus certificados de firma digital para Hacienda
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <Badge variant="secondary" className="h-8 gap-1 px-3 bg-yellow-500/20 text-yellow-200 border border-yellow-400/50">
              <ShieldAlert className="h-3 w-3" />
              Solo Lectura
            </Badge>
          )}
          {isAdmin && (
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-[0_25px_50px_-12px_rgba(59,130,246,0.4)] text-white font-bold py-3 px-6 rounded-xl transition-all duration-300">
              <Plus className="h-5 w-5" />
              Cargar Certificado
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Total Card */}
        <Card className="relative overflow-hidden backdrop-blur-2xl rounded-3xl border border-[#3B82F6]-400/30 shadow-[0_35px_60px_-15px_rgba(59,130,246,0.4)] hover:shadow-[0_50px_80px_-20px_rgba(59,130,246,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 to-blue-600/5 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent opacity-60 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent opacity-50 pointer-events-none" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0 pt-6 px-6">
            <CardTitle className="text-xs font-bold text-white/90 tracking-widest uppercase opacity-90">Total</CardTitle>
            <div className="p-3 rounded-2xl backdrop-blur-lg bg-blue-500/15 border border-white/40 shadow-2xl">
              <Lock className="h-5 w-5 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="relative pt-4 px-6 pb-6">
            <div className="text-5xl font-black tracking-tight text-white drop-shadow-lg">{certStats.total}</div>
            <p className="text-sm text-white/80 font-medium mt-2">Certificados cargados</p>
          </CardContent>
        </Card>

        {/* Activos Card */}
        <Card className="relative overflow-hidden backdrop-blur-2xl rounded-3xl border border-emerald-400/30 shadow-[0_35px_60px_-15px_rgba(16,185,129,0.4)] hover:shadow-[0_50px_80px_-20px_rgba(16,185,129,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-60 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent opacity-50 pointer-events-none" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0 pt-6 px-6">
            <CardTitle className="text-xs font-bold text-white/90 tracking-widest uppercase opacity-90">Activos</CardTitle>
            <div className="p-3 rounded-2xl backdrop-blur-lg bg-emerald-500/15 border border-white/40 shadow-2xl">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="relative pt-4 px-6 pb-6">
            <div className="text-5xl font-black tracking-tight text-white drop-shadow-lg">{certStats.activos}</div>
            <p className="text-sm text-white/80 font-medium mt-2">Listos para usar</p>
          </CardContent>
        </Card>

        {/* Próximos a Expirar Card */}
        <Card className="relative overflow-hidden backdrop-blur-2xl rounded-3xl border border-amber-400/30 shadow-[0_35px_60px_-15px_rgba(217,119,6,0.4)] hover:shadow-[0_50px_80px_-20px_rgba(217,119,6,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 to-amber-600/5 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent opacity-60 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent opacity-50 pointer-events-none" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0 pt-6 px-6">
            <CardTitle className="text-xs font-bold text-white/90 tracking-widest uppercase opacity-90">Próximos a Expirar</CardTitle>
            <div className="p-3 rounded-2xl backdrop-blur-lg bg-amber-500/15 border border-white/40 shadow-2xl">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
          </CardHeader>
          <CardContent className="relative pt-4 px-6 pb-6">
            <div className="text-5xl font-black tracking-tight text-white drop-shadow-lg">{certStats.proximos_expirar}</div>
            <p className="text-sm text-white/80 font-medium mt-2">En 30 días o menos</p>
          </CardContent>
        </Card>

        {/* Expirados Card */}
        <Card className="relative overflow-hidden backdrop-blur-2xl rounded-3xl border border-red-400/30 shadow-[0_35px_60px_-15px_rgba(239,68,68,0.4)] hover:shadow-[0_50px_80px_-20px_rgba(239,68,68,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/15 to-red-600/5 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-transparent opacity-60 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent opacity-50 pointer-events-none" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0 pt-6 px-6">
            <CardTitle className="text-xs font-bold text-white/90 tracking-widest uppercase opacity-90">Expirados</CardTitle>
            <div className="p-3 rounded-2xl backdrop-blur-lg bg-red-500/15 border border-white/40 shadow-2xl">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
          </CardHeader>
          <CardContent className="relative pt-4 px-6 pb-6">
            <div className="text-5xl font-black tracking-tight text-white drop-shadow-lg">{certStats.expirados}</div>
            <p className="text-sm text-white/80 font-medium mt-2">Requieren actualización</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre o huella..." 
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="validado">Validado</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="expirado">Expirado</SelectItem>
                </SelectContent>
              </Select>
              {(search || estadoFilter !== "all") && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setEstadoFilter("all");
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Validez</TableHead>
                    <TableHead className="text-center">Vencimiento</TableHead>
                    <TableHead className="w-[100px]">Tipo</TableHead>
                    <TableHead className="w-[80px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCertificados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Lock className="h-8 w-8" />
                          <div>
                            <p className="font-medium">No hay certificados</p>
                            <p className="text-sm">Carga tu certificado de firma digital para comenzar</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCertificados.map((cert) => {
                      const IconEstado = cert.estado ? estadoIcons[cert.estado] || Clock : Clock;
                      const diasFalta = cert.diasParaExpiracion || 0;
                      const alertaProxima = diasFalta > 0 && diasFalta <= 30;
                      
                      return (
                        <TableRow key={cert.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50">
                                <Fingerprint className="h-5 w-5 text-purple-600" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium">{cert.nombre}</span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {cert.huella.substring(0, 16)}...
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {cert.activo && (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Activo
                                </Badge>
                              )}
                              {!cert.activo && (
                                <Badge variant="outline" className={cert.estado ? estadoColors[cert.estado] : ""}>
                                  <IconEstado className="h-3 w-3 mr-1" />
                                  {cert.estado}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {cert.certificadoValido ? (
                                <span className="text-green-600 font-medium">✓ Validado</span>
                              ) : (
                                <span className="text-amber-600">Requiere validación</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-right">
                              {cert.validoHasta && (
                                <>
                                  <div className="text-sm font-medium">
                                    {formatDate(cert.validoHasta)}
                                  </div>
                                  {alertaProxima && (
                                    <div className="text-xs text-amber-600">
                                      {diasFalta} días
                                    </div>
                                  )}
                                  {diasFalta <= 0 && (
                                    <div className="text-xs text-red-600">
                                      Expirado
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {cert.esProductivo ? "Productivo" : "Pruebas"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {!cert.certificadoValido && (
                                    <>
                                      <DropdownMenuItem 
                                        onClick={() => {
                                          setSelectedCertificadoId(cert.id);
                                          setIsValidateDialogOpen(true);
                                        }}
                                      >
                                        <Check className="h-4 w-4 mr-2" />
                                        Validar
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  {cert.certificadoValido && !cert.activo && (
                                    <>
                                      <DropdownMenuItem 
                                        onClick={() => {
                                          activarCertificado(cert.id);
                                        }}
                                      >
                                        <Shield className="h-4 w-4 mr-2" />
                                        Activar
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteClick(cert.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button variant="ghost" size="icon">
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {pagination.pages > 1 && (
            <div className="mt-4">
              <PaginationCustom
                currentPage={page}
                totalPages={pagination.pages}
                onPageChange={setPage}
                totalItems={pagination.total}
                itemsPerPage={limit}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Upload Certificado */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Cargar Certificado Digital</DialogTitle>
            <DialogDescription>
              Sube tu archivo de certificado P12 para firma digital (formato .p12 o .pfx)
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Certificado *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ej: Certificado 2024, Cert Principal" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Nombre amigable para identificar el certificado
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Archivo de Certificado (P12) *</FormLabel>
                  <FormControl>
                    <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                      <input
                        type="file"
                        accept=".p12,.pfx"
                        onChange={handleFileSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center gap-2">
                        <Lock className="h-8 w-8 text-muted-foreground" />
                        {fileData ? (
                          <>
                            <p className="font-medium">Archivo cargado ✓</p>
                            <p className="text-xs text-muted-foreground">
                              {fileData.length} caracteres en base64
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">Arrastra tu archivo aquí</p>
                            <p className="text-xs text-muted-foreground">
                              o haz clic para seleccionar
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormField
                  control={form.control}
                  name="contrasena"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña del Certificado *</FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder="Contraseña"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Contraseña necesaria para desbloquear el certificado
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="esProductivo"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Ambiente Productivo</FormLabel>
                        <FormDescription className="text-xs">
                          Marca si es para ambiente de producción
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isCreating || !fileData}>
                  {isCreating ? "Cargando..." : "Cargar Certificado"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El certificado será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Validate Confirmation Dialog */}
      <AlertDialog open={isValidateDialogOpen} onOpenChange={setIsValidateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Validar Certificado</AlertDialogTitle>
            <AlertDialogDescription>
              Se realizará una validación completa del certificado para verificar su integridad y vigencia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleValidate}
              disabled={isValidating}
            >
              {isValidating ? "Validando..." : "Validar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
