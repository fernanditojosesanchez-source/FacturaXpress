import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Activity, LogIn, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SupportAccess {
  accessId: string;
  supportUserName: string;
  tipoAcceso: string;
  validoHasta: string;
  razon: string;
}

interface SupportLog {
  logId: string;
  supportUserName: string;
  resourceId?: string;
  accion: string;
  recurso: string;
  exitoso: boolean;
  errorMsg?: string;
  timestamp: string;
}

interface SupportTicket {
  ticketId: string;
  numeroTicket: string;
  tenantId: string;
  titulo: string;
  severidad: "baja" | "normal" | "alta" | "critica";
  estado: "abierto" | "en_progreso" | "resuelto" | "cerrado";
  categoria: string;
  creado: string;
}

const severidadColors: Record<string, string> = {
  baja: "bg-blue-100 text-blue-800",
  normal: "bg-gray-100 text-gray-800",
  alta: "bg-orange-100 text-orange-800",
  critica: "bg-red-100 text-red-800",
};

const estadoTicketColors: Record<string, string> = {
  abierto: "bg-yellow-100 text-yellow-800",
  en_progreso: "bg-blue-100 text-blue-800",
  resuelto: "bg-green-100 text-green-800",
  cerrado: "bg-gray-100 text-gray-800",
};

export default function SigmaSupportPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Obtener estadísticas globales
  const { data: statsData } = useQuery({
    queryKey: ["/api/admin/sigma/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sigma/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar estadísticas");
      return res.json();
    },
  });

  // Obtener accesos activos
  const { data: accesosData } = useQuery({
    queryKey: ["/api/admin/sigma/accesos"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sigma/accesos", { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar accesos");
      return res.json();
    },
  });

  // Obtener logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["/api/admin/sigma/logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sigma/logs?limit=100", { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar logs");
      return res.json();
    },
  });

  // Obtener tickets
  const { data: ticketsData } = useQuery({
    queryKey: ["/api/admin/sigma/tickets", { estado: filtroEstado }],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(filtroEstado && { estado: filtroEstado }),
      });
      const res = await fetch(`/api/admin/sigma/tickets?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar tickets");
      return res.json();
    },
  });

  const stats = statsData || {
    accessesActivos: 0,
    logsUltimas24h: 0,
    ticketsAbiertos: 0,
    ticketsCriticos: 0,
  };

  const accesos = accesosData?.accesos || [];
  const logs = logsData?.logs || [];
  const tickets = ticketsData?.tickets || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vista Soporte Sigma</h1>
          <p className="text-sm text-gray-500 mt-1">Dashboard de monitoreo y acceso de soporte</p>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
              <LogIn className="w-4 h-4" /> Accesos Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">{stats.accessesActivos}</div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Logs (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">{stats.logsUltimas24h}</div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Tickets Abiertos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-800">{stats.ticketsAbiertos}</div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Críticos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-800">{stats.ticketsCriticos}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="accesos">Accesos ({accesos.length})</TabsTrigger>
          <TabsTrigger value="logs">Logs Auditoría ({logs.length})</TabsTrigger>
          <TabsTrigger value="tickets" className="relative">
            Tickets ({tickets.length})
            {stats.ticketsCriticos > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {stats.ticketsCriticos}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Dashboard */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Accesos Recientes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Accesos Recientes</CardTitle>
                <CardDescription>Últimos accesos otorgados</CardDescription>
              </CardHeader>
              <CardContent>
                {accesos.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-sm">No hay accesos activos</div>
                ) : (
                  <div className="space-y-3">
                    {accesos.slice(0, 5).map((acc: SupportAccess) => (
                      <div key={acc.accessId} className="border-l-4 border-green-500 pl-3 py-2">
                        <div className="font-medium text-sm">{acc.supportUserName}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {acc.tipoAcceso} - {acc.razon}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Válido hasta: {new Date(acc.validoHasta).toLocaleDateString("es-DO")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tickets Críticos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tickets Críticos</CardTitle>
                <CardDescription>Requieren atención inmediata</CardDescription>
              </CardHeader>
              <CardContent>
                {tickets.filter((t: SupportTicket) => t.severidad === "critica" && t.estado !== "cerrado").length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-sm">No hay tickets críticos</div>
                ) : (
                  <div className="space-y-3">
                    {tickets
                      .filter((t: SupportTicket) => t.severidad === "critica" && t.estado !== "cerrado")
                      .slice(0, 5)
                      .map((tkt: SupportTicket) => (
                        <div key={tkt.ticketId} className="border-l-4 border-red-500 pl-3 py-2">
                          <div className="font-medium text-sm">{tkt.numeroTicket}</div>
                          <div className="text-xs text-gray-600 mt-1">{tkt.titulo}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {tkt.categoria} • {tkt.estado}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Accesos */}
        <TabsContent value="accesos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Accesos de Soporte</CardTitle>
              <CardDescription>Accesos temporales activos para el equipo Sigma</CardDescription>
            </CardHeader>
            <CardContent>
              {accesos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No hay accesos activos</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Tipo de Acceso</TableHead>
                      <TableHead>Razón</TableHead>
                      <TableHead>Válido Hasta</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accesos.map((acc: SupportAccess) => (
                      <TableRow key={acc.accessId}>
                        <TableCell className="font-medium">{acc.supportUserName}</TableCell>
                        <TableCell>
                          <Badge>{acc.tipoAcceso}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{acc.razon}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(acc.validoHasta).toLocaleDateString("es-DO")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              toast({
                                title: "Revocar acceso",
                                description: "Confirma que deseas revocar este acceso",
                              });
                            }}
                          >
                            Revocar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Logs */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auditoría de Acciones</CardTitle>
              <CardDescription>Registro de todas las acciones realizadas por el equipo de soporte (sin PII)</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-8 text-gray-500">Cargando logs...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No hay logs registrados</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Acción</TableHead>
                        <TableHead>Recurso</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>Timestamp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.slice(0, 50).map((log: SupportLog) => (
                        <TableRow key={log.logId}>
                          <TableCell className="text-sm font-medium">{log.supportUserName}</TableCell>
                          <TableCell className="text-sm">{log.accion}</TableCell>
                          <TableCell className="text-sm text-gray-600">{log.recurso}</TableCell>
                          <TableCell>
                            <Badge variant={log.exitoso ? "default" : "destructive"}>
                              {log.exitoso ? "✓ Éxito" : "✗ Error"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleString("es-DO")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Tickets */}
        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tickets de Soporte</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 flex-wrap mb-4">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">Todos los estados</option>
                <option value="abierto">Abierto</option>
                <option value="en_progreso">En Progreso</option>
                <option value="resuelto">Resuelto</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {tickets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No hay tickets</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Severidad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((tkt: SupportTicket) => (
                      <TableRow key={tkt.ticketId}>
                        <TableCell className="font-mono text-sm">{tkt.numeroTicket}</TableCell>
                        <TableCell className="text-sm">{tkt.titulo}</TableCell>
                        <TableCell className="text-sm">{tkt.categoria}</TableCell>
                        <TableCell>
                          <Badge className={severidadColors[tkt.severidad] || ""}>
                            {tkt.severidad}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={estadoTicketColors[tkt.estado] || ""}>
                            {tkt.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(tkt.creado).toLocaleDateString("es-DO")}
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
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
