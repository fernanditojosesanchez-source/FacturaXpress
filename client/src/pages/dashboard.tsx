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
  DollarSign,
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

// Colores premium para cada tarjeta
const cardColorConfigs = [
  { // Azul vibrante
    name: "Facturas",
    bg: "from-blue-500/10 to-blue-600/5",
    border: "border-blue-400/20",
    shadow: "shadow-[0_20px_40px_-12px_rgba(59,130,246,0.35)]",
    icon: "text-blue-500",
    glow: "group-hover:shadow-[0_25px_50px_-12px_rgba(59,130,246,0.45)]",
  },
  { // Esmeralda
    name: "Ventas",
    bg: "from-emerald-500/10 to-emerald-600/5",
    border: "border-emerald-400/20",
    shadow: "shadow-[0_20px_40px_-12px_rgba(16,185,129,0.35)]",
    icon: "text-emerald-500",
    glow: "group-hover:shadow-[0_25px_50px_-12px_rgba(16,185,129,0.45)]",
  },
  { // Púrpura
    name: "Pendientes",
    bg: "from-purple-500/10 to-purple-600/5",
    border: "border-purple-400/20",
    shadow: "shadow-[0_20px_40px_-12px_rgba(168,85,247,0.35)]",
    icon: "text-purple-500",
    glow: "group-hover:shadow-[0_25px_50px_-12px_rgba(168,85,247,0.45)]",
  },
  { // Ámbar
    name: "Total",
    bg: "from-amber-500/10 to-amber-600/5",
    border: "border-amber-400/20",
    shadow: "shadow-[0_20px_40px_-12px_rgba(217,119,6,0.35)]",
    icon: "text-amber-500",
    glow: "group-hover:shadow-[0_25px_50px_-12px_rgba(217,119,6,0.45)]",
  },
];

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
  const colorConfig = cardColorConfigs[index % cardColorConfigs.length];

  return (
    <div
      className={`group relative animate-fade-in-up backdrop-blur-xl rounded-3xl border ${colorConfig.border} ${colorConfig.shadow} ${colorConfig.glow} transition-all duration-500 overflow-hidden`}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Fondo gradiente con glassmorphism */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colorConfig.bg} pointer-events-none`} />
      
      {/* Inner glow sofisticado */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-40 pointer-events-none" />
      
      {/* Contenido */}
      <div className="relative p-6 space-y-4">
        {/* Header con icono en contenedor de vidrio */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground/80 tracking-wide uppercase">
            {title}
          </h3>
          <div className={`p-3 rounded-2xl backdrop-blur-md bg-white/10 border border-white/20`}>
            <Icon className={`h-5 w-5 ${colorConfig.icon}`} />
          </div>
        </div>

        {/* Valor principal */}
        <div>
          <div 
            className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground" 
            data-testid={`stat-${title.toLowerCase().replace(/\s/g, "-")}`}
          >
            {value}
          </div>
          <p className="text-xs sm:text-sm text-foreground/60 mt-3 leading-relaxed">
            {description}
            {trend && (
              <span className={`ml-2 font-semibold ${trend.positive ? "text-emerald-500" : "text-red-500"}`}>
                {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="h-48 rounded-3xl bg-white/40 backdrop-blur-xl border border-white/20 animate-pulse" />
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
      className="flex items-center justify-between gap-4 py-4 px-6 hover:bg-white/30 transition-all duration-300 group"
      data-testid={`invoice-row-${factura.id}`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm truncate">{factura.receptor.nombre}</p>
        <p className="text-xs text-foreground/60 mt-1">
          {factura.numeroControl}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="font-bold text-foreground">{formatCurrency(factura.resumen.totalPagar)}</p>
          <p className="text-xs text-foreground/60 mt-0.5">
            {formatDate(factura.fecEmi)}
          </p>
        </div>
        <Badge variant={status.variant} size="sm" className="flex-shrink-0">
          {status.label}
        </Badge>
      </div>
    </div>
  );
}

function AlertBanner({ pendientes }: { pendientes: number }) {
  if (pendientes === 0) return null;

  return (
    <div className="flex items-center gap-4 p-6 rounded-2xl backdrop-blur-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-orange-500/5 shadow-[0_20px_40px_-12px_rgba(217,119,6,0.2)]">
      <div className="p-3 rounded-2xl backdrop-blur-md bg-amber-500/20 border border-amber-400/30 flex-shrink-0">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-amber-900">
          {pendientes} factura{pendientes > 1 ? "s" : ""} pendiente{pendientes > 1 ? "s" : ""} por transmitir
        </p>
        <p className="text-xs text-amber-800/80 mt-1">Sincroniza con DGII para completar el proceso</p>
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        className="flex-shrink-0 border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 transition-all duration-300"
      >
        Sincronizar
      </Button>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/stats/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50/50 via-white to-blue-50/30 p-6 sm:p-8 space-y-6">
        {/* Header skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-48 rounded-2xl" />
          <Skeleton className="h-5 w-64 rounded-lg" />
        </div>
        {/* Stats grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 rounded-3xl bg-white/40 backdrop-blur-xl border border-white/20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const recentFacturas = stats?.recentInvoices || [];
  const isEmpty = recentFacturas.length === 0;

  const heroStats = [
    { title: "Ventas Totales", value: formatCurrency(stats?.totalVentas || 0), description: "Histórico" },
    { title: "Ventas del Mes", value: formatCurrency(stats?.ventasEsteMes || 0), description: "Mes actual" },
    { title: "Pendiente por transmitir", value: formatCurrency(stats?.outstanding || 0), description: "Por enviar al MH" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/40 via-white to-blue-50/30">
      {/* Formas fluidas de fondo */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-purple-300/8 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-emerald-300/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 right-1/4 w-96 h-96 bg-amber-300/8 rounded-full blur-3xl" />
      </div>

      <div className="relative p-6 sm:p-8 lg:p-12 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 animate-fade-in-up">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
              Panel de Control
            </h1>
            <p className="text-base text-foreground/60 mt-2">
              Resumen ejecutivo de tu facturación electrónica
            </p>
          </div>
          <Link href="/factura/nueva">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300"
              data-testid="button-new-invoice"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nueva Factura
            </Button>
          </Link>
        </div>

        {/* Alert Banner */}
        {(stats?.pendientes || 0) > 0 && <AlertBanner pendientes={stats?.pendientes || 0} />}

        {/* Info Accordion */}
        <Accordion type="single" collapsible className="w-fit">
          <AccordionItem value="info-dte" className="border-none">
            <AccordionTrigger className="backdrop-blur-xl rounded-2xl border border-white/20 bg-white/40 px-4 py-3 shadow-lg hover:bg-white/50 hover:no-underline transition-all duration-300 [&[data-state=open]]:rounded-b-none">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl backdrop-blur-md bg-blue-500/20 border border-blue-400/30">
                  <FileText className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-sm font-semibold text-foreground">Información DTE</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="rounded-b-2xl border border-t-0 border-white/20 bg-white/40 backdrop-blur-xl px-5 pb-4 pt-2 shadow-lg">
              <div className="space-y-3 pt-2">
                {[
                  {
                    icon: CheckCircle2,
                    color: "green",
                    title: "Formato JSON",
                    desc: "Las facturas se generan en formato JSON conforme a los esquemas de la DGII de El Salvador",
                  },
                  {
                    icon: AlertCircle,
                    color: "yellow",
                    title: "Ambiente de Pruebas",
                    desc: "Actualmente trabajando en ambiente de pruebas (00). Para producción se requiere certificación de la DGII.",
                  },
                  {
                    icon: FileText,
                    color: "blue",
                    title: "Tipos de DTE",
                    desc: "Soporta Factura Electrónica, Comprobante de Crédito Fiscal, Notas de Crédito/Débito y más.",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 rounded-2xl backdrop-blur-md bg-white/30 border border-white/30 hover:bg-white/50 transition-all duration-300">
                    <item.icon className={`h-5 w-5 text-${item.color}-500 flex-shrink-0 mt-0.5`} />
                    <div>
                      <p className="font-semibold text-sm text-foreground">{item.title}</p>
                      <p className="text-xs text-foreground/60 mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {!isEmpty && (
          <>
            {/* Stats Cards - Flotantes con glassmorphism */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
              <StatCard
                title="Total Facturas"
                value={stats?.totalInvoices || 0}
                description="Facturas emitidas"
                icon={FileText}
                index={0}
              />
              <StatCard
                title="Ventas Este Mes"
                value={formatCurrency(stats?.ventasEsteMes || 0)}
                description="Monto facturado en el mes actual"
                icon={TrendingUp}
                index={1}
              />
              <StatCard
                title="Pendientes"
                value={stats?.pendientes || 0}
                description="Por transmitir a DGII"
                icon={Clock}
                index={2}
              />
              <StatCard
                title="Ventas Totales"
                value={formatCurrency(stats?.totalVentas || 0)}
                description="Histórico acumulado"
                icon={DollarSign}
                index={3}
              />
            </div>

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              {/* Resumen Rápido */}
              <div className="lg:col-span-2 backdrop-blur-xl rounded-3xl border border-white/20 bg-gradient-to-br from-white/50 to-white/30 shadow-[0_20px_40px_-12px_rgba(59,130,246,0.1)] p-6 space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-2xl backdrop-blur-md bg-blue-500/20 border border-blue-400/30">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-foreground">Resumen Rápido</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Transmisión", value: "100%" },
                    { label: "Hoy", value: `${stats?.hoy || 0}` },
                    { label: "Selladas", value: stats?.selladas || 0 },
                  ].map((stat, idx) => (
                    <div key={idx} className="text-center p-3 rounded-2xl bg-white/40 border border-white/20">
                      <p className="text-xs text-foreground/60 mb-2">{stat.label}</p>
                      <p className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Última Transmisión */}
              <div className="backdrop-blur-xl rounded-3xl border border-white/20 bg-gradient-to-br from-emerald-500/5 to-emerald-600/5 shadow-[0_20px_40px_-12px_rgba(16,185,129,0.1)] p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-2xl backdrop-blur-md bg-emerald-500/20 border border-emerald-400/30">
                    <Zap className="h-5 w-5 text-emerald-500" />
                  </div>
                  <h3 className="font-semibold text-foreground">Última Transmisión</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/40 border border-white/20">
                    <span className="text-sm text-foreground/70">Estado</span>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-semibold text-emerald-600">En línea</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/40 border border-white/20">
                    <span className="text-sm text-foreground/70">Sincronizadas</span>
                    <span className="text-lg font-bold text-foreground">{stats?.selladas || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Invoices Table */}
            <div 
              className="backdrop-blur-2xl rounded-3xl border border-white/30 bg-gradient-to-br from-white/50 to-white/30 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] overflow-hidden animate-fade-in" 
              style={{ animationDelay: '0.3s' }}
            >
              <div className="flex items-center justify-between gap-4 p-6 border-b border-white/20">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl backdrop-blur-md bg-blue-500/20 border border-blue-400/30">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-foreground">Facturas Recientes</h3>
                </div>
                <Link href="/historial">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-white/50 transition-all duration-300"
                    data-testid="link-view-all"
                  >
                    Ver todo
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <div className="divide-y divide-white/10">
                {recentFacturas.map((factura) => (
                  <RecentInvoiceRow key={factura.id} factura={factura} />
                ))}
              </div>
            </div>
          </>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center gap-8 py-12">
            <div className="relative w-full max-w-md">
              {/* Tarjeta flotante central */}
              <div className="backdrop-blur-2xl rounded-3xl border border-white/30 bg-gradient-to-br from-white/60 to-white/40 shadow-[0_40px_80px_-20px_rgba(59,130,246,0.2)] p-12 text-center space-y-6">
                <div className="flex justify-center">
                  <div className="p-4 rounded-3xl backdrop-blur-md bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-white/40">
                    <FileText className="h-12 w-12 text-blue-500" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-bold text-foreground">Aquí irá tu primera factura</h2>
                  <p className="text-base text-foreground/70">Crea una factura y verás la lista cobrar vida.</p>
                </div>
                <Link href="/factura/nueva">
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg"
                    data-testid="button-create-first"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Crear primera factura
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
