import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface User {
  id: string;
  nombre: string;
  email: string;
  role: string;
  activo: boolean;
  createdAt: string;
}

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "tenant_admin", label: "Administrador de Empresa" },
  { value: "manager", label: "Gerente" },
  { value: "cashier", label: "Cajero" },
  { value: "accountant", label: "Contador" },
  { value: "sigma_readonly", label: "Solo Lectura Sigma" },
];

export function UsuariosPage() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    contraseña: "",
    role: "cashier",
  });

  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await fetch("/api/tenants/users", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/tenants/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Usuario creado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      setFormData({ nombre: "", email: "", contraseña: "", role: "cashier" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await fetch(`/api/tenants/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update role");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Rol actualizado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/tenants/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Usuario eliminado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      // Handle edit - currently just role changes via updateRoleMutation
      setEditingId(null);
    } else {
      createUserMutation.mutate(formData);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-5xl font-black bg-gradient-to-r from-blue-200 via-purple-200 to-emerald-200 bg-clip-text text-transparent drop-shadow-lg">Gestión de Usuarios</h2>
          <p className="text-white/70 mt-2">
            Administra los usuarios de tu empresa
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-[0_25px_50px_-12px_rgba(59,130,246,0.4)] text-white font-bold py-3 px-6 rounded-xl transition-all duration-300">
              <Plus className="mr-2 h-5 w-5" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-slate-800/95 border border-white/20 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="text-white text-xl font-black">Crear Nuevo Usuario</DialogTitle>
              <DialogDescription className="text-white/70">
                Agrega un nuevo usuario a tu empresa con su rol correspondiente
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre" className="text-white font-bold">Nombre Completo</Label>
                <Input
                  id="nombre"
                  placeholder="Juan Pérez"
                  value={formData.nombre}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-blue-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white font-bold">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="juan@example.com"
                  value={formData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-blue-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contraseña" className="text-white font-bold">Contraseña Temporal</Label>
                <div className="relative">
                  <Input
                    id="contraseña"
                    type={showPassword ? "text" : "password"}
                    placeholder="Contraseña segura"
                    value={formData.contraseña}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, contraseña: e.target.value })}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-white/50 hover:text-white/80" />
                    ) : (
                      <Eye className="h-4 w-4 text-white/50 hover:text-white/80" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="text-white font-bold">Rol</Label>
                <Select value={formData.role} onValueChange={(value: string) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800/95 border border-white/20">
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value} className="text-white focus:bg-white/10">
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-[0_25px_50px_-12px_rgba(59,130,246,0.4)]"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Usuario"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-500/20 border border-red-400/50 text-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error al cargar usuarios: {error instanceof Error ? error.message : "Unknown error"}
          </AlertDescription>
        </Alert>
      )}

      <Card className="relative overflow-hidden backdrop-blur-3xl rounded-3xl border border-white/20 shadow-[0_35px_60px_-15px_rgba(59,130,246,0.3)] hover:shadow-[0_50px_80px_-20px_rgba(59,130,246,0.4)] transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-600/5 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 to-transparent opacity-40 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-40 pointer-events-none" />
        <div className="absolute inset-0 rounded-3xl border border-white/30 pointer-events-none" />
        
        <CardHeader className="relative border-b border-white/10">
          <CardTitle className="text-2xl font-black text-white drop-shadow-lg">Usuarios de tu Empresa</CardTitle>
          <CardDescription className="text-white/70">
            Total de usuarios: {users.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-white/50" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/70">No hay usuarios en tu empresa</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-20">
                  <TableRow className="border-b border-white/15 hover:bg-white/5">
                    <TableHead className="font-bold text-white drop-shadow-md">Nombre</TableHead>
                    <TableHead className="font-bold text-white drop-shadow-md">Email</TableHead>
                    <TableHead className="font-bold text-white drop-shadow-md">Rol</TableHead>
                    <TableHead className="font-bold text-white drop-shadow-md">Estado</TableHead>
                    <TableHead className="font-bold text-white drop-shadow-md">Se unió</TableHead>
                    <TableHead className="text-right font-bold text-white drop-shadow-md">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user: User) => (
                    <TableRow key={user.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                      <TableCell className="font-medium text-white drop-shadow-sm">{user.nombre}</TableCell>
                      <TableCell className="text-white/80 drop-shadow-sm">{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(value: string) =>
                            updateRoleMutation.mutate({ userId: user.id, role: value })
                          }
                          disabled={user.id === currentUser?.id || updateRoleMutation.isPending}
                        >
                          <SelectTrigger className="w-[150px] bg-white/10 border-white/20 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800/95 border border-white/20">
                            {ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value} className="text-white focus:bg-white/10">
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.activo ? "default" : "secondary"} className={user.activo ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/50" : "bg-red-500/30 text-red-200 border border-red-400/50"}>
                          {user.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-white/70 drop-shadow-sm">
                        {new Date(user.createdAt).toLocaleDateString("es-ES")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteUserMutation.mutate(user.id)}
                          disabled={user.id === currentUser?.id || deleteUserMutation.isPending}
                          className="text-red-300 hover:text-red-100 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default UsuariosPage;
