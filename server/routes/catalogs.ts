/**
 * Catalog Sync Admin Routes
 * 
 * Endpoints para administración y monitoreo de sincronización de catálogos DGII.
 * 
 * Endpoints:
 * - GET  /api/admin/catalogs/versions - Ver versiones actuales
 * - GET  /api/admin/catalogs/sync-history - Historial de sincronizaciones
 * - POST /api/admin/catalogs/sync - Forzar sincronización manual
 * - POST /api/admin/catalogs/sync/:catalogName - Sincronizar catálogo específico
 * - GET  /api/admin/catalogs/alerts - Ver alertas sin resolver
 * - POST /api/admin/catalogs/alerts/:id/acknowledge - Reconocer alerta
 */

import { Router } from "express";
import { db } from "../db.js";
import { 
  catalogVersionsTable, 
  catalogSyncAlertsTable,
  catalogSyncRequestSchema 
} from "../../shared/schema-catalog-sync.js";
import { catalogSyncService } from "../lib/catalog-sync-service.js";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * GET /api/admin/catalogs/versions
 * Retorna versiones actuales de todos los catálogos
 */
router.get("/versions", async (req, res) => {
  try {
    const versions = await catalogSyncService.getCatalogVersions();
    
    return res.json({
      success: true,
      data: versions.map((v: any) => ({
        catalogName: v.catalogName,
        version: v.version,
        description: v.description,
        recordCount: v.recordCount,
        syncStatus: v.syncStatus,
        lastSyncAt: v.lastSyncAt,
        syncDurationMs: v.syncDurationMs,
        dataHash: v.dataHash,
      })),
    });
  } catch (error: any) {
    console.error("[CatalogAdmin] Error fetching versions:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch catalog versions",
    });
  }
});

/**
 * GET /api/admin/catalogs/sync-history
 * Retorna historial de sincronizaciones
 * 
 * Query params:
 * - catalogName: filtrar por catálogo específico
 * - limit: máximo de registros (default 100)
 */
router.get("/sync-history", async (req, res) => {
  try {
    const catalogName = req.query.catalogName as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    
    const history = await catalogSyncService.getSyncHistory(catalogName, limit);
    
    return res.json({
      success: true,
      data: history.map((h: any) => ({
        id: h.id,
        catalogName: h.catalogName,
        status: h.status,
        message: h.message,
        oldRecordCount: h.oldRecordCount,
        newRecordCount: h.newRecordCount,
        changedRecords: h.changedRecords,
        durationMs: h.durationMs,
        triggerType: h.triggerType,
        error: h.error,
        createdAt: h.createdAt,
        completedAt: h.completedAt,
      })),
    });
  } catch (error: any) {
    console.error("[CatalogAdmin] Error fetching sync history:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch sync history",
    });
  }
});

/**
 * POST /api/admin/catalogs/sync
 * Fuerza la sincronización de todos los catálogos
 */
router.post("/sync", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    
    // Iniciar sincronización en background
    const results = await catalogSyncService.syncAllCatalogs({
      force: true,
      triggerType: "manual",
      triggeredBy: userId,
    });
    
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
    
    return res.json({
      success: true,
      message: `Sync completed: ${successCount} succeeded, ${failedCount} failed`,
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: failedCount,
        totalDurationMs: totalDuration,
        averageDurationMs: Math.round(totalDuration / results.length),
      },
      results: results.map(r => ({
        catalogName: r.catalogName,
        success: r.success,
        message: r.message,
        oldRecordCount: r.oldRecordCount,
        newRecordCount: r.newRecordCount,
        changedRecords: r.changedRecords,
        durationMs: r.durationMs,
      })),
    });
  } catch (error: any) {
    console.error("[CatalogAdmin] Error triggering sync:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to trigger catalog sync",
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/catalogs/sync/:catalogName
 * Sincroniza un catálogo específico
 */
router.post("/sync/:catalogName", async (req, res) => {
  try {
    const { catalogName } = req.params;
    const userId = (req as any).user?.id;
    
    // Validar que sea un catálogo conocido
    const validCatalogs = [
      "departamentos",
      "tipos_documento",
      "tipos_dte",
      "condiciones_operacion",
      "formas_pago",
      "unidades_medida",
    ];
    
    if (!validCatalogs.includes(catalogName)) {
      return res.status(400).json({
        success: false,
        error: "Invalid catalog name",
        validCatalogs,
      });
    }
    
    // Sincronizar
    const result = await catalogSyncService.syncCatalog(catalogName, {
      force: true,
      triggerType: "manual",
      triggeredBy: userId,
    });
    
    return res.json({
      success: result.success,
      message: result.message,
      data: {
        catalogName: result.catalogName,
        success: result.success,
        oldRecordCount: result.oldRecordCount,
        newRecordCount: result.newRecordCount,
        changedRecords: result.changedRecords,
        durationMs: result.durationMs,
        error: result.error,
      },
    });
  } catch (error: any) {
    console.error("[CatalogAdmin] Error syncing catalog:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to sync catalog",
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/catalogs/alerts
 * Retorna alertas sin resolver
 */
router.get("/alerts", async (req, res) => {
  try {
    const alerts = await catalogSyncService.getUnresolvedAlerts();
    
    return res.json({
      success: true,
      data: alerts.map((a: any) => ({
        id: a.id,
        catalogName: a.catalogName,
        severity: a.severity,
        title: a.title,
        description: a.description,
        recommendation: a.recommendation,
        acknowledged: a.acknowledged,
        createdAt: a.createdAt,
      })),
      totalCount: alerts.length,
    });
  } catch (error: any) {
    console.error("[CatalogAdmin] Error fetching alerts:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch alerts",
    });
  }
});

/**
 * POST /api/admin/catalogs/alerts/:id/acknowledge
 * Reconoce/resuelve una alerta
 */
router.post("/alerts/:id/acknowledge", async (req, res) => {
  try {
    const { id } = req.params;
    const { resolved } = req.body;
    const userId = (req as any).user?.id;
    
    // Actualizar alerta
    await db
      .update(catalogSyncAlertsTable)
      .set({
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
        resolvedAt: resolved ? new Date() : undefined,
      })
      .where(eq(catalogSyncAlertsTable.id, id));
    
    return res.json({
      success: true,
      message: resolved ? "Alert resolved" : "Alert acknowledged",
    });
  } catch (error: any) {
    console.error("[CatalogAdmin] Error acknowledging alert:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to acknowledge alert",
    });
  }
});

/**
 * GET /api/catalogs
 * Endpoint público para obtener catálogos (para componentes, dropdown lists, etc.)
 */
router.get("/", async (req, res) => {
  try {
    const versions = await db
      .select()
      .from(catalogVersionsTable)
      .where(eq(catalogVersionsTable.syncStatus, "success"));
    
    const catalogs: Record<string, any> = {};
    
    for (const version of versions) {
      catalogs[version.catalogName] = {
        version: version.version,
        data: version.data,
        lastUpdated: version.lastSyncAt,
      };
    }
    
    return res.json({
      success: true,
      data: catalogs,
    });
  } catch (error: any) {
    console.error("[Catalogs] Error fetching catalogs:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch catalogs",
    });
  }
});

/**
 * GET /api/catalogs/:catalogName
 * Obtiene un catálogo específico
 */
router.get("/:catalogName", async (req, res) => {
  try {
    const { catalogName } = req.params;
    
    const [catalog] = await db
      .select()
      .from(catalogVersionsTable)
      .where(eq(catalogVersionsTable.catalogName, catalogName))
      .limit(1);
    
    if (!catalog) {
      return res.status(404).json({
        success: false,
        error: "Catalog not found",
      });
    }
    
    return res.json({
      success: true,
      data: {
        catalogName: catalog.catalogName,
        version: catalog.version,
        data: catalog.data,
        lastUpdated: catalog.lastSyncAt,
        recordCount: catalog.recordCount,
      },
    });
  } catch (error: any) {
    console.error("[Catalogs] Error fetching catalog:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch catalog",
    });
  }
});

export default router;
