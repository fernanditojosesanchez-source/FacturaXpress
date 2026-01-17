import { Router, Request, Response } from "express";
import { requireAuth, requireTenantAdmin } from "../auth.js";
import { logAudit, getClientIP } from "../lib/audit.js";
import { sendToSIEM } from "../lib/siem.js";
import { db } from "../db.js";
import { eq, and, desc, sql, gt } from "drizzle-orm";
import { 
  sigmaSupportLogsTable,
  sigmaSupportTicketsTable,
  sigmaSupportMetricasTable
} from "../../shared/schema-sigma-support.js";
import {
  grantSigmaSupportAccess,
  revokeSigmaSupportAccess,
  logSupportAction,
  getActiveSupportAccesses,
  getSupportStats,
  createSupportTicket,
} from "../lib/sigma-support.js";

const router = Router();

// Helper para obtener tenantId del request
const getTenantId = (req: Request) => (req as any).user?.tenantId;

/**
 * SIGMA SUPPORT - Endpoints para gestión de acceso de soporte
 * 
 * Funcionalidad:
 * - Otorgar/revocar acceso temporal para el equipo de Sigma
 * - Logs de auditoría sin PII (resourceId UUID solamente)
 * - Tickets de soporte con severidad
 * - Métricas de tenant para monitoreo
 */

// ============================================
// GESTIÓN DE ACCESO (Admin Only)
// ============================================

/**
 * GET /api/admin/sigma/accesos
 * Listar todos los accesos activos para soporte (admin)
 * 
 * Query:
 * - tenantId?: string (opcional, filtra por tenant específico)
 * 
 * Response:
 * [{
 *   accessId: string,
 *   tenantId: string,
 *   supportUserName: string,
 *   tipoAcceso: "readonly" | "readwrite" | "fullaccess",
 *   permisos: { viewLogs: boolean, viewMetrics: boolean, viewAudit: boolean, exportData: boolean },
 *   activo: boolean,
 *   otorgadoEn: ISO string,
 *   validoHasta: ISO string,
 *   razonAcceso?: string
 * }]
 */
router.get("/accesos", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const accesos = await getActiveSupportAccesses(tenantId);
    
    res.json({
      total: accesos.length,
      accesos,
      filtro: tenantId ? `tenant: ${tenantId}` : "todos los tenants"
    });
  } catch (error) {
    await sendToSIEM({
      type: "sigma_support_error",
      level: "error",
      details: { error: (error as Error).message, endpoint: "GET /accesos" }
    });
    res.status(500).json({ error: "Error al obtener accesos de soporte" });
  }
});

/**
 * POST /api/admin/sigma/accesos
 * Otorgar acceso temporal a soporte para un tenant
 * 
 * Body:
 * {
 *   tenantId: string,
 *   supportUserEmail: string,
 *   tipoAcceso: "readonly" | "readwrite" | "fullaccess",
 *   permisos?: { viewLogs?: boolean, viewMetrics?: boolean, viewAudit?: boolean, exportData?: boolean },
 *   razonAcceso?: string,
 *   diasValidez?: number (default: 7)
 * }
 * 
 * Response:
 * {
 *   accessId: string,
 *   tenantId: string,
 *   otorgadoEn: ISO string,
 *   validoHasta: ISO string,
 *   mensaje: "Acceso otorgado por 7 días"
 * }
 */
router.post("/accesos", requireAuth, ...requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const adminUserId = (req as any).user?.id;
    const tenantId = getTenantId(req);
    const { supportEmail, tipoAcceso, permisos, razonAcceso, diasValidez } = req.body;

    // Validación
    if (!supportEmail || !tipoAcceso) {
      return res.status(400).json({
        error: "Parámetros requeridos: supportEmail, tipoAcceso"
      });
    }

    const tiposValidos = ["readonly", "readwrite", "fullaccess"];
    if (!tiposValidos.includes(tipoAcceso)) {
      return res.status(400).json({
        error: `tipoAcceso inválido. Válidos: ${tiposValidos.join(", ")}`
      });
    }

    const result = await grantSigmaSupportAccess(adminUserId, {
      supportUserId: `user-${Date.now()}`, // Generado temporalmente
      supportUserName: supportEmail.split("@")[0], // Extrae nombre del email
      supportEmail,
      tenantId,
      tenantNombre: (req as any).user?.tenantName || "unknown",
      tipoAcceso,
      permisos: permisos || { 
        canViewLogs: true, 
        canViewMetrics: true, 
        canViewAudit: true, 
        canExportData: false 
      },
      razon: razonAcceso || "Support request",
      fechaFin: diasValidez 
        ? new Date(Date.now() + diasValidez * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días por defecto
    });

    // Log de auditoría
    await logAudit({
      userId: adminUserId,
      action: "sigma_support_access_granted",
      ipAddress: getClientIP(req),
      details: { tenantId, supportEmail, tipoAcceso, validoHasta: result.validoHasta }
    });

    // SIEM event
    await sendToSIEM({
      type: "sigma_support_access_granted",
      level: "info",
      details: { tenantId, supportEmail, tipoAcceso, validoHasta: result.validoHasta }
    });

    res.status(201).json({
      accessId: result.accessId,
      tenantId,
      supportEmail,
      otorgadoEn: new Date().toISOString(),
      validoHasta: result.validoHasta.toISOString(),
      mensaje: `Acceso otorgado por ${diasValidez || 7} días`
    });
  } catch (error) {
    await sendToSIEM({
      type: "sigma_support_access_grant_error",
      level: "error",
      details: { error: (error as Error).message }
    });
    res.status(500).json({ error: "Error al otorgar acceso de soporte" });
  }
});

/**
 * DELETE /api/admin/sigma/accesos/:accessId
 * Revocar acceso de soporte
 * 
 * Body:
 * {
 *   razon: string (motivo de la revocación)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   accesId: string,
 *   revocadoEn: ISO string
 * }
 */
router.delete("/accesos/:accessId", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const adminUserId = (req as any).user?.id;
    const { razon } = req.body;

    if (!razon) {
      return res.status(400).json({ error: "Parámetro requerido: razon" });
    }

    const result = await revokeSigmaSupportAccess(adminUserId, req.params.accessId, razon);

    // Log de auditoría
    await logAudit({
      userId: adminUserId,
      action: "sigma_support_access_revoked",
      ipAddress: getClientIP(req),
      details: { accessId: req.params.accessId, razon }
    });

    // SIEM event
    await sendToSIEM({
      type: "sigma_support_access_revoked",
      level: "warn",
      details: { accessId: req.params.accessId, razon }
    });

    res.json(result);
  } catch (error) {
    await sendToSIEM({
      type: "sigma_support_access_revoke_error",
      level: "error",
      details: { error: (error as Error).message, accessId: req.params.accessId }
    });
    res.status(500).json({ error: "Error al revocar acceso de soporte" });
  }
});

// ============================================
// LOGS DE SOPORTE (PII-Safe, solo resourceId)
// ============================================

/**
 * POST /api/admin/sigma/logs
 * Registrar una acción de soporte (acceso a datos de tenant)
 * 
 * Body:
 * {
 *   resourceId: string (UUID, NOT customer name/email),
 *   accion: string,
 *   recurso: string,
 *   exitoso: boolean,
 *   errorMsg?: string
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   logId: string
 * }
 */
router.post("/logs", requireAuth, async (req: Request, res: Response) => {
  try {
    const supportUserId = (req as any).user?.id;
    const supportUserName = (req as any).user?.username || "unknown";
    const { resourceId, accion, recurso, exitoso, errorMsg } = req.body;

    if (!resourceId || !accion || !recurso) {
      return res.status(400).json({
        error: "Parámetros requeridos: resourceId, accion, recurso"
      });
    }

    // PII-SAFETY: resourceId debe ser UUID, no nombres ni emails
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(resourceId)) {
      return res.status(400).json({
        error: "resourceId debe ser un UUID válido (no nombres ni datos personales)"
      });
    }

    await logSupportAction(supportUserId, supportUserName, {
      action: accion,
      recurso,
      resourceId,
      exitoso: exitoso !== false,
      error: errorMsg
    });

    // SIEM event: Log si hay error
    if (!exitoso) {
      await sendToSIEM({
        type: "sigma_support_action_failed",
        level: "warn",
        details: { resourceId, accion, error: errorMsg }
      });
    }

    res.status(201).json({
      success: true,
      logId: `log-${Date.now()}`
    });
  } catch (error) {
    await sendToSIEM({
      type: "sigma_support_log_error",
      level: "error",
      details: { error: (error as Error).message }
    });
    res.status(500).json({ error: "Error al registrar acción de soporte" });
  }
});

/**
 * GET /api/admin/sigma/logs?tenantId=:tenantId&limit=100&offset=0
 * Obtener logs de soporte para un tenant (admin only)
 * 
 * Query:
 * - tenantId: string
 * - limit: number (default: 100)
 * - offset: number (default: 0)
 * 
 * Response:
 * {
 *   total: number,
 *   logs: [{
 *     logId: string,
 *     supportUserName: string,
 *     resourceId: string (UUID),
 *     accion: string,
 *     exitoso: boolean,
 *     errorMsg?: string,
 *     timestamp: ISO string
 *   }]
 * }
 */
router.get("/logs", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, limit = "100", offset = "0" } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: "Parámetro requerido: tenantId" });
    }

    const limitNum = Math.min(1000, parseInt(limit as string) || 100);
    const offsetNum = Math.max(0, parseInt(offset as string) || 0);

    // Query logs (nota: logs no tienen tenantId directo, filtramos por supportUserId que tenga acceso al tenant)
    const logs = await db
      .select({
        logId: sigmaSupportLogsTable.id,
        supportUserName: sigmaSupportLogsTable.supportUserName,
        resourceId: sigmaSupportLogsTable.resourceId,
        accion: sigmaSupportLogsTable.accion,
        recurso: sigmaSupportLogsTable.recurso,
        exitoso: sigmaSupportLogsTable.exitoso,
        error: sigmaSupportLogsTable.error,
        timestamp: sigmaSupportLogsTable.createdAt,
      })
      .from(sigmaSupportLogsTable)
      .orderBy(desc(sigmaSupportLogsTable.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    // Contar total
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sigmaSupportLogsTable);
    
    res.json({
      total: Number(totalCount),
      logs: logs.map(l => ({
        logId: l.logId,
        supportUserName: l.supportUserName,
        resourceId: l.resourceId,
        accion: l.accion,
        recurso: l.recurso,
        exitoso: l.exitoso,
        errorMsg: l.error,
        timestamp: l.timestamp.toISOString(),
      })),
      filtro: { tenantId, limit, offset }
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener logs de soporte" });
  }
});

// ============================================
// TICKETS DE SOPORTE
// ============================================

/**
 * POST /api/admin/sigma/tickets
 * Crear un ticket de soporte para un tenant
 * 
 * Body:
 * {
 *   tenantId: string,
 *   titulo: string,
 *   descripcion: string,
 *   severidad: "baja" | "normal" | "alta" | "critica",
 *   categoria?: string,
 *   contacto?: string
 * }
 * 
 * Response:
 * {
 *   ticketId: string,
 *   numeroTicket: "TKT-{timestamp}-{random}",
 *   tenantId: string,
 *   estado: "abierto",
 *   creado: ISO string
 * }
 */
router.post("/tickets", requireAuth, async (req: Request, res: Response) => {
  try {
    const createdByUserId = (req as any).user?.id;
    const tenantId = getTenantId(req);
    const { titulo, descripcion, severidad, categoria, contacto } = req.body;

    if (!tenantId || !titulo || !severidad) {
      return res.status(400).json({
        error: "Parámetros requeridos: titulo, severidad"
      });
    }

    const severidadValidas = ["baja", "normal", "alta", "critica"];
    if (!severidadValidas.includes(severidad)) {
      return res.status(400).json({
        error: `severidad inválida. Válidas: ${severidadValidas.join(", ")}`
      });
    }

    const result = await createSupportTicket(tenantId, createdByUserId, {
      titulo,
      descripcion,
      severidad,
      categoria: categoria || "general"
    });

    // Log de auditoría
    await logAudit({
      userId: createdByUserId,
      action: "sigma_support_ticket_created",
      ipAddress: getClientIP(req),
      details: { tenantId, numeroTicket: result.numeroTicket, severidad }
    });

    // SIEM event
    await sendToSIEM({
      type: "sigma_support_ticket_created",
      level: severidad === "critica" ? "error" : severidad === "alta" ? "warn" : "info",
      details: { tenantId, numeroTicket: result.numeroTicket, severidad, titulo }
    });

    res.status(201).json(result);
  } catch (error) {
    await sendToSIEM({
      type: "sigma_support_ticket_error",
      level: "error",
      details: { error: (error as Error).message }
    });
    res.status(500).json({ error: "Error al crear ticket de soporte" });
  }
});

/**
 * GET /api/admin/sigma/tickets?tenantId=:tenantId&estado=abierto
 * Listar tickets de soporte
 * 
 * Query:
 * - tenantId?: string (filtra por tenant)
 * - estado?: "abierto" | "en_progreso" | "resuelto" | "cerrado"
 * 
 * Response:
 * {
 *   total: number,
 *   tickets: [{
 *     ticketId: string,
 *     numeroTicket: string,
 *     tenantId: string,
 *     titulo: string,
 *     severidad: "baja" | "normal" | "alta" | "critica",
 *     estado: string,
 *     creado: ISO string
 *   }]
 * }
 */
router.get("/tickets", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, estado } = req.query;

    // Construir condiciones
    const conditions = [];
    if (tenantId) {
      conditions.push(eq(sigmaSupportTicketsTable.tenantId, tenantId as string));
    }
    if (estado) {
      conditions.push(eq(sigmaSupportTicketsTable.estado, estado as string));
    }

    // Query tickets
    const tickets = await db
      .select({
        ticketId: sigmaSupportTicketsTable.id,
        numeroTicket: sigmaSupportTicketsTable.numeroTicket,
        tenantId: sigmaSupportTicketsTable.tenantId,
        titulo: sigmaSupportTicketsTable.titulo,
        descripcion: sigmaSupportTicketsTable.descripcion,
        severidad: sigmaSupportTicketsTable.severidad,
        estado: sigmaSupportTicketsTable.estado,
        categoria: sigmaSupportTicketsTable.categoria,
        creado: sigmaSupportTicketsTable.createdAt,
      })
      .from(sigmaSupportTicketsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sigmaSupportTicketsTable.createdAt))
      .limit(100);

    res.json({
      total: tickets.length,
      tickets: tickets.map(t => ({
        ticketId: t.ticketId,
        numeroTicket: t.numeroTicket,
        tenantId: t.tenantId,
        titulo: t.titulo,
        severidad: t.severidad,
        estado: t.estado,
        categoria: t.categoria,
        creado: t.creado.toISOString(),
      })),
      filtro: { tenantId, estado }
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener tickets de soporte" });
  }
});

/**
 * PATCH /api/admin/sigma/tickets/:ticketId
 * Actualizar estado de un ticket
 * 
 * Body:
 * {
 *   estado: "en_progreso" | "resuelto" | "cerrado",
 *   notas?: string,
 *   asignadoA?: string (email de soporte)
 * }
 */
router.patch("/tickets/:ticketId", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { estado, notas, asignadoA } = req.body;
    const userId = (req as any).user?.id;

    if (!estado) {
      return res.status(400).json({ error: "Parámetro requerido: estado" });
    }

    // Update ticket en database
    await db
      .update(sigmaSupportTicketsTable)
      .set({
        estado,
        asignadoA: asignadoA || null,
        asignadoNombre: asignadoA || null,
        updatedAt: new Date(),
        ...(estado === 'resuelto' && { fechaResolucion: new Date() }),
        ...(estado === 'cerrado' && { closedAt: new Date() }),
      })
      .where(eq(sigmaSupportTicketsTable.id, req.params.ticketId));

    await logAudit({
      userId,
      action: "sigma_support_ticket_updated",
      ipAddress: getClientIP(req),
      details: { ticketId: req.params.ticketId, nuevoEstado: estado }
    });

    res.json({
      success: true,
      ticketId: req.params.ticketId,
      nuevoEstado: estado
    });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar ticket" });
  }
});

// ============================================
// MÉTRICAS Y ESTADÍSTICAS
// ============================================

/**
 * GET /api/admin/sigma/stats
 * Obtener estadísticas globales de soporte
 * 
 * Response:
 * {
 *   accesosActivos: number,
 *   logsUltimas24h: number,
 *   ticketsAbiertos: number,
 *   ticketsCriticos: number,
 *   tenantsMasAccesados: [{ tenantId, accesos }],
 *   accionesMasFrequentes: [{ accion, cantidad }]
 * }
 */
router.get("/stats", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await getSupportStats();

    res.json({
      timestamp: new Date().toISOString(),
      stats
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener estadísticas de soporte" });
  }
});

/**
 * GET /api/admin/sigma/stats/tenant/:tenantId
 * Métricas específicas de un tenant
 * 
 * Response:
 * {
 *   tenantId: string,
 *   accesosActivos: number,
 *   ultimoAcceso: ISO string,
 *   logsUltimas24h: number,
 *   ticketsAbiertos: number,
 *   tendenciaAccesos: "up" | "down" | "stable"
 * }
 */
router.get("/stats/tenant/:tenantId", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Query métricas del tenant
    const metricas = await db
      .select()
      .from(sigmaSupportMetricasTable)
      .where(eq(sigmaSupportMetricasTable.tenantId, tenantId))
      .orderBy(desc(sigmaSupportMetricasTable.fecha))
      .limit(30);

    // Contar tickets abiertos
    const [{ count: ticketsAbiertos }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sigmaSupportTicketsTable)
      .where(
        and(
          eq(sigmaSupportTicketsTable.tenantId, tenantId),
          eq(sigmaSupportTicketsTable.estado, 'abierto')
        )
      );

    // Tendencia (simplificada)
    const tendencia = metricas.length >= 2 && metricas[0].valor > metricas[1].valor 
      ? 'up' 
      : metricas.length >= 2 && metricas[0].valor < metricas[1].valor 
      ? 'down' 
      : 'stable';

    res.json({
      tenantId,
      timestamp: new Date().toISOString(),
      accesosActivos: 0, // Podríamos contar desde sigmaSupportAccessTable
      ultimoAcceso: metricas.length > 0 ? metricas[0].createdAt.toISOString() : null,
      logsUltimas24h: 0, // Podríamos contar desde sigmaSupportLogsTable
      ticketsAbiertos: Number(ticketsAbiertos),
      tendenciaAccesos: tendencia,
      metricas: metricas.slice(0, 10).map(m => ({
        metrica: m.metrica,
        valor: m.valor,
        fecha: m.fecha.toISOString(),
        trending: m.trending,
        alerta: m.alerta,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener métricas del tenant" });
  }
});

export default router;
