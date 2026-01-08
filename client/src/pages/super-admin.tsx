import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Building2, Key, Loader2, Plus, Shield } from "lucide-react";

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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Queries
  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
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

  return (
    <div className="flex-1 overflow-auto bg-gray-50 dark:bg-zinc-900">
      <div className="p-6">
        <div className="flex items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Super Admin</h1>
            <p className="text-muted-foreground">
              Panel de control SaaS - Gestión de Inquilinos
            </p>
          </div>
        </div>

        <div className="grid gap-6">
            <div className="flex justify-end">
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nueva Empresa
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Empresas Registradas</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Slug (URL)</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Acciones</TableHead>
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
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">
                          {tenant.nombre}
                        </TableCell>
                        <TableCell>{tenant.slug}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tenant.tipo}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              tenant.estado === "activo"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {tenant.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(tenant.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTenant(tenant)}
                          >
                            <Key className="h-4 w-4 mr-2" />
                            Credenciales
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
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
  const [data, setData] = useState({ nombre: "", slug: "", tipo: "clinic" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Empresa SaaS</DialogTitle>
          <DialogDescription>
            Crea un nuevo inquilino (tenant). Se generará un usuario administrador automáticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              </SelectContent>
            </Select>
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
