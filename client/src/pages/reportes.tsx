import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  FileText,
  Calendar,
  Download,
  PieChart,
  Table as TableIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Factura } from "@shared/schema";
import { TIPOS_DTE } from "@shared/schema";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

interface IvaReporte {
  periodo: string;
  totalFacturas: number;
  ventasGravadas: number;
  ventasExentas: number;
  totalIva: number;
  totalVentas: number;
  detalle: Array<{
    fecha: string;
    numero: string;
    cliente: string;
    gravado: number;
    iva: number;
    total: number;
  }>;
}

export default function Reportes() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState((currentMonth + 1).toString().padStart(2, "0"));

  // Query general para gráficos (Client-side aggregation)
  const { data: facturas, isLoading: isLoadingFacturas } = useQuery<Factura[]>({
    queryKey: ["/api/facturas"],
  });

  // Query específica para el Libro de IVA (Server-side aggregation)
  const { data: reporteIva, isLoading: isLoadingIva } = useQuery<IvaReporte>({
    queryKey: ["/api/reportes/iva-mensual", selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/reportes/iva-mensual?mes=${selectedMonth}&anio=${selectedYear}`);
      if (!res.ok) throw new Error("Error al obtener reporte");
      return res.json();
    },
  });

  const stats = useMemo(() => {
    if (!facturas) return null;

    const validFacturas = facturas.filter((f) => f.estado !== "anulada");
    
    const monthlyData: Record<string, { ventas: number; iva: number; count: number }> = {};
    const serviceData: Record<string, { cantidad: number; monto: number }> = {};
    const tipoData: Record<string, number> = {};
    
    let totalVentas = 0;
    let totalIVA = 0;
    let monthVentas = 0;
    let monthIVA = 0;
    let monthCount = 0;

    validFacturas.forEach((factura) => {
      const fecha = new Date(factura.fecEmi);
      const year = fecha.getFullYear().toString();
      const month = (fecha.getMonth() + 1).toString().padStart(2, "0");
      const monthKey = `${year}-${month}`;
      
      totalVentas += factura.resumen.totalPagar;
      totalIVA += factura.resumen.totalIva;

      if (year === selectedYear && month === selectedMonth) {
        monthVentas += factura.resumen.totalPagar;
        monthIVA += factura.resumen.totalIva;
        monthCount++;
      }

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { ventas: 0, iva: 0, count: 0 };
      }
      monthlyData[monthKey].ventas += factura.resumen.totalPagar;
      monthlyData[monthKey].iva += factura.resumen.totalIva;
      monthlyData[monthKey].count += 1;

      factura.cuerpoDocumento.forEach((item) => {
        if (!serviceData[item.descripcion]) {
          serviceData[item.descripcion] = { cantidad: 0, monto: 0 };
        }
        serviceData[item.descripcion].cantidad += item.cantidad;
        serviceData[item.descripcion].monto += item.ventaGravada;
      });

      const tipoDte = factura.tipoDte;
      tipoData[tipoDte] = (tipoData[tipoDte] || 0) + 1;
    });

    const chartMonths = [];
    for (let i = 0; i < 12; i++) {
      const monthKey = `${selectedYear}-${(i + 1).toString().padStart(2, "0")}`;
      chartMonths.push({
        name: MONTHS[i].substring(0, 3),
        ventas: monthlyData[monthKey]?.ventas || 0,
        iva: monthlyData[monthKey]?.iva || 0,
        cantidad: monthlyData[monthKey]?.count || 0,
      });
    }

    const topServices = Object.entries(serviceData)
      .sort((a, b) => b[1].monto - a[1].monto)
      .slice(0, 5)
      .map(([name, data]) => ({
        name: name.length > 20 ? name.substring(0, 20) + "..." : name,
        fullName: name,
        cantidad: data.cantidad,
        monto: data.monto,
      }));

    const tipoChartData = Object.entries(tipoData).map(([codigo, count]) => ({
      name: TIPOS_DTE.find((t) => t.codigo === codigo)?.nombre || codigo,
      value: count,
    }));

    return {
      totalVentas,
      totalIVA,
      totalFacturas: validFacturas.length,
      monthVentas,
      monthIVA,
      monthCount,
      chartMonths,
      topServices,
      tipoChartData,
    };
  }, [facturas, selectedYear, selectedMonth]);

  const downloadReport = () => {
    if (!reporteIva) return;

    const blob = new Blob([JSON.stringify(reporteIva, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `libro-iva-${selectedYear}-${selectedMonth}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoadingFacturas) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 animate-fade-in-up [animation-delay:0s]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
            Reportes y Estadísticas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Análisis de ventas, IVA y servicios facturados
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] table-input-focus" data-testid="select-month">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, i) => (
                <SelectItem key={i} value={(i + 1).toString().padStart(2, "0")}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px] table-input-focus" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0s' }}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ventas del Mes
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#3d2f28]" data-testid="text-month-sales">
              {formatCurrency(stats?.monthVentas || 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {MONTHS[parseInt(selectedMonth) - 1]} {selectedYear}
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              IVA del Mes
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#3d2f28]" data-testid="text-month-iva">
              {formatCurrency(stats?.monthIVA || 0)}
            </p>
            <p className="text-xs text-muted-foreground">13% sobre ventas gravadas</p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Facturas del Mes
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#3d2f28]" data-testid="text-month-count">
              {stats?.monthCount || 0}
            </p>
            <p className="text-xs text-muted-foreground">Documentos emitidos</p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Acumulado
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#3d2f28]" data-testid="text-total-sales">
              {formatCurrency(stats?.totalVentas || 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats?.totalFacturas || 0} facturas totales
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Ventas Mensuales {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.chartMonths || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="iva" name="IVA" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cantidad de Facturas {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.chartMonths || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cantidad"
                    name="Facturas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Servicios Más Facturados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.topServices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay datos disponibles
              </p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.topServices || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${v}`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => stats?.topServices.find((s) => s.name === label)?.fullName || label}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="monto" name="Monto" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Distribución por Tipo de Documento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.tipoChartData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay datos disponibles
              </p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={stats?.tipoChartData || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {stats?.tipoChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* NUEVA SECCIÓN: LIBRO DE IVA */}
      <Card className="backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TableIcon className="h-5 w-5" />
              Libro de Ventas a Contribuyentes (Detalle IVA)
            </CardTitle>
            <CardDescription>
              Reporte oficial para declaración de impuestos. Periodo: {MONTHS[parseInt(selectedMonth) - 1]} {selectedYear}
            </CardDescription>
          </div>
          <Button onClick={downloadReport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Descargar JSON
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingIva ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : reporteIva?.detalle.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay facturas selladas en este periodo.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Número Control</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Gravado</TableHead>
                    <TableHead className="text-right">IVA (13%)</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reporteIva?.detalle.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDate(new Date(row.fecha))}</TableCell>
                      <TableCell className="font-mono text-xs">{row.numero}</TableCell>
                      <TableCell>{row.cliente}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.gravado)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.iva)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(row.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3}>TOTALES DEL PERIODO</TableCell>
                    <TableCell className="text-right">{formatCurrency(reporteIva?.ventasGravadas || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(reporteIva?.totalIva || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(reporteIva?.totalVentas || 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}