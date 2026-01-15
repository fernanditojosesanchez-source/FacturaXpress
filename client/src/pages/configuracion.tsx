import { Settings, Info, FileJson, Shield, HelpCircle, Wifi, WifiOff, AlertCircle, Database, Trash2, Plus, Upload, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Emisor } from "@shared/schema";
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

interface MHStatus {
  conectado: boolean;
  modoSimulacion: boolean;
  mensaje: string;
}

export default function Configuracion() {
  const { toast } = useToast();
  const [cantidad, setCantidad] = useState(10);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: mhStatus, isLoading: loadingMH, refetch: refetchMH } = useQuery<MHStatus>({
    queryKey: ["/api/mh/status"],
    refetchInterval: 30000,
  });

  const { data: facturasResponse } = useQuery<any>({
    queryKey: ["/api/facturas"],
  });

  const facturas: any[] = Array.isArray(facturasResponse?.data)
    ? facturasResponse.data
    : [];

  const { data: emisor } = useQuery<Emisor>({
    queryKey: ["/api/emisor"],
  });

  // Mutation para generar datos de prueba
  const generarDatosMutation = useMutation({
    mutationFn: async (cantidad: number) => {
      // Primero guardar emisor de prueba
      await apiRequest("POST", "/api/seed/emisor");
      // Luego generar facturas
      return await apiRequest<{ success: boolean; cantidad: number; mensaje: string }>(
        "POST", 
        "/api/seed/facturas", 
        { cantidad }
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/facturas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/emisor"] });
      toast({
        title: "✅ Datos generados",
        description: data.mensaje,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron generar los datos",
        variant: "destructive",
      });
    },
  });

  // Mutation para limpiar datos
  const limpiarDatosMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ success: boolean; cantidad: number; mensaje: string }>(
        "DELETE", 
        "/api/seed/facturas"
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/facturas"] });
      toast({
        title: "🗑️ Datos eliminados",
        description: data.mensaje,
      });
      setShowClearDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron eliminar los datos",
        variant: "destructive",
      });
    },
  });

  // Mutation para subir logo
  const uploadLogoMutation = useMutation({
    mutationFn: async (logoBase64: string) => {
      if (!emisor) throw new Error("No hay emisor configurado");
      
      const updatedEmisor = {
        ...emisor,
        logo: logoBase64,
      };
      
      return await apiRequest("POST", "/api/emisor", updatedEmisor);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emisor"] });
      toast({
        title: "Logo actualizado",
        description: "El logo se ha guardado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo subir el logo",
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Archivo inválido",
        description: "Solo se permiten imágenes (PNG, JPG, SVG)",
        variant: "destructive",
      });
      return;
    }

    // Validar tamaño (máx 1MB)
    if (file.size > 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: "El logo debe pesar menos de 1MB",
        variant: "destructive",
      });
      return;
    }

    // Convertir a base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      uploadLogoMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    if (!emisor) return;
    
    const updatedEmisor = {
      ...emisor,
      logo: undefined,
    };
    
    apiRequest("POST", "/api/emisor", updatedEmisor).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/emisor"] });
      toast({
        title: "Logo eliminado",
        description: "El logo se ha eliminado correctamente",
      });
    });
  };

  return (
    <div className="flex-1 p-8 pt-6 space-y-6">
      <div className="animate-fade-in-up [animation-delay:0s] mb-8">
        <h1 className="text-5xl font-black bg-gradient-to-r from-blue-200 via-purple-200 to-emerald-200 bg-clip-text text-transparent drop-shadow-lg" data-testid="text-page-title">
          Configuración
        </h1>
        <p className="text-white/70 text-sm mt-2">
          Información del sistema y configuraciones
        </p>
      </div>

      <Card className="backdrop-blur-3xl rounded-3xl border border-white/20 shadow-[0_35px_60px_-15px_rgba(59,130,246,0.3)] hover:shadow-[0_50px_80px_-20px_rgba(59,130,246,0.4)] transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '0s' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 pointer-events-none rounded-3xl" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 to-transparent opacity-40 pointer-events-none rounded-3xl" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-40 pointer-events-none rounded-3xl" />
          <CardHeader className="relative border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {loadingMH ? (
                  <Skeleton className="h-5 w-5 rounded-full bg-white/20" />
                ) : mhStatus?.conectado ? (
                  <Wifi className="h-6 w-6 text-emerald-400" />
                ) : (
                  <WifiOff className="h-6 w-6 text-red-400" />
                )}
                <div>
                  <CardTitle className="text-lg text-white font-bold">Ministerio de Hacienda</CardTitle>
                  <CardDescription className="text-white/70">Estado de conexión e integración</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchMH()}
                disabled={loadingMH}
                className="hover:bg-white/10 hover:text-white text-white/70 border-white/20 transition-all duration-200"
              >
                Verificar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="relative space-y-4 pt-6">
            {loadingMH ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full bg-white/20" />
                <Skeleton className="h-4 w-3/4 bg-white/20" />
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <Badge variant={mhStatus?.conectado ? "default" : "secondary"}>
                    {mhStatus?.conectado ? "Conectado" : "Desconectado"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Modo</span>
                  <Badge variant={mhStatus?.modoSimulacion ? "outline" : "default"}>
                    {mhStatus?.modoSimulacion ? "Simulación" : "Producción"}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-start gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-muted-foreground">{mhStatus?.mensaje}</p>
                </div>
              
                {mhStatus?.modoSimulacion && (
                  <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Modo Simulación:</strong> Las transmisiones no se envían al MH real. 
                      Este modo permite desarrollar y probar sin certificado digital.
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ImageIcon className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Logo del Emisor</CardTitle>
                <CardDescription>Personaliza tu identidad corporativa</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {emisor?.logo ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center p-4 rounded-lg border-2 border-dashed border-border bg-muted/50">
                  <img 
                    src={emisor.logo} 
                    alt="Logo del emisor" 
                    className="max-h-24 max-w-full object-contain"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1"
                    disabled={uploadLogoMutation.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Cambiar Logo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={removeLogo}
                    className="hover:bg-red-50 hover:border-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div 
                  className="flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Subir logo</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG o SVG (máx 1MB)</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                  disabled={uploadLogoMutation.isPending}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Seleccionar Archivo
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              El logo aparecerá en el navbar y en los PDFs generados.
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Información del Sistema</CardTitle>
                <CardDescription>Detalles técnicos de la aplicación</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Versión</span>
              <Badge variant="outline">1.0.0</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Ambiente</span>
              <Badge variant="secondary">Pruebas (00)</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Formato DTE</span>
              <Badge variant="outline">JSON v1</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">IVA</span>
              <span className="text-sm font-medium">13%</span>
            </div>
          </CardContent>
        </Card>

  <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileJson className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Tipos de DTE Soportados</CardTitle>
                <CardDescription>Documentos tributarios electrónicos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">01 - Factura</Badge>
              <Badge variant="outline">03 - Crédito Fiscal</Badge>
              <Badge variant="outline">05 - Nota de Crédito</Badge>
              <Badge variant="outline">06 - Nota de Débito</Badge>
              <Badge variant="outline">07 - Nota de Remisión</Badge>
              <Badge variant="outline">11 - Exportación</Badge>
              <Badge variant="outline">14 - Sujeto Excluido</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Normativas</CardTitle>
                <CardDescription>Cumplimiento regulatorio</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">DGII El Salvador</p>
              <p className="text-xs text-muted-foreground">
                Sistema conforme a los requisitos técnicos de la Dirección General de
                Impuestos Internos para la emisión de Documentos Tributarios Electrónicos.
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Decreto 960/2024</p>
              <p className="text-xs text-muted-foreground">
                Cumplimiento de requisitos para facturación electrónica incluyendo
                información de receptor según montos de transacción.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Nueva sección: Datos de Prueba */}
        <Card className="md:col-span-2 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Datos de Prueba</CardTitle>
                  <CardDescription>
                    Genera facturas de prueba para desarrollar y probar el sistema
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline">
                 <span className="text-[#3d2f28] font-semibold">{facturasResponse?.pagination?.total ?? (Array.isArray(facturas) ? facturas.length : 0)}</span> facturas
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                <strong>Generador Automático:</strong> Crea facturas de prueba con datos realistas 
                incluyendo diferentes receptores, productos, servicios y estados variados.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="cantidad" className="text-xs text-blue-800 dark:text-blue-200">
                    Cantidad de facturas
                  </Label>
                  <Input
                    id="cantidad"
                    type="number"
                    min={1}
                    max={100}
                    value={cantidad}
                    onChange={(e) => setCantidad(parseInt(e.target.value) || 10)}
                    className="mt-1 table-input-focus"
                  />
                </div>
                <Button
                  onClick={() => generarDatosMutation.mutate(cantidad)}
                  disabled={generarDatosMutation.isPending}
                                    className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-white hover:shadow-lg transition-all duration-200"
                  size="default"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {generarDatosMutation.isPending ? "Generando..." : "Generar Datos"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowClearDialog(true)}
                  disabled={limpiarDatosMutation.isPending || (facturasResponse?.pagination?.total === 0)}
                                    className="hover:bg-red-600 transition-all duration-200"
                  size="default"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpiar Todo
                </Button>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Emisor de prueba</p>
                 <p className="font-medium text-[#3d2f28]">COMERCIAL LA ESPERANZA</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Receptores</p>
                 <p className="font-medium text-[#3d2f28]">5 clientes variados</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Productos/Servicios</p>
                 <p className="font-medium text-[#3d2f28]">15 ítems diferentes</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Estados</p>
                 <p className="font-medium text-[#3d2f28]">Todos los estados</p>
              </div>
            </div>
          </CardContent>
        </Card>

  <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Recursos</CardTitle>
                <CardDescription>Enlaces útiles</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="https://factura.gob.sv"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-md bg-indigo-50/30 hover:bg-indigo-100/40 transition-all duration-200 border border-indigo-200/50 hover:border-indigo-300/70"
            >
              <p className="text-sm font-medium">Portal DGII</p>
              <p className="text-xs text-muted-foreground">factura.gob.sv</p>
            </a>
            <a
              href="https://factura.gob.sv/consultaobligatoriedad"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-md bg-indigo-50/30 hover:bg-indigo-100/40 transition-all duration-200 border border-indigo-200/50 hover:border-indigo-300/70"
            >
              <p className="text-sm font-medium">Consulta de Obligatoriedad</p>
              <p className="text-xs text-muted-foreground">
                Verifica tu fecha de obligación
              </p>
            </a>
            <div className="p-3 rounded-md bg-muted">
              <p className="text-sm font-medium">Soporte WhatsApp</p>
              <p className="text-xs text-muted-foreground">7073-8444</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
        <CardHeader>
          <CardTitle className="text-lg">Notas Importantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-yellow-800 dark:text-yellow-200">
                Ambiente de Pruebas
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                Este sistema actualmente opera en ambiente de pruebas (00). Para producción
                se requiere certificación oficial de la DGII y configuración del certificado
                de firma electrónica.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-blue-800 dark:text-blue-200">
                Almacenamiento de DTEs
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Según la normativa vigente, los DTEs deben conservarse por un período
                mínimo de 15 años. Asegúrese de mantener respaldos seguros de todos
                los documentos generados.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <Info className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-green-800 dark:text-green-200">
                Transmisión a DGII
              </p>
              <p className="text-xs text-green-700 dark:text-green-300">
                Una vez configurado el certificado digital, las facturas podrán ser
                transmitidas automáticamente al Ministerio de Hacienda para obtener
                el sello de recepción oficial.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de confirmación para limpiar datos */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente todas las facturas ({facturasResponse?.pagination?.total ?? (Array.isArray(facturas) ? facturas.length : 0)} en total). 
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => limpiarDatosMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar Todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
