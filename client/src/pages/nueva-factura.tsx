import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Trash2,
  FileJson,
  FileDown,
  Save,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useValidateDTE } from "@/hooks/use-validate-dte";
import { useCatalogos } from "@/hooks/use-catalogos";
import { useProductos } from "@/hooks/use-productos";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  formatCurrency,
  generateUUID,
  generateNumeroControl,
  numberToWords,
  calculateIVA,
} from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Check,
  ChevronsUpDown,
  Plus,
  Trash2,
  FileJson,
  FileDown,
  Save,
  Eye,
  ArrowLeft,
} from "lucide-react";
import {
  DEPARTAMENTOS_EL_SALVADOR,
  TIPOS_DOCUMENTO,
  TIPOS_DTE,
  CONDICIONES_OPERACION,
  FORMAS_PAGO,
  TIPOS_ITEM,
  UNIDADES_MEDIDA,
  type Emisor,
  type Factura,
} from "@shared/schema";

type DgiiValidationError = {
  field: string;
  message: string;
};

const itemSchema = z.object({
  tipoItem: z.string().default("2"),
  cantidad: z.coerce.number().min(0.01, "Cantidad requerida"),
  codigo: z.string().optional(),
  uniMedida: z.coerce.number().default(20),
  descripcion: z.string().min(1, "Descripción requerida"),
  precioUni: z.coerce.number().min(0, "Precio requerido"),
  montoDescu: z.coerce.number().default(0),
});

const facturaFormSchema = z.object({
  tipoDte: z.string().default("01"),
  receptor: z.object({
    tipoDocumento: z.string().default("36"),
    numDocumento: z.string().min(1, "Número de documento requerido"),
    nombre: z.string().min(1, "Nombre requerido"),
    nrc: z.string().optional(),
    datosVerificados: z.boolean().default(false),
    direccion: z.object({
      departamento: z.string().min(1, "Departamento requerido"),
      municipio: z.string().min(1, "Municipio requerido"),
      complemento: z.string().min(1, "Dirección requerida"),
    }),
    telefono: z.string().optional(),
    correo: z.string().email("Correo inválido").optional().or(z.literal("")),
  }),
  items: z.array(itemSchema).min(1, "Agregar al menos un item"),
  condicionOperacion: z.string().default("1"),
  formaPago: z.string().default("01"),
  observaciones: z.string().optional(),
});

type FacturaFormData = z.infer<typeof facturaFormSchema>;

const countErrors = (errors: Record<string, any>): number => {
  return Object.values(errors).reduce((acc, value) => {
    if (!value) return acc;
    if (value.message) return acc + 1;
    if (typeof value === "object") return acc + countErrors(value as Record<string, any>);
    return acc;
  }, 0);
};

function ProductSearch({ 
  onSelect, 
  value 
}: { 
  onSelect: (product: any) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const { productos } = useProductos();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative group cursor-pointer w-full">
          <Input
            value={value}
            onChange={(e) => onSelect({ descripcion: e.target.value })}
            placeholder="Buscar o escribir descripción..."
            className="pr-8 table-input-focus"
          />
          <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar producto..." />
          <CommandList>
            <CommandEmpty>No se encontraron productos.</CommandEmpty>
            <CommandGroup heading="Catálogo de Productos">
              {productos.filter(p => p.activo).map((producto) => (
                <CommandItem
                  key={producto.id}
                  value={producto.nombre}
                  onSelect={() => {
                    onSelect({
                      descripcion: producto.nombre,
                      precioUni: Number(producto.precioUnitario),
                      uniMedida: producto.uniMedida,
                      tipoItem: producto.tipoItem,
                      codigo: producto.codigo
                    });
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === producto.nombre ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{producto.nombre}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(Number(producto.precioUnitario))} - {producto.codigo || "Sin código"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function InvoicePreview({ data, emisor }: { data: FacturaFormData; emisor: Emisor | null }) {
  const subtotal = data.items.reduce(
    (sum, item) => sum + item.cantidad * item.precioUni - item.montoDescu,
    0
  );
  const iva = calculateIVA(subtotal);
  const total = subtotal + iva;

  return (
    <div className="space-y-4 text-sm">
      <div className="text-center border-b pb-3">
        <p className="font-bold text-base">{emisor?.nombre || "Emisor no configurado"}</p>
        <p className="text-muted-foreground text-xs">NIT: {emisor?.nit || "---"}</p>
        <p className="text-muted-foreground text-xs">NRC: {emisor?.nrc || "---"}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="font-medium mb-1">Receptor:</p>
          <p>{data.receptor.nombre || "---"}</p>
          <p>{data.receptor.numDocumento || "---"}</p>
        </div>
        <div className="text-right">
          <p className="font-medium mb-1">Tipo DTE:</p>
          <p>{TIPOS_DTE.find((t) => t.codigo === data.tipoDte)?.nombre || "Factura"}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Descripción</TableHead>
            <TableHead className="text-xs text-right">Cant</TableHead>
            <TableHead className="text-xs text-right">Precio</TableHead>
            <TableHead className="text-xs text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="text-xs">{item.descripcion || "---"}</TableCell>
              <TableCell className="text-xs text-right">{item.cantidad}</TableCell>
              <TableCell className="text-xs text-right">
                {formatCurrency(item.precioUni)}
              </TableCell>
              <TableCell className="text-xs text-right">
                {formatCurrency(item.cantidad * item.precioUni - item.montoDescu)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="border-t pt-3 space-y-1">
        <div className="flex justify-between text-xs">
          <span>Subtotal:</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>IVA (13%):</span>
          <span>{formatCurrency(iva)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Total a Pagar:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="text-xs text-muted-foreground text-center border-t pt-2">
        <p className="uppercase">{numberToWords(total)}</p>
      </div>
    </div>
  );
}

export default function NuevaFactura() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const [correlativo, setCorrelativo] = useState(1);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [dgiiErrors, setDgiiErrors] = useState<DgiiValidationError[]>([]);
  const [validationStatus, setValidationStatus] = useState<"idle" | "valid" | "error">("idle");
  const { mutateAsync: validateDTE, isPending: isValidating } = useValidateDTE();
  const { data: catalogos, isLoading: catalogosLoading } = useCatalogos();

  const { data: emisor } = useQuery<Emisor>({
    queryKey: ["/api/emisor"],
  });

  const { data: facturas } = useQuery<Factura[]>({
    queryKey: ["/api/facturas"],
  });

  const tiposDteOptions = catalogos?.tiposDte ?? TIPOS_DTE;
  const tiposDocumentoOptions = catalogos?.tiposDocumento ?? TIPOS_DOCUMENTO;
  const departamentosOptions = catalogos?.departamentos ?? DEPARTAMENTOS_EL_SALVADOR;
  const condicionesOperacionOptions = catalogos?.condicionesOperacion ?? CONDICIONES_OPERACION;
  const formasPagoOptions = catalogos?.formasPago ?? FORMAS_PAGO;
  const tiposItemOptions = catalogos?.tiposItem ?? TIPOS_ITEM;
  const unidadesMedidaOptions = catalogos?.unidadesMedida ?? UNIDADES_MEDIDA;
  const defaultUniMedida = unidadesMedidaOptions[0]?.codigo ?? 20;

  useEffect(() => {
    if (facturas) {
      setCorrelativo(facturas.length + 1);
    }
  }, [facturas]);

  const form = useForm<FacturaFormData>({
    resolver: zodResolver(facturaFormSchema),
    defaultValues: {
      tipoDte: "01",
      receptor: {
        tipoDocumento: "36",
        numDocumento: "",
        nombre: "",
        nrc: "",
        datosVerificados: false,
        direccion: {
          departamento: "06",
          municipio: "01",
          complemento: "",
        },
        telefono: "",
        correo: "",
      },
      items: [
        {
          tipoItem: "2",
          cantidad: 1,
          codigo: "",
          uniMedida: defaultUniMedida,
          descripcion: "",
          precioUni: 0,
          montoDescu: 0,
        },
      ],
      condicionOperacion: "1",
      formaPago: "01",
      observaciones: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Autocompletar datos del receptor al ingresar número de documento
  const watchedNumDoc = form.watch("receptor.numDocumento");
  useEffect(() => {
    const fetchReceptor = async () => {
      if (watchedNumDoc && (watchedNumDoc.length >= 9)) { // Mínimo caracteres para buscar
        try {
          const response = await fetch(`/api/receptores/${watchedNumDoc}`);
          if (response.ok) {
            const data = await response.json();
            // Solo autocompletar si los campos están vacíos para no sobreescribir accidentalmente
            const currentNombre = form.getValues("receptor.nombre");
            if (!currentNombre || currentNombre === "") {
              form.setValue("receptor.nombre", data.nombre);
              if (data.nrc) form.setValue("receptor.nrc", data.nrc);
              if (data.telefono) form.setValue("receptor.telefono", data.telefono);
              if (data.correo) form.setValue("receptor.correo", data.correo);
              if (data.direccion) {
                form.setValue("receptor.direccion.departamento", data.direccion.departamento);
                form.setValue("receptor.direccion.municipio", data.direccion.municipio);
                form.setValue("receptor.direccion.complemento", data.direccion.complemento);
              }
              toast({
                title: "Cliente encontrado",
                description: `Se han cargado los datos de ${data.nombre}`,
              });
            }
          }
        } catch (error) {
          // Silencioso si no encuentra
        }
      }
    };

    const timer = setTimeout(fetchReceptor, 500); // Debounce de 500ms
    return () => clearTimeout(timer);
  }, [watchedNumDoc, form]);

  useEffect(() => {
    const duplicatedData = sessionStorage.getItem("duplicatedFactura");
    if (duplicatedData) {
      try {
        const data = JSON.parse(duplicatedData);
        
        const normalizedItems = (data.items?.length > 0 ? data.items : []).map((item: any) => ({
          tipoItem: String(item.tipoItem || "2"),
          cantidad: Number(item.cantidad) || 1,
          codigo: String(item.codigo || ""),
          uniMedida: Number(item.uniMedida ?? defaultUniMedida) || defaultUniMedida,
          descripcion: String(item.descripcion || ""),
          precioUni: Number(item.precioUni) || 0,
          montoDescu: Number(item.montoDescu) || 0,
        }));

        if (normalizedItems.length === 0) {
          normalizedItems.push({
            tipoItem: "2",
            cantidad: 1,
            codigo: "",
            uniMedida: defaultUniMedida,
            descripcion: "",
            precioUni: 0,
            montoDescu: 0,
          });
        }

        form.reset({
          tipoDte: String(data.tipoDte || "01"),
          receptor: {
            tipoDocumento: String(data.receptor?.tipoDocumento || "36"),
            numDocumento: String(data.receptor?.numDocumento || ""),
            nombre: String(data.receptor?.nombre || ""),
            nrc: String(data.receptor?.nrc || ""),
            direccion: {
              departamento: String(data.receptor?.direccion?.departamento || "06"),
              municipio: String(data.receptor?.direccion?.municipio || "01"),
              complemento: String(data.receptor?.direccion?.complemento || ""),
            },
            telefono: String(data.receptor?.telefono || ""),
            correo: String(data.receptor?.correo || ""),
          },
          items: normalizedItems,
          condicionOperacion: String(data.condicionOperacion || "1"),
          formaPago: String(data.formaPago || "01"),
          observaciones: String(data.observaciones || ""),
        });
        setIsDuplicate(true);
        sessionStorage.removeItem("duplicatedFactura");
        toast({
          title: "Factura duplicada",
          description: "Los datos han sido cargados. Revise y confirme antes de generar.",
        });
      } catch (e) {
        // Silently fail if data is corrupted, user will start fresh
      }
    }
  }, [form, toast]);

  const buildFacturaPayload = (data: FacturaFormData) => {
    const now = new Date();
    const fecEmi = now.toISOString().split("T")[0];
    const horEmi = now.toTimeString().split(" ")[0];
    const codigoGeneracion = generateUUID();
    const numeroControl = generateNumeroControl(data.tipoDte, correlativo);

    const subtotal = data.items.reduce(
      (sum, item) => sum + item.cantidad * item.precioUni - item.montoDescu,
      0
    );
    const iva = calculateIVA(subtotal);
    const total = subtotal + iva;

    return {
      version: 1,
      ambiente: "00",
      tipoDte: data.tipoDte,
      numeroControl,
      codigoGeneracion,
      tipoModelo: "1",
      tipoOperacion: "1",
      tipoContingencia: null,
      motivoContin: null,
      fecEmi,
      horEmi,
      tipoMoneda: "USD",
      emisor: emisor || {
        nit: "",
        nrc: "",
        nombre: "",
        codActividad: "",
        descActividad: "",
        direccion: { departamento: "", municipio: "", complemento: "" },
        telefono: "",
        correo: "",
      },
      receptor: {
        ...data.receptor,
        tipoDocumento: data.receptor.tipoDocumento as "36" | "13" | "02" | "03" | "37",
      },
      cuerpoDocumento: data.items.map((item, index) => ({
        numItem: index + 1,
        tipoItem: item.tipoItem as "1" | "2" | "3" | "4",
        cantidad: item.cantidad,
        codigo: item.codigo || "",
        uniMedida: Number(item.uniMedida),
        descripcion: item.descripcion,
        precioUni: item.precioUni,
        montoDescu: item.montoDescu,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada: item.cantidad * item.precioUni - item.montoDescu,
        tributos: [],
        psv: 0,
        noGravado: 0,
        ivaItem: calculateIVA(item.cantidad * item.precioUni - item.montoDescu),
      })),
      resumen: {
        totalNoSuj: 0,
        totalExenta: 0,
        totalGravada: subtotal,
        subTotalVentas: subtotal,
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
        subTotal: subtotal,
        ivaRete1: 0,
        reteRenta: 0,
        montoTotalOperacion: total,
        totalNoGravado: 0,
        totalPagar: total,
        totalLetras: numberToWords(total),
        totalIva: iva,
        saldoFavor: 0,
        condicionOperacion: data.condicionOperacion as "1" | "2" | "3",
        pagos: [
          {
            codigo: data.formaPago,
            montoPago: total,
            referencia: "",
            plazo: "",
            periodo: 0,
          },
        ],
        numPagoElectronico: "",
      },
      extension: {
        observaciones: data.observaciones || "",
      },
      apendice: [],
      selloRecibido: null,
      estado: "generada" as const,
    };
  };

  type FacturaPayload = ReturnType<typeof buildFacturaPayload>;

  const createMutation = useMutation({
    mutationFn: async (payload: FacturaPayload) => {
      const res = await apiRequest("POST", "/api/facturas", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facturas"] });
      toast({
        title: "Factura generada",
        description: "La factura ha sido creada exitosamente",
      });
      setValidationStatus("idle");
      setDgiiErrors([]);
      navigate("/historial");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la factura",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FacturaFormData) => {
    if (!emisor?.nit) {
      toast({
        title: "Emisor no configurado",
        description: "Por favor configure los datos del emisor primero",
        variant: "destructive",
      });
      navigate("/emisor");
      return;
    }

    const facturaPayload = buildFacturaPayload(data);

    try {
      await validateDTE(facturaPayload);
      setDgiiErrors([]);
      setValidationStatus("valid");
    } catch (error: any) {
      const errors = error?.errors || error?.dgiiErrors || [];
      setDgiiErrors(errors);
      setValidationStatus("error");
      toast({
        title: "Errores de validación DGII",
        description: "Corrige los campos marcados antes de generar el DTE",
        variant: "destructive",
      });
      return;
    }

    await createMutation.mutateAsync(facturaPayload);
  };

  const watchedData = form.watch();
  const { submitCount, isSubmitting } = form.formState;
  const errorCount = countErrors(form.formState.errors);
  const hasErrors = errorCount > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 animate-fade-in-up">
      <div className="flex items-center justify-between gap-4 flex-wrap animate-fade-in-up [animation-delay:0s]">
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
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
              Nueva Factura Electrónica
            </h1>
            <p className="text-muted-foreground text-sm">
              Complete los datos para generar el DTE
            </p>
          </div>
        </div>
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-preview" className="hover:bg-white/70 transition-all">
              <Eye className="h-4 w-4 mr-2" />
              Vista Previa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Vista Previa de Factura</DialogTitle>
            </DialogHeader>
            <InvoicePreview data={watchedData} emisor={emisor || null} />
          </DialogContent>
        </Dialog>
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
                  <p className="text-xs text-emerald-800">Sin errores de cliente. Puedes generar el DTE.</p>
                </div>
                {isSubmitting && <span className="text-xs">Enviando...</span>}
              </div>
            )}
            {dgiiErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive shadow-sm">
                <p className="font-semibold">Errores de validación DGII</p>
                <ul className="mt-2 space-y-1 text-xs text-destructive">
                  {dgiiErrors.map((err, index) => (
                    <li key={`${err.field}-${index}`}>
                      • {err.field}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {validationStatus === "valid" && dgiiErrors.length === 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-semibold">Validación DGII lista</p>
                  <p className="text-xs text-emerald-800">El documento cumple el schema oficial DGII.</p>
                </div>
                {isValidating && <span className="text-xs">Validando...</span>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-4 space-y-6">
              <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0s' }}>
                <CardHeader>
                  <CardTitle>Tipo de Documento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tipoDte"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de DTE *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={catalogosLoading}
                              >
                            <FormControl>
                              <SelectTrigger data-testid="select-tipo-dte">
                                <SelectValue placeholder="Seleccionar tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                  {tiposDteOptions.map((tipo) => (
                                <SelectItem key={tipo.codigo} value={tipo.codigo}>
                                  {tipo.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div>
                      <Label className="text-sm font-medium">Número de Control</Label>
                      <p className="text-sm mt-2 font-mono bg-muted p-2 rounded-md" data-testid="text-numero-control">
                        {generateNumeroControl(watchedData.tipoDte, correlativo)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <CardHeader>
                  <CardTitle>Datos del Receptor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="receptor.tipoDocumento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Documento *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={catalogosLoading}
                              >
                            <FormControl>
                              <SelectTrigger data-testid="select-tipo-doc">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                  {tiposDocumentoOptions.map((tipo) => (
                                <SelectItem key={tipo.codigo} value={tipo.codigo}>
                                  {tipo.nombre}
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
                      name="receptor.numDocumento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Documento *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="0000-000000-000-0"
                              data-testid="input-num-documento"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="receptor.datosVerificados"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            id="receptor-datos-verificados"
                          />
                        </FormControl>
                        <FormLabel htmlFor="receptor-datos-verificados" className="cursor-pointer font-normal mb-0">
                          ✓ He verificado que los datos del receptor son correctos
                        </FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="receptor.nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre / Razón Social *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Nombre del cliente"
                            data-testid="input-nombre-receptor"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="receptor.nrc"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NRC (Opcional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="000000-0"
                            data-testid="input-nrc-receptor"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="receptor.direccion.departamento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departamento *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={catalogosLoading}
                              >
                            <FormControl>
                              <SelectTrigger data-testid="select-departamento">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                  {departamentosOptions.map((dep) => (
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
                      name="receptor.direccion.municipio"
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
                    name="receptor.direccion.complemento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Dirección completa"
                            className="resize-none"
                            data-testid="input-direccion"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="receptor.telefono"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
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
                      name="receptor.correo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Correo Electrónico</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="correo@ejemplo.com"
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

              <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle>Productos / Servicios</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        tipoItem: "2",
                        cantidad: 1,
                        codigo: "",
                        uniMedida: defaultUniMedida,
                        descripcion: "",
                        precioUni: 0,
                        montoDescu: 0,
                      })
                    }
                    data-testid="button-add-item"
                    className="hover:bg-white/70 gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar Item
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                          <TableRow>
                          <TableHead className="w-[90px]">Tipo</TableHead>
                          <TableHead className="w-[130px]">Unidad</TableHead>
                          <TableHead className="min-w-[250px]">Descripción</TableHead>
                          <TableHead className="w-[100px]">Cant.</TableHead>
                          <TableHead className="w-[130px]">Precio Unit.</TableHead>
                          <TableHead className="w-[120px]">Desc.</TableHead>
                          <TableHead className="w-[130px] text-right">Subtotal</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((field, index) => {
                          const item = watchedData.items[index];
                          const subtotal = item
                            ? item.cantidad * item.precioUni - item.montoDescu
                            : 0;
                          return (
                            <TableRow key={field.id} className="table-row-hover group">
                              <TableCell className="group-hover:bg-indigo-50/50">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.tipoItem`}
                                  render={({ field }) => (
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value}
                                      disabled={catalogosLoading}
                                    >
                                      <SelectTrigger className="w-full table-input-focus" data-testid={`select-tipo-item-${index}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {tiposItemOptions.map((tipo) => (
                                          <SelectItem key={tipo.codigo} value={tipo.codigo}>
                                            {tipo.nombre}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="group-hover:bg-indigo-50/50">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.uniMedida`}
                                  render={({ field }) => (
                                    <Select
                                      onValueChange={(val) => field.onChange(Number(val))}
                                      value={String(field.value ?? defaultUniMedida)}
                                      disabled={catalogosLoading}
                                    >
                                      <SelectTrigger className="w-full table-input-focus" data-testid={`select-uni-medida-${index}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {unidadesMedidaOptions.map((unidad) => (
                                          <SelectItem key={unidad.codigo} value={String(unidad.codigo)}>
                                            {unidad.nombre}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="group-hover:bg-indigo-50/50">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.descripcion`}
                                  render={({ field }) => (
                                    <ProductSearch 
                                      value={field.value}
                                      onSelect={(p) => {
                                        field.onChange(p.descripcion);
                                        if (p.precioUni !== undefined) {
                                          form.setValue(`items.${index}.precioUni`, p.precioUni);
                                          form.setValue(`items.${index}.uniMedida`, p.uniMedida);
                                          form.setValue(`items.${index}.tipoItem`, p.tipoItem);
                                          if (p.codigo) form.setValue(`items.${index}.codigo`, p.codigo);
                                        }
                                      }}
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell className="group-hover:bg-indigo-50/50">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.cantidad`}
                                  render={({ field }) => (
                                    <Input
                                      {...field}
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      data-testid={`input-cantidad-${index}`}
                                      className="table-input-focus"
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell className="group-hover:bg-indigo-50/50">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.precioUni`}
                                  render={({ field }) => (
                                    <Input
                                      {...field}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      data-testid={`input-precio-${index}`}
                                      className="table-input-focus"
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell className="group-hover:bg-indigo-50/50">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.montoDescu`}
                                  render={({ field }) => (
                                    <Input
                                      {...field}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      data-testid={`input-descuento-${index}`}
                                      className="table-input-focus"
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell className="text-right font-medium group-hover:bg-indigo-50/50">
                                {formatCurrency(subtotal)}
                              </TableCell>
                              <TableCell className="group-hover:bg-indigo-50/50">
                                {fields.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => remove(index)}
                                    data-testid={`button-remove-item-${index}`}
                                    className="hover:bg-red-100 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {form.formState.errors.items && (
                    <p className="text-sm text-destructive mt-2">
                      {form.formState.errors.items.message}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <CardHeader>
                  <CardTitle>Condiciones de Pago</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="condicionOperacion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condición de Operación *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={catalogosLoading}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-condicion">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {condicionesOperacionOptions.map((cond) => (
                                <SelectItem key={cond.codigo} value={cond.codigo}>
                                  {cond.nombre}
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
                      name="formaPago"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Forma de Pago *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={catalogosLoading}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-forma-pago">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {formasPagoOptions.map((pago) => (
                                <SelectItem key={pago.codigo} value={pago.codigo}>
                                  {pago.nombre}
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
                    name="observaciones"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel>Observaciones</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Observaciones adicionales"
                            className="resize-none"
                            data-testid="input-observaciones"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="sticky top-6 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <CardHeader>
                  <CardTitle>Resumen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const subtotal = watchedData.items.reduce(
                      (sum, item) => sum + item.cantidad * item.precioUni - item.montoDescu,
                      0
                    );
                    const iva = calculateIVA(subtotal);
                    const total = subtotal + iva;
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">IVA (13%):</span>
                          <span data-testid="text-iva">{formatCurrency(iva)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total:</span>
                          <span data-testid="text-total">{formatCurrency(total)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground text-center uppercase">
                          {numberToWords(total)}
                        </p>
                      </>
                    );
                  })()}

                  <Separator />

                  <div className="space-y-2">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createMutation.isPending || isValidating}
                      data-testid="button-generar"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {createMutation.isPending
                        ? "Generando..."
                        : isValidating
                          ? "Validando..."
                          : "Generar Factura"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
