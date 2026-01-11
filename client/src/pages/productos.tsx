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
  FileDown
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductos } from "@/hooks/use-productos";
import { useCatalogos } from "@/hooks/use-catalogos";
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  
  const { 
    productos, 
    isLoading, 
    createProducto, 
    updateProducto, 
    deleteProducto,
    isCreating,
    isUpdating
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
    return productos.filter((p) => 
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo?.toLowerCase().includes(search.toLowerCase()) ||
      p.descripcion?.toLowerCase().includes(search.toLowerCase())
    );
  }, [productos, search]);

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
    } catch (error) {
      // Error handled by hook toast
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este producto?")) {
      await deleteProducto(id);
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catálogo de Productos</h1>
          <p className="text-muted-foreground">
            Gestiona los bienes y servicios para tu facturación
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre o código..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="w-[100px]">Estado</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProductos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No se encontraron productos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProductos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.codigo || "---"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{p.nombre}</span>
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {p.descripcion}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {tiposItem.find(t => t.codigo === p.tipoItem)?.nombre || p.tipoItem}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {unidadesMedida.find(u => u.codigo === p.uniMedida)?.nombre || "Unidad"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(p.precioUnitario))}
                        </TableCell>
                        <TableCell>
                          {p.activo ? (
                            <div className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                              <span className="text-xs">Activo</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <XCircle className="h-3 w-3" />
                              <span className="text-xs">Inactivo</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
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
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleDelete(p.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingProducto ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="codigo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código Interno</FormLabel>
                      <FormControl>
                        <Input placeholder="PROD-001" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tipoItem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Item</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Producto / Servicio *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Consulta Médica General" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción Corta</FormLabel>
                    <FormControl>
                      <Input placeholder="Detalles adicionales..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="precioUnitario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio Unitario ($) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.000001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uniMedida"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidad de Medida</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange(Number(val))}
                        defaultValue={String(field.value)}
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

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isCreating || isUpdating}>
                  {editingProducto ? "Guardar Cambios" : "Crear Producto"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
