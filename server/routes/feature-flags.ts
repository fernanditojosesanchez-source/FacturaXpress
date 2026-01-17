import { Router, Request, Response } from "express";
import { requireAuth, requireTenantAdmin } from "../auth.js";
import { featureFlagsService } from "../lib/feature-flags-service.js";
import { 
  insertFeatureFlagSchema, 
  updateFeatureFlagSchema 
} from "../../shared/schema-feature-flags.js";
import { logger } from "../lib/logger.js";

const router = Router();

/**
 * GET /api/admin/feature-flags
 * Obtener todos los feature flags
 */
router.get("/", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { db } = await import("../db.js");
    const { featureFlags } = await import("../../shared/schema-feature-flags.js");
    
    const flags = await db.query.featureFlags.findMany({
      orderBy: (flags: any, { desc }: any) => [desc(flags.createdAt)],
    });

    res.json(flags);
  } catch (error) {
    logger.error("Error obteniendo feature flags:", error);
    res.status(500).json({ error: "Error obteniendo feature flags" });
  }
});

/**
 * GET /api/admin/feature-flags/:key
 * Obtener un feature flag específico
 */
router.get("/:key", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { db } = await import("../db.js");
    const { featureFlags } = await import("../../shared/schema-feature-flags.js");
    const { eq } = await import("drizzle-orm");

    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.key, req.params.key),
    });

    if (!flag) {
      return res.status(404).json({ error: "Feature flag no encontrado" });
    }

    res.json(flag);
  } catch (error) {
    logger.error("Error obteniendo feature flag:", error);
    res.status(500).json({ error: "Error obteniendo feature flag" });
  }
});

/**
 * POST /api/admin/feature-flags
 * Crear un nuevo feature flag
 */
router.post("/", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const validated = insertFeatureFlagSchema.parse(req.body);
    const userId = (req as any).user.id;

    const flag = await featureFlagsService.upsertFlag(
      validated.key,
      validated,
      userId
    );

    res.status(201).json(flag);
  } catch (error: any) {
    logger.error("Error creando feature flag:", error);
    res.status(400).json({ error: error.message || "Error creando feature flag" });
  }
});

/**
 * PATCH /api/admin/feature-flags/:key
 * Actualizar un feature flag
 */
router.patch("/:key", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const validated = updateFeatureFlagSchema.parse(req.body);
    const userId = (req as any).user.id;

    const flag = await featureFlagsService.upsertFlag(
      req.params.key,
      validated,
      userId
    );

    res.json(flag);
  } catch (error: any) {
    logger.error("Error actualizando feature flag:", error);
    res.status(400).json({ error: error.message || "Error actualizando feature flag" });
  }
});

/**
 * POST /api/admin/feature-flags/:key/toggle
 * Toggle rápido de habilitado/deshabilitado
 */
router.post("/:key/toggle", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { db } = await import("../db.js");
    const { featureFlags } = await import("../../shared/schema-feature-flags.js");
    const { eq } = await import("drizzle-orm");
    const userId = (req as any).user.id;

    const existing = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.key, req.params.key),
    });

    if (!existing) {
      return res.status(404).json({ error: "Feature flag no encontrado" });
    }

    const flag = await featureFlagsService.upsertFlag(
      req.params.key,
      { habilitado: !existing.habilitado },
      userId
    );

    res.json(flag);
  } catch (error) {
    logger.error("Error toggling feature flag:", error);
    res.status(500).json({ error: "Error actualizando feature flag" });
  }
});

/**
 * POST /api/admin/feature-flags/:key/increment-rollout
 * Incrementar porcentaje de rollout gradual
 */
router.post("/:key/increment-rollout", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { incremento = 10 } = req.body;
    const userId = (req as any).user.id;

    const flag = await featureFlagsService.incrementGradualRollout(
      req.params.key,
      incremento,
      userId
    );

    res.json(flag);
  } catch (error: any) {
    logger.error("Error incrementando rollout:", error);
    res.status(400).json({ error: error.message || "Error incrementando rollout" });
  }
});

/**
 * GET /api/admin/feature-flags/:key/history
 * Obtener historial de cambios
 */
router.get("/:key/history", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const history = await featureFlagsService.getHistory(req.params.key);
    res.json(history);
  } catch (error: any) {
    logger.error("Error obteniendo historial:", error);
    res.status(400).json({ error: error.message || "Error obteniendo historial" });
  }
});

/**
 * GET /api/admin/feature-flags/:key/stats
 * Obtener estadísticas de uso
 */
router.get("/:key/stats", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const stats = await featureFlagsService.getStats(req.params.key, days);
    res.json(stats);
  } catch (error: any) {
    logger.error("Error obteniendo estadísticas:", error);
    res.status(400).json({ error: error.message || "Error obteniendo estadísticas" });
  }
});

/**
 * POST /api/admin/feature-flags/:key/evaluate
 * Evaluar un flag manualmente (para testing)
 */
router.post("/:key/evaluate", requireAuth, async (req: Request, res: Response) => {
  try {
    const context = {
      tenantId: req.body.tenantId || (req as any).user.tenantId,
      userId: req.body.userId || (req as any).user.id,
      ...req.body.context,
    };

    const result = await featureFlagsService.evaluate(req.params.key, context);
    res.json(result);
  } catch (error: any) {
    logger.error("Error evaluando feature flag:", error);
    res.status(400).json({ error: error.message || "Error evaluando feature flag" });
  }
});

/**
 * GET /api/feature-flags/my-flags
 * Obtener todos los flags habilitados para el usuario actual (para frontend)
 */
router.get("/my-flags", requireAuth, async (req: Request, res: Response) => {
  try {
    const context = {
      tenantId: (req as any).user.tenantId,
      userId: (req as any).user.id,
      userEmail: (req as any).user.email,
    };

    const flags = await featureFlagsService.getAllFlags(context);
    res.json({ flags });
  } catch (error) {
    logger.error("Error obteniendo flags del usuario:", error);
    res.status(500).json({ error: "Error obteniendo feature flags" });
  }
});

/**
 * POST /api/feature-flags/evaluate-bulk
 * Evaluar múltiples flags de una vez (para frontend)
 */
router.post("/evaluate-bulk", requireAuth, async (req: Request, res: Response) => {
  try {
    const { flagKeys } = req.body;
    
    if (!Array.isArray(flagKeys)) {
      return res.status(400).json({ error: "flagKeys debe ser un array" });
    }

    const context = {
      tenantId: (req as any).user.tenantId,
      userId: (req as any).user.id,
      userEmail: (req as any).user.email,
    };

    const result = await featureFlagsService.evaluateBulk(flagKeys, context);
    res.json(result);
  } catch (error) {
    logger.error("Error evaluando bulk feature flags:", error);
    res.status(500).json({ error: "Error evaluando feature flags" });
  }
});

/**
 * PHASE 2: POST /api/admin/feature-flags/:key/rollout/increment
 * Incrementa el porcentaje de rollout (canary deployment)
 */
router.post("/:key/rollout/increment", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { incremento = 10 } = req.body;
    const userId = (req as any).user.id;

    const flag = await featureFlagsService.incrementRollout(key, incremento, userId);

    res.json({
      success: true,
      message: `Rollout incrementado a ${flag.porcentajeRollout}%`,
      flag,
    });
  } catch (error) {
    logger.error("Error incrementando rollout:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * PHASE 2: GET /api/admin/feature-flags/:key/rollout
 * Obtiene el estado del rollout de un flag
 */
router.get("/:key/rollout", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const status = await featureFlagsService.getRolloutStatus(key);

    res.json({ success: true, status });
  } catch (error) {
    logger.error("Error obteniendo status de rollout:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * PHASE 2: GET /api/admin/feature-flags/rollout/active
 * Lista todos los rollouts en progreso (canary deployments activos)
 */
router.get("/rollout/active", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const rollouts = await featureFlagsService.getActiveRollouts();

    res.json({ success: true, rollouts });
  } catch (error) {
    logger.error("Error obteniendo rollouts activos:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * PHASE 2: GET /api/admin/feature-flags/:key/stats
 * Obtiene estadísticas de uso de un feature flag
 */
router.get("/:key/stats", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const days = parseInt(req.query.days as string) || 7;

    const stats = await featureFlagsService.getStats(key, days);

    res.json({ success: true, stats });
  } catch (error) {
    logger.error("Error obteniendo stats de feature flag:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * PHASE 2: GET /api/admin/feature-flags/:key/history
 * Obtiene el historial de cambios de un feature flag
 */
router.get("/:key/history", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { db } = await import("../db.js");
    const { featureFlags: ffTable, featureFlagHistory } = await import("../../shared/schema-feature-flags.js");
    const { eq, desc } = await import("drizzle-orm");

    const flag = await db.query.featureFlags.findFirst({
      where: eq(ffTable.key, req.params.key),
    });

    if (!flag) {
      return res.status(404).json({ error: "Feature flag no encontrado" });
    }

    const history = await db.query.featureFlagHistory.findMany({
      where: eq(featureFlagHistory.flagId, flag.id),
      orderBy: [desc(featureFlagHistory.createdAt)],
      limit: 50,
    });

    res.json({ success: true, history });
  } catch (error) {
    logger.error("Error obteniendo historial de feature flag:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * PHASE 2: GET /api/admin/feature-flags/dashboard/summary
 * Obtiene un resumen del dashboard de feature flags
 */
router.get("/dashboard/summary", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { db } = await import("../db.js");
    const { featureFlags: ffTable } = await import("../../shared/schema-feature-flags.js");
    
    const flags = await db.query.featureFlags.findMany();
    
    const summary = {
      totalFlags: flags.length,
      habilitados: flags.filter((f: any) => f.habilitado).length,
      deshabilitados: flags.filter((f: any) => !f.habilitado).length,
      porEstrategia: {
        boolean: flags.filter((f: any) => f.estrategia === "boolean").length,
        percentage: flags.filter((f: any) => f.estrategia === "percentage").length,
        tenants: flags.filter((f: any) => f.estrategia === "tenants").length,
        user_ids: flags.filter((f: any) => f.estrategia === "user_ids").length,
        gradual: flags.filter((f: any) => f.estrategia === "gradual").length,
      },
      rolloutesEnProgreso: flags.filter((f: any) => f.estrategia === "gradual" && f.habilitado && f.porcentajeRollout < 100).length,
    };

    res.json({ success: true, summary });
  } catch (error) {
    logger.error("Error obteniendo dashboard summary:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * PHASE 2: POST /api/admin/feature-flags/process-auto-rollouts
 * Procesa incrementos automáticos de rollout para canary deployments
 */
router.post("/process-auto-rollouts", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const result = await featureFlagsService.processAutomaticRollouts();

    res.json({
      success: true,
      message: `Procesados ${result.processed} flags, ${result.updated} actualizados`,
      result,
    });
  } catch (error) {
    logger.error("Error procesando auto rollouts:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
