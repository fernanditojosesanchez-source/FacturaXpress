import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  FileText,
  FileJson,
  FileDown,
  Search,
  Eye,
  Trash2,
  Download,
  Filter,
  Copy,
  Mail,
  Calendar,
  X,
  Package,
  Send,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Factura } from "@shared/schema";
import { TIPOS_DTE } from "@shared/schema";

const statusConfig = {
  borrador: { label: "Borrador", variant: "secondary" as const },
  generada: { label: "Generada", variant: "outline" as const },
  transmitida: { label: "Transmitida", variant: "default" as const },
  sellada: { label: "Sellada", variant: "default" as const },
  anulada: { label: "Anulada", variant: "destructive" as const },
};

interface AdvancedFilters {
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  tipoDte: string;
}

function JsonViewer({ data }: { data: object }) {
  return (
    <ScrollArea className="h-[400px] w-full rounded-md border bg-muted p-4">
      <pre className="text-xs font-mono whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </ScrollArea>
  );
}

export default function Historial() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const [deleteFactura, setDeleteFactura] = useState<Factura | null>(null);
  const [transmitingId, setTransmitingId] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    dateFrom: "",
    dateTo: "",
    minAmount: "",
    maxAmount: "",
    tipoDte: "all",
  });

  const { data: facturas, isLoading } = useQuery<Factura[]>({
    queryKey: ["/api/facturas"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/facturas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facturas"] });
      toast({
        title: "Factura eliminada",
        description: "La factura ha sido eliminada correctamente",
      });
      setDeleteFactura(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la factura",
        variant: "destructive",
      });
    },
  });

  // Mutation para transmitir al MH
  const transmitirMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest<{
        success: boolean;
        sello: {
          estado: string;
          selloRecibido: string;
          observaciones?: string;
        };
      }>("POST", `/api/facturas/${id}/transmitir`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/facturas"] });
      if (data.success) {
        toast({
          title: "✅ Transmisión exitosa",
          description: "La factura ha sido transmitida y sellada por el MH",
        });
      } else {
        toast({
          title: "⚠️ Transmisión rechazada",
          description: data.sello.observaciones || "El MH rechazó el documento",
          variant: "destructive",
        });
      }
      setTransmitingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al transmitir",
        description: error.message || "No se pudo transmitir al MH",
        variant: "destructive",
      });
      setTransmitingId(null);
    },
  });

  const transmitirAlMH = async (factura: Factura) => {
    if (factura.estado === "sellada" || factura.estado === "transmitida") {
      toast({
        title: "Factura ya transmitida",
        description: "Esta factura ya fue transmitida al MH",
        variant: "destructive",
      });
      return;
    }

    setTransmitingId(factura.id!);
    transmitirMutation.mutate(factura.id!);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.dateFrom) count++;
    if (advancedFilters.dateTo) count++;
    if (advancedFilters.minAmount) count++;
    if (advancedFilters.maxAmount) count++;
    if (advancedFilters.tipoDte !== "all") count++;
    return count;
  }, [advancedFilters]);

  const filteredFacturas = useMemo(() => {
    return facturas?.filter((f) => {
      const matchesSearch =
        f.receptor.nombre.toLowerCase().includes(search.toLowerCase()) ||
        f.numeroControl.toLowerCase().includes(search.toLowerCase()) ||
        f.codigoGeneracion.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || f.estado === statusFilter;

      if (advancedFilters.dateFrom) {
        const facturaDate = new Date(f.fecEmi);
        const fromDate = new Date(advancedFilters.dateFrom);
        if (facturaDate < fromDate) return false;
      }
      if (advancedFilters.dateTo) {
        const facturaDate = new Date(f.fecEmi);
        const toDate = new Date(advancedFilters.dateTo);
        if (facturaDate > toDate) return false;
      }
      if (advancedFilters.minAmount) {
        if (f.resumen.totalPagar < parseFloat(advancedFilters.minAmount)) return false;
      }
      if (advancedFilters.maxAmount) {
        if (f.resumen.totalPagar > parseFloat(advancedFilters.maxAmount)) return false;
      }
      if (advancedFilters.tipoDte !== "all") {
        if (f.tipoDte !== advancedFilters.tipoDte) return false;
      }

      return matchesSearch && matchesStatus;
    });
  }, [facturas, search, statusFilter, advancedFilters]);

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      dateFrom: "",
      dateTo: "",
      minAmount: "",
      maxAmount: "",
      tipoDte: "all",
    });
  };

  const downloadJSON = (factura: Factura) => {
    const dataStr = JSON.stringify(factura, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DTE-${factura.numeroControl}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "JSON descargado",
      description: `Archivo DTE-${factura.numeroControl}.json descargado`,
    });
  };

  const downloadPDF = async (factura: Factura) => {
    try {
      const { generateFacturaHTML, generatePDFFromElement } = await import(
        "@/lib/pdf-generator"
      );

      const htmlContent = generateFacturaHTML(factura);
      
      // Crear elemento temporal
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlContent;
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-10000px";
      document.body.appendChild(tempDiv);

      await generatePDFFromElement(tempDiv, `FACTURA-${factura.numeroControl}.pdf`);
      
      document.body.removeChild(tempDiv);
      
      toast({
        title: "PDF descargado",
        description: `Archivo FACTURA-${factura.numeroControl}.pdf descargado`,
      });
    } catch (error) {
      console.error("Error generando PDF:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    }
  };

  const exportMassiveJSON = () => {
    if (!filteredFacturas?.length) {
      toast({
        title: "Sin facturas",
        description: "No hay facturas para exportar",
        variant: "destructive",
      });
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      totalFacturas: filteredFacturas.length,
      facturas: filteredFacturas,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const now = new Date();
    link.download = `facturas-${now.toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "Exportación completada",
      description: `${filteredFacturas.length} facturas exportadas`,
    });
  };

  const exportToCSV = () => {
    if (!filteredFacturas?.length) {
      toast({
        title: "Sin facturas",
        description: "No hay facturas para exportar",
        variant: "destructive",
      });
      return;
    }

    // Headers del CSV
    const headers = ["Fecha", "Número Control", "Código Gen", "Receptor", "Monto", "Estado", "Tipo DTE"];
    
    // Rows del CSV
    const rows = filteredFacturas.map(f => [
      formatDate(f.fecEmi),
      f.numeroControl,
      f.codigoGeneracion.substring(0, 8),
      f.receptor.nombre,
      formatCurrency(f.resumen.totalPagar),
      f.estado,
      TIPOS_DTE.find(t => t.codigo === f.tipoDte)?.nombre || f.tipoDte,
    ]);

    // Convertir a CSV
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    // Descargar
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const now = new Date();
    link.download = `facturas-${now.toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exportación a CSV completada",
      description: `${filteredFacturas.length} facturas exportadas`,
    });
  };

  const duplicateFactura = (factura: Factura) => {
    const duplicatedData = {
      tipoDte: factura.tipoDte,
      receptor: factura.receptor,
      items: factura.cuerpoDocumento.map((item) => ({
        tipoItem: item.tipoItem,
        cantidad: item.cantidad,
        codigo: item.codigo,
        descripcion: item.descripcion,
        precioUni: item.precioUni,
        montoDescu: item.montoDescu,
      })),
      condicionOperacion: factura.resumen.condicionOperacion,
      formaPago: factura.resumen.pagos?.[0]?.codigo || "01",
      observaciones: factura.extension?.observaciones || "",
    };

    sessionStorage.setItem("duplicatedFactura", JSON.stringify(duplicatedData));
    navigate("/factura/nueva?duplicate=true");
  };

  const sendByEmail = (factura: Factura) => {
    if (!factura.receptor.correo) {
      toast({
        title: "Sin correo",
        description: "El receptor no tiene correo electrónico registrado",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Función próximamente",
      description: "El envío por correo estará disponible pronto. Por favor configure la integración de email.",
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Card>
          <CardContent className="p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-4 border-b last:border-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Historial de Facturas
          </h1>
          <p className="text-muted-foreground">
            {filteredFacturas?.length || 0} de {facturas?.length || 0} facturas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={exportMassiveJSON}
            disabled={!filteredFacturas?.length}
            data-testid="button-export-all"
          >
            <FileJson className="h-4 w-4 mr-2" />
            Exportar JSON
          </Button>
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={!filteredFacturas?.length}
            data-testid="button-export-csv"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Link href="/factura/nueva">
            <Button data-testid="button-new-invoice">
              <FileText className="h-4 w-4 mr-2" />
              Nueva Factura
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, número de control..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search"
                data-search-input
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="generada">Generada</SelectItem>
                <SelectItem value="transmitida">Transmitida</SelectItem>
                <SelectItem value="sellada">Sellada</SelectItem>
                <SelectItem value="anulada">Anulada</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
              <PopoverTrigger asChild>
                <Button
                  variant={activeFiltersCount > 0 ? "default" : "outline"}
                  data-testid="button-advanced-filters"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-2" size="sm">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Filtros Avanzados</h4>
                    {activeFiltersCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAdvancedFilters}
                        data-testid="button-clear-filters"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Limpiar
                      </Button>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Desde</Label>
                        <Input
                          type="date"
                          value={advancedFilters.dateFrom}
                          onChange={(e) =>
                            setAdvancedFilters((prev) => ({
                              ...prev,
                              dateFrom: e.target.value,
                            }))
                          }
                          data-testid="input-date-from"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Hasta</Label>
                        <Input
                          type="date"
                          value={advancedFilters.dateTo}
                          onChange={(e) =>
                            setAdvancedFilters((prev) => ({
                              ...prev,
                              dateTo: e.target.value,
                            }))
                          }
                          data-testid="input-date-to"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Monto mínimo ($)</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={advancedFilters.minAmount}
                          onChange={(e) =>
                            setAdvancedFilters((prev) => ({
                              ...prev,
                              minAmount: e.target.value,
                            }))
                          }
                          data-testid="input-min-amount"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Monto máximo ($)</Label>
                        <Input
                          type="number"
                          placeholder="1000.00"
                          value={advancedFilters.maxAmount}
                          onChange={(e) =>
                            setAdvancedFilters((prev) => ({
                              ...prev,
                              maxAmount: e.target.value,
                            }))
                          }
                          data-testid="input-max-amount"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Tipo de documento</Label>
                      <Select
                        value={advancedFilters.tipoDte}
                        onValueChange={(value) =>
                          setAdvancedFilters((prev) => ({
                            ...prev,
                            tipoDte: value,
                          }))
                        }
                      >
                        <SelectTrigger data-testid="select-tipo-dte-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los tipos</SelectItem>
                          {TIPOS_DTE.map((tipo) => (
                            <SelectItem key={tipo.codigo} value={tipo.codigo}>
                              {tipo.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          {!filteredFacturas?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No hay facturas</p>
              <p className="text-muted-foreground text-sm">
                {search || statusFilter !== "all" || activeFiltersCount > 0
                  ? "No se encontraron facturas con los filtros aplicados"
                  : "Comienza creando tu primera factura electrónica"}
              </p>
              {!search && statusFilter === "all" && activeFiltersCount === 0 && (
                <Link href="/factura/nueva">
                  <Button className="mt-4" data-testid="button-create-first">
                    Crear factura
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Número de Control</TableHead>
                    <TableHead>Receptor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFacturas.map((factura) => {
                    const status = statusConfig[factura.estado];
                    const tipoDte = TIPOS_DTE.find((t) => t.codigo === factura.tipoDte);
                    return (
                      <TableRow key={factura.id} data-testid={`row-factura-${factura.id}`} className="table-row-hover">
                        <TableCell className="font-mono text-sm">
                          {formatDate(factura.fecEmi)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {factura.numeroControl}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{factura.receptor.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {factura.receptor.numDocumento}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" size="sm">
                            {tipoDte?.nombre || factura.tipoDte}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(factura.resumen.totalPagar)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} size="sm">
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {(factura.estado === "generada" || factura.estado === "borrador") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => transmitirAlMH(factura)}
                                disabled={transmitingId === factura.id}
                                data-testid={`button-transmit-${factura.id}`}
                                title="Transmitir al MH"
                              >
                                {transmitingId === factura.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4 text-blue-600" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedFactura(factura)}
                              data-testid={`button-view-${factura.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => duplicateFactura(factura)}
                              data-testid={`button-duplicate-${factura.id}`}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => downloadJSON(factura)}
                              data-testid={`button-download-${factura.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => sendByEmail(factura)}
                              data-testid={`button-email-${factura.id}`}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteFactura(factura)}
                              data-testid={`button-delete-${factura.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedFactura} onOpenChange={() => setSelectedFactura(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de Factura</DialogTitle>
            <DialogDescription>
              {selectedFactura?.numeroControl}
            </DialogDescription>
          </DialogHeader>
          {selectedFactura && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Código de Generación</p>
                  <p className="font-mono text-xs">{selectedFactura.codigoGeneracion}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha de Emisión</p>
                  <p>{formatDate(selectedFactura.fecEmi)} {selectedFactura.horEmi}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Receptor</p>
                  <p className="font-medium">{selectedFactura.receptor.nombre}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-bold text-lg">
                    {formatCurrency(selectedFactura.resumen.totalPagar)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">JSON del DTE</p>
                <JsonViewer data={selectedFactura} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => downloadJSON(selectedFactura)} data-testid="button-download-json">
                  <FileJson className="h-4 w-4 mr-2" />
                  Descargar JSON
                </Button>
                <Button 
                  onClick={() => downloadPDF(selectedFactura)} 
                  variant="outline"
                  data-testid="button-download-pdf"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Descargar PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open(`/api/facturas/${selectedFactura.id}/pdf`, "_blank");
                  }}
                  data-testid="button-download-pdf"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Descargar PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFactura(null);
                    duplicateFactura(selectedFactura);
                  }}
                  data-testid="button-duplicate-dialog"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFactura} onOpenChange={() => setDeleteFactura(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Factura</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la factura{" "}
              <strong>{deleteFactura?.numeroControl}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFactura && deleteMutation.mutate(deleteFactura.id!)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
