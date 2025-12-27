import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings, X, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { emisorSchema, type Emisor } from "@shared/schema";
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

const DEPARTAMENTOS_EL_SALVADOR = [
  { code: "01", name: "Ahuachapán" },
  { code: "02", name: "Santa Ana" },
  { code: "03", name: "Sonsonate" },
  { code: "04", name: "Chalatenango" },
  { code: "05", name: "La Libertad" },
  { code: "06", name: "San Salvador" },
  { code: "07", name: "Cuscatlán" },
  { code: "08", name: "La Paz" },
  { code: "09", name: "Cabañas" },
  { code: "10", name: "San Vicente" },
  { code: "11", name: "Usulután" },
  { code: "12", name: "San Miguel" },
  { code: "13", name: "Morazán" },
  { code: "14", name: "La Unión" },
];

export function ConfigModal() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("emisor");

  const { data: emisor, isLoading } = useQuery<Emisor>({
    queryKey: ["/api/emisor"],
  });

  const form = useForm<Emisor>({
    resolver: zodResolver(emisorSchema),
    defaultValues: {
      nit: "",
      nrc: "",
      nombre: "",
      codActividad: "",
      descActividad: "",
      nombreComercial: "",
      tipoEstablecimiento: "01",
      direccion: {
        departamento: "06",
        municipio: "01",
        complemento: "",
      },
      telefono: "",
      correo: "",
      codEstableMH: "",
      codEstable: "",
      codPuntoVentaMH: "",
      codPuntoVenta: "",
    },
  });

  useEffect(() => {
    if (emisor && open) {
      form.reset(emisor);
    }
  }, [emisor, open, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: Emisor) => {
      return await apiRequest("POST", "/api/emisor", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emisor"] });
      toast({
        title: "Éxito",
        description: "Los datos del emisor han sido guardados",
      });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar los datos",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Emisor) => {
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full hover:bg-white/70 hover:shadow-sm"
          title="Configuración"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto animate-fade-in-up">
        <DialogHeader className="space-y-1 animate-fade-in-up [animation-delay:0s]">
          <DialogTitle className="text-2xl font-bold">Configuración</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Gestiona los datos de tu emisor y configuraciones del sistema
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <TabsList className="grid w-full grid-cols-2 backdrop-blur-sm bg-white/70 dark:bg-slate-900/60 rounded-full border border-white/60">
            <TabsTrigger value="emisor">Datos del Emisor</TabsTrigger>
            <TabsTrigger value="sistema">Sistema</TabsTrigger>
          </TabsList>

          <TabsContent value="emisor" className="space-y-4">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="nit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>NIT</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="0123456789" className="table-input-focus" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="nrc"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>NRC</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="123456-7" className="table-input-focus" />
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
                            <FormLabel>Nombre Legal</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="Nombre de la empresa" className="table-input-focus" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="nombreComercial"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre Comercial</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="Nombre comercial" className="table-input-focus" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="codActividad"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Código Actividad</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="621000" className="table-input-focus" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="descActividad"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Descripción</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Actividad" className="table-input-focus" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="telefono"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Teléfono</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="2123-4567" className="table-input-focus" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="correo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Correo</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder="info@empresa.com" className="table-input-focus" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="direccion.complemento"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dirección</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Calle y número" className="table-input-focus" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                      <FormField
                        control={form.control}
                        name="direccion.departamento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Departamento</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="table-input-focus">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DEPARTAMENTOS_EL_SALVADOR.map((dept) => (
                                  <SelectItem key={dept.code} value={dept.code}>
                                    {dept.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="codEstableMH"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Código Estab. MH</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="001" className="table-input-focus" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="codPuntoVentaMH"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Código PV MH</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="001" className="table-input-focus" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="codEstable"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Código Estable</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="0000" className="table-input-focus" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="codPuntoVenta"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Código PV</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="0001" className="table-input-focus" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="tipoEstablecimiento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo Establecimiento</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="table-input-focus">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="01">Casa Matriz</SelectItem>
                                <SelectItem value="02">Sucursal</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="w-full gap-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-white hover:shadow-lg transition-all duration-200"
                  >
                    <Save className="h-4 w-4" />
                    {saveMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </form>
              </Form>
            )}
          </TabsContent>

          <TabsContent value="sistema" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Información del Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Versión</Label>
                  <p className="font-medium">1.0.0</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Ambiente
                  </Label>
                  <p className="font-medium text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg w-fit">
                    Pruebas (00)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Base de Datos
                  </Label>
                  <p className="font-medium text-green-700">Conectada</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
