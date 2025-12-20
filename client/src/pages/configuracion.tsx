import { Settings, Info, FileJson, Shield, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Configuracion() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Configuración
        </h1>
        <p className="text-muted-foreground">
          Información del sistema y configuraciones
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
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

        <Card>
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

        <Card>
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

        <Card>
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
              className="block p-3 rounded-md bg-muted hover-elevate transition-colors"
            >
              <p className="text-sm font-medium">Portal DGII</p>
              <p className="text-xs text-muted-foreground">factura.gob.sv</p>
            </a>
            <a
              href="https://factura.gob.sv/consultaobligatoriedad"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-md bg-muted hover-elevate transition-colors"
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

      <Card>
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
    </div>
  );
}
