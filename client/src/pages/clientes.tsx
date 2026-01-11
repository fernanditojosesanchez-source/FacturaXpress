import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Users, 
  Search, 
  Edit2, 
  Trash2, 
  MoreVertical,
  Mail,
  Phone,
  FileText,
  UserCheck,
  ShieldAlert
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
import { useClientes } from "@/hooks/use-clientes";
import { useCatalogos } from "@/hooks/use-catalogos";
import { useAuth } from "@/hooks/use-auth";
import { 
  receptorSchema, 
  type Receptor,
  TIPOS_DOCUMENTO,
  DEPARTAMENTOS_EL_SALVADOR
} from "@shared/schema";

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Receptor | null>(null);
  
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "tenant_admin";

  const { 
    clientes, 
    isLoading, 
    updateCliente, 
    deleteCliente,
    isUpdating
  } = useClientes();
  
  const { data: catalogos } = useCatalogos();
  const tiposDocumento = catalogos?.tiposDocumento ?? TIPOS_DOCUMENTO;
  const departamentos = catalogos?.departamentos ?? DEPARTAMENTOS_EL_SALVADOR;

  const form = useForm<Partial<Receptor>>({
    resolver: zodResolver(receptorSchema.partial()),
    defaultValues: {
      nombre: "",
      numDocumento: "",
      tipoDocumento: "36",
      correo: "",
      telefono: "",
      nrc: "",
      direccion: {
        departamento: "06",
        municipio: "01",
        complemento: ""
      }
    },
  });

  const filteredClientes = useMemo(() => {
    return clientes.filter((c) => 
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.numDocumento.toLowerCase().includes(search.toLowerCase()) ||
      c.correo?.toLowerCase().includes(search.toLowerCase())
    );
  }, [clientes, search]);

  const handleEdit = (cliente: Receptor) => {
    setEditingCliente(cliente);
    form.reset({
      nombre: cliente.nombre,
      numDocumento: cliente.numDocumento,
      tipoDocumento: cliente.tipoDocumento as any,
      correo: cliente.correo ?? "",
      telefono: cliente.telefono ?? "",
      nrc: cliente.nrc ?? "",
      direccion: (cliente.direccion as any) ?? {
        departamento: "06",
        municipio: "01",
        complemento: ""
      }
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: any) => {
    if (!editingCliente?.id) return;
    try {
      await updateCliente({ id: editingCliente.id, data });
      setIsDialogOpen(false);
    } catch (error) {
      // Error handled by hook toast
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este cliente? Esta acción es irreversible.")) {
      await deleteCliente(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catálogo de Clientes</h1>
          <p className="text-muted-foreground">
            Visualiza y gestiona la base de datos de tus pacientes y clientes
          </p>
        </div>
        {!isAdmin && (
          <Badge variant="secondary" className="h-8 gap-1 px-3">
            <ShieldAlert className="h-3 w-3" />
            Solo Lectura
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre, documento o correo..." 
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
                    <TableHead>Nombre / Razón Social</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClientes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No hay clientes registrados aún.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClientes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                              <Users className="h-4 w-4" />
                            </div>
                            <span className="font-medium">{c.nombre}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-mono">{c.numDocumento}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {tiposDocumento.find(t => t.codigo === c.tipoDocumento)?.nombre || c.tipoDocumento}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {c.correo && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" /> {c.correo}
                              </div>
                            )}
                            {c.telefono && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" /> {c.telefono}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">
                            {departamentos.find(d => d.codigo === (c.direccion as any)?.departamento)?.nombre || "---"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(c)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                {isAdmin ? "Editar" : "Ver Detalle"}
                              </DropdownMenuItem>
                              {isAdmin && (
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleDelete(c.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              )}
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {isAdmin ? "Editar Datos del Cliente" : "Detalles del Cliente"}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipoDocumento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo Documento</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
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
                      <FormLabel>Número Documento</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isAdmin} />
                      </FormControl>
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
                    <FormLabel>Nombre o Razón Social</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!isAdmin} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="correo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} value={field.value || ""} disabled={!isAdmin} />
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
                        <Input {...field} value={field.value || ""} disabled={!isAdmin} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border rounded-md p-4 space-y-4">
                <h3 className="text-sm font-semibold">Dirección</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="direccion.departamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departamento</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
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
                        <FormLabel>Municipio (Código)</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!isAdmin} />
                        </FormControl>
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
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isAdmin} />
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
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </DialogFooter>
              )}
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
