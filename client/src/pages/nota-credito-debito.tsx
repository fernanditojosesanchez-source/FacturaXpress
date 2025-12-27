import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Search,
  FileText,
  Receipt,
  CircleMinus,
  CirclePlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  formatCurrency,
  formatDate,
  generateUUID,
  generateNumeroControl,
  numberToWords,
  calculateIVA,
} from "@/lib/utils";
import type { Factura, Emisor } from "@shared/schema";

const notaFormSchema = z.object({
  tipoNota: z.enum(["05", "06"]),
  facturaReferencia: z.string().min(1, "Seleccione una factura"),
  motivoAnulacion: z.string().min(5, "Indique el motivo"),
  montoAjuste: z.coerce.number().min(0.01, "Monto debe ser mayor a 0"),
  descripcionAjuste: z.string().min(1, "Describa el ajuste"),
});

type NotaFormData = z.infer<typeof notaFormSchema>;

const countErrors = (errors: Record<string, any>): number => {
  return Object.values(errors).reduce((acc, value) => {
    if (!value) return acc;
    if (value.message) return acc + 1;
    if (typeof value === "object") return acc + countErrors(value as Record<string, any>);
    return acc;
  }, 0);
};

export default function NotaCreditoDebito() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [correlativo, setCorrelativo] = useState(1);

  const { data: facturas } = useQuery<Factura[]>({
    queryKey: ["/api/facturas"],
  });

  const { data: emisor } = useQuery<Emisor>({
    queryKey: ["/api/emisor"],
  });

  useEffect(() => {
    if (facturas) {
      setCorrelativo(facturas.length + 1);
    }
  }, [facturas]);

  const form = useForm<NotaFormData>({
    resolver: zodResolver(notaFormSchema),
    defaultValues: {
      tipoNota: "05",
      facturaReferencia: "",
      motivoAnulacion: "",
      montoAjuste: 0,
      descripcionAjuste: "",
    },
  });

  const tipoNota = form.watch("tipoNota");
  const montoAjuste = form.watch("montoAjuste");
  const { submitCount, isSubmitting } = form.formState;
  const errorCount = countErrors(form.formState.errors);
  const hasErrors = errorCount > 0;

  const facturasElegibles = facturas?.filter(
    (f) =>
      (f.estado === "generada" || f.estado === "sellada") &&
      (f.tipoDte === "01" || f.tipoDte === "03") &&
      (f.receptor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.numeroControl.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const createNotaMutation = useMutation({
    mutationFn: async (data: NotaFormData) => {
      if (!selectedFactura || !emisor) {
        throw new Error("Datos incompletos");
      }

      const now = new Date();
      const fecEmi = now.toISOString().split("T")[0];
      const horEmi = now.toTimeString().split(" ")[0];
      const codigoGeneracion = generateUUID();
      const numeroControl = generateNumeroControl(data.tipoNota, correlativo);

      const iva = calculateIVA(data.montoAjuste);
      const total = data.montoAjuste + iva;

      const notaData = {
        version: 1,
        ambiente: "00",
        tipoDte: data.tipoNota,
        numeroControl,
        codigoGeneracion,
        tipoModelo: "1",
        tipoOperacion: "1",
        tipoContingencia: null,
        motivoContin: null,
        fecEmi,
        horEmi,
        tipoMoneda: "USD",
        emisor,
        receptor: selectedFactura.receptor,
        cuerpoDocumento: [
          {
            numItem: 1,
            tipoItem: "2" as const,
            cantidad: 1,
            codigo: "AJUSTE",
            uniMedida: 99,
            descripcion: data.descripcionAjuste,
            precioUni: data.montoAjuste,
            montoDescu: 0,
            ventaNoSuj: 0,
            ventaExenta: 0,
            ventaGravada: data.montoAjuste,
            tributos: [],
            psv: 0,
            noGravado: 0,
            ivaItem: iva,
          },
        ],
        resumen: {
          totalNoSuj: 0,
          totalExenta: 0,
          totalGravada: data.montoAjuste,
          subTotalVentas: data.montoAjuste,
          descuNoSuj: 0,
          descuExenta: 0,
          descuGravada: 0,
          porcentajeDescuento: 0,
          totalDescu: 0,
          tributos: [
            {
              codigo: "20",
              descripcion: "Impuesto al Valor Agregado 13%",
              valor: iva,
            },
          ],
          subTotal: data.montoAjuste,
          ivaRete1: 0,
          reteRenta: 0,
          montoTotalOperacion: total,
          totalNoGravado: 0,
          totalPagar: total,
          totalLetras: numberToWords(total),
          totalIva: iva,
          saldoFavor: 0,
          condicionOperacion: "1" as const,
          pagos: [{ codigo: "01", montoPago: total }],
        },
        extension: {
          observaciones: `${data.tipoNota === "05" ? "NOTA DE CRÉDITO" : "NOTA DE DÉBITO"} - Ref: ${selectedFactura.numeroControl}. Motivo: ${data.motivoAnulacion}`,
        },
        apendice: [
          {
            campo: "documentoReferencia",
            etiqueta: "Documento de Referencia",
            valor: selectedFactura.numeroControl,
          },
          {
            campo: "codigoGeneracionRef",
            etiqueta: "Código Generación Referencia",
            valor: selectedFactura.codigoGeneracion,
          },
        ],
        selloRecibido: null,
        estado: "generada" as const,
      };

      const res = await apiRequest("POST", "/api/facturas", notaData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facturas"] });
      toast({
        title: tipoNota === "05" ? "Nota de Crédito generada" : "Nota de Débito generada",
        description: "El documento ha sido creado exitosamente",
      });
      navigate("/historial");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el documento",
        variant: "destructive",
      });
    },
  });

  const selectFactura = (factura: Factura) => {
    setSelectedFactura(factura);
    form.setValue("facturaReferencia", factura.id!);
    form.setValue("montoAjuste", factura.resumen.totalGravada);
  };

  const onSubmit = (data: NotaFormData) => {
    if (!emisor?.nit) {
      toast({
        title: "Emisor no configurado",
        description: "Por favor configure los datos del emisor primero",
        variant: "destructive",
      });
      navigate("/emisor");
      return;
    }
    createNotaMutation.mutate(data);
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-4 mb-6 animate-fade-in-up [animation-delay:0s]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          data-testid="button-back"
          className="hover:bg-white/70 transition-all duration-200 hover:-translate-x-1"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
            Notas de Crédito / Débito
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Emita documentos para corregir o anular facturas
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2 animate-fade-in-up [animation-delay:0s]">
            {submitCount > 0 && hasErrors && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
                <p className="font-semibold">Revisa el formulario</p>
                <p className="text-xs text-amber-800">Faltan {errorCount} campo(s) obligatorios o con formato inválido.</p>
              </div>
            )}
            {submitCount > 0 && !hasErrors && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-semibold">Validación lista</p>
                  <p className="text-xs text-emerald-800">Sin errores de cliente. Puedes generar la nota.</p>
                </div>
                {isSubmitting && <span className="text-xs">Enviando...</span>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0s' }}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Tipo de Documento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="tipoNota"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seleccione el tipo de nota</FormLabel>
                      <div className="grid grid-cols-2 gap-4">
                        <Button
                          type="button"
                          variant={field.value === "05" ? "default" : "outline"}
                          className="h-auto py-4 flex flex-col items-center gap-2"
                          onClick={() => field.onChange("05")}
                          data-testid="button-nota-credito"
                        >
                          <CircleMinus className="h-6 w-6" />
                          <span className="font-medium">Nota de Crédito</span>
                          <span className="text-xs opacity-70">Reduce el monto</span>
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === "06" ? "default" : "outline"}
                          className="h-auto py-4 flex flex-col items-center gap-2"
                          onClick={() => field.onChange("06")}
                          data-testid="button-nota-debito"
                        >
                          <CirclePlus className="h-6 w-6" />
                          <span className="font-medium">Nota de Débito</span>
                          <span className="text-xs opacity-70">Aumenta el monto</span>
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <Label className="text-sm font-medium">Número de Control</Label>
                  <p className="text-sm mt-2 font-mono bg-muted p-2 rounded-md">
                    {generateNumeroControl(tipoNota, correlativo)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Factura de Referencia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar factura..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 table-input-focus"
                    data-testid="input-search-factura"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2">
                  {facturasElegibles?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay facturas disponibles
                    </p>
                  ) : (
                    facturasElegibles?.slice(0, 5).map((factura) => (
                      <div
                        key={factura.id}
                        className={`p-3 rounded-md border cursor-pointer transition-colors ${
                          selectedFactura?.id === factura.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => selectFactura(factura)}
                        data-testid={`factura-option-${factura.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">
                              {factura.receptor.nombre}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {factura.numeroControl}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {formatCurrency(factura.resumen.totalPagar)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(factura.fecEmi)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {selectedFactura && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-xs text-muted-foreground mb-1">Seleccionada:</p>
                    <p className="font-medium">{selectedFactura.receptor.nombre}</p>
                    <p className="text-sm font-mono">{selectedFactura.numeroControl}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {selectedFactura && (
            <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <CardTitle className="text-lg">Detalles del Ajuste</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="motivoAnulacion"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Motivo del ajuste *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-motivo" className="table-input-focus">
                              <SelectValue placeholder="Seleccione un motivo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Error en cálculo">Error en cálculo</SelectItem>
                            <SelectItem value="Devolución de producto">Devolución de producto</SelectItem>
                            <SelectItem value="Descuento no aplicado">Descuento no aplicado</SelectItem>
                            <SelectItem value="Servicio no prestado">Servicio no prestado</SelectItem>
                            <SelectItem value="Cancelación de consulta">Cancelación de consulta</SelectItem>
                            <SelectItem value="Cambio en tratamiento">Cambio en tratamiento</SelectItem>
                            <SelectItem value="Otro">Otro motivo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="montoAjuste"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto del ajuste (sin IVA) *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={selectedFactura.resumen.totalGravada}
                            data-testid="input-monto-ajuste"
                            className="table-input-focus"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <Label className="text-sm font-medium">Total con IVA</Label>
                    <p className="text-2xl font-bold mt-1 text-[#3d2f28]">
                      {formatCurrency(montoAjuste + calculateIVA(montoAjuste))}
                    </p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="descripcionAjuste"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción del concepto *</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Describa el concepto del ajuste..."
                          className="resize-none table-input-focus"
                          data-testid="input-descripcion-ajuste"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm font-medium mb-2">Resumen del documento:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-medium">
                      {tipoNota === "05" ? "Nota de Crédito" : "Nota de Débito"}
                    </span>
                    <span className="text-muted-foreground">Factura original:</span>
                    <span className="font-mono text-xs">{selectedFactura.numeroControl}</span>
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(montoAjuste)}</span>
                    <span className="text-muted-foreground">IVA (13%):</span>
                    <span>{formatCurrency(calculateIVA(montoAjuste))}</span>
                    <span className="text-muted-foreground font-medium">Total:</span>
                    <span className="font-bold">
                      {formatCurrency(montoAjuste + calculateIVA(montoAjuste))}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/historial")}
                    data-testid="button-cancel"
                    className="hover:bg-white/70 transition-all duration-200"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createNotaMutation.isPending}
                    data-testid="button-submit"
                    className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-white hover:shadow-lg transition-all duration-200"
                  >
                    {createNotaMutation.isPending ? "Generando..." : `Generar ${tipoNota === "05" ? "Nota de Crédito" : "Nota de Débito"}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </Form>
    </div>
  );
}
