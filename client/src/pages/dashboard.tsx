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
  ChevronDown,
  AlertTriangle,
  Zap,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Factura } from "@shared/schema";

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  index = 0,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  index?: number;
}) {
  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground" data-testid={`stat-${title.toLowerCase().replace(/\s/g, "-")}`}>
          {value}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
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

function StatPill({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/90 px-5 py-4 shadow-[0_18px_46px_rgba(42,32,20,0.14)] backdrop-blur-sm">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold text-[#3d2f28] mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
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

function AlertBanner({ pendientes }: { pendientes: number }) {
  if (pendientes === 0) return null;

  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/60 shadow-sm">
      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-amber-900">
          {pendientes} factura{pendientes > 1 ? "s" : ""} pendiente{pendientes > 1 ? "s" : ""} por transmitir
        </p>
        <p className="text-xs text-amber-800">Sincroniza con DGII para completar el proceso</p>
      </div>
      <Button variant="outline" size="sm" className="flex-shrink-0 border-amber-300 hover:bg-amber-100/50">
        Sincronizar
      </Button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-16 mb-2 animate-pulse-subtle" />
        <Skeleton className="h-4 w-32 animate-pulse-subtle" />
      </CardContent>
    </Card>
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
  const outstanding =
    facturas?.filter((f) => f.estado === "generada").reduce((sum, f) => sum + f.resumen.totalPagar, 0) || 0;
  const recentFacturas = facturas?.slice(0, 5) || [];
  const isEmpty = recentFacturas.length === 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
        </div>
        <Skeleton className="h-12 w-56 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const heroStats = [
    { title: "Ventas Totales", value: formatCurrency(totalVentas), description: "Este mes" },
    { title: "Pendiente por transmitir", value: formatCurrency(outstanding), description: "Por enviar al MH" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" data-testid="text-page-title">
            Panel de Control
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

      <AlertBanner pendientes={stats.pendientes} />

      <Accordion type="single" collapsible className="w-fit">
        <AccordionItem value="info-dte" className="border-none">
          <AccordionTrigger className="rounded-2xl border border-white/70 bg-white/90 px-4 py-2.5 shadow-lg backdrop-blur-sm hover:bg-white hover:no-underline [&[data-state=open]]:rounded-b-none [&[data-state=open]]:shadow-[0_20px_50px_rgba(42,32,20,0.08)]">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Información DTE</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="rounded-b-2xl border border-t-0 border-white/70 bg-white/90 px-5 pb-4 pt-2 shadow-[0_20px_50px_rgba(42,32,20,0.08)] backdrop-blur-sm">
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-green-400 bg-white hover:bg-gray-50/50 transition-colors">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-foreground">Formato JSON</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Las facturas se generan en formato JSON conforme a los
                    esquemas de la DGII de El Salvador
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-yellow-400 bg-white hover:bg-gray-50/50 transition-colors">
                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-foreground">Ambiente de Pruebas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Actualmente trabajando en ambiente de pruebas (00). Para
                    producción se requiere certificación de la DGII.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-blue-400 bg-white hover:bg-gray-50/50 transition-colors">
                <FileText className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-foreground">Tipos de DTE</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Soporta Factura Electrónica, Comprobante de Crédito Fiscal,
                    Notas de Crédito/Débito y más.
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {!isEmpty && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-2 animate-fade-in-up" style={{ animationDelay: '0s' }}>
            <StatCard
              title="Total Facturas"
              value={stats.total}
              description="Facturas emitidas"
              icon={FileText}
              index={0}
            />
          </div>
          <StatCard
            title="Ventas Totales"
            value={formatCurrency(totalVentas)}
            description="Monto total facturado"
            icon={TrendingUp}
            index={1}
          />
          <StatCard
            title="Pendientes"
            value={stats.pendientes}
            description="Por transmitir a DGII"
            icon={Clock}
            index={2}
          />
          <StatCard
            title="Hoy"
            value={stats.hoy}
            description="Facturas generadas hoy"
            icon={CheckCircle2}
            index={3}
          />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Resumen Rápido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-white/40">
                  <span className="text-sm text-muted-foreground">Tasa de Transmisión</span>
                  <span className="font-semibold">100%</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/40">
                  <span className="text-sm text-muted-foreground">Últimas 30 días</span>
                  <span className="font-semibold">{stats.total} facturas</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Promedio por día</span>
                  <span className="font-semibold">{Math.round(stats.total / 30)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-500" />
                  Última Transmisión
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse-subtle" />
                    <span className="text-sm font-medium">OK</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Hace</span>
                  <span className="text-sm font-medium">2 horas</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/40">
                  <span className="text-sm text-muted-foreground">Sincronizadas</span>
                  <span className="text-sm font-semibold">{stats.selladas}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {isEmpty ? (
        <>
          <div className="relative flex items-center gap-6 justify-center">
            <div className="hidden lg:block">
              <StatPill {...heroStats[0]} />
            </div>
            
            <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-b from-white/95 to-amber-50/80 p-8 shadow-[0_32px_80px_rgba(42,32,20,0.16)] flex-shrink-0">
              <div className="flex flex-col items-center justify-center gap-6 text-center">
                <div className="relative h-36 w-52">
                  <div className="absolute inset-0 rounded-[26px] bg-gradient-to-br from-amber-100/60 via-white to-amber-50/60 shadow-[0_20px_50px_rgba(42,32,20,0.12)]" />
                  <div className="absolute left-3 right-3 top-3 h-full rounded-[26px] bg-white shadow-[0_12px_34px_rgba(42,32,20,0.10)]" />
                  <div className="absolute left-5 right-5 top-5 h-[78%] rounded-2xl bg-gradient-to-b from-white to-amber-50/70 border border-white/75 shadow-[0_14px_28px_rgba(42,32,20,0.10)]" />
                  <div className="absolute left-7 top-9 h-3 w-12 rounded-full bg-amber-300/85" />
                  <div className="absolute left-7 top-12 h-3 w-16 rounded-full bg-amber-200/75" />
                  <div className="absolute left-7 top-16 h-3 w-24 rounded-full bg-amber-100/85" />
                  <div className="absolute right-8 bottom-10 h-9 w-16 rounded-xl bg-gradient-to-br from-cyan-400/75 to-blue-500/80 shadow-[0_10px_20px_rgba(12,90,255,0.24)]" />
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-foreground">Aquí irá tu primera factura</p>
                  <p className="text-sm text-muted-foreground">Crea una factura y verás la lista cobrar vida.</p>
                </div>
                <Link href="/factura/nueva">
                  <Button className="px-6" data-testid="button-create-first">
                    Crear primera factura
                  </Button>
                </Link>
              </div>
            </div>

            <div className="hidden lg:block">
              <StatPill {...heroStats[1]} />
            </div>
          </div>

          <div className="grid w-full gap-4 grid-cols-1 sm:grid-cols-2 lg:hidden">
            <StatPill {...heroStats[0]} />
            <StatPill {...heroStats[1]} />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Facturas Recientes</CardTitle>
              <Link href="/historial">
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:bg-white/80 hover:shadow-sm"
                  data-testid="link-view-all"
                >
                  Ver todo
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {recentFacturas.map((factura) => (
                  <RecentInvoiceRow key={factura.id} factura={factura} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
