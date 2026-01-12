import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Users, 
  Plus,
  Search, 
  Edit2, 
  Trash2, 
  MoreVertical,
  Mail,
  Phone,
  FileText,
  UserCheck,
  ShieldAlert,
  Building2,
  MapPin,
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
import { useClientes } from "@/hooks/use-clientes";
import { useCatalogos } from "@/hooks/use-catalogos";
import { PaginationCustom } from "@/components/ui/pagination-custom";
import { useAuth } from "@/hooks/use-auth";
import { receptorSchema, type Receptor, TIPOS_DOCUMENTO, DEPARTAMENTOS_EL_SALVADOR } from "@shared/schema";
import { z } from "zod";

type ClienteFormData = z.infer<typeof receptorSchema>;

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const [tipoDocFilter, setTipoDocFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Receptor | null>(null);
  const [deletingClienteId, setDeletingClienteId] = useState<string | null>(null);
  
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "tenant_admin";

  const { 
    clientes, 
    pagination,
    isLoading,
    page,
    setPage,
    limit,
    createCliente,
    updateCliente, 
    deleteCliente,
    isCreating,
    isUpdating,
    isDeleting
  } = useClientes();

  // Resetear página al filtrar (con protección)
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [search, tipoDocFilter, page, setPage]);
  
  const { data: catalogos } = useCatalogos();
  const tiposDocumento = catalogos?.tiposDocumento ?? TIPOS_DOCUMENTO;
  const departamentos = catalogos?.departamentos ?? DEPARTAMENTOS_EL_SALVADOR;

  const form = useForm<ClienteFormData>({
    resolver: zodResolver(receptorSchema),
    defaultValues: {
      nombre: "",
      numDocumento: "",
      tipoDocumento: "36",
      correo: "",
      telefono: "",
      nrc: "",
      codActividad: "",
      descActividad: "",
      direccion: {
        departamento: "06",
        municipio: "01",
        complemento: ""
      }
    },
  });

  const filteredClientes = useMemo(() => {
    return clientes.filter((c) => {
      const matchesSearch = 
        c.nombre.toLowerCase().includes(search.toLowerCase()) ||
        c.numDocumento.toLowerCase().includes(search.toLowerCase()) ||
        c.correo?.toLowerCase().includes(search.toLowerCase());
      
      const matchesTipoDoc = tipoDocFilter === "all" || c.tipoDocumento === tipoDocFilter;
      
      return matchesSearch && matchesTipoDoc;
    });
  }, [clientes, search, tipoDocFilter]);

  const handleOpenDialog = (cliente?: Receptor) => {
    if (cliente) {
      setEditingCliente(cliente);
      form.reset({
        nombre: cliente.nombre,
        numDocumento: cliente.numDocumento,
        tipoDocumento: cliente.tipoDocumento as any,
        correo: cliente.correo ?? "",
        telefono: cliente.telefono ?? "",
        nrc: cliente.nrc ?? "",
        codActividad: cliente.codActividad ?? "",
        descActividad: cliente.descActividad ?? "",
        direccion: (cliente.direccion as any) ?? {
          departamento: "06",
          municipio: "01",
          complemento: ""
        }
      });
    } else {
      setEditingCliente(null);
      form.reset({
        nombre: "",
        numDocumento: "",
        tipoDocumento: "36",
        correo: "",
        telefono: "",
        nrc: "",
        codActividad: "",
        descActividad: "",
        direccion: {
          departamento: "06",
          municipio: "01",
          complemento: ""
        }
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: ClienteFormData) => {
    try {
      if (editingCliente?.id) {
        await updateCliente({ id: editingCliente.id, data });
      } else {
        await createCliente(data as any);
      }
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      // Error handled by hook toast
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeletingClienteId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deletingClienteId) {
      await deleteCliente(deletingClienteId);
      setIsDeleteDialogOpen(false);
      setDeletingClienteId(null);
    }
  };

  const clienteStats = useMemo(() => {
    return {
      total: clientes.length,
      conCorreo: clientes.filter(c => c.correo).length,
      conNRC: clientes.filter(c => c.nrc).length,
    };
  }, [clientes]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catálogo de Clientes</h1>
          <p className="text-muted-foreground">
            Gestiona tu base de datos de clientes y receptores de facturas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <Badge variant="secondary" className="h-8 gap-1 px-3">
              <ShieldAlert className="h-3 w-3" />
              Solo Lectura
            </Badge>
          )}
          {isAdmin && (
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Cliente
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clienteStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clienteStats.conCorreo}</div>
            <p className="text-xs text-muted-foreground">
              {((clienteStats.conCorreo / clienteStats.total) * 100 || 0).toFixed(0)}% del total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con NRC</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clienteStats.conNRC}</div>
            <p className="text-xs text-muted-foreground">
              {((clienteStats.conNRC / clienteStats.total) * 100 || 0).toFixed(0)}% del total
            </p>
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
                placeholder="Buscar por nombre, documento o correo..." 
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={tipoDocFilter} onValueChange={setTipoDocFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo documento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {tiposDocumento.map(t => (
                    <SelectItem key={t.codigo} value={t.codigo}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(search || tipoDocFilter !== "all") && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setTipoDocFilter("all");
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
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead className="w-[80px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClientes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Users className="h-8 w-8" />
                          <div>
                            <p className="font-medium">No hay clientes {search && "que coincidan"}</p>
                            <p className="text-sm">{search ? "Intenta con otro término de búsqueda" : "Crea tu primer cliente para comenzar"}</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClientes.map((c) => {
                      const tipoDoc = tiposDocumento.find(t => t.codigo === c.tipoDocumento);
                      const dept = departamentos.find(d => d.codigo === (c.direccion as any)?.departamento);
                      
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                <Users className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{c.nombre}</p>
                                {c.nrc && (
                                  <p className="text-xs text-muted-foreground">NRC: {c.nrc}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-sm">{c.numDocumento}</span>
                              <Badge variant="outline" className="w-fit text-[10px]">
                                {tipoDoc?.nombre || c.tipoDocumento}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5">
                              {c.correo ? (
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm">{c.correo}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sin correo</span>
                              )}
                              {c.telefono && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm">{c.telefono}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{dept?.nombre || "---"}</span>
                            </div>
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
                                  <DropdownMenuItem onClick={() => handleOpenDialog(c)}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteClick(c.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(c)}>
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <div className="p-4 border-t">
                <PaginationCustom
                  currentPage={page}
                  totalPages={pagination.pages}
                  onPageChange={setPage}
                  totalItems={pagination.total}
                  itemsPerPage={limit}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Cliente */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCliente ? "Editar Cliente" : "Nuevo Cliente"}
            </DialogTitle>
            <DialogDescription>
              {editingCliente 
                ? "Actualiza la información del cliente. Los cambios se guardarán inmediatamente." 
                : "Completa los datos del nuevo cliente para agregarlo al catálogo."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Información General */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Información General</h3>
                <Separator />
                
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre / Razón Social *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej: Juan Pérez o Empresa S.A." disabled={!isAdmin} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipoDocumento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Documento *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!isAdmin}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposDocumento.map(t => (
                              <SelectItem key={t.codigo} value={t.codigo}>
                                {t.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="numDocumento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Documento *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: 1234567890123-4" disabled={!isAdmin} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          NIT: 14 dígitos + guión + 1 verificador
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nrc"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NRC</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="Opcional" disabled={!isAdmin} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Número de Registro de Contribuyente
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="codActividad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Actividad</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="Opcional" disabled={!isAdmin} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Contacto */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Información de Contacto</h3>
                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="correo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} value={field.value || ""} placeholder="correo@ejemplo.com" disabled={!isAdmin} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="telefono"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="12345678" disabled={!isAdmin} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          8 dígitos sin guiones
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Dirección */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Dirección</h3>
                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="direccion.departamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departamento *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!isAdmin}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departamentos.map(d => (
                              <SelectItem key={d.codigo} value={d.codigo}>
                                {d.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="direccion.municipio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Municipio (Código) *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="01" disabled={!isAdmin} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Código de 2 dígitos
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="direccion.complemento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento de Dirección *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej: Calle Principal, Casa #123" disabled={!isAdmin} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isAdmin && (
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isCreating || isUpdating}>
                    {(isCreating || isUpdating) ? "Guardando..." : editingCliente ? "Actualizar" : "Crear Cliente"}
                  </Button>
                </DialogFooter>
              )}
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
              Esta acción no se puede deshacer. El cliente será eliminado permanentemente del sistema.
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
    </div>
  );
}
