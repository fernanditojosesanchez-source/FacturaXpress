import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Package, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  MoreVertical,
  CheckCircle2,
  XCircle,
  FileDown,
  Filter,
  X,
  DollarSign,
  ShieldAlert,
  Barcode
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
import { useProductos } from "@/hooks/use-productos";
import { useCatalogos } from "@/hooks/use-catalogos";
import { useAuth } from "@/hooks/use-auth";
import { 
  insertProductoSchema, 
  type Producto, 
  type InsertProducto,
  TIPOS_ITEM,
  UNIDADES_MEDIDA
} from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

export default function ProductosPage() {
  const [search, setSearch] = useState("");
  const [activoFilter, setActivoFilter] = useState<string>("all");
  const [tipoItemFilter, setTipoItemFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [deletingProductoId, setDeletingProductoId] = useState<string | null>(null);
  
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "tenant_admin";

  const { 
    productos, 
    isLoading, 
    createProducto, 
    updateProducto, 
    deleteProducto,
    isCreating,
    isUpdating,
    isDeleting
  } = useProductos();
  
  const { data: catalogos } = useCatalogos();
  const unidadesMedida = catalogos?.unidadesMedida ?? UNIDADES_MEDIDA;
  const tiposItem = catalogos?.tiposItem ?? TIPOS_ITEM;

  const form = useForm<InsertProducto>({
    resolver: zodResolver(insertProductoSchema),
    defaultValues: {
      nombre: "",
      codigo: "",
      descripcion: "",
      precioUnitario: 0,
      uniMedida: 20,
      tipoItem: "2",
      activo: true,
    },
  });

  const filteredProductos = useMemo(() => {
    return productos.filter((p) => {
      const matchesSearch = 
        p.nombre.toLowerCase().includes(search.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(search.toLowerCase()) ||
        p.descripcion?.toLowerCase().includes(search.toLowerCase());
      
      const matchesActivo = activoFilter === "all" || 
        (activoFilter === "active" && p.activo) ||
        (activoFilter === "inactive" && !p.activo);
      
      const matchesTipoItem = tipoItemFilter === "all" || p.tipoItem === tipoItemFilter;
      
      return matchesSearch && matchesActivo && matchesTipoItem;
    });
  }, [productos, search, activoFilter, tipoItemFilter]);

  const productStats = useMemo(() => {
    const activos = productos.filter(p => p.activo).length;
    const valorTotal = productos
      .filter(p => p.activo)
      .reduce((sum, p) => sum + Number(p.precioUnitario), 0);
    
    return {
      total: productos.length,
      activos,
      inactivos: productos.length - activos,
      valorPromedio: productos.length > 0 ? valorTotal / activos : 0
    };
  }, [productos]);

  const handleOpenDialog = (producto?: Producto) => {
    if (producto) {
      setEditingProducto(producto);
      form.reset({
        nombre: producto.nombre,
        codigo: producto.codigo ?? "",
        descripcion: producto.descripcion ?? "",
        precioUnitario: Number(producto.precioUnitario),
        uniMedida: producto.uniMedida,
        tipoItem: producto.tipoItem as any,
        activo: producto.activo ?? true,
      });
    } else {
      setEditingProducto(null);
      form.reset({
        nombre: "",
        codigo: "",
        descripcion: "",
        precioUnitario: 0,
        uniMedida: 20,
        tipoItem: "2",
        activo: true,
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: InsertProducto) => {
    try {
      if (editingProducto) {
        await updateProducto({ id: editingProducto.id, data });
      } else {
        await createProducto(data);
      }
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      // Error handled by hook toast
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeletingProductoId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deletingProductoId) {
      await deleteProducto(deletingProductoId);
      setIsDeleteDialogOpen(false);
      setDeletingProductoId(null);
    }
  };

  const exportCSV = () => {
    const headers = ["Código", "Nombre", "Descripción", "Precio", "Unidad", "Tipo", "Estado"];
    const rows = filteredProductos.map(p => [
      p.codigo || "",
      p.nombre,
      p.descripcion || "",
      p.precioUnitario,
      unidadesMedida.find(u => u.codigo === p.uniMedida)?.nombre || p.uniMedida,
      tiposItem.find(t => t.codigo === p.tipoItem)?.nombre || p.tipoItem,
      p.activo ? "Activo" : "Inactivo"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `catalogo-productos-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catálogo de Productos</h1>
          <p className="text-muted-foreground">
            Gestiona los bienes y servicios para tu facturación
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <Badge variant="secondary" className="h-8 gap-1 px-3">
              <ShieldAlert className="h-3 w-3" />
              Solo Lectura
            </Badge>
          )}
          <Button variant="outline" onClick={exportCSV}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          {isAdmin && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{productStats.activos}</div>
            <p className="text-xs text-muted-foreground">
              {((productStats.activos / productStats.total) * 100 || 0).toFixed(0)}% del total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactivos</CardTitle>
            <XCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{productStats.inactivos}</div>
            <p className="text-xs text-muted-foreground">
              {((productStats.inactivos / productStats.total) * 100 || 0).toFixed(0)}% del total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precio Promedio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(productStats.valorPromedio)}</div>
            <p className="text-xs text-muted-foreground">De productos activos</p>
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
                placeholder="Buscar por nombre, código o descripción..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={activoFilter} onValueChange={setActivoFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tipoItemFilter} onValueChange={setTipoItemFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo de item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {tiposItem.map(t => (
                    <SelectItem key={t.codigo} value={t.codigo}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(search || activoFilter !== "all" || tipoItemFilter !== "all") && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setActivoFilter("all");
                    setTipoItemFilter("all");
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
                    <TableHead>Producto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="w-[100px]">Estado</TableHead>
                    <TableHead className="w-[80px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProductos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Package className="h-8 w-8" />
                          <div>
                            <p className="font-medium">No hay productos {search && "que coincidan"}</p>
                            <p className="text-sm">{search ? "Intenta con otro término de búsqueda" : "Crea tu primer producto para comenzar"}</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProductos.map((p) => {
                      const tipoItemInfo = tiposItem.find(t => t.codigo === p.tipoItem);
                      const unidadInfo = unidadesMedida.find(u => u.codigo === p.uniMedida);
                      
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                                {p.codigo ? (
                                  <Barcode className="h-5 w-5 text-blue-600" />
                                ) : (
                                  <Package className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium">{p.nombre}</span>
                                <span className="text-xs text-muted-foreground">
                                  {p.codigo ? `Cód: ${p.codigo}` : "Sin código"}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {tipoItemInfo?.nombre || p.tipoItem}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {unidadInfo?.nombre || "Unidad"}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(Number(p.precioUnitario))}
                          </TableCell>
                          <TableCell>
                            {p.activo ? (
                              <div className="flex items-center gap-1.5 text-emerald-600">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-xs font-medium">Activo</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <XCircle className="h-4 w-4" />
                                <span className="text-xs">Inactivo</span>
                              </div>
                            )}
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
                                  <DropdownMenuItem onClick={() => handleOpenDialog(p)}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteClick(p.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(p)}>
                                <Edit2 className="h-4 w-4" />
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
        </CardContent>
      </Card>

      {/* Dialog Producto */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProducto ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
            <DialogDescription>
              {editingProducto 
                ? "Actualiza la información del producto o servicio." 
                : "Completa los datos del nuevo producto o servicio para agregarlo al catálogo."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Identificación */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Identificación</h3>
                <Separator />
                
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Producto / Servicio *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Consulta Médica General" {...field} disabled={!isAdmin} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="codigo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Interno</FormLabel>
                        <FormControl>
                          <Input placeholder="PROD-001" {...field} value={field.value || ""} disabled={!isAdmin} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Código personalizado opcional
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tipoItem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Item *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!isAdmin}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposItem.map(t => (
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
                </div>

                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input placeholder="Detalles adicionales..." {...field} value={field.value || ""} disabled={!isAdmin} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Información adicional que aparecerá en la factura
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Precio y Medida */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Precio y Unidad</h3>
                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="precioUnitario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Unitario ($) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            placeholder="0.00"
                            {...field} 
                            disabled={!isAdmin}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Precio por unidad en dólares
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="uniMedida"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidad de Medida *</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(Number(val))}
                          value={String(field.value)}
                          disabled={!isAdmin}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {unidadesMedida.map(u => (
                              <SelectItem key={u.codigo} value={String(u.codigo)}>
                                {u.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Estado */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Estado</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="activo"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Producto Activo</FormLabel>
                        <FormDescription>
                          Los productos activos están disponibles para facturación
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!isAdmin}
                        />
                      </FormControl>
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
                    {(isCreating || isUpdating) ? "Guardando..." : editingProducto ? "Actualizar" : "Crear Producto"}
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
              Esta acción no se puede deshacer. El producto será eliminado permanentemente del catálogo.
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
