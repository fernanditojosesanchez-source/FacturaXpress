import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  FileText,
  FileJson,
  FileDown,
  Search,
  Eye,
  Trash2,
  Download,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const [deleteFactura, setDeleteFactura] = useState<Factura | null>(null);

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

  const filteredFacturas = facturas?.filter((f) => {
    const matchesSearch =
      f.receptor.nombre.toLowerCase().includes(search.toLowerCase()) ||
      f.numeroControl.toLowerCase().includes(search.toLowerCase()) ||
      f.codigoGeneracion.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || f.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
            {facturas?.length || 0} facturas en total
          </p>
        </div>
        <Link href="/factura/nueva">
          <Button data-testid="button-new-invoice">
            <FileText className="h-4 w-4 mr-2" />
            Nueva Factura
          </Button>
        </Link>
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
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                <Filter className="h-4 w-4 mr-2" />
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
          </div>
        </CardHeader>
        <CardContent>
          {!filteredFacturas?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No hay facturas</p>
              <p className="text-muted-foreground text-sm">
                {search || statusFilter !== "all"
                  ? "No se encontraron facturas con los filtros aplicados"
                  : "Comienza creando tu primera factura electrónica"}
              </p>
              {!search && statusFilter === "all" && (
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
                      <TableRow key={factura.id} data-testid={`row-factura-${factura.id}`}>
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
                              onClick={() => downloadJSON(factura)}
                              data-testid={`button-download-${factura.id}`}
                            >
                              <Download className="h-4 w-4" />
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

              <div className="flex gap-2">
                <Button onClick={() => downloadJSON(selectedFactura)} data-testid="button-download-json">
                  <FileJson className="h-4 w-4 mr-2" />
                  Descargar JSON
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
