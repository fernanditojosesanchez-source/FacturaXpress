import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Save, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { emisorSchema, DEPARTAMENTOS_EL_SALVADOR, type Emisor } from "@shared/schema";

export default function EmisorPage() {
  const { toast } = useToast();

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
    if (emisor) {
      form.reset(emisor);
    }
  }, [emisor, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: Emisor) => {
      const res = await apiRequest("POST", "/api/emisor", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emisor"] });
      toast({
        title: "Datos guardados",
        description: "Los datos del emisor han sido actualizados correctamente",
      });
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

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Datos del Emisor
        </h1>
        <p className="text-muted-foreground">
          Configure los datos de su empresa para la facturación electrónica
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
                  <Building2 className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Información Fiscal</CardTitle>
                  <CardDescription>
                    Datos registrados ante la DGII de El Salvador
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NIT *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="0000-000000-000-0"
                          data-testid="input-nit"
                        />
                      </FormControl>
                      <FormDescription>
                        Número de Identificación Tributaria
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nrc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NRC *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="000000-0"
                          data-testid="input-nrc"
                        />
                      </FormControl>
                      <FormDescription>
                        Número de Registro de Contribuyente
                      </FormDescription>
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
                    <FormLabel>Nombre o Razón Social *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Nombre legal de la empresa"
                        data-testid="input-nombre"
                      />
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
                      <Input
                        {...field}
                        placeholder="Nombre comercial (opcional)"
                        data-testid="input-nombre-comercial"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="codActividad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de Actividad *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ej: 86100"
                          data-testid="input-cod-actividad"
                        />
                      </FormControl>
                      <FormDescription>
                        Según clasificación CIIU
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="descActividad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción de Actividad *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ej: Actividades de hospitales"
                          data-testid="input-desc-actividad"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dirección</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="direccion.departamento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departamento *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-departamento">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DEPARTAMENTOS_EL_SALVADOR.map((dep) => (
                            <SelectItem key={dep.codigo} value={dep.codigo}>
                              {dep.nombre}
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
                      <FormLabel>Municipio *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Código de municipio"
                          data-testid="input-municipio"
                        />
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
                    <FormLabel>Dirección Completa *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Calle, número, colonia, etc."
                        className="resize-none"
                        data-testid="input-direccion"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="0000-0000"
                          data-testid="input-telefono"
                        />
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
                      <FormLabel>Correo Electrónico *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="correo@empresa.com"
                          data-testid="input-correo"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Códigos de Establecimiento</CardTitle>
              <CardDescription>
                Códigos asignados por el Ministerio de Hacienda (opcional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="codEstableMH"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código Establecimiento MH</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Código asignado por MH"
                          data-testid="input-cod-establemh"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="codEstable"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código Establecimiento Interno</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Código interno"
                          data-testid="input-cod-estable"
                        />
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
                      <FormLabel>Código Punto de Venta MH</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Código asignado por MH"
                          data-testid="input-cod-puntomh"
                        />
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
                      <FormLabel>Código Punto de Venta Interno</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Código interno"
                          data-testid="input-cod-punto"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              data-testid="button-save"
            >
              {saveMutation.isPending ? (
                "Guardando..."
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Datos
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>

      {emisor?.nit && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-sm">Emisor configurado</p>
                <p className="text-xs text-muted-foreground">
                  Los datos del emisor están listos para generar facturas electrónicas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
