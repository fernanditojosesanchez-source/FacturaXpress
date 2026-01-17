import { Router, Request, Response } from "express";
import { requireAuth, requireTenantAdmin, checkPermission } from "../auth.js";
import { logAudit, getClientIP } from "../lib/audit.js";
import { sendToSIEM } from "../lib/siem.js";
import { db } from "../db.js";
import { eq, and, or, desc, sql, gte, lte } from "drizzle-orm";
import { 
  stockTransitoTable, 
  stockTransitoHistorialTable 
} from "../../shared/schema-stock-transito.js";
import {
  createStockTransito,
  updateStockTransito,
  receiveStockTransito,
  devuelveStockTransito,
  getStockTransitoStats,
} from "../lib/stock-transito.js";

const router = Router();

// Helper para obtener tenantId del request
const getTenantId = (req: Request) => (req as any).user?.tenantId;

/**
 * STOCK EN TRÁNSITO - Endpoints para gestión de movimientos entre sucursales
 * 
 * Funcionalidad:
 * - Crear movimientos de stock entre sucursales
 * - Seguimiento de estado (pendiente → enviado → en_transporte → recibido)
 * - Devoluciones y problemas de entrega
 * - Reportes y auditoría completa
 * - Inspección de lotes/series
 */

// ============================================
// CREAR MOVIMIENTO
// ============================================

/**
 * POST /api/stock-transito
 * Crear un nuevo movimiento de stock en tránsito
 * 
 * Body:
 * {
 *   sucursalOrigen: string,
 *   sucursalDestino: string,
 *   productos: [{
 *     productoId: string,
 *     codigoProducto: string,
 *     nombreProducto: string,
 *     cantidad: number,
 *     observaciones?: string
 *   }],
 *   transportista?: string,
 *   numeroGuia?: string,
 *   observaciones?: string,
 *   costoTransporte?: number,
 *   referencia?: string
 * }
 * 
 * Response:
 * {
 *   id: string,
 *   numeroMovimiento: "MOV-{timestamp}-{random}",
 *   tenantId: string,
 *   estado: "pendiente",
 *   sucursalOrigen: string,
 *   sucursalDestino: string,
 *   creado: ISO string,
 *   creadoPor: string
 * }
 */
router.post("/", requireAuth, checkPermission("manage_inventory"), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = (req as any).user?.id;
    const {
      sucursalOrigen,
      sucursalDestino,
      productos,
      transportista,
      numeroGuia,
      observaciones,
      costoTransporte,
      referencia
    } = req.body;

    // Validación
    if (!sucursalOrigen || !sucursalDestino || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({
        error: "Parámetros requeridos: sucursalOrigen, sucursalDestino, productos[]"
      });
    }

    if (sucursalOrigen === sucursalDestino) {
      return res.status(400).json({
        error: "Sucursal de origen y destino no pueden ser iguales"
      });
    }

    let productosTotales = 0;
    let cantidadTotal = 0;

    // Crear un movimiento por cada producto
    const movimientos = [];
    for (const producto of productos) {
      const result = await createStockTransito(tenantId, userId, {
        sucursalOrigen,
        sucursalDestino,
        productoId: producto.productoId,
        codigoProducto: producto.codigoProducto,
        nombreProducto: producto.nombreProducto,
        cantidadEnviada: producto.cantidad,
        transportista,
        numeroGuia,
        costoTransporte,
        referencia,
        observaciones: observaciones || producto.observaciones
      });
      
      movimientos.push(result);
      productosTotales++;
      cantidadTotal += producto.cantidad;
    }

    // Log de auditoría - usar primer movimiento como referencia
    await logAudit({
      userId,
      action: "stock_transito_created",
      ipAddress: getClientIP(req),
      details: {
        numeroMovimiento: movimientos[0].numeroMovimiento,
        origen: sucursalOrigen,
        destino: sucursalDestino,
        productosTotales
      }
    });

    // SIEM event
    await sendToSIEM({
      type: "stock_transito_created",
      level: "info",
      userId,
      tenantId,
      details: {
        numeroMovimiento: movimientos[0].numeroMovimiento,
        origen: sucursalOrigen,
        destino: sucursalDestino,
        cantidadProductos: productosTotales
      }
    });

    res.status(201).json({
      id: movimientos[0].id,
      numeroMovimiento: movimientos[0].numeroMovimiento,
      tenantId,
      estado: movimientos[0].estado,
      sucursalOrigen,
      sucursalDestino,
      productosTotales,
      cantidadTotal,
      creado: new Date().toISOString(),
      creadoPor: userId
    });
  } catch (error) {
    await sendToSIEM({
      type: "stock_transito_creation_error",
      level: "error",
      userId: (req as any).user?.id,
      tenantId: getTenantId(req),
      details: { error: (error as Error).message }
    });
    res.status(500).json({ error: "Error al crear movimiento de stock" });
  }
});

// ============================================
// LISTAR MOVIMIENTOS
// ============================================

/**
 * GET /api/stock-transito?estado=pendiente&sucursal=MAT&limit=25&page=1
 * Listar movimientos de stock en tránsito
 * 
 * Query:
 * - estado?: "pendiente" | "enviado" | "en_transporte" | "recibido" | "parcial" | "devuelto" | "cancelado"
 * - sucursal?: string (filtra origen o destino)
 * - desde?: ISO date (fecha inicial)
 * - hasta?: ISO date (fecha final)
 * - limit?: number (default: 25, max: 500)
 * - page?: number (default: 1)
 * 
 * Response:
 * {
 *   total: number,
 *   page: number,
 *   limit: number,
 *   pages: number,
 *   movimientos: [{
 *     id: string,
 *     numeroMovimiento: string,
 *     estado: string,
 *     sucursalOrigen: string,
 *     sucursalDestino: string,
 *     cantidadTotal: number,
 *     productosTotales: number,
 *     fechaCreacion: ISO string,
 *     transportista?: string
 *   }]
 * }
 */
router.get("/", requireAuth, checkPermission("view_stock"), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { estado, sucursal, desde, hasta, limit = "25", page = "1" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit as string) || 25));
    const offset = (pageNum - 1) * limitNum;

    // Construir condiciones de filtrado
    const conditions = [eq(stockTransitoTable.tenantId, tenantId)];
    
    if (estado) {
      conditions.push(eq(stockTransitoTable.estado, estado as string));
    }
    
    if (sucursal) {
      conditions.push(
        or(
          eq(stockTransitoTable.sucursalOrigen, sucursal as string),
          eq(stockTransitoTable.sucursalDestino, sucursal as string)
        )!
      );
    }
    
    if (desde) {
      conditions.push(gte(stockTransitoTable.createdAt, new Date(desde as string)));
    }
    
    if (hasta) {
      conditions.push(lte(stockTransitoTable.createdAt, new Date(hasta as string)));
    }

    // Query movimientos con filtros
    const movimientos = await db
      .select({
        id: stockTransitoTable.id,
        numeroMovimiento: stockTransitoTable.numeroMovimiento,
        estado: stockTransitoTable.estado,
        sucursalOrigen: stockTransitoTable.sucursalOrigen,
        sucursalDestino: stockTransitoTable.sucursalDestino,
        codigoProducto: stockTransitoTable.codigoProducto,
        nombreProducto: stockTransitoTable.nombreProducto,
        cantidadEnviada: stockTransitoTable.cantidadEnviada,
        cantidadRecibida: stockTransitoTable.cantidadRecibida,
        fechaCreacion: stockTransitoTable.createdAt,
        transportista: stockTransitoTable.transportista,
      })
      .from(stockTransitoTable)
      .where(and(...conditions))
      .orderBy(desc(stockTransitoTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    // Contar total para paginación
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(stockTransitoTable)
      .where(and(...conditions));

    const total = Number(totalCount);
    const pages = Math.ceil(total / limitNum);

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      pages,
      movimientos: movimientos.map(m => ({
        id: m.id,
        numeroMovimiento: m.numeroMovimiento,
        estado: m.estado,
        sucursalOrigen: m.sucursalOrigen,
        sucursalDestino: m.sucursalDestino,
        productosTotales: 1, // En este momento solo un producto por movimiento
        cantidadTotal: m.cantidadEnviada,
        fechaCreacion: m.fechaCreacion.toISOString(),
        transportista: m.transportista,
      })),
      filtros: { estado, sucursal, desde, hasta }
    });
  } catch (error) {
    res.status(500).json({ error: "Error al listar movimientos de stock" });
  }
});

// ============================================
// OBTENER DETALLES
// ============================================

/**
 * GET /api/stock-transito/:movimientoId
 * Obtener detalles completos de un movimiento
 * 
 * Response:
 * {
 *   id: string,
 *   numeroMovimiento: string,
 *   tenantId: string,
 *   estado: string,
 *   sucursalOrigen: string,
 *   sucursalDestino: string,
 *   transportista?: string,
 *   observaciones?: string,
 *   costoTransporte?: number,
 *   productos: [{
 *     productoId: string,
 *     descripcion: string,
 *     cantidadEnviada: number,
 *     cantidadRecibida?: number,
 *     cantidadDevuelta?: number,
 *     lotes: [{
 *       numeroLote: string,
 *       cantidadEnviada: number,
 *       cantidadRecibida?: number,
 *       inspeccion?: "aprobado" | "rechazado" | "parcial",
 *       observacionesInspeccion?: string
 *     }]
 *   }],
 *   historial: [{
 *     evento: string,
 *     fecha: ISO string,
 *     ubicacion?: string,
 *     registradoPor: string,
 *     evidencia?: object,
 *     observaciones?: string
 *   }],
 *   creado: ISO string,
 *   creadoPor: string,
 *   actualizado: ISO string,
 *   modificadoPor?: string
 * }
 */
router.get("/:movimientoId", requireAuth, checkPermission("view_stock"), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { movimientoId } = req.params;

    // Query movimiento completo
    const [movimiento] = await db
      .select()
      .from(stockTransitoTable)
      .where(and(
        eq(stockTransitoTable.id, movimientoId),
        eq(stockTransitoTable.tenantId, tenantId)
      ))
      .limit(1);

    if (!movimiento) {
      return res.status(404).json({
        error: "Movimiento no encontrado"
      });
    }

    // Obtener historial
    const historial = await db
      .select()
      .from(stockTransitoHistorialTable)
      .where(eq(stockTransitoHistorialTable.stockTransitoId, movimientoId))
      .orderBy(desc(stockTransitoHistorialTable.createdAt));

    res.json({
      ...movimiento,
      costoTransporte: movimiento.costoTransporte ? parseFloat(movimiento.costoTransporte) : null,
      historial: historial.map(h => ({
        evento: h.evento,
        estadoAnterior: h.estadoAnterior,
        estadoNuevo: h.estadoNuevo,
        observaciones: h.observaciones,
        fecha: h.createdAt.toISOString(),
        usuario: h.nombreUsuario,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener detalles del movimiento" });
  }
});

// ============================================
// ACTUALIZAR ESTADO / ENVÍO
// ============================================

/**
 * PATCH /api/stock-transito/:movimientoId/enviar
 * Marcar movimiento como enviado
 * 
 * Body:
 * {
 *   observaciones?: string
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   movimientoId: string,
 *   nuevoEstado: "enviado",
 *   fechaEnvio: ISO string
 * }
 */
router.patch("/:movimientoId/enviar", requireAuth, checkPermission("manage_inventory"), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = (req as any).user?.id;
    const { movimientoId } = req.params;
    const { observaciones } = req.body;

    await updateStockTransito(tenantId, userId, movimientoId, {
      estado: "enviado",
      observaciones
    });

    // Log de auditoría
    await logAudit({
      userId,
      action: "stock_transito_updated",
      ipAddress: getClientIP(req),
      details: {
        movimientoId,
        nuevoEstado: "enviado"
      }
    });

    // SIEM event
    await sendToSIEM({
      type: "stock_transito_sent",
      level: "info",
      userId,
      tenantId,
      details: { movimientoId }
    });

    res.json({
      success: true,
      movimientoId,
      nuevoEstado: "enviado",
      fechaEnvio: new Date().toISOString()
    });
  } catch (error) {
    await sendToSIEM({
      type: "stock_transito_error",
      level: "error",
      details: { error: (error as Error).message, movimientoId: req.params.movimientoId }
    });
    res.status(500).json({ error: "Error al actualizar estado del movimiento" });
  }
});

// ============================================
// RECEPCIÓN
// ============================================

/**
 * PATCH /api/stock-transito/:movimientoId/recibir
 * Registrar recepción de movimiento
 * 
 * Body:
 * {
 *   cantidadRecibida: number,
 *   observaciones?: string
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   movimientoId: string,
 *   cantidadRecibida: number,
 *   fechaRecepcion: ISO string
 * }
 */
router.patch("/:movimientoId/recibir", requireAuth, checkPermission("manage_inventory"), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = (req as any).user?.id;
    const { movimientoId } = req.params;
    const { cantidadRecibida, observaciones } = req.body;

    if (typeof cantidadRecibida !== "number" || cantidadRecibida <= 0) {
      return res.status(400).json({
        error: "Parámetro requerido: cantidadRecibida (número > 0)"
      });
    }

    await receiveStockTransito(tenantId, userId, movimientoId, cantidadRecibida, observaciones);

    // Log de auditoría
    await logAudit({
      userId,
      action: "stock_transito_received",
      ipAddress: getClientIP(req),
      details: {
        movimientoId,
        cantidadRecibida
      }
    });

    // SIEM event
    await sendToSIEM({
      type: "stock_transito_received",
      level: "info",
      userId,
      tenantId,
      details: { movimientoId, cantidadRecibida }
    });

    res.json({
      success: true,
      movimientoId,
      cantidadRecibida,
      fechaRecepcion: new Date().toISOString()
    });
  } catch (error) {
    await sendToSIEM({
      type: "stock_transito_receive_error",
      level: "error",
      details: { error: (error as Error).message, movimientoId: req.params.movimientoId }
    });
    res.status(500).json({ error: "Error al registrar recepción" });
  }
});

// ============================================
// DEVOLUCIONES
// ============================================

/**
 * PATCH /api/stock-transito/:movimientoId/devolver
 * Registrar devolución
 * 
 * Body:
 * {
 *   cantidadDevuelta: number,
 *   motivo: string,
 *   observaciones?: string
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   movimientoId: string,
 *   cantidadDevuelta: number,
 *   motivo: string,
 *   fechaDevolucin: ISO string
 * }
 */
router.patch("/:movimientoId/devolver", requireAuth, checkPermission("manage_inventory"), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = (req as any).user?.id;
    const { movimientoId } = req.params;
    const { cantidadDevuelta, motivo, observaciones } = req.body;

    if (typeof cantidadDevuelta !== "number" || cantidadDevuelta <= 0) {
      return res.status(400).json({
        error: "Parámetro requerido: cantidadDevuelta (número > 0)"
      });
    }

    if (!motivo) {
      return res.status(400).json({
        error: "Parámetro requerido: motivo"
      });
    }

    await devuelveStockTransito(tenantId, userId, movimientoId, cantidadDevuelta, motivo);

    // Log de auditoría
    await logAudit({
      userId,
      action: "stock_transito_returned",
      ipAddress: getClientIP(req),
      details: {
        movimientoId,
        cantidadDevuelta,
        motivo
      }
    });

    // SIEM event
    await sendToSIEM({
      type: "stock_transito_returned",
      level: "warn",
      userId,
      tenantId,
      details: { movimientoId, cantidadDevuelta, motivo }
    });

    res.json({
      success: true,
      movimientoId,
      cantidadDevuelta,
      motivo,
      fechaDevolucin: new Date().toISOString()
    });
  } catch (error) {
    await sendToSIEM({
      type: "stock_transito_return_error",
      level: "error",
      details: { error: (error as Error).message, movimientoId: req.params.movimientoId }
    });
    res.status(500).json({ error: "Error al registrar devolución" });
  }
});

// ============================================
// CANCELAR MOVIMIENTO
// ============================================

/**
 * PATCH /api/stock-transito/:movimientoId/cancelar
 * Cancelar un movimiento (solo si está en estado pendiente)
 * 
 * Body:
 * {
 *   motivo: string,
 *   observaciones?: string
 * }
 */
router.patch("/:movimientoId/cancelar", requireAuth, ...requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = (req as any).user?.id;
    const { movimientoId } = req.params;
    const { motivo, observaciones } = req.body;

    if (!motivo) {
      return res.status(400).json({ error: "Parámetro requerido: motivo" });
    }

    await updateStockTransito(tenantId, userId, movimientoId, {
      estado: "cancelado",
      motivoDevolucion: motivo,
      observaciones
    });

    // Log de auditoría
    await logAudit({
      userId,
      action: "stock_transito_cancelled",
      ipAddress: getClientIP(req),
      details: { movimientoId, motivo }
    });

    // SIEM event
    await sendToSIEM({
      type: "stock_transito_cancelled",
      level: "warn",
      userId,
      tenantId,
      details: { movimientoId, motivo }
    });

    res.json({
      success: true,
      movimientoId,
      nuevoEstado: "cancelado"
    });
  } catch (error) {
    res.status(500).json({ error: "Error al cancelar movimiento" });
  }
});

// ============================================
// REPORTES Y ESTADÍSTICAS
// ============================================

/**
 * GET /api/stock-transito/stats
 * Obtener estadísticas de stock en tránsito
 * 
 * Response:
 * {
 *   totalMovimientos: number,
 *   porEstado: {
 *     pendiente: number,
 *     enviado: number,
 *     enTransporte: number,
 *     recibido: number,
 *     parcial: number,
 *     devuelto: number,
 *     cancelado: number
 *   },
 *   sucursalesActivas: number,
 *   cantidadTotalEnTransito: number,
 *   problemas: {
 *     movimientosRetrasados: number,
 *     devoluciones: number,
 *     cancelados: number
 *   },
 *   valorTotalEnTransito: number
 * }
 */
router.get("/stats", requireAuth, checkPermission("view_reports"), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const stats = await getStockTransitoStats(tenantId);

    res.json({
      tenantId,
      timestamp: new Date().toISOString(),
      ...stats
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener estadísticas de stock" });
  }
});

/**
 * GET /api/stock-transito/analytics?desde=2024-01-01&hasta=2024-01-31
 * Análisis de movimientos: tendencias, problemas, eficiencia
 * 
 * Query:
 * - desde: ISO date
 * - hasta: ISO date
 * 
 * Response:
 * {
 *   periodo: "2024-01-01 a 2024-01-31",
 *   movimientosCompletados: number,
 *   tiempoPromedioEntrega: "3.5 días",
 *   eficienciaEntrega: 94.5,
 *   problemasReportados: [{ tipo, cantidad, ejemplos }],
 *   costoPromedio: number,
 *   rutas: [{ origen, destino, movimientos, tiempoPromedio }]
 * }
 */
router.get("/analytics", requireAuth, checkPermission("view_reports"), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { desde, hasta } = req.query;

    // Filtros de fecha
    const conditions = [eq(stockTransitoTable.tenantId, tenantId)];
    if (desde) {
      conditions.push(gte(stockTransitoTable.createdAt, new Date(desde as string)));
    }
    if (hasta) {
      conditions.push(lte(stockTransitoTable.createdAt, new Date(hasta as string)));
    }

    // Query analytics
    const [analytics] = await db
      .select({
        movimientosCompletados: sql<number>`count(*) filter (where ${stockTransitoTable.estado} = 'recibido')`,
        movimientosConProblemas: sql<number>`count(*) filter (where ${stockTransitoTable.estado} in ('parcial', 'devuelto'))`,
        costoTotal: sql<number>`coalesce(sum(${stockTransitoTable.costoTransporte}::decimal), 0)`,
        costoPromedio: sql<number>`coalesce(avg(${stockTransitoTable.costoTransporte}::decimal), 0)`,
        tiempoPromedioHoras: sql<number>`coalesce(avg(extract(epoch from (${stockTransitoTable.fechaRecepcion} - ${stockTransitoTable.createdAt})) / 3600), 0)`,
      })
      .from(stockTransitoTable)
      .where(and(...conditions));

    // Calcular eficiencia
    const totalMovimientos = Number(analytics.movimientosCompletados) + Number(analytics.movimientosConProblemas);
    const eficiencia = totalMovimientos > 0 
      ? (Number(analytics.movimientosCompletados) / totalMovimientos) * 100 
      : 0;

    const tiempoPromedioDias = Number(analytics.tiempoPromedioHoras) / 24;

    res.json({
      tenantId,
      timestamp: new Date().toISOString(),
      periodo: `${desde} a ${hasta}`,
      movimientosCompletados: Number(analytics.movimientosCompletados),
      tiempoPromedioEntrega: `${tiempoPromedioDias.toFixed(1)} días`,
      eficienciaEntrega: parseFloat(eficiencia.toFixed(2)),
      problemasReportados: [],
      costoPromedio: parseFloat(Number(analytics.costoPromedio).toFixed(2)),
      rutas: []
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener análisis de movimientos" });
  }
});

/**
 * GET /api/stock-transito/problemas?severidad=critica&limite=30
 * Listar movimientos con problemas o alertas
 * 
 * Query:
 * - severidad?: "baja" | "normal" | "alta" | "critica"
 * - limite?: number (últimos N días)
 * 
 * Response:
 * {
 *   total: number,
 *   problemas: [{
 *     movimientoId: string,
 *     numeroMovimiento: string,
 *     tipo: "retraso" | "devolución" | "daño" | "perdida" | "incompleto",
 *     severidad: string,
 *     descripcion: string,
 *     reportadoEn: ISO string,
 *     estado: "abierto" | "en_investigación" | "resuelto"
 *   }]
 * }
 */
router.get("/problemas", requireAuth, checkPermission("view_reports"), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { severidad, limite = "30" } = req.query;

    const limiteDias = parseInt(limite as string) || 30;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - limiteDias);

    // Query movimientos con problemas
    const problemas = await db
      .select({
        movimientoId: stockTransitoTable.id,
        numeroMovimiento: stockTransitoTable.numeroMovimiento,
        estado: stockTransitoTable.estado,
        sucursalOrigen: stockTransitoTable.sucursalOrigen,
        sucursalDestino: stockTransitoTable.sucursalDestino,
        nombreProducto: stockTransitoTable.nombreProducto,
        cantidadEnviada: stockTransitoTable.cantidadEnviada,
        cantidadRecibida: stockTransitoTable.cantidadRecibida,
        cantidadDevuelta: stockTransitoTable.cantidadDevuelta,
        motivoDevolucion: stockTransitoTable.motivoDevolucion,
        reportadoEn: stockTransitoTable.createdAt,
      })
      .from(stockTransitoTable)
      .where(
        and(
          eq(stockTransitoTable.tenantId, tenantId),
          or(
            eq(stockTransitoTable.estado, 'parcial'),
            eq(stockTransitoTable.estado, 'devuelto')
          )!,
          gte(stockTransitoTable.createdAt, fechaLimite)
        )
      )
      .orderBy(desc(stockTransitoTable.createdAt))
      .limit(100);

    res.json({
      tenantId,
      total: problemas.length,
      problemas: problemas.map(p => ({
        movimientoId: p.movimientoId,
        numeroMovimiento: p.numeroMovimiento,
        tipo: p.estado === 'devuelto' ? 'devolución' : 'incompleto',
        severidad: (p.cantidadDevuelta || 0) > 0 ? 'alta' : 'normal',
        descripcion: p.motivoDevolucion || `Recibidas ${p.cantidadRecibida} de ${p.cantidadEnviada} unidades`,
        reportadoEn: p.reportadoEn.toISOString(),
        estado: 'abierto',
        producto: p.nombreProducto,
        ruta: `${p.sucursalOrigen} → ${p.sucursalDestino}`,
      })),
      filtros: { severidad, ultimosDias: limite }
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener problemas de stock" });
  }
});

export default router;
