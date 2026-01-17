import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Package, Clock, CheckCircle, AlertTriangle } from "lucide-react";

interface StockMovimiento {
  id: string;
  numeroMovimiento: string;
  estado: string;
  sucursalOrigen: string;
  sucursalDestino: string;
  codigoProducto: string;
  nombreProducto: string;
  cantidadEnviada: number;
  cantidadRecibida: number;
  fechaCreacion: string;
  transportista?: string;
}

interface StockStats {
  total: number;
  pendiente: number;
  enTransito: number;
  recibido: number;
  problemas: number;
  valorTotal: number;
}

const estadoColors: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  enviado: "bg-blue-100 text-blue-800",
  en_transporte: "bg-blue-100 text-blue-800",
  recibido: "bg-green-100 text-green-800",
  parcial: "bg-orange-100 text-orange-800",
  devuelto: "bg-red-100 text-red-800",
  cancelado: "bg-gray-100 text-gray-800",
};

export default function StockTransitoPage() {
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [page, setPage] = useState(1);

  // Obtener estadísticas
  const { data: statsData } = useQuery({
    queryKey: ["/api/stock-transito/stats"],
    queryFn: async () => {
      const res = await fetch("/api/stock-transito/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar estadísticas");
      return res.json() as Promise<StockStats>;
    },
  });

  // Obtener movimientos con filtros
  const { data: movimientosData, isLoading } = useQuery({
    queryKey: ["/api/stock-transito", { estado: filtroEstado, sucursal: filtroSucursal, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(filtroEstado && { estado: filtroEstado }),
        ...(filtroSucursal && { sucursal: filtroSucursal }),
        page: page.toString(),
        limit: "25",
      });
      const res = await fetch(`/api/stock-transito?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar movimientos");
      return res.json();
    },
  });

  // Obtener análisis
  const { data: analyticsData } = useQuery({
    queryKey: ["/api/stock-transito/analytics"],
    queryFn: async () => {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - 1);
      const params = new URLSearchParams({
        desde: desde.toISOString().split("T")[0],
        hasta: new Date().toISOString().split("T")[0],
      });
      const res = await fetch(`/api/stock-transito/analytics?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar análisis");
      return res.json();
    },
  });

  // Obtener problemas
  const { data: problemasData } = useQuery({
    queryKey: ["/api/stock-transito/problemas"],
    queryFn: async () => {
      const res = await fetch("/api/stock-transito/problemas?limite=30", { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar problemas");
      return res.json();
    },
  });

  const stats = statsData || { total: 0, pendiente: 0, enTransito: 0, recibido: 0, problemas: 0, valorTotal: 0 };
  const movimientos = movimientosData?.movimientos || [];
  const totalPages = movimientosData?.pages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock en Tránsito</h1>
          <p className="text-sm text-gray-500 mt-1">Seguimiento de movimientos de stock entre sucursales</p>
        </div>
        <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
          + Nuevo Movimiento
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-500 mt-1">Movimientos</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Pendiente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-800">{stats.pendiente}</div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <Package className="w-4 h-4" /> En Tránsito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">{stats.enTransito}</div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Recibido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">{stats.recibido}</div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Problemas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-800">{stats.problemas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="movimientos" className="w-full">
        <TabsList>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="analytics">Análisis</TabsTrigger>
          <TabsTrigger value="problemas" className="relative">
            Problemas
            {stats.problemas > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {stats.problemas}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Movimientos */}
        <TabsContent value="movimientos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-gray-600">Estado</label>
                <Input
                  placeholder="Filtrar por estado..."
                  value={filtroEstado}
                  onChange={(e) => {
                    setFiltroEstado(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-gray-600">Sucursal</label>
                <Input
                  placeholder="Filtrar por sucursal..."
                  value={filtroSucursal}
                  onChange={(e) => {
                    setFiltroSucursal(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setFiltroEstado("");
                  setFiltroSucursal("");
                  setPage(1);
                }}
                className="self-end"
              >
                Limpiar
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Cargando movimientos...</div>
              ) : movimientos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No hay movimientos</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Ruta</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Transportista</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimientos.map((mov: StockMovimiento) => (
                        <TableRow key={mov.id}>
                          <TableCell className="font-mono text-sm">{mov.numeroMovimiento}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {mov.sucursalOrigen} → {mov.sucursalDestino}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{mov.nombreProducto}</div>
                            <div className="text-xs text-gray-500">{mov.codigoProducto}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {mov.cantidadRecibida}/{mov.cantidadEnviada}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={estadoColors[mov.estado] || ""}>
                              {mov.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(mov.fechaCreacion).toLocaleDateString("es-DO")}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {mov.transportista || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Paginación */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex justify-center gap-2">
                      <Button
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Anterior
                      </Button>
                      <div className="flex items-center px-4 text-sm">
                        Página {page} de {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                      >
                        Siguiente
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Análisis */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Completados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.movimientosCompletados || 0}</div>
                <p className="text-xs text-gray-500 mt-1">Este mes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Tiempo Promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.tiempoPromedioEntrega || "0 días"}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Eficiencia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.eficienciaEntrega || 0}%</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Problemas */}
        <TabsContent value="problemas" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {!problemasData?.problemas || problemasData.problemas.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No hay problemas reportados</div>
              ) : (
                <div className="space-y-4">
                  {problemasData.problemas.map((prob: any) => (
                    <div
                      key={prob.movimientoId}
                      className="border rounded-lg p-4 bg-red-50 border-red-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-red-900">{prob.numeroMovimiento}</h4>
                          <p className="text-sm text-red-800 mt-1">{prob.descripcion}</p>
                        </div>
                        <Badge variant="destructive">{prob.tipo}</Badge>
                      </div>
                      <div className="text-xs text-red-700 flex justify-between items-center mt-3">
                        <span>{prob.ruta}</span>
                        <span>{new Date(prob.reportadoEn).toLocaleDateString("es-DO")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
