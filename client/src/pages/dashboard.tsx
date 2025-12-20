import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Factura } from "@shared/schema";

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`stat-${title.toLowerCase().replace(/\s/g, "-")}`}>
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {description}
          {trend && (
            <span
              className={`ml-1 ${trend.positive ? "text-green-600" : "text-red-600"}`}
            >
              {trend.positive ? "+" : ""}{trend.value}%
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function RecentInvoiceRow({ factura }: { factura: Factura }) {
  const statusConfig = {
    borrador: { label: "Borrador", variant: "secondary" as const },
    generada: { label: "Generada", variant: "outline" as const },
    transmitida: { label: "Transmitida", variant: "default" as const },
    sellada: { label: "Sellada", variant: "default" as const },
    anulada: { label: "Anulada", variant: "destructive" as const },
  };

  const status = statusConfig[factura.estado];

  return (
    <div
      className="flex items-center justify-between gap-4 py-3 border-b last:border-0"
      data-testid={`invoice-row-${factura.id}`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{factura.receptor.nombre}</p>
        <p className="text-sm text-muted-foreground">
          {factura.numeroControl}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="font-medium">{formatCurrency(factura.resumen.totalPagar)}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(factura.fecEmi)}
          </p>
        </div>
        <Badge variant={status.variant} size="sm">
          {status.label}
        </Badge>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: facturas, isLoading } = useQuery<Factura[]>({
    queryKey: ["/api/facturas"],
  });

  const stats = {
    total: facturas?.length || 0,
    hoy: facturas?.filter((f) => {
      const today = new Date().toISOString().split("T")[0];
      return f.fecEmi === today;
    }).length || 0,
    pendientes: facturas?.filter((f) => f.estado === "generada").length || 0,
    selladas: facturas?.filter((f) => f.estado === "sellada").length || 0,
  };

  const totalVentas = facturas?.reduce((sum, f) => sum + f.resumen.totalPagar, 0) || 0;
  const recentFacturas = facturas?.slice(0, 5) || [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Resumen de facturación electrónica
          </p>
        </div>
        <Link href="/factura/nueva">
          <Button data-testid="button-new-invoice">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Factura
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Facturas"
          value={stats.total}
          description="Facturas emitidas"
          icon={FileText}
        />
        <StatCard
          title="Ventas Totales"
          value={formatCurrency(totalVentas)}
          description="Monto total facturado"
          icon={TrendingUp}
        />
        <StatCard
          title="Pendientes"
          value={stats.pendientes}
          description="Por transmitir a DGII"
          icon={Clock}
        />
        <StatCard
          title="Hoy"
          value={stats.hoy}
          description="Facturas generadas hoy"
          icon={CheckCircle2}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Facturas Recientes</CardTitle>
            <Link href="/historial">
              <Button variant="ghost" size="sm" data-testid="link-view-all">
                Ver todo
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentFacturas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  No hay facturas generadas
                </p>
                <Link href="/factura/nueva">
                  <Button variant="outline" className="mt-4" data-testid="button-create-first">
                    Crear primera factura
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {recentFacturas.map((factura) => (
                  <RecentInvoiceRow key={factura.id} factura={factura} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información DTE</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Formato JSON</p>
                <p className="text-xs text-muted-foreground">
                  Las facturas se generan en formato JSON conforme a los
                  esquemas de la DGII de El Salvador
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-md bg-muted">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Ambiente de Pruebas</p>
                <p className="text-xs text-muted-foreground">
                  Actualmente trabajando en ambiente de pruebas (00). Para
                  producción se requiere certificación de la DGII.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-md bg-muted">
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Tipos de DTE</p>
                <p className="text-xs text-muted-foreground">
                  Soporta Factura Electrónica, Comprobante de Crédito Fiscal,
                  Notas de Crédito/Débito y más.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
