import { useState } from "react";
import {
  useAnulacionesPendientes,
  useAnulacionesHistorico,
  useProcesarAnulacionesPendientes,
} from "@/hooks/use-anulaciones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDate } from "@/lib/utils";

const MOTIVOS_MAP: Record<string, string> = {
  "01": "Error en emisión",
  "02": "Contabilización errónea",
  "03": "Devolución total",
  "04": "Devolución parcial",
  "05": "Acuerdo entre partes",
};

const estadoConfig = {
  pendiente: {
    icon: Clock,
    label: "Pendiente",
    variant: "secondary" as const,
    color: "text-orange-600",
  },
  procesando: {
    icon: RefreshCw,
    label: "Procesando",
    variant: "outline" as const,
    color: "text-blue-600",
  },
  aceptado: {
    icon: CheckCircle2,
    label: "Aceptado",
    variant: "default" as const,
    color: "text-green-600",
  },
  error: {
    icon: AlertTriangle,
    label: "Error",
    variant: "destructive" as const,
    color: "text-red-600",
  },
};

function AnulacionesSkeletons() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-6 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function AnulacionesList() {
  const { toast } = useToast();
  const pendientesQuery = useAnulacionesPendientes();
  const historicoQuery = useAnulacionesHistorico();
  const procesarMutation = useProcesarAnulacionesPendientes();

  const handleProcesar = () => {
    procesarMutation.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Éxito",
          description:
            "Se inició el procesamiento de anulaciones pendientes",
          variant: "default",
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "No se pudo procesar las anulaciones",
          variant: "destructive",
        });
      },
    });
  };

  const pendientes = pendientesQuery.data || [];
  const historico = historicoQuery.data || [];

  const estadosCount = {
    pendiente: pendientes.filter((a) => a.estado === "pendiente").length,
    procesando: pendientes.filter((a) => a.estado === "procesando").length,
    aceptado: historico.filter((a) => a.estado === "aceptado").length,
    error: historico.filter((a) => a.estado === "error").length,
  };

  // Mostrar errores si las queries fallaron
  const hasPendientesError = pendientesQuery.isError;
  const hasHistoricoError = historicoQuery.isError;

  return (
    <Card className="col-span-full">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle>Gestión de Anulaciones</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pendientesQuery.refetch()}
              disabled={pendientesQuery.isLoading}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  pendientesQuery.isLoading ? "animate-spin" : ""
                }`}
              />
              Actualizar
            </Button>
            {pendientes.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleProcesar}
                disabled={
                  procesarMutation.isPending || pendientesQuery.isLoading
                }
                className="gap-2"
              >
                {procesarMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Procesar Pendientes
              </Button>
            )}
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-4 gap-3 pt-2">
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="text-xs font-semibold text-orange-600">
              PENDIENTES
            </div>
            <div className="mt-1 text-2xl font-bold text-orange-700">
              {estadosCount.pendiente}
            </div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-xs font-semibold text-blue-600">PROCESANDO</div>
            <div className="mt-1 text-2xl font-bold text-blue-700">
              {estadosCount.procesando}
            </div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="text-xs font-semibold text-green-600">ACEPTADO</div>
            <div className="mt-1 text-2xl font-bold text-green-700">
              {estadosCount.aceptado}
            </div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-xs font-semibold text-red-600">ERROR</div>
            <div className="mt-1 text-2xl font-bold text-red-700">
              {estadosCount.error}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {hasPendientesError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error al cargar anulaciones pendientes: {pendientesQuery.error instanceof Error ? pendientesQuery.error.message : "Error desconocido"}
            </AlertDescription>
          </Alert>
        )}
        
        {hasHistoricoError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error al cargar histórico de anulaciones: {historicoQuery.error instanceof Error ? historicoQuery.error.message : "Error desconocido"}
            </AlertDescription>
          </Alert>
        )}
        
        <Tabs defaultValue="pendientes" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pendientes" className="relative">
              Pendientes
              {estadosCount.pendiente > 0 && (
                <Badge className="ml-2 bg-orange-600">
                  {estadosCount.pendiente}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* Pendientes Tab */}
          <TabsContent value="pendientes" className="space-y-4">
            {pendientesQuery.isLoading ? (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código Gen</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Intentos</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnulacionesSkeletons />
                  </TableBody>
                </Table>
              </div>
            ) : pendientes.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No hay anulaciones pendientes de procesar
                </AlertDescription>
              </Alert>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código Gen</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Intentos</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendientes.map((anulacion) => {
                      const config = estadoConfig[anulacion.estado];
                      const Icon = config.icon;

                      return (
                        <TableRow key={anulacion.id}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {anulacion.codigoGeneracion}
                          </TableCell>
                          <TableCell>
                            {MOTIVOS_MAP[anulacion.motivo] || anulacion.motivo}
                          </TableCell>
                          <TableCell>
                            <Badge variant={config.variant} className="gap-1">
                              <Icon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {anulacion.intentosFallidos}/10
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {formatDate(anulacion.fechaAnulo)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Histórico Tab */}
          <TabsContent value="historico" className="space-y-4">
            {historicoQuery.isLoading ? (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código Gen</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Sello</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnulacionesSkeletons />
                  </TableBody>
                </Table>
              </div>
            ) : historico.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No hay anulaciones en el histórico
                </AlertDescription>
              </Alert>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código Gen</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Sello</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((anulacion) => {
                      const config = estadoConfig[anulacion.estado];
                      const Icon = config.icon;

                      return (
                        <TableRow key={anulacion.id}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {anulacion.codigoGeneracion}
                          </TableCell>
                          <TableCell>
                            {MOTIVOS_MAP[anulacion.motivo] || anulacion.motivo}
                          </TableCell>
                          <TableCell>
                            <Badge variant={config.variant} className="gap-1">
                              <Icon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {anulacion.selloAnulacion
                              ? anulacion.selloAnulacion.substring(0, 8) + "..."
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {formatDate(anulacion.fechaAnulo)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
